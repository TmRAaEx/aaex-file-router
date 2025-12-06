import { fileURLToPath } from "url";
import { FileScanner } from "../core/FileScanner.js";
import { RouteGenerator } from "../core/RouteGenerator.js";
import path from "path";
import fs from "fs"

const __filename = fileURLToPath(import.meta.url);
const pagesDir = "/src/pages";

async function generateRoutes() {
  try {
    const scanner = new FileScanner(pagesDir);
    const fileData = await scanner.get_file_data();

    // console.log(fileData);

    console.dir(fileData,{depth:null});

    const generator = new RouteGenerator();
    const routeMap = await generator.generateRoutesFile(fileData);

    // console.log("Route map: ", routeMap)

    // const routType = await generator.generateRoutesTypeDef(fileData);

    // console.log(routeMap);

    fs.writeFile("./src/test/output.ts",routeMap,"utf-8",(err)=>{
      if (err) {
        console.log(err);
        
      }
    })
  } catch (error) {
    console.error("Error generating routes:", error);
  }
}

generateRoutes();
