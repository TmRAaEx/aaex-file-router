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

async function regenerateRoutes(pagesDir: string, serverOutputAbs: string) {
  const scanner = new FileScanner(pagesDir);
  const generator = new RouteGenerator();

  const fileData = await scanner.get_file_data();
  const serverRoutesCode = generator.generateServerRoutesFile(fileData);
  const routesType = generator.generateTypesFile(fileData);

  await fs.writeFile(serverOutputAbs, serverRoutesCode, "utf-8");
  await fs.writeFile("src/routeTypes.ts", routesType, "utf-8");

  console.log("[aaex-server-router] Routes generated");
}

/**
 * Vite plugin that auto-generates server + client route files
 * whenever files change in the pages directory.
 */
export function aaexServerRouter(
  options: ViteServerPluginOptions = {}
): Plugin {
  const pagesDir = options.pagesDir || "./src/pages";
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
      const pagesAbs = path.resolve(process.cwd(), pagesDir);
      const serverOutputAbs = path.resolve(process.cwd(), serverOutputFile);

      //run on server start
      await regenerateRoutes(pagesDir, serverOutputAbs);

      // Regenerate when files are changed
      server.watcher.add(pagesAbs);

      server.watcher.on("all", async (event) => {
        if (event === "add" || event === "unlink") {
          await regenerateRoutes(pagesDir, serverOutputAbs);
        }
      });
    },
  };
}
