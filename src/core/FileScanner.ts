import { Dirent, promises as fs } from "node:fs";
import path from "path";

export interface FileData {
  name: string;
  relative_path: string;
  parent_path: string;
  isDirectory: boolean;
  children?: FileData[];
}

export class FileScanner {
  page_dir: string;

  constructor(pages_dir: string) {
    this.page_dir = pages_dir;
  }

  /**
   * Recursively scan directory and return nested FileData
   */
  private async scan_files(dir: string): Promise<FileData[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result: FileData[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
      const parentPath = path.relative(process.cwd(), dir).replace(/\\/g, "/") + "/";

      const fileData: FileData = {
        name: entry.name,
        relative_path: relativePath,
        parent_path: parentPath,
        isDirectory: entry.isDirectory(),
      };

      if (entry.isDirectory()) {
        fileData.children = await this.scan_files(fullPath);
      }

      result.push(fileData);
    }

    return result;
  }

  /**
   * Public entry point: returns nested FileData structure
   */
  public async get_file_data(): Promise<FileData[]> {
    const fullDir = path.join(process.cwd(), this.page_dir);
    const data = await this.scan_files(fullDir);
    return data;
  }
}
