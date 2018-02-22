import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as rimraf from 'rimraf';
import * as temp from 'temp';
import * as _ from 'lodash';
const noop = require('node-noop').noop;


export function fileExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch (e) { return false; }
}

export function isBinaryOrZip(path: string): boolean {
  return path.search(/\.zip$/i) !== -1
    || path.search(/\.apk$/i) !== -1
    || path.search(/\.ipa$/i) !== -1;
}

export function isDirectory(path: string): boolean {
  return fs.statSync(path).isDirectory();
}

export function copyFileToTmpDir(filePath: string): string {
  if (!isDirectory(filePath)) {
    const outputFolderPath: string = temp.mkdirSync('code-push');
    rimraf.sync(outputFolderPath);
    fs.mkdirSync(outputFolderPath);

    const outputFilePath: string = path.join(outputFolderPath, path.basename(filePath));
    fs.writeFileSync(outputFilePath, fs.readFileSync(filePath));

    return outputFolderPath;
  }
}

export function generateRandomFilename(length: number): string {
  let filename: string = '';
  const validChar: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    filename += validChar.charAt(Math.floor(Math.random() * validChar.length));
  }

  return filename;
}

export function fileDoesNotExistOrIsDirectory(path: string): boolean {
  try {
    return isDirectory(path);
  } catch (error) {
    return true;
  }
}

export function createEmptyTmpReleaseFolder(folderPath: string): void {
  rimraf.sync(folderPath);
  fs.mkdirSync(folderPath);
}

export function removeReactTmpDir(): void {
  rimraf.sync(`${os.tmpdir()}/react-*`);
}

export function normalizePath(filePath: string): string {
  // replace all backslashes coming from cli running on windows machines by slashes
  return filePath.replace(/\\/g, '/');
}

export async function walk(dir: string): Promise<string[]> {
  const stats = await stat(dir);
  if (stats.isDirectory()) {
    var files: string[] = [];
    for (const file of await readdir(dir)) {
      files = files.concat(await walk(path.join(dir, file)));
    }
    return files;
  } else {
    return [dir];
  }
}

export async function stat(path: string | Buffer): Promise<fs.Stats> {
  return (await callFs(fs.stat, path))[0];
}

export async function readdir(path: string | Buffer): Promise<string[]> {
  return (await callFs(fs.readdir, path))[0];
}

export function readFile(filename: string): Promise<Buffer>;
export function readFile(filename: string, encoding: string): Promise<string>;
export function readFile(filename: string, options: { flag?: string; }): Promise<Buffer>;
export function readFile(filename: string, options?: string | { encoding: string; flag?: string; }): Promise<string>;
export async function readFile(...args: any[]): Promise<any> {
  return (await callFs(fs.readFile, ...args))[0];
}

export async function access(path: string | Buffer, mode: number): Promise<void> {
  return callFs(fs.access, path, mode).then(() => { noop(); });
}

export function rmDir(source: string, recursive: boolean = true): Promise<void> {
  if (recursive) {
    return new Promise<void>((resolve, reject) => {
      rimraf(source, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } else {
    return callFs(fs.rmdir, source).then(() => { noop(); });
  }
}

export function mkTempDir(affixes: string): Promise<string> {
  return callTemp(temp.mkdir, affixes);
}

function callTemp<TResult>(func: (...args: any[]) => void, ...args: any[]): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    func.apply(temp, _.concat(args, [
      (err: any, result: TResult) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    ]));
  });
}

function callFs(func: (...args: any[]) => void, ...args: any[]): Promise<any[]> {
  return new Promise<any[]>((resolve, reject) => {
    func.apply(fs, _.concat(args, [
      (err: any, ...args: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(args);
        }
      }
    ]));
  });
}