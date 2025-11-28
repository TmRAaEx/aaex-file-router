import { FileData } from "./FileScanner";
import path from "path";

interface RouteConfig {
  path: string;
  element: string;
  children?: RouteConfig[];
}

export class RouteGenerator {
  // Stores static imports for top-level files (rendered immediately, not lazy-loaded)
  private topLevelImports: string[] = [];


  private clearImports():void{
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
    parentPath = ""
  ): RouteConfig[] {
    const routes: RouteConfig[] = [];
    const processedIndexes = new Set<string>();

    for (const file of fileData) {
      const isTopLevel = !parentPath;

      if (file.isDirectory && file.children && file.children.length > 0) {
        const layoutChild = file.children.find(
          (c) => !c.isDirectory && /^layout\.(tsx|jsx|ts|js)$/i.test(c.name)
        );

        // Fix: Remove 'src/' prefix properly without double slashes
        const layoutPath =
          layoutChild?.relative_path.replace(/^src\//, "./") ||
          "./layouts/DefaultLayout";
        const element = layoutChild
          ? `React.createElement(React.lazy(() => import('${layoutPath}')))`
          : `React.createElement(React.lazy(() => import('./layouts/DefaultLayout')))`;

        const childrenFiles = file.children.filter((c) => c !== layoutChild);
        const indexFile = childrenFiles.find(
          (c) => !c.isDirectory && /^index\.(tsx|jsx|ts|js)$/i.test(c.name)
        );
        const otherChildren = childrenFiles.filter((c) => c !== indexFile);

        const childrenRoutes: RouteConfig[] = [];

        if (indexFile) {
          // Fix: Proper path formatting
          const indexPath = indexFile.relative_path.replace(/^src\//, "./");
          childrenRoutes.push({
            path: "",
            element: `React.createElement(React.lazy(() => import('${indexPath}')))`,
          });
          processedIndexes.add(indexFile.relative_path);
        }

        childrenRoutes.push(
          ...this.fileDataToRoutes(
            otherChildren,
            path.join(parentPath, file.name)
          )
        );

        routes.push({
          path: file.name.toLowerCase(),
          element,
          children: childrenRoutes.length ? childrenRoutes : undefined,
        });
      } else if (!file.isDirectory) {
        const nameWithoutExt = file.name.replace(/\.[jt]sx?$/, "");
        const isIndexFile = nameWithoutExt.toLowerCase() === "index";

        if (isIndexFile && processedIndexes.has(file.relative_path)) {
          continue;
        }

        const pathSegment = isIndexFile
          ? parentPath
            ? ""
            : "/"
          : nameWithoutExt.toLowerCase();

        if (!/^layout\.(tsx|jsx|ts|js)$/i.test(file.name)) {
          if (isTopLevel) {
            const importName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
            const capitalized =
              importName[0].toUpperCase() + importName.slice(1);
            // Fix: Proper path formatting
            const filePath = file.relative_path.replace(/^src\//, "./");
            this.topLevelImports.push(
              `import ${capitalized} from '${filePath}';`
            );

            routes.push({
              path: pathSegment,
              element: `React.createElement(${capitalized})`,
            });
            if (isIndexFile) {
              processedIndexes.add(file.relative_path);
            }
          } else {
            const filePath = file.relative_path.replace(/^src\//, "./");
            routes.push({
              path: pathSegment,
              element: `React.createElement(React.lazy(() => import('${filePath}')))`,
            });
            if (isIndexFile) {
              processedIndexes.add(file.relative_path);
            }
          }
        }
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

    this.clearImports();

    const routes = this.fileDataToRoutes(fileData);

    const routesString = JSON.stringify(routes, null, 2)
      // Replace stringified lazy imports
      .replace(
        /"React\.createElement\(React\.lazy\(\(\) => import\('(.*)'\)\)\)"/g,
        "React.createElement(React.lazy(() => import('$1')))"
      )
      // Replace stringified React.createElement(ComponentName) with actual function call
      .replace(/"React\.createElement\((\w+)\)"/g, "React.createElement($1)");

    const mapString = `
import React from 'react';
${this.topLevelImports.join("\n")}
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = ${routesString};

export default routes;
`;

    return mapString;
  }
}
