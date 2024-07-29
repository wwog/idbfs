import { FsNotFoundError } from "./error";
import {
  appendFile,
  createFile,
  createReadStream,
  createWritableStreamByIDBFile,
  findPath,
  getFile,
  getManyByIndex,
  getOneByKey,
  mkdir,
  readFile,
  rm,
  saveFile,
  writeFile,
} from "./idbMethod";
import { Path } from "./path";
import {
  Directory,
  IDBFile,
  FileDesc,
  Stat,
  StoreNames,
  IDBFSOption,
  FindPathResult,
} from "./types";
import { pathMatchResult } from "./utils";

const IDBSysbol = Symbol("IDBFileSystem");

export class IDBFileSystem {
  private static instance: IDBFileSystem;
  private dbMethod: {
    getOneByKey: (storeName: string, key: any) => Promise<any>;
    getManyByIndex: (
      storeName: string,
      indexName: string,
      query: IDBValidKey | IDBKeyRange | null
    ) => Promise<any[]>;
    findPath: (path: Path) => Promise<FindPathResult[]>;
    mkdir: (path: Path) => Promise<void>;
    readFile: (path: Path) => Promise<ArrayBuffer>;
    rm: (path: Path, recursive?: boolean | undefined) => Promise<void>;
    writeFile: (
      path: Path,
      data: ArrayBuffer,
      desc: FileDesc
    ) => Promise<IDBFile>;
    appendFile: (file: IDBFile, data: ArrayBuffer) => Promise<boolean>;
    createReadStream: (path: Path) => ReadableStream<ArrayBuffer>;
    saveFile: (dbHandle: FileSystemFileHandle, path: Path) => Promise<void>;
    getFile: (path: Path) => Promise<IDBFile>;
    createWritableStreamByIDBFile: (
      file: IDBFile
    ) => WritableStream<ArrayBuffer>;
    createFile: (path: Path, desc: FileDesc) => Promise<IDBFile>;
  };
  private constructor(private mountRes: IDBFSOption) {
    if (mountRes.flag !== IDBSysbol) {
      throw new Error("Invalid mountRes");
    }

    this.dbMethod = {
      getOneByKey: getOneByKey.bind(null, this.mountRes.db),
      getManyByIndex: getManyByIndex.bind(null, this.mountRes.db),
      findPath: findPath.bind(null, this.mountRes.db),
      mkdir: mkdir.bind(null, this.mountRes.db),
      readFile: readFile.bind(null, this.mountRes.db),
      rm: rm.bind(null, this.mountRes.db),
      writeFile: writeFile.bind(null, this.mountRes.db),
      appendFile: appendFile.bind(null, this.mountRes.db),
      createReadStream: createReadStream.bind(null, this.mountRes.db),
      saveFile: saveFile.bind(null, this.mountRes.db),
      getFile: getFile.bind(null, this.mountRes.db),
      createWritableStreamByIDBFile: createWritableStreamByIDBFile.bind(
        null,
        this.mountRes.db
      ),
      createFile: createFile.bind(null, this.mountRes.db),
    };
  }

  public static getInstance(mountRes: IDBFSOption) {
    if (!IDBFileSystem.instance) {
      IDBFileSystem.instance = new IDBFileSystem(mountRes);
    }
    return IDBFileSystem.instance;
  }

