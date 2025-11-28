import { Dirent, promises as fs } from "fs";
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
  topLevelImports: string[] = [];

  constructor(pages_dir: string) {
    this.page_dir = pages_dir;
  }

  /**
   * Recursively scan directory and flatten all files/folders
   * Adds a parentPath property to each entry to track hierarchy
   */
  private async scan_files(dir: string): Promise<Dirent[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let result: Dirent[] = [];

    for (const entry of entries) {
      // Store parent directory path for later reference
      (entry as any).parentPath = dir;
      result.push(entry);

      // Recursively scan subdirectories and flatten results
      if (entry.isDirectory()) {
        const subFiles = await this.scan_files(path.join(dir, entry.name));
        result = result.concat(subFiles);
      }
    }

    return result;
  }

  /**
   * Convert flat Dirent array into nested FileData structure
   * Rebuilds directory hierarchy and filters children by parent path
   */
  private async build_file_data(files: Dirent[]): Promise<FileData[]> {
    const result: FileData[] = [];

    for (const file of files) {
      const fullpath = path.join((file as any).parentPath, file.name);
      
      // Convert backslashes to forward slashes for cross-platform path consistency
      const relative = path
        .relative(process.cwd(), fullpath)
        .replace(/\\/g, "/")
        .trim();

      if (file.isDirectory()) {
        // Filter files to find only direct children of this directory
        const children = files.filter(
          (file) => (file as any).parentPath === fullpath
        );

        result.push({
          name: file.name,
          parent_path:
            // Normalize parent path with forward slashes and trailing slash
            path
              .relative(process.cwd(), (file as any).parentPath)
              .replace(/\\/g, "/") + "/",
          relative_path: relative,
          isDirectory: true,
          children: await this.build_file_data(children),
        });
        continue;
      }

      result.push({
        name: file.name,
        parent_path:
          // Normalize parent path with forward slashes and trailing slash
          path
            .relative(process.cwd(), (file as any).parentPath)
            .replace(/\\/g, "/") + "/",
        relative_path: relative,
        isDirectory: false,
      });
    }

    return result;
  }

  /**
   * Public entry point: scans pages directory and returns nested FileData structure
   * Handles both flat scanning and hierarchical rebuilding
   */
  public async get_file_data(): Promise<FileData[]> {
    const raw = await this.scan_files(path.join(process.cwd(), this.page_dir));
    const result: FileData[] = await this.build_file_data(raw);
    return result;
  }
}

