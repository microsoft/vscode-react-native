// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';
import * as JsZip from 'jszip';
import * as yazl from 'yazl';
import * as fileUtils from '../utils/file-utils';

interface ReleaseFile {
  sourceLocation: string; // The current location of the file on disk
  targetLocation: string; // The desired location of the file within the zip
}

export default function zip(updateContentsPath: string, outputDir?: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const releaseFiles: ReleaseFile[] = [];

    if (!fileUtils.isDirectory(updateContentsPath)) {
      releaseFiles.push({
        sourceLocation: updateContentsPath,
        targetLocation: fileUtils.normalizePath(path.basename(updateContentsPath)) // Put the file in the root
      });
    }

    const directoryPath: string = updateContentsPath;
    const baseDirectoryPath = path.join(directoryPath, '..'); // For legacy reasons, put the root directory in the zip

    const files: string[] = await fileUtils.walk(updateContentsPath);

    files.forEach((filePath: string) => {
      const relativePath: string = path.relative(baseDirectoryPath, filePath);
      releaseFiles.push({
        sourceLocation: filePath,
        targetLocation: fileUtils.normalizePath(relativePath)
      });
    });

    if (!outputDir) {
      outputDir = process.cwd();
    }

    const packagePath: string = path.join(outputDir, fileUtils.generateRandomFilename(15) + '.zip');
    const zipFile = new yazl.ZipFile();
    const writeStream: fs.WriteStream = fs.createWriteStream(packagePath);

    zipFile.outputStream.pipe(writeStream)
      .on('error', (error: Error): void => {
        reject(error);
      })
      .on('close', (): void => {
        resolve(packagePath);
      });

    releaseFiles.forEach((releaseFile: ReleaseFile) => {
      zipFile.addFile(releaseFile.sourceLocation, releaseFile.targetLocation);
    });

    zipFile.end();
  });
}
