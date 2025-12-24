import path from "path";

interface RouteConfig {
  path: string;
  element?: any;
  children?: RouteConfig[];
}

interface ServerRouteConfig extends RouteConfig {
  modulePath?: string;
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
    if (name.toLowerCase() === "404") return "*"; //makes 404 catch all
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
    if (importName === "404") {
      importName = "NotFound";
    }
    if (!this.importSet.has(file.relative_path)) {
      const importPath = `./${file.relative_path
        .replace(/^src[\/\\]/, "")
        .replace(/\.[jt]sx?$/, "")}`;

      this.topLevelImports.push(`import ${importName} from '${importPath}';`);
      this.importSet.add(file.relative_path);
    }
  }

  /** Generate import name with folder prefix */
  private getPrefixedName(file: FileNode, parentPath: string, suffix: string) {
    const baseName = file.name
      .replace(/\.[jt]sx?$/, "")
      .replace("404", "NotFound");

    // Only add folder prefix if file is layout, loading or 404
    if (
      baseName.toLowerCase() === "layout" ||
      baseName.toLowerCase() === "loading" 
      // baseName.toLowerCase() === "notfound"
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

  /** Checks if a layout file exists root level*/
  private findRootLayout(files: FileNode[]): FileNode | null {
    return (
      files.find(
        (file) =>
          !file.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(file.name)
      ) ?? null
    );
  }

  // ---------------- Route Creation ----------------

  /** Create route object for a directory (may contain layout/loading/children) */
  private createDirectoryRoute(file: FileNode, isChild: boolean): RouteConfig {
    const route: ServerRouteConfig = { path: this.normalizeSegment(file.name) };

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

    this.addImport(file, importName);
    return {
      path: pathSegment,
      element: `React.createElement(${importName})`,
    };

    // ---------------- Route Recursion ----------------
  }
  /** Recursively convert FileNode array into RouteConfig array */
  private fileDataToRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false,
    folderLoadingName: string | null = null
  ): RouteConfig[] {
    const routes = files.map((file) =>
      file.isDirectory
        ? this.createDirectoryRoute(file, isChild) // pass isChild
        : this.createFileRoute(file, parentPath, isChild, folderLoadingName)
    );

    return routes.sort((a, b) => {
      // not found last
      if (a.path === "*") return 1;
      if (b.path === "*") return -1;
      //index first
      if (a.path === "") return -1;
      if (a.path === "") return 1;
      //rest
      return 0;
    });
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
        if (clean === "layout" || clean === "loading" || clean === "404")
          continue;

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

  /** ---------------- Server specific functions for AaExJS ---------------- */

  private createServerDirectoryRoute(file: FileNode, isChild: boolean) {
    const route: ServerRouteConfig = { path: this.normalizeSegment(file.name) };

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
      route.modulePath = path
        .resolve(process.cwd(), layoutFile.relative_path)
        .replace(/\\/g, "/");
    }

    const children = file.children?.filter(
      (f) =>
        !/^layout\.(tsx|jsx|ts|js)$/i.test(f.name) &&
        !/^loading\.(tsx|jsx|ts|js)$/i.test(f.name)
    );

    if (children?.length) {
      // nested = true for children

      route.children = this.fileDataToServerRoutes(children, route.path, true);
    }

    return route;
  }

  /** Creates server route with the module path included */
  private createServerFileRoute(
    file: FileNode,
    parentPath: string,
    isChild: boolean
  ): ServerRouteConfig {
    const fileName = file.name;

    // Build route path
    const nameWithoutExt = fileName.replace(/\.[jt]sx?$/, "");
    const isIndex = nameWithoutExt.toLowerCase() === "index";
    // const isRootLayout = nameWithoutExt.toLowerCase() === "rootlayout"

    let pathSegment = isIndex ? "" : this.normalizeSegment(nameWithoutExt);
    if (!isChild && parentPath) {
      pathSegment = `${parentPath}/${pathSegment}`;
    }

    // Get import identifier
    const importName = this.getPrefixedName(file, parentPath, "");

    // Static import for server
    this.addImport(file, importName);

    // Create ABSOLUTE FILE PATH
    //
    // Example:
    // projectRoot = /Users/me/myapp
    // file.relative_path = src/pages/test/index.tsx
    //
    // → /Users/me/myapp/src/pages/test/index.tsx
    const absolutePath = path.resolve(process.cwd(), file.relative_path);

    // Normalize for Node ESM (Windows requires forward slashes)
    const normalizedAbsolutePath = absolutePath.replace(/\\/g, "/");

    return {
      path: pathSegment,
      element: `React.createElement(${importName})`,
      modulePath: normalizedAbsolutePath,
    };
  }

  /**Builds routes usable by vite ssr to extend functionality */
  private fileDataToServerRoutes(
    files: FileNode[],
    parentPath = "",
    isChild = false
  ): ServerRouteConfig[] {
    const routes = files.map((file) => {
      return file.isDirectory
        ? this.createServerDirectoryRoute(file, isChild)
        : this.createServerFileRoute(file, parentPath, isChild);
    });

    return routes.sort((a, b) => {
      // not found last
      if (a.path === "*") return 1;
      if (b.path === "*") return -1;
      //index first
      if (a.path === "") return -1;
      if (a.path === "") return 1;
      //rest
      return 0;
    });
  }

  public generateServerRoutesFile(fileData: FileNode[]): string {
    this.topLevelImports = [];
    this.importSet.clear();

    const rootLayout = this.findRootLayout(fileData);

    //remove root layout from routes
    const withOutLayout = fileData.filter((f) => f !== rootLayout);

    let routes = this.fileDataToServerRoutes(withOutLayout);

    if (rootLayout) {
      const importName = "RootLayout";
      const restOfRoutes = routes;

      this.addImport(rootLayout, importName);

      routes = [
        {
          path: "",
          element: `React.createElement(${importName})`,
          modulePath: path
            .resolve(process.cwd(), rootLayout.relative_path)
            .replace(/\\/g, "/"),
          children: restOfRoutes,
        },
      ];
    }

    return `//* AUTO GENERATED: DO NOT EDIT
import React from 'react';
${this.topLevelImports.join("\n")}


const serverRoutes: any[] = ${JSON.stringify(routes, null, 2).replace(
      /"React\.createElement\(([\s\S]*?)\)"/g,
      (_, inner) => `${inner}`
    )};

export default serverRoutes;
`;
  }

  // ---------------- PUBLIC METHODS ----------------

  /** Generate routes.ts content */
  public generateRoutesFile(fileData: FileNode[]): string {
    this.topLevelImports = [];
    this.importSet.clear();

    const rootLayout = this.findRootLayout(fileData);

    //remove root layout from routes
    const withOutLayout = fileData.filter((f) => f !== rootLayout);

    let routes = this.fileDataToServerRoutes(withOutLayout);

    if (rootLayout) {
      const importName = "RootLayout";
      const restOfRoutes = routes;

      this.addImport(rootLayout, importName);

      routes = [
        {
          path: "",
          element: `React.createElement(${importName})`,
          children: restOfRoutes,
        },
      ];
    }

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
