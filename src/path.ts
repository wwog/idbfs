import { RootDirName } from "./idbMethod";

export class Path {
  private slicePath: string[];
  private path: string;
  private trimedBothSlash: string;

  static validCheck(path: string): boolean {
    if (path.includes("//")) {
      return false;
    }
    return true;
  }

  constructor(path: string) {
    this.path = path.trim();
    if (!Path.validCheck(path)) {
      throw new Error("Invalid path:" + path);
    }
    this.trimedBothSlash = path.replace(/^\/|\/$/g, "");
    this.slicePath = this.trimedBothSlash
      .split("/")
      .filter((item) => item !== "");

    if (this.slicePath[0] !== RootDirName) {
      this.slicePath.unshift(RootDirName);
    }
  }

  parent(): Path {
    if (this.size === 0) {
      return new Path("/");
    }
    return new Path("/" + this.slicePath.slice(0, -1).join("/"));
  }

  get slicePathStr(): string[] {
    return this.slicePath;
  }

  get origin(): string {
    return this.path;
  }

  get size(): number {
    return this.slicePath.length;
  }

  *[Symbol.iterator]() {
    for (let item of this.slicePath) {
      yield item;
    }
  }
}
