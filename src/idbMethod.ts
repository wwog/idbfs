import {
  FsAlreadyExistsError,
  FsNotExistsParentError,
  FsNotFoundError,
} from "./error";
import { Path } from "./path";
import { FileDesc, FindPathResult, IDBFile, StoreNames } from "./types";
import { pathMatchResult, streamToAsyncIterator } from "./utils";

export const RootDirId = -1;
export const RootDirName = "_SystemRoot_";
const RootDir: FindPathResult = {
  type: "directory",
  name: RootDirName,
  id: RootDirId,
  parentId: null,
  createAt: 0,
  updateAt: 0,
};
const KB = 1024;
const MB = 1024 * KB;
const DIRECT_STORE_SIZE = 256 * KB; // 256KB
const MEDIUM_BLOCK_SIZE = 256 * KB; // 256KB
const LARGE_BLOCK_SIZE = 512 * KB; // 512KB
const EXTRA_LARGE_BLOCK_SIZE = MB; // 1MB
const MAX_BLOCK_SIZE = 2 * KB; // 2MB

function calculateBlockSize(fileSize: number): number {
  if (fileSize <= DIRECT_STORE_SIZE) {
    return fileSize;
  } else if (fileSize <= 2 * MB) {
    //2MB - 256kb
    return MEDIUM_BLOCK_SIZE;
  } else if (fileSize <= 50 * MB) {
    //50MB - 512kb
    return LARGE_BLOCK_SIZE;
  } else if (fileSize <= 100 * MB) {
    //100MB - 1MB
    return EXTRA_LARGE_BLOCK_SIZE;
  } else {
    //> 2MB
    return MAX_BLOCK_SIZE;
  }
}

export function openDatabase() {
  return new Promise<IDBDatabase>((res, rej) => {
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
      res(request.result);
    };

    request.onerror = (event) => {
      rej(request.error);
    };
  });
}

export function getOneByKey(db: IDBDatabase, storeName: string, key: any) {
  return new Promise<any>((res, rej) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = (event) => {
      res(request.result);
    };
    request.onerror = (event) => {
      rej(request.error);
    };
  });
}

export function getManyByIndex(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  query: IDBValidKey | IDBKeyRange | null
) {
  return new Promise<any[]>((res, rej) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(query);
    request.onsuccess = (event) => {
      res(request.result);
    };
    request.onerror = (event) => {
      rej(request.error);
    };
  });
}

/**
 * Except for errors, the presence path is always returned
 * @param db
 * @param path
 * @example
 * findPath("/texts/test.txt")
 * [
 *   {
 *     type:"directory",
 *     name:"texts",
 *     id:1,
 *     parentId:null
 *     //...
 *   },
 *  {
 *    type:"file",
 *    name:"test.txt",
 *    id:1,
 *    directoryId:1,
 *   //...
 *  }
 * ]
 */
export async function findPath(
  db: IDBDatabase,
  path: Path
): Promise<FindPathResult[]> {
  // root directory
  const result = [RootDir];
  if (path.size === 0) {
    return result;
  }
  const transaction = db.transaction(
    [StoreNames.DIRECTORYS, StoreNames.FILES],
    "readonly"
  );

  const directory = transaction.objectStore(StoreNames.DIRECTORYS);
  const file = transaction.objectStore(StoreNames.FILES);

  let _tempParentId: number | undefined = undefined;

  try {
    for (let idx = 0; idx < path.slicePathStr.length; idx++) {
      const name = path.slicePathStr[idx];

      let dirRes = undefined;

      if (_tempParentId === undefined) {
        dirRes = RootDir;
      } else {
        const p = new Promise((res, rej) => {
          const cursor = directory
            .index("parentId")
            .openCursor(IDBKeyRange.only(_tempParentId));

          cursor.onsuccess = (event) => {
            //@ts-ignore
            const cursor = event.target.result;
            if (cursor) {
              if (cursor.value.name === name) {
                res(cursor.value);
              } else {
                cursor.continue();
              }
            } else {
              res(undefined);
            }
          };

          cursor.onerror = (event) => {
            rej(event);
          };
        });
        dirRes = await p;
      }
      if (dirRes) {
        //@ts-ignore
        _tempParentId = dirRes.id;
      }

      if (dirRes && _tempParentId !== RootDirId) {
        result.push({
          type: "directory",
          ...dirRes,
        } as FindPathResult);
      }
    }
  } catch (error) {
    console.error(`IndexedDBFileSystem.exists(${path})`, error);
    return [];
  }
  if (result.length === path.size) {
    return result;
  }
  const fileName = path.slicePathStr[result.length];
  const p = new Promise((res, rej) => {
    const query = file.index("name").getAll(fileName);
    query.onsuccess = (event) => {
      //@ts-ignore
      const files = event.target.result as IDBFile[];

      for (let idx = 0; idx < files.length; idx++) {
        const el = files[idx];
        if (el.directoryId === result[result.length - 1].id) {
          return res(el);
        }
      }

      res(undefined);
    };
    query.onerror = (event) => {
      rej(event);
    };
  });

  const fileRes = await p;

  if (fileRes) {
    result.push({
      type: "file",
      ...fileRes,
    } as FindPathResult);
  }

  return result;
}

