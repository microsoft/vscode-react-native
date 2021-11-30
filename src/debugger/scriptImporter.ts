// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import path = require("path");
import url = require("url");
import { logger } from "vscode-debugadapter";
import * as semver from "semver";
import { Request } from "../common/node/request";
import { ensurePackagerRunning } from "../common/packagerStatus";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { FileSystem } from "../common/node/fileSystem";
import { SourceMapUtil } from "./sourceMap";

export interface DownloadedScript {
    contents: string;
    filepath: string;
}

interface IStrictUrl extends url.Url {
    pathname: string;
    href: string;
}

export class ScriptImporter {
    public static DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
    public static DEBUGGER_WORKER_FILENAME = ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME + ".js";
    private packagerAddress: string;
    private packagerPort: number;
    private sourcesStoragePath: string;
    private packagerRemoteRoot?: string;
    private packagerLocalRoot?: string;
    private sourceMapUtil: SourceMapUtil;

    constructor(
        packagerAddress: string,
        packagerPort: number,
        sourcesStoragePath: string,
        packagerRemoteRoot?: string,
        packagerLocalRoot?: string,
    ) {
        this.packagerAddress = packagerAddress;
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        this.packagerRemoteRoot = packagerRemoteRoot;
        this.packagerLocalRoot = packagerLocalRoot;
        this.sourceMapUtil = new SourceMapUtil();
    }

    public async downloadAppScript(
        scriptUrlString: string,
        projectRootPath: string,
    ): Promise<DownloadedScript> {
        const parsedScriptUrl = url.parse(scriptUrlString);
        const overriddenScriptUrlString =
            parsedScriptUrl.hostname === "localhost"
                ? this.overridePackagerPort(scriptUrlString)
                : scriptUrlString;

        // We'll get the source code, and store it locally to have a better debugging experience
        let scriptBody = await Request.request(overriddenScriptUrlString, true);

        const rnVersions = await ProjectVersionHelper.getReactNativeVersions(projectRootPath);
        // unfortunatelly Metro Bundler is broken in RN 0.54.x versions, so use this workaround unless it will be fixed
        // https://github.com/facebook/metro/issues/147
        // https://github.com/microsoft/vscode-react-native/issues/660
        if (
            ProjectVersionHelper.getRNVersionsWithBrokenMetroBundler().includes(
                rnVersions.reactNativeVersion,
            )
        ) {
            const noSourceMappingUrlGenerated = scriptBody.match(/sourceMappingURL=/g) === null;
            if (noSourceMappingUrlGenerated) {
                const sourceMapPathUrl = overriddenScriptUrlString.replace("bundle", "map");
                scriptBody = this.sourceMapUtil.appendSourceMapPaths(scriptBody, sourceMapPathUrl);
            }
        }

        // Extract sourceMappingURL from body
        const scriptUrl = <IStrictUrl>url.parse(overriddenScriptUrlString); // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
        const sourceMappingUrl = this.sourceMapUtil.getSourceMapURL(scriptUrl, scriptBody); // sourceMappingUrl = "http://localhost:8081/index.ios.map?platform=ios&dev=true"

        let waitForSourceMapping: Promise<void> = Promise.resolve();
        if (sourceMappingUrl) {
            /* handle source map - request it and store it locally */
            waitForSourceMapping = this.writeAppSourceMap(sourceMappingUrl, scriptUrl).then(() => {
                scriptBody = this.sourceMapUtil.updateScriptPaths(
                    scriptBody,
                    <IStrictUrl>sourceMappingUrl,
                );
                if (semver.gte(rnVersions.reactNativeVersion, "0.61.0")) {
                    scriptBody = this.sourceMapUtil.removeSourceURL(scriptBody);
                }
            });
        }
        await waitForSourceMapping;
        const scriptFilePath = await this.writeAppScript(scriptBody, scriptUrl);
        logger.verbose(`Script ${overriddenScriptUrlString} downloaded to ${scriptFilePath}`);
        return { contents: scriptBody, filepath: scriptFilePath };
    }

