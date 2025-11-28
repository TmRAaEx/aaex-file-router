import { FileData } from "./FileScanner";
import path from "path";

interface RouteConfig {
  path: string;
  element: string;
  children?: RouteConfig[];
}

export class RouteGenerator {
  private topLevelImports: string[] = [];
  private importSet: Set<string> = new Set();
  private processedFiles: Set<string> = new Set();

  private clearImports(): void {
    this.topLevelImports = [];
  }
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

    for (const file of fileData) {
      // Skip files already emitted during this generation
      if (!file.isDirectory && this.processedFiles.has(file.relative_path)) {
        continue;
      }

      if (file.isDirectory && file.children && file.children.length > 0) {
        const layoutChild = file.children.find(
          (c) => !c.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(c.name)
        );

        if (!layoutChild) {
          // No layout -> flatten children into absolute routes
          const newFlatten = posixJoin(flattenPrefix, file.name.toLowerCase());
          routes.push(
            ...this.fileDataToRoutes(
              file.children,
              parentPath,
              newFlatten,
              false
            )
          );
          continue;
        }

        // Directory has layout -> import layout statically
        const layoutPath = layoutChild.relative_path.replace(
          /^src[\/\\]/,
          "./"
        );
        const layoutImportName = `TestLayout`;
        this.topLevelImports.push(
          `import ${layoutImportName} from '${layoutPath}';`
        );
        this.processedFiles.add(layoutChild.relative_path); // Mark layout as processed

        const childrenRoutes: RouteConfig[] = [];

        // Process children - filter out layout files
        const nonLayoutChildren = file.children.filter(
          (c) => !/^layout\.(tsx|jsx|ts|js)$/i.test(c.name)
        );

        for (const child of nonLayoutChildren) {
          if (child.isDirectory) {
            // Recursively handle child directories
            childrenRoutes.push(
              ...this.fileDataToRoutes(
                [child],
                posixJoin(parentPath, file.name),
                "",
                true
              )
            );
          } else {
            const childNameWithoutExt = child.name.replace(/\.[jt]sx?$/, "");
            const childPath = child.relative_path.replace(/^src[\/\\]/, "./");
            const isIndexFile = childNameWithoutExt.toLowerCase() === "index";

            if (isIndexFile) {
              childrenRoutes.push({
                path: "",
                element: `React.createElement(React.lazy(() => import('${childPath}')))`,
              });
            } else {
              childrenRoutes.push({
                path: childNameWithoutExt.toLowerCase(),
                element: `React.createElement(React.lazy(() => import('${childPath}')))`,
              });
            }
            // Mark child as processed so it doesn't get added as top-level
            this.processedFiles.add(child.relative_path);
          }
        }

        routes.push({
          path: file.name.toLowerCase(),
          element: `React.createElement(${layoutImportName})`,
          children: childrenRoutes.length ? childrenRoutes : undefined,
        });
      } else if (!file.isDirectory) {
        const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
        const isIndexFile = nameWithoutExt.toLowerCase() === "index";

        // Skip if already processed
        if (isIndexFile && processedIndexes.has(file.relative_path)) {
          continue;
        }

        // If a sibling directory with the same name exists, skip this file
        const siblingDirExists = fileData.some(
          (f) =>
            f.isDirectory &&
            f.name.toLowerCase() === nameWithoutExt.toLowerCase()
        );
        if (siblingDirExists) {
          this.processedFiles.add(file.relative_path);
          continue;
        }

        // Skip layout files
        if (/^layout\.(tsx|jsx|ts|js)$/i.test(file.name)) {
          this.processedFiles.add(file.relative_path);
          continue;
        }

        // Determine path
        const fileSegment = isIndexFile ? "" : nameWithoutExt.toLowerCase();
        let fullPath: string;
        if (flattenPrefix) {
          fullPath = posixJoin(flattenPrefix, fileSegment);
        } else if (inGroup) {
          fullPath = fileSegment;
        } else if (parentPath) {
          fullPath = posixJoin(parentPath, fileSegment);
        } else {
          fullPath = isIndexFile ? "/" : fileSegment;
        }

        // Create import & avoid duplicates
        const importNameBase = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
        const capitalized =
          importNameBase.charAt(0).toUpperCase() + importNameBase.slice(1);
        const filePath = file.relative_path.replace(/^src[\/\\]/, "./");

        if (inGroup) {
          // Lazy-load child component inside group
          routes.push({
            path: fullPath === "/" ? "" : fullPath.replace(/^\/+/, ""),
            element: `React.createElement(React.lazy(() => import('${filePath}')))`,
          });
        } else {
          // Top-level files use static imports
          if (!this.importSet.has(filePath)) {
            this.topLevelImports.push(
              `import ${capitalized} from '${filePath}';`
            );
            this.importSet.add(filePath);
          }
          routes.push({
            path: fullPath === "/" ? "/" : fullPath.replace(/^\/+/, ""),
            element: `React.createElement(${capitalized})`,
          });
        }

        this.processedFiles.add(file.relative_path);
        if (isIndexFile) processedIndexes.add(file.relative_path);
      }
    }

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
}
