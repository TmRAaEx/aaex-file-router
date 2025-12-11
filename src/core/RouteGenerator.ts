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

  /** Convert file/folder name to route segment, replacing [slug] with :slug */
  private normalizeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, ":$1").toLowerCase();
  }

  /** Convert file/folder name to type segment, replacing [slug] with {string} */
  private normalizeTypeSegment(name: string) {
    return name.replace(/\[([^\]]+)\]/g, "{string}");
  }

  /** Convert string to PascalCase */
  private toPascal(str: string) {
    return str
      .replace(/\[|\]/g, "")
      .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, "").toUpperCase());
  }

  /** Add import statement if not already imported */
  private addImport(file: FileNode, importName: string) {
    if (!this.importSet.has(file.relative_path)) {
      const importPath = `./${file.relative_path.replace(/^src[\/\\]/, "")}`;
      this.topLevelImports.push(`import ${importName} from '${importPath}';`);
      this.importSet.add(file.relative_path);
    }
  }

  /** Generate import name with folder prefix */
  private getPrefixedName(file: FileNode, parentPath: string, suffix: string) {
    const baseName = file.name.replace(/\.[jt]sx?$/, "");

    // Only add folder prefix if file is layout or loading
    if (
      baseName.toLowerCase() === "layout" ||
      baseName.toLowerCase() === "loading"
    ) {
      let segments = parentPath.split("/").filter(Boolean).map(this.toPascal);

      if (segments.toString() === ["src", "pages"].toString()) {
        segments = ["root"];
      }
      return (
        (segments[segments.length - 1] || this.toPascal(baseName)) + suffix
      );
    }

    // For normal files, just PascalCase without suffix
    if (baseName.toLowerCase() === "index" && parentPath) {
      const segments = parentPath.split("/").filter(Boolean).map(this.toPascal);
      return segments.join("") + suffix; // optional suffix for index if needed
    }

    return this.toPascal(baseName) + suffix;
  }

  // ---------------- Route Creation ----------------

  /** Create route object for a directory (may contain layout/loading/children) */
  private createDirectoryRoute(file: FileNode, isChild: boolean): RouteConfig {
    const route: RouteConfig = { path: this.normalizeSegment(file.name) };

    const layoutFile = file.children?.find((f) =>
      /^layout\.(tsx|jsx|ts|js)$/i.test(f.name)
    );
    let layoutName: string | null = null;
    if (layoutFile) {
      layoutName = this.getPrefixedName(
        layoutFile,
        file.relative_path,
        "Layout"
      );
      this.addImport(layoutFile, layoutName);
      route.element = `React.createElement(${layoutName})`;
    }

    const loadingFile = file.children?.find((f) =>
      /^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );
    let loadingName: string | null = null;
    if (loadingFile) {
      loadingName = this.getPrefixedName(
        loadingFile,
        file.relative_path,
        "Loading"
      );
      this.addImport(loadingFile, loadingName);
    }

    const children = file.children?.filter(
      (f) =>
        !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name) &&
        !/^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );

    if (children?.length) {
      // nested = true for children
      route.children = this.fileDataToRoutes(
        children,
        route.path,
        true,
        loadingName
      );
    }

    return route;
  }

  /** Create route object for a file */
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

    const importName = this.getPrefixedName(file, parentPath, "");

    // if (!isChild) {
    //   // Top-level: static import
    //   this.addImport(file, importName);
    //   return {
    //     path: pathSegment,
    //     element: `React.createElement(${importName})`,
    //   };
    // }
    this.addImport(file, importName);
      return {
        path: pathSegment,
        element: `React.createElement(${importName})`,

    // // Nested: lazy + Suspense
    // const fallback = folderLoadingName
    //   ? `React.createElement(${folderLoadingName})`
    //   : `React.createElement('div', null, 'loading...')`;

    // return {
    //   path: pathSegment,
    //   element: `React.createElement(React.Suspense, { fallback: ${fallback} }, React.createElement(React.lazy(() => import('./${file.relative_path.replace(
    //     /^src[\/\\]/,
    //     ""
    //   )}'))))`,
    // };
  }

  // ---------------- Route Recursion ----------------
  }
  /** Recursively convert FileNode array into RouteConfig array */
  private fileDataToRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false,
    folderLoadingName: string | null = null
  ): RouteConfig[] {
    return files.map((file) =>
      file.isDirectory
        ? this.createDirectoryRoute(file, isChild) // pass isChild
        : this.createFileRoute(file, parentPath, isChild, folderLoadingName)
    );
  }

  // ---------------- TypeScript Route Type Helpers ----------------

  /** Collect all route paths for type generation */
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

  /** Build TypeScript union type string */
  private buildTypeUnion(paths: string[]): string {
    const normalized = [...new Set(paths)]
      .map((p) => p.replace(/\/+/g, "/"))
      .map((p) => (p === "" ? "/" : p))
      .sort();

    return normalized.map((p) => `  | "${p}"`).join("\n");
  }

  // ---------------- PUBLIC METHODS ----------------

  /** Generate routes.ts content */
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
    )};

export default routes;
`;
  }

  /** Generate route type file (route paths as union) */
  public generateTypesFile(fileData: FileNode[]): string {
    const paths = this.collectPaths(fileData, "");
    const union = this.buildTypeUnion(paths);

    return `// AUTO-GENERATED: DO NOT EDIT
export type FileRoutes =
${union};
`;
  }
}