    public async downloadDebuggerWorker(
        sourcesStoragePath: string,
        projectRootPath: string,
        debuggerWorkerUrlPath?: string,
    ): Promise<void> {
        const errPackagerNotRunning = ErrorHelper.getInternalError(
            InternalErrorCode.CannotAttachToPackagerCheckPackagerRunningOnPort,
            this.packagerPort,
        );

        await ensurePackagerRunning(this.packagerAddress, this.packagerPort, errPackagerNotRunning);

        const rnVersions = await ProjectVersionHelper.getReactNativeVersions(projectRootPath);
        const debuggerWorkerURL = this.prepareDebuggerWorkerURL(
            rnVersions.reactNativeVersion,
            debuggerWorkerUrlPath,
        );
        const debuggerWorkerLocalPath = path.join(
            sourcesStoragePath,
            ScriptImporter.DEBUGGER_WORKER_FILENAME,
        );
        logger.verbose(
            "About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath,
        );

        const body = await Request.request(debuggerWorkerURL, true);

        return new FileSystem().writeFile(debuggerWorkerLocalPath, body);
    }

    public prepareDebuggerWorkerURL(rnVersion: string, debuggerWorkerUrlPath?: string): string {
        let debuggerWorkerURL: string;
        // It can be empty string
        if (debuggerWorkerUrlPath !== undefined) {
            debuggerWorkerURL = `http://${this.packagerAddress}:${this.packagerPort}/${debuggerWorkerUrlPath}${ScriptImporter.DEBUGGER_WORKER_FILENAME}`;
        } else {
            let newPackager = "";
            if (
                !semver.valid(
                    rnVersion,
                ) /* Custom RN implementations should support new packager*/ ||
                semver.gte(rnVersion, "0.50.0")
            ) {
                newPackager = "debugger-ui/";
            }
            debuggerWorkerURL = `http://${this.packagerAddress}:${this.packagerPort}/${newPackager}${ScriptImporter.DEBUGGER_WORKER_FILENAME}`;
        }
        return debuggerWorkerURL;
    }

    /**
     * Writes the script file to the project temporary location.
     */
    private async writeAppScript(scriptBody: string, scriptUrl: IStrictUrl): Promise<string> {
        const scriptFilePath = path.join(
            this.sourcesStoragePath,
            path.basename(scriptUrl.pathname),
        ); // scriptFilePath = "$TMPDIR/index.ios.bundle"
        await new FileSystem().writeFile(scriptFilePath, scriptBody);
        return scriptFilePath;
    }

    /**
     * Writes the source map file to the project temporary location.
     */
    private async writeAppSourceMap(
        sourceMapUrl: IStrictUrl,
        scriptUrl: IStrictUrl,
    ): Promise<void> {
        const sourceMapBody = await Request.request(sourceMapUrl.href, true);
        const sourceMappingLocalPath = path.join(
            this.sourcesStoragePath,
            path.basename(sourceMapUrl.pathname),
        ); // sourceMappingLocalPath = "$TMPDIR/index.ios.map"
        const scriptFileRelativePath = path.basename(scriptUrl.pathname); // scriptFileRelativePath = "index.ios.bundle"
        const updatedContent = this.sourceMapUtil.updateSourceMapFile(
            sourceMapBody,
            scriptFileRelativePath,
            this.sourcesStoragePath,
            this.packagerRemoteRoot,
            this.packagerLocalRoot,
        );
        return new FileSystem().writeFile(sourceMappingLocalPath, updatedContent);
    }

    /**
     * Changes the port of the url to be the one configured as this.packagerPort
     */
    private overridePackagerPort(urlToOverride: string): string {
        const components = url.parse(urlToOverride);
        components.port = this.packagerPort.toString();
        delete components.host; // We delete the host, if not the port change will be ignored
        return url.format(components);
    }
}