export async function mkdir(db: IDBDatabase, path: Path) {
  const result = await findPath(db, path);
  if (pathMatchResult(path, result)) {
    throw new FsAlreadyExistsError("Directory already exists:" + path.origin);
  }

  if (pathMatchResult(path.parent(), result) === false) {
    throw new FsNotExistsParentError(
      "Parent directory does not exist:" + path.origin
    );
  }

  const transaction = db.transaction(StoreNames.DIRECTORYS, "readwrite");
  const store = transaction.objectStore(StoreNames.DIRECTORYS);
  const parent = result[result.length - 1];
  const request = store.add({
    name: path.slicePathStr[path.size - 1],
    parentId: parent ? parent.id : RootDirId,
    createAt: new Date(),
    updateAt: new Date(),
  });

  return new Promise<void>((res, rej) => {
    request.onsuccess = () => {
      res();
    };
    request.onerror = () => {
      rej(request.error);
    };
  });
}

export async function getFile(db: IDBDatabase, path: Path): Promise<IDBFile> {
  const result = await findPath(db, path);
  if (pathMatchResult(path, result) === false) {
    throw new FsNotFoundError("Not found:" + path.origin);
  }
  const file = result[result.length - 1];
  if (file.type !== "file") {
    throw new FsNotFoundError("Not a file:" + path.origin);
  }
  return file as unknown as IDBFile;
}

export async function readFile(
  db: IDBDatabase,
  path: Path
): Promise<ArrayBuffer> {
  const file = await getFile(db, path);
  const dataIds = file.dataIds;
  if (dataIds!.length === 0) {
    return new ArrayBuffer(0);
  }
  const data = await Promise.all(
    dataIds!.map((id) => getOneByKey(db, StoreNames.DATA, id))
  );

  return data.reduce((prev, cur) => {
    const buffer = new ArrayBuffer(prev.byteLength + cur.byteLength);
    const view = new Uint8Array(buffer);
    view.set(new Uint8Array(prev), 0);
    view.set(new Uint8Array(cur), prev.byteLength);
    return buffer;
  });
}

export async function rm(db: IDBDatabase, path: Path, recursive = false) {
  const result = await findPath(db, path);
  if (pathMatchResult(path, result) === false) {
    throw new FsNotFoundError("Not found:" + path.origin);
  }
  const last = result[result.length - 1];
  if (last.type === "directory") {
    const transaction = db.transaction(
      [StoreNames.DIRECTORYS, StoreNames.DATA, StoreNames.FILES],
      "readwrite"
    );
    const directory = transaction.objectStore(StoreNames.DIRECTORYS);
    const file = transaction.objectStore(StoreNames.FILES);
    const data = transaction.objectStore(StoreNames.DATA);

    const p = new Promise<void>((res, rej) => {
      const cursor = file
        .index("directoryId")
        .openCursor(IDBKeyRange.only(last.id));
      cursor.onsuccess = (event) => {
        //@ts-ignore
        const cursor = event.target.result;
        if (cursor) {
          if (recursive === false) {
            throw new Error("Directory is not empty:" + path.origin);
          }
          cursor.value.dataIds.forEach((id: number) => {
            data.delete(id);
          });
          cursor.delete();
          cursor.continue();
        } else {
          res();
        }
      };
      cursor.onerror = (event) => {
        rej(event);
      };
    });
    await p;
    directory.delete(last.id);
  } else {
    const transaction = db.transaction(
      [StoreNames.FILES, StoreNames.DATA],
      "readwrite"
    );
    const file = transaction.objectStore(StoreNames.FILES);
    const data = transaction.objectStore(StoreNames.DATA);
    const p = new Promise<void>((res, rej) => {
      const cursor = file.index("name").openCursor(IDBKeyRange.only(last.name));
      cursor.onsuccess = (event) => {
        //@ts-ignore
        const cursor = event.target.result;
        if (cursor) {
          cursor.value.dataIds.forEach((id: number) => {
            data.delete(id);
          });
          cursor.delete();
          res();
        }
      };
      cursor.onerror = (event) => {
        rej(event);
      };
    });
    await p;
  }
}

