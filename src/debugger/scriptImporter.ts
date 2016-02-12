// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import {Log, LogLevel} from "../common/log";
import path = require("path");
import Q = require("q");
import {Request} from "../common/node/request";
import {SourceMapUtil} from "./sourceMap";
import url = require("url");

interface DownloadedScript {
    contents: string;
    filepath: string;
}

export class ScriptImporter {
    private sourcesStoragePath: string;
    private debugAdapterPort: number;
    private sourceMapUtil: SourceMapUtil;

    constructor(sourcesStoragePath: string, debugAdapterPort: number) {
        this.sourcesStoragePath = sourcesStoragePath;
        this.debugAdapterPort = debugAdapterPort;
        this.sourceMapUtil = new SourceMapUtil();
    }

    public download(scriptUrlString: string): Q.Promise<DownloadedScript> {

        // We'll get the source code, and store it locally to have a better debugging experience
        return new Request().request(scriptUrlString, true).then(scriptBody => {
            // Extract sourceMappingURL from body
            let scriptUrl = url.parse(scriptUrlString); // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
            let sourceMappingUrl = this.sourceMapUtil.getSourceMapURL(scriptUrl, scriptBody); // sourceMappingUrl = "http://localhost:8081/index.ios.map?platform=ios&dev=true"

            let waitForSourceMapping = Q<void>(null);
            if (sourceMappingUrl) {
                /* handle source map - request it and store it locally */
                waitForSourceMapping = this.writeSourceMap(sourceMappingUrl, scriptUrl)
                    .then(() => {
                        scriptBody = this.sourceMapUtil.updateScriptPaths(scriptBody, sourceMappingUrl);
                    });
            }

            return waitForSourceMapping
                .then(() => this.writeScript(scriptBody, scriptUrl))
                .then((scriptFilePath: string) => {
                    Log.logInternalMessage(LogLevel.Info, `Script ${scriptUrlString} downloaded to ${scriptFilePath}`);
                    return { contents: scriptBody, filepath: scriptFilePath };
                });
        });
    }

    /**
     * Writes the script file to the project temporary location.
     */
    private writeScript(scriptBody: string, scriptUrl: url.Url): Q.Promise<String> {
        let scriptFilePath = path.join(this.sourcesStoragePath, scriptUrl.pathname); // scriptFilePath = "$TMPDIR/index.ios.bundle"
        return new FileSystem().writeFile(scriptFilePath, scriptBody)
            .then(() => scriptFilePath);
    }

    /**
     * Writes the source map file to the project temporary location.
     */
    private writeSourceMap(sourceMapUrl: url.Url, scriptUrl: url.Url): Q.Promise<void> {
        return new Request().request(sourceMapUrl.href, true)
            .then((sourceMapBody: string) => {
                let sourceMappingLocalPath = path.join(this.sourcesStoragePath, sourceMapUrl.pathname); // sourceMappingLocalPath = "$TMPDIR/index.ios.map"
                let scriptFileRelativePath = path.basename(scriptUrl.pathname); // scriptFileRelativePath = "index.ios.bundle"
                let updatedContent = this.sourceMapUtil.updateSourceMapFile(sourceMapBody, scriptFileRelativePath, this.sourcesStoragePath);
                return new FileSystem().writeFile(sourceMappingLocalPath, updatedContent);
            }).then(() => {
                // TODO: update port based on command line arguments
                // Request that the debug adapter update breakpoints and sourcemaps now that we have written them
                return new Request().request(`http://localhost:${this.debugAdapterPort}/refreshBreakpoints`);
            });
    }
}
