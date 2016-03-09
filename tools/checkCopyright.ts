// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

var FindFiles = require("node-find-files");
var fs = require("fs");
import Q = require("q");
import path_module = require("path");

class CopyrightVerifier {
    private foundMissing = false;
    
    private static UTB_BYTE_ORDER_MARKER = "\ufeff";
    private static SOURCE_CODE_FILE_PATTERN = /.*\.(ts|js)$/;
    private static EXCLUDED_FILE_PATTERN = /.*\.d\.ts/;
    private static COPYRIGHT_NOTICE = "// Copyright (c) Microsoft Corporation. All rights reserved.\n" +
                                      "// Licensed under the MIT license. See LICENSE file in the project root for details.\n";

    private findIn(path: string): Q.Promise<string[]> {
        const defer = Q.defer<string[]>();
        const foundFiles: string[] = [];
        const finder = new FindFiles({
            rootFolder: path,
            filterFunction: (path: string, stat: any) => {
                // match only filename
                return path.match(CopyrightVerifier.SOURCE_CODE_FILE_PATTERN) && !path.match(CopyrightVerifier.EXCLUDED_FILE_PATTERN);
            }
        });

        finder.on("match", (filePath: string, fileStats: any) => {
            let contents = fs.readFileSync(filePath).toString().replace(/\r\n/g, "\n");
            if (contents.startsWith(CopyrightVerifier.UTB_BYTE_ORDER_MARKER)) {
                contents = contents.substr(1);
            }
            if (!contents.startsWith(CopyrightVerifier.COPYRIGHT_NOTICE)) {
                foundFiles.push(filePath);
            }
        });
        
        finder.on("complete", function() {
            return defer.resolve(foundFiles);
        });
        
        finder.on("patherror", (err: any, strPath: string) => {
            // defer.reject("Error for Path " + strPath + " " + err);
        })
        
        finder.on("error", (err: any) => {
            defer.reject("Global Error " + err);
        })        
        
        finder.startSearch();
        
        return defer.promise;
    }

    private findInAll(paths: string[]): Q.Promise<string[]> {
        return Q.all(paths.map(path => this.findIn(path_module.resolve(path)))).then(invalids => {
            return [].concat.apply([], invalids);
        });
    }

    public verify(...paths: string[]): void {
        return this.findInAll(paths).done(filePaths => {
            if (filePaths.length !== 0) {
                process.stderr.write("Found files which don't match the expected copyright notice:\n");
                filePaths.forEach(filePath => process.stderr.write(`\t${filePath}\n`));
                process.exit(1);
            } else {
                process.exit(0);
            }
        }, (reason: any) => {
            process.stderr.write(`Uknown error while trying to check files copyright: ${reason}`);
            process.exit(1);
        });
    }
}

new CopyrightVerifier().verify("../src", "../tools");