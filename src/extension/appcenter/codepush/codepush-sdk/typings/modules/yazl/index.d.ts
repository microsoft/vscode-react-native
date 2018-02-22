declare module "yazl" {
  import * as events from "events";
  import * as stream from "stream";

  export interface IDosDateTime {
      date: number;
      time: number;
  }

  export interface IFinalSizeCallback {
      (finalSize: number): void;
  }

  export interface IOptions {
      compress?: boolean;
      mode?: number;
      mtime?: Date;
      size?: number;
  }

  export function dateToDosDateTime(date: Date): IDosDateTime;

  export class ZipFile extends events.EventEmitter {
      outputStream: stream.Readable;

      public addBuffer(buffer: Buffer, metadataPath: string, options?: IOptions): void;
      public addEmptyDirectory(metadataPath: string, options?: IOptions): void;
      public addFile(realPath: string, metadataPath: string, options?: IOptions): void;
      public addReadStream(readStream: stream.Readable, metadataPath: string, options?: IOptions): void;
      public end(finalSizeCallback?: IFinalSizeCallback): void;
  }
}