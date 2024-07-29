export interface Stat {
  name: string;
  size: number;
  isDirectory: boolean;
  createAt: number;
  updateAt: number;
  mimeType: string;
}

export enum StoreNames {
  FILES = "Files",
  DIRECTORYS = "Directorys",
  DATA = "Data",
}

export interface IDBFile {
  id: number;
  name: string;
  directoryId: number;
  dataIds: number[];
  size: number;
  createAt: Date;
  updateAt: Date;
  mimeType: string;
}

export interface Directory {
  id: number;
  name: string;
  parentId: number | null;
  createAt: Date;
  updateAt: Date;
}

export interface Data {
  id: number;
  data: ArrayBuffer;
}

export interface FindPathResult {
  type: "file" | "directory";
  id: number;
  name: string;
  dataIds?: number[];
  [key: string]: any;
}

export interface FileDesc {
  mimeType: string;
}

export type IDBFSOption = {
  flag: Symbol;
  db: IDBDatabase;
};
