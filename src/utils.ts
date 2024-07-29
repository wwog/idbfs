import { FsFatalError } from "./error";
import { Path } from "./path";
import { FindPathResult } from "./types";

export async function* streamToAsyncIterator<T extends ArrayBufferLike>(
  stream: ReadableStream<T>
): AsyncIterableIterator<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function checkFindResult(result: FindPathResult[]) {
  for (let idx = 0; idx < result.length; idx++) {
    if (result[idx].type === "file") {
      return idx === result.length - 1;
    }
  }
}

export function pathMatchResult(path: Path, result: FindPathResult[]) {
  const valid = checkFindResult(result);
  if (valid === false) {
    throw new FsFatalError(
      "The path cannot be composed of files:" +
        path.origin +
        ",please rm it first directly"
    );
  }
  if (result.length !== path.size) {
    return false;
  }
  for (let idx = 0; idx < result.length; idx++) {
    if (result[idx].name !== path.slicePathStr[idx]) {
      return false;
    }
  }
  return true;
}
