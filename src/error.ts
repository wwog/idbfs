export enum FsErrorCode {
  NOT_FOUND = 1,
  INVALID_PATH,
  ALREADY_EXISTS,
  NOT_EXIST_PARENT,
  FATAL,
}

export class FsError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

export class FsNotFoundError extends FsError {
  constructor(message: string) {
    super(message, FsErrorCode.NOT_FOUND);
  }
}

export class FsInvalidPathError extends FsError {
  constructor(message: string) {
    super(message, FsErrorCode.INVALID_PATH);
  }
}

export class FsAlreadyExistsError extends FsError {
  constructor(message: string) {
    super(message, FsErrorCode.ALREADY_EXISTS);
  }
}

export class FsNotExistsParentError extends FsError {
  constructor(message: string) {
    super(message, FsErrorCode.NOT_EXIST_PARENT);
  }
}

export class FsFatalError extends FsError {
  constructor(message: string) {
    super(message, FsErrorCode.FATAL);
  }
}

