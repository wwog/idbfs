# IndexedDB File System

> A file system built on the front end of the web, using `indexedDB` as the back-end storage, as an alternative storage solution or compatible solution for Opfs. It supports reading and writing of file `stream` and can be used for uploading and downloading large files..Most of the APIs refer to NodeJS, which is used in a similar way.

## Features

- Support `Stream` Api
- Store file data in chunks to IndexedDB
- Maintain metadata of files
- Support Save disk

## Useage

```javascript
import { mount } from "@wwog/idbfs";

const fs = await mount();

const result = await fs.readdir("/");
console.log(result); // {dirs:[], files:[]}
```

### Write the file to the disk

```javascript
const handle = await window.showSaveFilePicker();
//Use the stream internally
await fs.saveFile(handle, "/bigFile");
```

### Streams the selected file into IDBFS

```javascript
const file = fileInput.files?.[0];
if (!file) {
  return alert("please select file");
}
const path = "/" + file.name;
const idbFile = await fs.createFile(path, { mimeType: file.type });
const wStream = fs.createWriteStream(idbFile);
await file.stream().pipeTo(wStream);
```

### Read the file from the disk

```javascript
import { streamToAsyncIterator } from "@wwog/idbfs";
const rStream = fs.createReadStream(path);
for await (chunk of streamToAsyncIterator(rStream)) {
  console.log(chunk);
}
```

## FS API

-  async appendFile(path: string|IDBFile, data: ArrayBuffer): Promise<boolean>;
-  async getFile(path: string): Promise<IDBFile>
-  async save(dbHandle: FileSystemFileHandle, path: string): Promise<void>
-  async createFile(path: string, desc: FileDesc): Promise<IDBFile>
-  createWriteStream(file: IDBFile): WritableStream<ArrayBuffer>
-  createReadStream(path: string): ReadableStream<ArrayBuffer>
-  async rm(path: string, recursive?: boolean): Promise<void> 
-  async readdir(path: string): Promise<{ dirs: Directory[]; files: IDBFile[] }> 
-  async writeFileByWebFile(path: string, file: File): Promise<IDBFile>
-  async writeFile(path: string,data: ArrayBuffer,desc: FileDesc): Promise<IDBFile>
-  async readFile(path: string): Promise<ArrayBuffer>
-  async mkdir(path: string): Promise<void>
-  async stat(path: string): Promise<Stat>
-  async exists(path: string): Promise<boolean>