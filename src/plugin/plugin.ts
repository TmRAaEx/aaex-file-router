import { Plugin } from "vite";
import { promises as fs } from "node:fs";
import path from "path";
import { FileScanner } from "../core/FileScanner.js";
import { RouteGenerator } from "../core/RouteGenerator.js";

export interface VitePluginOptions {
  pagesDir?: string;
  outputFile?: string;
}

/**
 * Vite plugin that auto-generates routes when page files change
 * Watches the pages directory and regenerates routes.ts on file create/delete
 */
export function aaexFileRouter(options: VitePluginOptions = {}): Plugin {
  const pagesDir = options.pagesDir || "./src/pages";
  const outputFile = options.outputFile || "./src/routes.ts";

  let scanner: FileScanner;
  let generator: RouteGenerator;

  return {
    name: "aaex-file-router",
    apply: "serve", // Only run in dev mode

    configResolved() {
      scanner = new FileScanner(pagesDir);
      generator = new RouteGenerator();
    },

    async configureServer(server) {
      // Watch the pages directory for changes
      server.watcher.add(path.resolve(process.cwd(), pagesDir));

      server.watcher.on("all", async (event, filePath) => {
        // Only regenerate on file add/unlink events
        if (event === "add" || event === "unlink") {
          try {
            console.log(`📄 [aaex-file-router] ${event}: ${filePath}`);

            // Regenerate routes
            scanner = new FileScanner(pagesDir);
            generator = new RouteGenerator();

            const fileData = await scanner.get_file_data();
            const routesCode = generator.generateRoutesFile(fileData);
            const routesType = generator.generateTypesFile(fileData);

            // Write routes file
            await fs.writeFile(outputFile, routesCode, "utf-8");
            await fs.writeFile("src/routeTypes.ts", routesType, "utf-8");

            console.log(
              `✅ [aaex-file-router] Routes regenerated at ${outputFile}`
            );
          } catch (error) {
            console.error(
              "❌ [aaex-file-router] Error regenerating routes:",
              error
            );
          }
        }
      });
    },
  };
}
