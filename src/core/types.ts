
export interface FileData{
    name: string;
    relative_path: string;
    isDirectory: boolean;
    children?: FileData[]
}