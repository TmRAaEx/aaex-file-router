import { fileURLToPath } from "url";
import { FileScanner } from "../core/FileScanner.js";
import { RouteGenerator } from "../core/RouteGenerator.js";
import { promises as fs } from "fs";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = "/src/pages";

async function generateRoutes() {
  try {
    const scanner = new FileScanner(pagesDir);
    const fileData = await scanner.get_file_data();

    const generator = new RouteGenerator();
    const routeMap = await generator.generateComponentsMap(fileData);


    console.log("Route map: ", routeMap)

    const routType = generator.generateRoutesTypeDef(fileData);

    console.log(routType);
    

  } catch (error) {
    console.error("Error generating routes:", error);
  }
}

generateRoutes();