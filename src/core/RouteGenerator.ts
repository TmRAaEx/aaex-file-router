interface RouteConfig {
  path: string;
  element?: any; // now actual React elements
  children?: RouteConfig[];
}

interface FileNode {
  name: string;
  relative_path: string;
  parent_path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export class RouteGenerator {
  private topLevelImports: string[] = [];
  private importSet: Set<string> = new Set(); // avoid duplicate imports

  // ---------------- Helpers ----------------
  private normalizeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, ":$1").toLowerCase();
  }

  private toPascal(str: string) {
    return str
      .replace(/\[|\]/g, "")
      .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, "").toUpperCase());
  }

  private addImport(file: FileNode, importName: string) {
    if (!this.importSet.has(file.relative_path)) {
      const importPath = `./${file.relative_path.replace(/^src[\/\\]/, "")}`;
      this.topLevelImports.push(`import ${importName} from '${importPath}';`);
      this.importSet.add(file.relative_path);
    }
  }

  private getImportName(file: FileNode, parentPath: string) {
    const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
    if (nameWithoutExt.toLowerCase() === "index" && parentPath) {
      const segments = parentPath.split("/").filter(Boolean);
      return this.toPascal(segments.join("")) + "Index";
    }
    return this.toPascal(nameWithoutExt);
  }

  // ---------------- Route Creation ----------------

  private createDirectoryRoute(file: FileNode): RouteConfig {
    const route: RouteConfig = { path: this.normalizeSegment(file.name) };

    // Layout component (static import)
    const layout = file.children?.find(
      (f) => !f.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
    );
    if (layout) {
      const importName = `${this.toPascal(file.name)}Layout`;
      this.addImport(layout, importName);
      route.element = `React.createElement(${importName})`;
    }

    // Folder-specific loading.tsx (static import)
    const loadingFile = file.children?.find(
      (f) => !f.isDirectory && /^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );
    let loadingName: string | null = null;
    if (loadingFile) {
      loadingName = this.getImportName(loadingFile, file.relative_path);
      this.addImport(loadingFile, loadingName);
    }

    // Children (exclude layout and loading)
    if (file.children?.length) {
      const children = file.children.filter(
        (f) =>
          !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name) &&
          !/^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
      );
      if (children.length) {
        route.children = this.fileDataToRoutes(
          children,
          route.path,
          true,
          loadingName
        );
      }
    }

    return route;
  }

  private createFileRoute(
    file: FileNode,
    parentPath: string,
    isChild: boolean,
    folderLoadingName: string | null = null
  ): RouteConfig {
    const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
    const isIndex = nameWithoutExt.toLowerCase() === "index";

    let pathSegment = isIndex ? "" : this.normalizeSegment(nameWithoutExt);
    if (!isChild && parentPath) pathSegment = `${parentPath}/${pathSegment}`;

    const importName = this.getImportName(file, parentPath);
    this.addImport(file, importName);

    // Lazy + Suspense as string
    const fallback = folderLoadingName
      ? `React.createElement(${folderLoadingName})`
      : `<div>Loading...</div>`;

    const elementString = `React.createElement(React.Suspense, { fallback: ${fallback} }, React.createElement(React.lazy(() => import('./${file.relative_path.replace(
      /^src[\/\\]/,
      ""
    )}'))))`;

    return {
      path: pathSegment,
      element: elementString,
    };
  }

  // ---------------- Recursion ----------------

  private fileDataToRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false,
    folderLoadingName: string | null = null
  ): RouteConfig[] {
    return files.map((file) =>
      file.isDirectory
        ? this.createDirectoryRoute(file)
        : this.createFileRoute(file, parentPath, isChild, folderLoadingName)
    );
  }

  // ---------------- Code Generation ----------------

  public async generateRoutesFile(fileData: FileNode[]): Promise<string> {
    this.topLevelImports = [];
    this.importSet.clear();

    const routes = this.fileDataToRoutes(fileData);

    return `//* AUTO GENERATED: DO NOT EDIT
import React from 'react';
${this.topLevelImports.join("\n")}
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = ${JSON.stringify(routes, null, 2).replace(
      /"React\.createElement\(([^)]+)\)"/g,
      "React.createElement($1)"
    )};


export default routes;
`;
  }
}
