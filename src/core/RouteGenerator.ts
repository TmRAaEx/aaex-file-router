import { FileData } from "./FileScanner";
// import path from "path";

interface RouteConfig {
  path: string;
  element: string;
  children?: RouteConfig[];
}

export class RouteGenerator {
  private topLevelImports: string[] = [];
  private importSet: Set<string> = new Set();
  private processedFiles: Set<string> = new Set();

  /**
   * Recursively converts FileData tree into React Router RouteConfig array
   * Handles layout files, index files, and nested routes with proper pathing
   * @param fileData - Array of files/folders to process
   * @param parentPath - Current path context for nested routes (empty for root)
   */
  private fileDataToRoutes(
    fileData: FileData[],
    parentPath = "",
    flattenPrefix = "",
    inGroup = false
  ): RouteConfig[] {
    const routes: RouteConfig[] = [];
    const processedIndexes = new Set<string>();

    /** Converts `[slug]` → `:slug` */
    const normalizeDynamicSegment = (name: string) =>
      name.replace(/\[([^\]]+)\]/g, ":$1");

    /**
     * Utility function to safely join path segments
     * - Filters out empty/falsy parts to avoid "///" in paths
     * - Joins with "/" separator
     * - Replaces all backslashes with forward slashes for cross-platform consistency
     * Example: posixJoin("test", "", "hello") -> "test/hello"
     * Example: posixJoin("pages\\test", "hello") -> "pages/test/hello"
     */
    const posixJoin = (...parts: string[]) =>
      parts.filter(Boolean).join("/").replace(/\\/g, "/");

