/**
 * NOTE!!! This utility file is duplicated for use by the CodePush service (for server-driven hashing/
 * integrity checks) and Management SDK (for end-to-end code signing), please keep them in sync.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import * as _ from 'lodash';
import * as fileUtils from '../../utils/file-utils';

// Do not throw an exception if either of these modules are missing, as they may not be needed by the
// consumer of this file.
const HASH_ALGORITHM = 'sha256';

export async function generatePackageHashFromDirectory(directoryPath: string, basePath: string): Promise<string> {
  if (!fileUtils.isDirectory(directoryPath)) {
    throw new Error('Not a directory. Please either create a directory, or use hashFile().');
  }

  const manifest: PackageManifest = await generatePackageManifestFromDirectory(directoryPath, basePath);
  return manifest.computePackageHash();
}

export function generatePackageManifestFromDirectory(directoryPath: string, basePath: string): Promise<PackageManifest> {
  return new Promise<PackageManifest>(async (resolve, reject) => {
    const fileHashesMap = new Map<string, string>();

    const files: string[] = await fileUtils.walk(directoryPath);

    if (!files || files.length === 0) {
      reject(`Error: Can't sign the release because no files were found.`);
      return;
    }

    // Hash the files sequentially, because streaming them in parallel is not necessarily faster
    const generateManifestPromise: Promise<void> = files.reduce((soFar: Promise<void>, filePath: string) => {
      return soFar
        .then(() => {
          const relativePath: string = fileUtils.normalizePath(path.relative(basePath, filePath));
          if (!PackageManifest.isIgnored(relativePath)) {
            return hashFile(filePath)
              .then((hash: string) => {
                fileHashesMap.set(relativePath, hash);
              });
          }
        });
    }, Promise.resolve(<void>null));

    generateManifestPromise
      .then(() => {
        resolve(new PackageManifest(fileHashesMap));
      }, reject);
  });
}

export function hashFile(filePath: string): Promise<string> {
  const readStream: fs.ReadStream = fs.createReadStream(filePath);
  return hashStream(readStream);
}

export function hashStream(readStream: stream.Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hashStream = <stream.Transform><any>crypto.createHash(HASH_ALGORITHM);

    readStream
      .on('error', (error: any): void => {
        hashStream.end();
        reject(error);
      })
      .on('end', (): void => {
        hashStream.end();

        const buffer = <Buffer>hashStream.read();
        const hash: string = buffer.toString('hex');

        resolve(hash);
      });

    readStream.pipe(hashStream);
  });
}

export class PackageManifest {
  private _map: Map<string, string>;

  public constructor(map?: Map<string, string>) {
    if (!map) {
      map = new Map<string, string>();
    }
    this._map = map;
  }

  public toMap(): Map<string, string> {
    return this._map;
  }

  public computePackageHash(): string {
    var entries: string[] = [];
    this._map.forEach((hash: string, name: string): void => {
      entries.push(name + ':' + hash);
    });

    // Make sure this list is alphabetically ordered so that other clients
    // can also compute this hash easily given the update contents.
    entries = entries.sort();

    return crypto.createHash(HASH_ALGORITHM)
      .update(JSON.stringify(entries))
      .digest('hex');
  }

  public serialize(): string {
    const obj: any = {};

    this._map.forEach(function (value, key) {
      obj[key] = value;
    });

    return JSON.stringify(obj);
  }

  public static deserialize(serializedContents: string): PackageManifest {
    try {
      const obj: any = JSON.parse(serializedContents);
      const map = new Map<string, string>();

      for (const key of Object.keys(obj)) {
        map.set(key, obj[key]);
      }

      return new PackageManifest(map);
    } catch (e) {
      console.error(e);
    }
  }

  public static isIgnored(relativeFilePath: string): boolean {
    const __MACOSX = '__MACOSX/';
    const DS_STORE = '.DS_Store';
    const CODEPUSH_METADATA = '.codepushrelease';
    return _.startsWith(relativeFilePath, __MACOSX)
      || relativeFilePath === DS_STORE
      || _.endsWith(relativeFilePath, '/' + DS_STORE)
      || relativeFilePath === CODEPUSH_METADATA
      || _.endsWith(relativeFilePath, '/' + CODEPUSH_METADATA);
  }
}