export async function createFile(db: IDBDatabase, path: Path, desc: FileDesc) {
  const { mimeType } = desc;
  const findRes = await findPath(db, path);
  if (pathMatchResult(path, findRes)) {
    throw new FsAlreadyExistsError("File already exists:" + path.origin);
  }

  if (pathMatchResult(path.parent(), findRes) === false) {
    throw new FsNotExistsParentError(
      "Parent directory does not exist:" + path.origin
    );
  }
  const parentDir = findRes[findRes.length - 1];
  const transaction = db.transaction([StoreNames.FILES], "readwrite");
  const file = transaction.objectStore(StoreNames.FILES);
  const idbFile = {
    name: path.slicePathStr[path.size - 1],
    directoryId: parentDir ? parentDir.id : RootDirId,
    dataIds: [],
    size: 0,
    createAt: new Date(),
    updateAt: new Date(),
    mimeType,
  };
  const request = file.add(idbFile);

  return new Promise<IDBFile>((res, rej) => {
    request.onsuccess = (event) => {
      //@ts-ignore
      const id = event.target.result as number;
      res({
        id,
        ...idbFile,
      });
    };
    request.onerror = () => {
      rej(request.error);
    };
  });
}

export async function appendFile(
  db: IDBDatabase,
  file: IDBFile,
  data: ArrayBuffer
) {
  return new Promise<boolean>(async (resolve, reject) => {
    const preChunkIds = file.dataIds;
    const transaction = db.transaction(
      [StoreNames.DATA, StoreNames.FILES],
      "readwrite"
    );
    const dataStore = transaction.objectStore(StoreNames.DATA);
    const fileStore = transaction.objectStore(StoreNames.FILES);
    transaction.oncomplete = () => {
      resolve(true);
    };
    transaction.onerror = (event) => {
      reject(event);
    };
    const blockSize = calculateBlockSize(data.byteLength);
    const blockCount = Math.ceil(data.byteLength / blockSize);
    const blocks = Array.from({ length: blockCount }, (_, idx) => {
      return data.slice(idx * blockSize, (idx + 1) * blockSize);
    });

    const p = blocks.map((block) => {
      return new Promise<number>((res, rej) => {
        const request = dataStore.add(block);
        request.onsuccess = (event) => {
          //@ts-ignore
          res(event.target.result);
        };
        request.onerror = (event) => {
          rej(event);
        };
      });
    });
    const ids = await Promise.all(p);
    file.dataIds = preChunkIds.concat(ids);
    file.size = data.byteLength + file.size;
    file.updateAt = new Date();
    fileStore.put(file);
  });
}

export async function writeFile(
  db: IDBDatabase,
  path: Path,
  data: ArrayBuffer,
  desc: FileDesc
) {
  let file = await createFile(db, path, desc);

  return new Promise<IDBFile>((resolve, reject) => {
    const fileSize = data.byteLength;
    const blockSize = calculateBlockSize(data.byteLength);
    const blockCount = Math.ceil(data.byteLength / blockSize);
    const blocks = Array.from({ length: blockCount }, (_, idx) => {
      return data.slice(idx * blockSize, (idx + 1) * blockSize);
    });

    const transaction = db.transaction(
      [StoreNames.DATA, StoreNames.FILES],
      "readwrite"
    );

    const fileStore = transaction.objectStore(StoreNames.FILES);
    const dataStore = transaction.objectStore(StoreNames.DATA);

    const fileRequest = fileStore.get(file.id);

    fileRequest.onsuccess = async (event) => {
      //@ts-ignore
      file = event.target.result as IDBFile;
      if (!file) {
        throw new FsNotFoundError("Not found:" + path.origin);
      }
      const p = blocks.map((block) => {
        return new Promise<number>((res, rej) => {
          const request = dataStore.add(block);
          request.onsuccess = (event) => {
            //@ts-ignore
            res(event.target.result);
          };
          request.onerror = (event) => {
            rej(event);
          };
        });
      });
      const ids = await Promise.all(p);
      file.dataIds = ids;
      file.size = fileSize;
      file.updateAt = new Date();

      fileStore.put(file);
    };

    transaction.oncomplete = () => {
      resolve(file);
    };

    transaction.onerror = (event) => {
      reject(event);
    };
  });
}

