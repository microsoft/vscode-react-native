// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from 'path';
import * as Q from 'q';
import {FileSystem} from './node/fileSystem';

export class TsdHelper {
   private static REACT_TYPINGS_FOLDERNAME =  "ReactTypings";
   private static REACT_TYPINGS_PATH =  path.resolve(__dirname, "..", "..", TsdHelper.REACT_TYPINGS_FOLDERNAME);

   private static installTypeDefinitionFile(src: string, dest: string): Q.Promise<void> {
       var fileSystem:FileSystem = new FileSystem();
       if (fileSystem.existsSync(dest)) {
           return Q.resolve<void>(void 0);
       }

       // Ensure that the parent folder exits; if not, create the hierarchy of directories
       let parentFolder = path.resolve(dest, "..");
       if (!fileSystem.existsSync(parentFolder)) {
           fileSystem.makeDirectoryRecursiveSync(parentFolder);
       }

       return fileSystem.copyFile(src, dest);
   }

    /**
     *  Helper function to get the target path for the type definition files (to be used for intellisense).
     *  Creates the target path if it does not exist already.
     */
    public static getOrCreateTypingsTargetPath(projectRoot: string): string {
        let targetPath = path.resolve(projectRoot, ".vscode", "typings");
        let fileSystem:FileSystem = new FileSystem();

        if (!fileSystem.existsSync(targetPath)) {
            fileSystem.makeDirectoryRecursiveSync(targetPath);
        }

        return targetPath;
    }

   /**
    *   Helper to install type defintion files for React Native.
    *   {typingsFolderPath} - the parent folder where the type definitions need to be installed
    *   {typeDefsPath} - the relative paths of all type definitions that need to be
    *                    installed (relative to <project_root>\.vscode\typings)
    */
    public static installTypings(typingsFolderPath: string, typeDefsPath: string[]): Q.Promise<any> {
        return Q.all(typeDefsPath.map((relativePath: string): Q.Promise<void> => {
            let src = path.resolve(TsdHelper.REACT_TYPINGS_PATH, relativePath);
            let dest = path.resolve(typingsFolderPath, relativePath);

            return TsdHelper.installTypeDefinitionFile(src, dest);
        }));
    }
}
