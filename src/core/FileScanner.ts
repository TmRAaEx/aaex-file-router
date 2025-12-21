  import { promises as fs } from "node:fs";
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
     * - Scans files of a given folder
     * - converts and returns as usable data
     * - Format:
     * {name: string,
     * relative_path: string,
     * parent_path: string,
     * isDirectory: string
     * }
     * @param dir string
     * @returns FileData[]
     */
    private async scan_files(dir: string): Promise<FileData[]> {
      //scans the parent folder and outputs an array of files
      const files = await fs.readdir(dir, { withFileTypes: true });
      const result: FileData[] = [];

      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path
          .relative(process.cwd(), fullPath)
          .replace(/\\/g, "/");
        const parentPath =
          path.relative(process.cwd(), dir).replace(/\\/g, "/") + "/";

        // convert to usable data
        const fileData: FileData = {
          name: file.name,
          relative_path: relativePath,
          parent_path: parentPath,
          isDirectory: file.isDirectory(),
        };
        //recurivly scan directories for more files
        if (file.isDirectory()) {
          fileData.children = await this.scan_files(fullPath);
        }

        result.push(fileData);
      }

      return result;
    }

    /**
     * Public file point: returns nested FileData structure
     */
    public async get_file_data(): Promise<FileData[]> {
      const fullDir = path.join(process.cwd(), this.page_dir);
      const data = await this.scan_files(fullDir);
      return data;
    }
  }
