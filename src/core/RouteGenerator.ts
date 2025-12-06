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
  private importSet: Set<string> = new Set();

  /**
   * Converts a FileData-like tree into React Router routes
   * @param files - Array of file/folder objects passed externally
   * @param parentPath - Current path for recursion
   */
  private fileDataToRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false
  ): RouteConfig[] {
    const routes: RouteConfig[] = [];

    const normalizeSegment = (name: string) =>
      name.replace(/\[([^\]]+)\]/g, ":$1").toLowerCase();

    const toPascal = (str: string) =>
      str
        .replace(/\[|\]/g, "")
        .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, "").toUpperCase());

    const getImportName = (file: FileNode, parentPath: string) => {
      const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
      if (nameWithoutExt.toLowerCase() === "index" && parentPath) {
        // Use parent folder prefix for nested index
        const segments = parentPath.split("/").filter(Boolean);
        return toPascal(segments.join("")) + "Index";
      }
      return toPascal(nameWithoutExt);
    };

    for (const file of files) {
      if (file.isDirectory) {
        const layout = file.children?.find(
          (f) => !f.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
        );

        const route: RouteConfig = {
          path: normalizeSegment(file.name),
        };

        if (layout) {
          const importName = `${toPascal(file.name)}Layout`;
          const importPath = `./${layout.relative_path.replace(
            /^src[\/\\]/,
            ""
          )}`;
          if (!this.importSet.has(layout.relative_path)) {
            this.topLevelImports.push(
              `import ${importName} from '${importPath}';`
            );
            this.importSet.add(layout.relative_path);
          }
          route.element = `React.createElement(${importName})`;
        }

        if (file.children?.length) {
          const children = file.children.filter(
            (f) => !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
          );
          if (children.length) {
            // Pass true for isChild to make children paths relative
            route.children = this.fileDataToRoutes(children, route.path, true);
          }
        }

        routes.push(route);
      } else {
        const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
        const isIndex = nameWithoutExt.toLowerCase() === "index";

        // If child, path is relative; otherwise, top-level gets full path
        let pathSegment = isIndex ? "" : normalizeSegment(nameWithoutExt);
        if (isChild) {
          // Children always use relative paths
          pathSegment = pathSegment;
        } else {
          pathSegment = parentPath
            ? `${parentPath}/${pathSegment}`
            : pathSegment;
        }

        const importName = getImportName(file, parentPath);
;
        const importPath = `./${file.relative_path.replace(/^src[\/\\]/, "")}`;
        if (!this.importSet.has(file.relative_path)) {
          this.topLevelImports.push(
            `import ${importName} from '${importPath}';`
          );
          this.importSet.add(file.relative_path);
        }

        routes.push({
          path: pathSegment,
          element: `React.createElement(${importName})`,
        });
      }
    }

    return routes;
  }

  /**
   * Generates a React Router routes file as a string
   * @param fileData - FileData-like tree
   */
  public async generateRoutesFile(fileData: FileNode[]): Promise<string> {
    this.topLevelImports = [];
    this.importSet = new Set();

    const routes = this.fileDataToRoutes(fileData);

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

  /**
   * Generates TypeScript type definition for all route paths
   * @param fileData - FileData-like tree
   */
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