    /** Converts "user", "[id]" → "User", "Id" */
    const toPascal = (str: string) =>
      str
        .replace(/\[|\]/g, "")
        .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, "").toUpperCase());

    /** Build import name from parent folder + file */
    const getImportName = (file: FileData) => {
      const segments = file.relative_path.replace(/^src[\/\\]/, "").split("/");
      const parentFolder =
        segments.length > 1 ? segments[segments.length - 2] : "";
      const parentName = parentFolder ? toPascal(parentFolder) : "";
      const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
      const fileNamePart =
        nameWithoutExt.toLowerCase() === "index"
          ? ""
          : toPascal(nameWithoutExt);
      return `${parentName}${fileNamePart}`;
    };

    /** Create route object (handles lazy vs top-level import) */
    const createRoute = (
      file: FileData,
      path: string,
      importName?: string,
      lazy = false
    ): RouteConfig => {
      const filePath = file.relative_path.replace(/^src[\/\\]/, "./");
      const element = lazy
        ? `React.createElement(React.lazy(() => import('${filePath}')))`
        : `React.createElement(${importName})`;
      return { path: normalizeDynamicSegment(path), element };
    };

    /** Recursive processing */
    const processFile = (
      file: FileData,
      currentParentPath: string,
      currentFlatten: string,
      group: boolean
    ) => {
      if (!file.isDirectory && this.processedFiles.has(file.relative_path))
        return;

      if (file.isDirectory && file.children?.length) {
        const layoutFile = file.children.find(
          (c) => !c.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(c.name)
        );

        if (!layoutFile) {
          const newFlatten = posixJoin(currentFlatten, file.name.toLowerCase());
          routes.push(
            ...this.fileDataToRoutes(
              file.children,
              currentParentPath,
              newFlatten,
              false
            )
          );
          return;
        }

        const layoutImportName = "TestLayout";
        const layoutPath = layoutFile.relative_path.replace(/^src[\/\\]/, "./");
        this.topLevelImports.push(
          `import ${layoutImportName} from '${layoutPath}';`
        );
        this.processedFiles.add(layoutFile.relative_path);

        const childRoutes: RouteConfig[] = [];
        for (const child of file.children.filter(
          (c) => !/^layout\.(tsx|jsx|ts|js)$/i.test(c.name)
        )) {
          if (child.isDirectory) {
            processFile(
              child,
              posixJoin(currentParentPath, file.name),
              "",
              true
            );
          } else {
            const childNameWithoutExt = child.name.replace(/\.[jt]sx?$/, "");
            const path =
              childNameWithoutExt.toLowerCase() === "index"
                ? ""
                : normalizeDynamicSegment(childNameWithoutExt.toLowerCase());
            childRoutes.push(createRoute(child, path, undefined, true));
            this.processedFiles.add(child.relative_path);
          }
        }

        routes.push({
          path: normalizeDynamicSegment(file.name.toLowerCase()),
          element: `React.createElement(${layoutImportName})`,
          children: childRoutes.length ? childRoutes : undefined,
        });

        return;
      }

      // ---------------- FILES ----------------
      const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
      const isIndex = nameWithoutExt.toLowerCase() === "index";

      if (isIndex && processedIndexes.has(file.relative_path)) return;

      if (
        fileData.some(
          (f) =>
            f.isDirectory &&
            f.name.toLowerCase() === nameWithoutExt.toLowerCase()
        ) ||
        /^layout\.(tsx|jsx|ts|js)$/i.test(file.name)
      ) {
        this.processedFiles.add(file.relative_path);
        return;
      }

      const rawSegment = isIndex ? "" : nameWithoutExt.toLowerCase();
      const fileSegment = normalizeDynamicSegment(rawSegment);

      let fullPath: string;
      if (currentFlatten) fullPath = posixJoin(currentFlatten, fileSegment);
      else if (group) fullPath = fileSegment;
      else if (currentParentPath)
        fullPath = posixJoin(currentParentPath, fileSegment);
      else fullPath = isIndex ? "/" : fileSegment;

      const importName = getImportName(file);

      if (group) routes.push(createRoute(file, fullPath, undefined, true));
      else {
        if (!this.importSet.has(file.relative_path)) {
          this.topLevelImports.push(
            `import ${importName} from './${file.relative_path.replace(
              /^src[\/\\]/,
              ""
            )}';`
          );
          this.importSet.add(file.relative_path);
        }
        routes.push(createRoute(file, fullPath, importName));
      }

      this.processedFiles.add(file.relative_path);
      if (isIndex) processedIndexes.add(file.relative_path);
    };

    for (const file of fileData)
      processFile(file, parentPath, flattenPrefix, inGroup);

    return routes;
  }

  /**
   * Generates a complete routes configuration file as a string
   * Includes all imports and route definitions in valid TypeScript/React code
   * @param fileData - FileData tree from FileScanner
   * @returns Complete routes file content ready to be written to disk
   */
  public async generateComponentsMap(fileData: FileData[]): Promise<string> {
    // reset import & processed tracking each generation to avoid duplication across regen
    this.topLevelImports = [];
    this.importSet = new Set();
    this.processedFiles = new Set();

    const routes = this.fileDataToRoutes(fileData);

    const routesString = JSON.stringify(routes, null, 2)
      // lazy imports were serialized as strings, restore them to function calls
      .replace(
        /"React\.createElement\(React\.lazy\(\(\) => import\('(.*)'\)\)\)"/g,
        "React.createElement(React.lazy(() => import('$1')))"
      )
      // React.createElement(Component) serialized as string, unquote it
      .replace(/"React\.createElement\((\w+)\)"/g, "React.createElement($1)");

    const mapString = `//* AUTO GENERATED: DO NOT EDIT
import React from 'react';
${this.topLevelImports.join("\n")}
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = ${routesString};

export default routes;
`;

    return mapString;
  }

  /**
   * Generates a TypeScript definition file exporting a union type of all route paths
   * @param fileData - FileData tree from FileScanner
   * @returns Type definition file content as string
   */
  public async generateRoutesTypeDef(fileData: FileData[]): Promise<string> {
    // Reset state
    this.topLevelImports = [];
    this.importSet = new Set();
    this.processedFiles = new Set();

    const routes = this.fileDataToRoutes(fileData);

    const routePaths: string[] = [];

    const addRoute = (route: any, parentPath = "") => {
      const fullPath = parentPath
        ? `${parentPath}/${route.path}`.replace(/\/+/g, "/")
        : route.path;

      // Replace ":param" with ${string} for TypeScript type
      const tsPath = fullPath
        .split("/")
        .map((seg: string) => (seg.startsWith(":") ? "${string}" : seg))
        .join("/");

      routePaths.push(tsPath);

      if (route.children?.length) {
        route.children.forEach((child: string) => addRoute(child, fullPath));
      }
    };

    routes.forEach((route) => addRoute(route));

    const uniquePaths = Array.from(new Set(routePaths))
      .map((p) => `\`${p}\``) // wrap in backticks for template literal types
      .join(" | ");

    return `// * AUTO GENERATED: DO NOT EDIT

export type FileRoutes = ${uniquePaths};
`;
  }
}