/**
 *
 * @example
 * const fileHandle = await window.showSaveFilePicker();
 * saveFile(fileHandle, new ArrayBuffer(0));
 */
export async function saveFile(
  db: IDBDatabase,
  fileHandle: FileSystemFileHandle,
  path: Path
) {
  const writable = await fileHandle.createWritable();
  const file = await getFile(db, path);
  const stream = createReadStreamByIDBFile(db, file);

  for await (const chunk of streamToAsyncIterator(stream)) {
    writable.write(chunk);
  }
  await writable.close();
}

export function createReadStream(db: IDBDatabase, path: Path) {
  let idx = 0;
  let dataIds: number[] = [];

  const rStream = new ReadableStream<ArrayBuffer>(
    {
      async start(controller) {
        const file = await getFile(db, path);
        dataIds = file.dataIds;
        if (dataIds!.length === 0) {
          controller.close();
          return;
        }
      },
      async pull(controller) {
        if (idx < dataIds.length) {
          const dataId = dataIds[idx];
          const data = await getOneByKey(db, StoreNames.DATA, dataId);
          controller.enqueue(data);
          idx++;
        } else {
          controller.close();
        }
      },
    },
    {
      highWaterMark: 3,
    }
  );

  return rStream;
}

/**
 * @example
 * const file = await getIDBFile(db, path);
 * const rStream = createReadStreamByIDBFile(db, file);
 * for await (const chunk of streamToAsyncIterator(rStream)) {
 *  console.log(chunk);
 * }
 * rStream.close();
 */
export function createReadStreamByIDBFile(db: IDBDatabase, file: IDBFile) {
  let idx = 0;
  let dataIds: number[] = file.dataIds;

  const rStream = new ReadableStream<ArrayBuffer>(
    {
      async start(controller) {
        if (dataIds!.length === 0) {
          controller.close();
          return;
        }
      },
      async pull(controller) {
        if (idx < dataIds.length) {
          const dataId = dataIds[idx];
          const data = await getOneByKey(db, StoreNames.DATA, dataId);
          controller.enqueue(data);
          idx++;
        } else {
          controller.close();
        }
      },
    },
    {
      highWaterMark: 3,
    }
  );

  return rStream;
}

/**
 * @description
 * Considering that the chunk of the write stream can be large or small
 * and the file may change, the equal-partition rule does not apply.
 * When streaming data is written, the chunk size is fixed at 1 MB.
 */
export function createWritableStreamByIDBFile(db: IDBDatabase, file: IDBFile) {
  const wStream = new WritableStream<ArrayBuffer>(
    {
      async write(chunk, controller) {
        let chunkOffset = 0;

        const tp = new Promise<IDBFile>(async (res, rej) => {
          const transaction = db.transaction(
            [StoreNames.DATA, StoreNames.FILES],
            "readwrite"
          );

          transaction.oncomplete = () => {
            res(file);
          };

          transaction.onerror = (event) => {
            rej(event);
          };

          const dataStore = transaction.objectStore(StoreNames.DATA);
          const fileStore = transaction.objectStore(StoreNames.FILES);
          const newFile = {
            ...file,
            updateAt: new Date(),
          };

          const chunkSize = chunk.byteLength;
          if (chunkSize > MB) {
            while (chunkSize - chunkOffset > MB) {
              const data = chunk.slice(chunkOffset, MB);
              const p = new Promise<number>((resolve, reject) => {
                const req = dataStore.add(data);
                req.onsuccess = (event) =>
                  //@ts-ignore
                  resolve(event.target.result as number);
              });
              const id = await p;
              newFile.dataIds.push(id);
              newFile.size += data.byteLength;
              chunkOffset = chunkOffset + MB;
            }
            if (chunkSize - chunkOffset > 0) {
              const data = chunk.slice(chunkOffset);
              const p = new Promise<number>((resolve, reject) => {
                const req = dataStore.add(data);
                req.onsuccess = (event) =>
                  //@ts-ignore
                  resolve(event.target.result as number);
              });
              const id = await p;
              newFile.dataIds.push(id);
              newFile.size += data.byteLength;
            }
          } else {
            const p = new Promise<number>((resolve, reject) => {
              const req = dataStore.add(chunk);
              //@ts-ignore
              req.onsuccess = (event) => resolve(event.target.result as number);
            });
            const id = await p;
            newFile.dataIds.push(id);
            newFile.size += chunk.byteLength;
          }

          fileStore.put(newFile);
        });

        await tp;
      },
      close() {},
    },
    {
      highWaterMark: 2,
    }
  );

  return wStream;
}
