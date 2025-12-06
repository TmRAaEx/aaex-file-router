interface RouteConfig {
  path: string;
  element?: any;
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
  private importSet: Set<string> = new Set();

  // ---------------- Helpers ----------------
  private normalizeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, ":$1").toLowerCase();
  }

  private normalizeTypeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, "{string}");
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

    const layout = file.children?.find((f) =>
      /^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
    );

    if (layout) {
      const importName = `${this.toPascal(file.name)}Layout`;
      this.addImport(layout, importName);
      route.element = `React.createElement(${importName})`;
    }

    const loadingFile = file.children?.find((f) =>
      /^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );

    let loadingName: string | null = null;

    if (loadingFile) {
      loadingName = this.getImportName(loadingFile, file.relative_path);
      this.addImport(loadingFile, loadingName);
    }

    const children = file.children?.filter(
      (f) =>
        !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name) &&
        !/^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );

    if (children?.length) {
      route.children = this.fileDataToRoutes(
        children,
        route.path,
        true,
        loadingName
      );
    }

    return route;
  }

  private createFileRoute(
    file: FileNode,
    parentPath: string,
    isChild: boolean,
    folderLoadingName: string | null
  ): RouteConfig {
    const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
    const isIndex = nameWithoutExt.toLowerCase() === "index";

    let pathSegment = isIndex ? "" : this.normalizeSegment(nameWithoutExt);
    if (!isChild && parentPath) pathSegment = `${parentPath}/${pathSegment}`;

    const importName = this.getImportName(file, parentPath);
    this.addImport(file, importName);

    const fallback = folderLoadingName
      ? `React.createElement(${folderLoadingName})`
      : `React.createElement('div',null,'loading...')`;

    const elementString = `React.createElement(React.Suspense, { fallback: ${fallback} }, React.createElement(React.lazy(() => import('./${file.relative_path.replace(
      /^src[\/\\]/,
      ""
    )}'))))`;

    return { path: pathSegment, element: elementString };
  }

  // ---------------- Route Recursion ----------------
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

  // ---------------- Type Helpers ----------------
  private collectPaths(files: FileNode[], prefix = ""): string[] {
    let result: string[] = [];

    for (const file of files) {
      if (file.isDirectory) {
        const newPrefix = `${prefix}/${this.normalizeTypeSegment(file.name)}`;
        result.push(newPrefix);

        if (file.children?.length) {
          result.push(...this.collectPaths(file.children, newPrefix));
        }
      } else {
        const clean = file.name.replace(/\.[jt]sx?$/, "");

        if (clean === "layout" || clean === "loading") continue;

        if (clean === "index") {
          result.push(prefix || "/");
        } else {
          result.push(`${prefix}/${this.normalizeTypeSegment(clean)}`);
        }
      }
    }

    return result;
  }

  private buildTypeUnion(paths: string[]): string {
    const normalized = [...new Set(paths)]
      .map((p) => p.replace(/\/+/g, "/"))
      .map((p) => (p === "" ? "/" : p))
      .sort();

    return normalized.map((p) => `  | "${p}"`).join("\n");
  }

  // ---------------- PUBLIC METHODS ----------------
  public generateRoutesFile(fileData: FileNode[]): string {
    this.topLevelImports = [];
    this.importSet.clear();

    const routes = this.fileDataToRoutes(fileData);

    return `//* AUTO GENERATED: DO NOT EDIT
import React from 'react';
${this.topLevelImports.join("\n")}
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = ${JSON.stringify(routes, null, 2).replace(
      /"React\.createElement\(([\s\S]*?)\)"/g,
      (_, inner) => `React.createElement(${inner})`
    )}


export default routes;
`;
  }

  public generateTypesFile(fileData: FileNode[]): string {
    const paths = this.collectPaths(fileData, "");
    const union = this.buildTypeUnion(paths);

    return `// AUTO-GENERATED: DO NOT EDIT
export type FileRoutes =
${union};
`;
  }
}