  static mount() {
    return new Promise<IDBFSOption>((res, rej) => {
      const request = indexedDB.open("WebFileSystem", 1);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains("Files")) {
          const files = db.createObjectStore("Files", {
            keyPath: "id",
            autoIncrement: true,
          });
          files.createIndex("directoryId", "directoryId", { unique: false });
          files.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("Directorys")) {
          const directorys = db.createObjectStore("Directorys", {
            keyPath: "id",
            autoIncrement: true,
          });
          directorys.createIndex("parentId", "parentId", { unique: false });
          directorys.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("Data")) {
          db.createObjectStore("Data", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = (event) => {
        res({
          flag: IDBSysbol,
          db: request.result,
        });
      };

      request.onerror = (event) => {
        rej(request.error);
      };
    });
  }

  /**
   * @description Internal and `stat` operations are similar. But no error, only whether it exists
   * @param path
   * @returns
   */
  async exists(path: string): Promise<boolean> {
    const pathObj = new Path(path);
    const result = await this.dbMethod.findPath(pathObj);
    return pathMatchResult(pathObj, result);
  }

  /**
   * @description Get the file or directory information
   * @param path
   */
  async stat(path: string): Promise<Stat> {
    const pathObj = new Path(path);
    const result = await this.dbMethod.findPath(pathObj);
    if (pathMatchResult(pathObj, result) === false) {
      throw new FsNotFoundError("Not found:" + path);
    }
    const last = result[result.length - 1];
    const stat: Stat = {
      isDirectory: last.type === "directory",
      size: last?.size,
      createAt: last?.createAt,
      updateAt: last?.updateAt,
      mimeType: last?.mimeType,
      name: last.name,
    };
    return stat;
  }

  async mkdir(path: string): Promise<void> {
    return this.dbMethod.mkdir(new Path(path));
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    const pathObj = new Path(path);
    const result = await this.dbMethod.readFile(pathObj);
    return result;
  }

  async writeFile(
    path: string,
    data: ArrayBuffer,
    desc: FileDesc
  ): Promise<IDBFile> {
    const pathObj = new Path(path);
    return await this.dbMethod.writeFile(pathObj, data, desc);
  }

  async writeFileByWebFile(path: string, file: File): Promise<IDBFile> {
    const data = await file.arrayBuffer();
    return await this.writeFile(path, data, {
      mimeType: file.type,
    });
  }

  async readdir(
    path: string
  ): Promise<{ dirs: Directory[]; files: IDBFile[] }> {
    const pathRes = await this.dbMethod.findPath(new Path(path));
    const last = pathRes[pathRes.length - 1];
    if (last.type !== "directory") {
      throw new FsNotFoundError("Not found:" + path);
    }
    const dirId = last.id;

    const dirs = await this.dbMethod.getManyByIndex(
      StoreNames.DIRECTORYS,
      "parentId",
      dirId
    );
    const files = await this.dbMethod.getManyByIndex(
      StoreNames.FILES,
      "directoryId",
      dirId
    );

    return {
      dirs,
      files,
    };
  }

  async rm(path: string, recursive?: boolean): Promise<void> {
    return this.dbMethod.rm(new Path(path), recursive);
  }

  createReadStream(path: string): ReadableStream<ArrayBuffer> {
    return this.dbMethod.createReadStream(new Path(path));
  }

  createWriteStream(file: IDBFile): WritableStream<ArrayBuffer> {
    return this.dbMethod.createWritableStreamByIDBFile(file);
  }

  /**
   *
   * @example
   * const fileHandle = await window.showSaveFilePicker();
   * save(fileHandle, new ArrayBuffer(0));
   */
  async save(dbHandle: FileSystemFileHandle, path: string): Promise<void> {
    return this.dbMethod.saveFile(dbHandle, new Path(path));
  }

  async getFile(path: string): Promise<IDBFile> {
    return this.dbMethod.getFile(new Path(path));
  }

  /**
   * @example
   * await fs.appendFile("test.txt", new ArrayBuffer(0));
   * await fs.appendFile(file, new ArrayBuffer(0));
   */
  async appendFile(path: string, data: ArrayBuffer): Promise<boolean>;
  async appendFile(file: IDBFile, data: ArrayBuffer): Promise<boolean>;
  async appendFile(
    arg1: string | IDBFile,
    data: ArrayBuffer
  ): Promise<boolean> {
    let file: IDBFile;
    if (typeof arg1 === "string") {
      file = await this.getFile(arg1);
    } else {
      file = arg1;
    }
    return this.dbMethod.appendFile(file, data);
  }

  async createFile(path: string, desc: FileDesc): Promise<IDBFile> {
    return this.dbMethod.createFile(new Path(path), desc);
  }
}



export async function mount() {
  const mountRes = await IDBFileSystem.mount();
  const idbFs = IDBFileSystem.getInstance(mountRes);
  return idbFs;
}
