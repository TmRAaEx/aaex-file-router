
export interface FileData{
    name: string;
    parent_path: string
    relative_path: string;
    isDirectory: boolean;
    children?: FileData[]
}