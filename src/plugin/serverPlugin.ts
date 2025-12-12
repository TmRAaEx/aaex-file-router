import { Plugin } from "vite";
import { promises as fs } from "node:fs";
import path from "path";
import { FileScanner } from "../core/FileScanner.js";
import { RouteGenerator } from "../core/RouteGenerator.js";

export interface ViteServerPluginOptions {
  pagesDir?: string;
  clientOutputFile?: string;
  serverOutputFile?: string;
}

/**
 * Compute a relative import path between two locations.
 * Ensures clean POSIX-style paths and proper "./" or "../" prefixes.
 */
function getRelativeImportPath(fromFile: string, toDir: string) {
  // Relative path from the generated file → target directory
  let rel = path.relative(path.dirname(fromFile), toDir);

  // Convert backslashes to slashes (Windows fix)
  rel = rel.replace(/\\/g, "/");

  // Ensure valid import path prefix
  if (!rel.startsWith(".")) rel = "./" + rel;

  return rel;
}

/**
 * Vite plugin that auto-generates server + client route files
 * whenever files change in the pages directory.
 */
export function aaexServerRouter(
  options: ViteServerPluginOptions = {}
): Plugin {
  const pagesDir = options.pagesDir || "./src/pages";
  const clientOutputFile = options.clientOutputFile || "./src/client-routes.ts";
  const serverOutputFile = options.serverOutputFile || "./src/server-routes.ts";

  let scanner: FileScanner;
  let generator: RouteGenerator;

  return {
    name: "aaex-server-router",
    apply: "serve", // Only run in dev mode

    configResolved() {
      scanner = new FileScanner(pagesDir);
      generator = new RouteGenerator();
    },

    async configureServer(server) {
      // Convert to absolute paths
      const pagesAbs = path.resolve(process.cwd(), pagesDir);
      const clientOutputAbs = path.resolve(process.cwd(), clientOutputFile);
      const serverOutputAbs = path.resolve(process.cwd(), serverOutputFile);

      // Watch the pages directory for changes
      server.watcher.add(pagesAbs);

      server.watcher.on("all", async (event, filePath) => {
        // Only regenerate on add/delete
        if (event === "add" || event === "unlink") {
          try {
            // Re-scan and regenerate route info
            scanner = new FileScanner(pagesDir);
            generator = new RouteGenerator();

            const fileData = await scanner.get_file_data();

    
            // Generate files using the relative paths
            const routesCode = generator.generateRoutesFile(fileData);

            const serverRoutesCode =
              generator.generateServerRoutesFile(fileData);

            const routesType = generator.generateTypesFile(fileData);

            // Write to disk
            await fs.writeFile(clientOutputAbs, routesCode, "utf-8");
            await fs.writeFile(serverOutputAbs, serverRoutesCode, "utf-8");
            await fs.writeFile("src/routeTypes.ts", routesType, "utf-8");

            console.log(
              `[aaex-server-router] Routes regenerated at ${clientOutputFile} & ${serverOutputFile}`
            );
          } catch (error) {
            console.error(
              "[aaex-server-router] Error regenerating routes:",
              error
            );
          }
        }
      });
    },
  };
}
