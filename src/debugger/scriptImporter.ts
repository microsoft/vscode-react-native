import fs = require("fs");
import http = require("http");
import path = require("path");
import Q = require("q");
import request = require("request");
import url = require("url");
import vm = require("vm");

interface ISourceMap {
    file: string;
    sources: string[];
    version: number;
    names: string[];
    mappings: string;
    sourceRoot?: string;
    sourcesContent?: string[];
}

export class ScriptImporter {
    private projectRootPath: string;
    private bundleFolderPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
        // We put the source code inside the workspace, because VS Code doesn't seem to support source mapping if we don't do that
        this.bundleFolderPath = path.join(this.projectRootPath, ".vscode");
    }

    private fixSourceMap(sourceMapBody: string, generatedCodeFilePath: string): string {
        try {
            let sourceMap = <ISourceMap> JSON.parse(sourceMapBody);
            sourceMap.sources = sourceMap.sources.map(source => {
                // Make all paths relative to the location of the source map
                let relativeSourcePath = path.relative(this.bundleFolderPath, source);
                let sourceUrl = relativeSourcePath.replace(/\\/g, "/");
                return sourceUrl;
            });
            // fixedSourceMapBody.sourceRoot = "..";
            delete sourceMap.sourcesContent;
            sourceMap.sourceRoot = "";
            sourceMap.file = generatedCodeFilePath;
            return JSON.stringify(sourceMap);
        } catch (exception) {
            return sourceMapBody;
        }
    }

    public import(scriptUrl: string): Q.Promise<void> {

        // We'll get the source code, and store it locally to have a better debugging experience
        return this.request(scriptUrl).then(scriptBody => {
            // Extract sourceMappingURL from body
            let parsedUrl = url.parse(scriptUrl); // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
            let sourceMappingRelativeUrl = this.sourceMapRelativeUrl(scriptBody); // sourceMappingRelativeUrl = "/index.ios.map?platform=ios&dev=true"
            let sourceMappingUrl = parsedUrl.protocol + "//" + parsedUrl.host + sourceMappingRelativeUrl; // sourceMappingUrl = "http://localhost:8081/index.ios.map?platform=ios&dev=true"

            // We'll get the source map, and story it locally, so we can debug the original files instead of the bundle
            return this.request(sourceMappingUrl).then(sourceMapBody => {
                let sourceMappingRelativePath = url.parse(sourceMappingRelativeUrl).pathname.substr(1); // sourceMappingRelativePath = "index.ios.map?platform=ios&dev=true"
                let sourceMappingLocalPath = path.join(this.bundleFolderPath, sourceMappingRelativePath); // sourceMappingLocalPath = "$TMPDIR/index.ios.map?platform=ios&dev=true"
                let scriptFileRelativePath = path.basename(parsedUrl.pathname); // scriptFileRelativePath = "index.ios.bundle"
                this.writeTemporaryFileSync(sourceMappingLocalPath, this.fixSourceMap(sourceMapBody, scriptFileRelativePath));
                // Update the body with the new location of the source map on storage
                scriptBody = scriptBody.replace(/^\/\/# sourceMappingURL=(.*)$/m, "//# sourceMappingURL=" + sourceMappingRelativePath);
            }).then(() => { // TODO: Figure out how to handle the case that the source mapping fails.
                let scriptFilePath = path.join(this.bundleFolderPath, parsedUrl.pathname); // scriptFilePath = "$TMPDIR/index.ios.bundle"
                this.writeTemporaryFileSync(scriptFilePath, scriptBody);

                // The next line converts to any due to the incorrect typing on node.d.ts of vm.runInThisContext
                vm.runInThisContext(scriptBody, <any>{ filename: scriptFilePath });
                console.log("Imported script at " + scriptUrl + " locally stored on " + this.bundleFolderPath);
            });
        });
    }

    private writeTemporaryFileSync(filename: string, data: string) {
        fs.writeFileSync(filename, data);
        this.scheduleTemporaryFileCleanUp(filename);
    }
    private scheduleTemporaryFileCleanUp(filename: string) {
        process.on("exit", function (){
            fs.unlinkSync(filename);
            console.log("Succesfully cleaned temporary file: " + filename);
        });
    }

    private sourceMapRelativeUrl(body: any) {
        let match = body.match(/^\/\/# sourceMappingURL=(.*)$/m);
        // If match is null, the body doesn't contain the source map
        return match ? match[1] : null;
    }

    private request(uri: string): Q.Promise<any> {
        let result = Q.defer<any>();
        request(uri, function (error: any, response: http.IncomingMessage, body: any) {
            if (!error) {
                if (response.statusCode === 200) {
                    result.resolve(body);
                } else {
                    result.reject(body);
                }
            } else {
                result.reject(error);
            }
        });
        return result.promise;
    }
}
