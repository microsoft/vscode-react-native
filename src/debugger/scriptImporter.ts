// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {FileSystem} from "../common/node/fileSystem";
import {Log} from "../common/log/log";
import {LogLevel} from "../common/log/logHelper";
import {Packager} from "../common/packager";
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
    public static DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
    public static DEBUGGER_WORKER_FILENAME = ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME + ".js";
    private packagerPort: number;
    private sourcesStoragePath: string;
    private sourceMapUtil: SourceMapUtil;

    constructor(packagerPort: number, sourcesStoragePath: string) {
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        this.sourceMapUtil = new SourceMapUtil();
    }

    public downloadAppScript(scriptUrlString: string, debugAdapterPort: number): Q.Promise<DownloadedScript> {
        const parsedScriptUrl = url.parse(scriptUrlString);
        const overriddenScriptUrlString = (parsedScriptUrl.hostname === "localhost") ? this.overridePackagerPort(scriptUrlString) : scriptUrlString;
        // We'll get the source code, and store it locally to have a better debugging experience
        return new Request().request(overriddenScriptUrlString, true).then(scriptBody => {
            // Extract sourceMappingURL from body
            let scriptUrl = url.parse(overriddenScriptUrlString); // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
            let sourceMappingUrl = this.sourceMapUtil.getSourceMapURL(scriptUrl, scriptBody); // sourceMappingUrl = "http://localhost:8081/index.ios.map?platform=ios&dev=true"

            let waitForSourceMapping = Q<void>(null);
            if (sourceMappingUrl) {
                /* handle source map - request it and store it locally */
                waitForSourceMapping = this.writeAppSourceMap(sourceMappingUrl, scriptUrl)
                    .then(() => {
                        scriptBody = this.sourceMapUtil.updateScriptPaths(scriptBody, sourceMappingUrl);
                    });
            }

            return waitForSourceMapping
                .then(() => this.writeAppScript(scriptBody, scriptUrl))
                .then((scriptFilePath: string) => {
                    Log.logInternalMessage(LogLevel.Info, `Script ${overriddenScriptUrlString} downloaded to ${scriptFilePath}`);
                    return { contents: scriptBody, filepath: scriptFilePath };
                }).finally(() => {
                    // Request that the debug adapter update breakpoints and sourcemaps now that we have written them
                    return new Request().request(`http://localhost:${debugAdapterPort}/refreshBreakpoints`);
                });
        });
    }

    public downloadDebuggerWorker(sourcesStoragePath: string): Q.Promise<void> {
        return Packager.isPackagerRunning(Packager.getHostForPort(this.packagerPort))
            .then(running => {
                if (running) {
                    let debuggerWorkerURL = `http://${Packager.getHostForPort(this.packagerPort)}/${ScriptImporter.DEBUGGER_WORKER_FILENAME}`;
                    let debuggerWorkerLocalPath = path.join(sourcesStoragePath, ScriptImporter.DEBUGGER_WORKER_FILENAME);
                    Log.logInternalMessage(LogLevel.Info, "About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath);
                    return new Request().request(debuggerWorkerURL, true).then((body: string) => {
                        return new FileSystem().writeFile(debuggerWorkerLocalPath, body);
                    });
                }
                throw new RangeError(`Cannot attach to packager. Are you sure there is a packager and it is running in the port ${this.packagerPort}? If your packager is configured to run in another port make sure to add that to the setting.json.`);
            });
    }

    /**
     * Writes the script file to the project temporary location.
     */
    private writeAppScript(scriptBody: string, scriptUrl: url.Url): Q.Promise<String> {
        let scriptFilePath = path.join(this.sourcesStoragePath, path.basename(scriptUrl.pathname)); // scriptFilePath = "$TMPDIR/index.ios.bundle"
        return new FileSystem().writeFile(scriptFilePath, scriptBody)
            .then(() => scriptFilePath);
    }

    /**
     * Writes the source map file to the project temporary location.
     */
    private writeAppSourceMap(sourceMapUrl: url.Url, scriptUrl: url.Url): Q.Promise<void> {
        return new Request().request(sourceMapUrl.href, true)
            .then((sourceMapBody: string) => {
                let sourceMappingLocalPath = path.join(this.sourcesStoragePath, path.basename(sourceMapUrl.pathname)); // sourceMappingLocalPath = "$TMPDIR/index.ios.map"
                let scriptFileRelativePath = path.basename(scriptUrl.pathname); // scriptFileRelativePath = "index.ios.bundle"
                let updatedContent = this.sourceMapUtil.updateSourceMapFile(sourceMapBody, scriptFileRelativePath, this.sourcesStoragePath);
                return new FileSystem().writeFile(sourceMappingLocalPath, updatedContent);
            });
    }

    /**
     * Changes the port of the url to be the one configured as this.packagerPort
     */
    private overridePackagerPort(urlToOverride: string): string {
        let components = url.parse(urlToOverride);
        components.port = this.packagerPort.toString();
        delete components.host; // We delete the host, if not the port change will be ignored
        return url.format(components);
    }
}
