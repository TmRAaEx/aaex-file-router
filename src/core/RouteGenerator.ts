interface RouteConfig {
  path: string;
  element?: string;
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
  private importSet: Set<string> = new Set(); // avoids duplicate imports

  // ---------------- Helpers ----------------

  /** Converts filenames/folders to URL-friendly paths, e.g., [id] -> :id */
  private normalizeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, ":$1").toLowerCase();
  }

  /** Converts string to PascalCase for React component names */
  private toPascal(str: string) {
    return str
      .replace(/\[|\]/g, "")
      .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, "").toUpperCase());
  }

  /** Adds import statement for codegen, avoiding duplicates */
  private addImport(file: FileNode, importName: string) {
    if (!this.importSet.has(file.relative_path)) {
      const importPath = `./${file.relative_path.replace(/^src[\/\\]/, "")}`;
      this.topLevelImports.push(`import ${importName} from '${importPath}';`);
      this.importSet.add(file.relative_path);
    }
  }

  /** Generates PascalCase import name, handles nested index files */
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

    // Use layout if present
    const layout = file.children?.find(
      (f) => !f.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
    );
    if (layout) {
      const importName = `${this.toPascal(file.name)}Layout`;
      this.addImport(layout, importName);
      route.element = `React.createElement(${importName})`;
    }

    // Recursively add children routes
    if (file.children?.length) {
      const children = file.children.filter(
        (f) => !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
      );
      if (children.length) {
        route.children = this.fileDataToRoutes(children, route.path, true);
      }
    }

    return route;
  }

  private createFileRoute(
    file: FileNode,
    parentPath: string,
    isChild: boolean
  ): RouteConfig {
    const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
    const isIndex = nameWithoutExt.toLowerCase() === "index";

    let pathSegment = isIndex ? "" : this.normalizeSegment(nameWithoutExt);
    if (!isChild && parentPath) pathSegment = `${parentPath}/${pathSegment}`;

    const importName = this.getImportName(file, parentPath);
    this.addImport(file, importName);

    return { path: pathSegment, element: `React.createElement(${importName})` };
  }

  // ---------------- Recursion ----------------

  /** Converts file tree to nested RouteConfig array */
  private fileDataToRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false
  ): RouteConfig[] {
    return files.map((file) =>
      file.isDirectory
        ? this.createDirectoryRoute(file)
        : this.createFileRoute(file, parentPath, isChild)
    );
  }

  // ---------------- Code Generation ----------------

  /** Generates a TypeScript routes file as a string */
  public async generateRoutesFile(fileData: FileNode[]): Promise<string> {
    this.topLevelImports = [];
    this.importSet.clear();

    const routes = this.fileDataToRoutes(fileData);

    // Replace quotes around element strings with actual React code
    const routesString = JSON.stringify(routes, null, 2).replace(
      /"React\.createElement\((\w+)\)"/g,
      "React.createElement($1)"
    );

    return `//* AUTO GENERATED: DO NOT EDIT
import React from 'react';
${this.topLevelImports.join("\n")}
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = ${routesString};

export default routes;
`;
  }

  /** Generates a TypeScript union type for all routes */
  public async generateRoutesTypeDef(fileData: FileNode[]): Promise<string> {
    const routes = this.fileDataToRoutes(fileData);
    const paths: string[] = [];

    const collectPaths = (routes: RouteConfig[], parentPath = "") => {
      for (const route of routes) {
        const fullPath = parentPath
          ? `${parentPath}/${route.path}`.replace(/\/+/g, "/")
          : route.path;
        const tsPath = fullPath
          .split("/")
          .map((seg) => (seg.startsWith(":") ? "${string}" : seg))
          .join("/");
        paths.push(tsPath);
        if (route.children) collectPaths(route.children, fullPath);
      }
    };

    collectPaths(routes);

    const uniquePaths = Array.from(new Set(paths))
      .map((p) => `\`${p}\``)
      .join(" | ");

    return `// * AUTO GENERATED: DO NOT EDIT

export type FileRoutes = ${uniquePaths};
`;
  }
}
