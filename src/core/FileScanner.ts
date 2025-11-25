import { Dirent, promises as fs } from "fs";
import path from "path";
import { FileData } from "./types";

class FileScanner {
  page_dir: string;

  constructor(pages_dir: string) {
    this.page_dir = pages_dir;
  }

  /** Internal function that scans the provided page directory*/
  private async scan_files() {
    let page_dir = process.cwd() + this.page_dir;
    const files = fs.readdir(page_dir, {
      recursive: true,
      withFileTypes: true,
    });

    const result = await files;

    return result;
  }

  async dirent_to_object() {
    const raw = await this.scan_files();

    if (!Array.isArray(raw)) throw `Error reading files from ${this.page_dir}`;

    let files = raw.flat();

    let result: FileData[] = await this.build_file_data(files);

    return result
  }

  private async build_file_data(files: Dirent[]): Promise<FileData[]> {
    let result: FileData[] = [];
    for (let file of files) {
      let fullpath = path.join(file.parentPath, file.name);
      const relative = path.relative(process.cwd(), fullpath).trim();

      if (file.isDirectory()) {
        const subFiles = await fs.readdir(fullpath, {
          recursive: true,
          withFileTypes: true,
        });

        result.push({
          name: file.name,
          relative_path: relative,
          isDirectory: true,
          children: await this.build_file_data(subFiles),
        });

        continue;
      }

      const fileData: FileData = {
        name: file.name,
        relative_path: relative,
        isDirectory: false,
      };

      result.push(fileData);
    }

    return result;
  }

  
}


//! TEST remove after 
const scanner = new FileScanner("/src/pages");
console.log(await scanner.dirent_to_object())
