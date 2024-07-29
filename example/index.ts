import { mount } from "../src";

document.querySelector("#root")!.innerHTML = `

  <div>
    <h1>IndexedDBFileSystem</h1>
    <hr />
    <input type="text" id="readdirInput" value="/">
    <button id="readdir">readDir</button>
    <br/>
    <input type="text" id="mkdirInput" value="/dir">
    <button id="mkdir">makeDir</button>
    <br/>
    <input type="text" id="rmInput" value="/dir">
    <button id="rm">remove</button>
    <br/>
    <input type="text" id="existInput" value="/dir">
    <button id="exist">exist</button>
    <br/>
    <input type="text" id="statInput" value="/dir">
    <button id="stat">stat</button>
    <br/>
    <input type="text" id="readFInput" value="/BBCHAT_Win_x64_64bit_V1.8.50.exe">
    <button id="readF">readFile</button>
    <button id="readFStream">stream read</button>
    <button id="saveFile">stream save to system</button>
    
    <br/>
    <input type="file" id="writeFile">
    <input type="text" id="writeFInput" value="/">
    <button id="writeF">write file</button>
    <button id="swrite">stream write file</button>
    <br/>
  </div>
`;

const readDirInput = document.querySelector(
  "#readdirInput"
) as HTMLInputElement;
const readDirBtn = document.querySelector("#readdir") as HTMLButtonElement;
const makeDirBtn = document.querySelector("#mkdir") as HTMLButtonElement;
const mkdirInput = document.querySelector("#mkdirInput") as HTMLInputElement;
const rmBtn = document.querySelector("#rm") as HTMLButtonElement;
const rmInput = document.querySelector("#rmInput") as HTMLInputElement;
const existBtn = document.querySelector("#exist") as HTMLButtonElement;
const existInput = document.querySelector("#existInput") as HTMLInputElement;
const statBtn = document.querySelector("#stat") as HTMLButtonElement;
const statInput = document.querySelector("#statInput") as HTMLInputElement;
const readFBtn = document.querySelector("#readF") as HTMLButtonElement;
const readFStream = document.querySelector("#readFStream") as HTMLButtonElement;
const readFInput = document.querySelector("#readFInput") as HTMLInputElement;
const writeFBtn = document.querySelector("#writeF") as HTMLButtonElement;
const writeFile = document.querySelector("#writeFile") as HTMLInputElement;
const writeFInput = document.querySelector("#writeFInput") as HTMLInputElement;
const writeFStream = document.querySelector("#swrite") as HTMLButtonElement;
const saveFileBtn = document.querySelector("#saveFile") as HTMLButtonElement;

async function main() {
  const fs = await mount();
  //@ts-ignore
  window.fs = fs;

  readDirBtn.addEventListener("click", async () => {
    const path = readDirInput.value;
    const result = await fs.readdir(path);
    console.log(result);
  });

  makeDirBtn.addEventListener("click", async () => {
    if (mkdirInput.value.trim() === "") {
      return alert("please input dir name");
    }
    const path = mkdirInput.value;
    await fs.mkdir(path);
    console.log("make dir:" + path);
  });

  rmBtn.addEventListener("click", async () => {
    const path = rmInput.value;
    await fs.rm(path, true);
    console.log("remove:" + path);
  });

  existBtn.addEventListener("click", async () => {
    const path = existInput.value;
    const result = await fs.exists(path);
    console.log("exist:" + path, result);
  });

  statBtn.addEventListener("click", async () => {
    const path = statInput.value;
    const result = await fs.stat(path);
    console.log("stat:" + path, result);
  });

  readFBtn.addEventListener("click", async () => {
    const path = readFInput.value;
    const result = await fs.readFile(path);
    console.log("readFile:" + path, result);
  });

  readFStream.addEventListener("click", async () => {
    const path = readFInput.value;
    const st = fs.createReadStream(path);
    const reader = st.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      console.log(value);
    }
  });

  saveFileBtn.addEventListener("click", async () => {
    const path = readFInput.value;
    //@ts-ignore
    if (window.showSaveFilePicker === undefined) {
      console.log("only https can use showSaveFilePicker");
      return;
    }
    //@ts-ignore
    const handle = await window.showSaveFilePicker();
    await fs.save(handle, path);
    console.log("save done");
  });

  writeFBtn.addEventListener("click", async () => {
    const file = writeFile.files?.[0];
    if (!file) {
      return alert("please select file");
    }
    const path = writeFInput.value + file.name;
    const fileId = await fs.writeFileByWebFile(path, file);
    console.log("writeFile:" + path, "   id:", fileId);
  });

  writeFStream.addEventListener("click", async () => {
    const file = writeFile.files?.[0];
    if (!file) {
      return alert("please select file");
    }
    const path = writeFInput.value + file.name;
    const idbFile = await fs.createFile(path, { mimeType: file.type });
    const wStream = fs.createWriteStream(idbFile);

    await file.stream().pipeTo(wStream);
    console.log("write stream done");
  });
}

main();
