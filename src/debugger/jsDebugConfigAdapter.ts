// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as semver from "semver";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { IAttachRequestArgs } from "./debugSessionBase";

export class JsDebugConfigAdapter {
    private static RNVersion_Direct_Debug = "0.76.0";
    public static createDebuggingConfigForPureRN(
        attachArgs: IAttachRequestArgs,
        cdpProxyPort: number,
        sessionId: string,
    ): any {
        return Object.assign({}, JsDebugConfigAdapter.getExistingExtraArgs(attachArgs), {
            type: "pwa-node",
            request: "attach",
            name: "Attach",
            continueOnAttach: true,
            port: cdpProxyPort,
            // The unique identifier of the debug session. It is used to distinguish React Native extension's
            // debug sessions from other ones. So we can save and process only the extension's debug sessions
            // in vscode.debug API methods "onDidStartDebugSession" and "onDidTerminateDebugSession".
            rnDebugSessionId: sessionId,
            // Fixes https://github.com/microsoft/vscode/issues/102042
            resolveSourceMapLocations: ["!**/debuggerWorker.js"],
        });
    }

    public static async createDebuggingConfigForRNHermes(
        attachArgs: IAttachRequestArgs,
        cdpProxyPort: number,
        sessionId: string,
    ) {
        const extraArgs: any = {};
        const versions = await ProjectVersionHelper.getReactNativeVersions(attachArgs.cwd);
        // Handle project file path from 0.76
        if (semver.gte(versions.reactNativeVersion, JsDebugConfigAdapter.RNVersion_Direct_Debug)) {
            extraArgs.sourceMapPathOverrides = {
                "/[metro-project]/*": `${attachArgs.cwd}/*`,
            };
        }

        return Object.assign({}, JsDebugConfigAdapter.getExistingExtraArgs(attachArgs), extraArgs, {
            type: "pwa-node",
            request: "attach",
            name: "Attach",
            continueOnAttach: true,
            port: cdpProxyPort,
            // The unique identifier of the debug session. It is used to distinguish React Native extension's
            // debug sessions from other ones. So we can save and process only the extension's debug sessions
            // in vscode.debug API methods "onDidStartDebugSession" and "onDidTerminateDebugSession".
            rnDebugSessionId: sessionId,
            // We need to provide js-debug with the "**" pattern, so that it can get source maps over a http URL.
            // We need to allow "**/node_modules/expo/**" path, since Expo source maps URL contains it.
            resolveSourceMapLocations: ["**", "!**/node_modules/!(expo)/**"],
        });
    }

    public static createChromeDebuggingConfig(
        attachArgs: IAttachRequestArgs,
        cdpProxyPort: number,
        pwaSessionName: string,
        sessionId: string,
    ): any {
        const extraArgs: any = {};

        return Object.assign({}, this.getExistingExtraArgs(attachArgs), extraArgs, {
            type: pwaSessionName,
            request: "attach",
            name: "Attach",
            port: cdpProxyPort,
            webRoot: attachArgs.cwd,
            rnDebugSessionId: sessionId,
        });
    }

    private static getExistingExtraArgs(attachArgs: IAttachRequestArgs): any {
        const existingExtraArgs: any = {};
        if (attachArgs.env) {
            existingExtraArgs.env = attachArgs.env;
        }
        if (attachArgs.envFile) {
            existingExtraArgs.envFile = attachArgs.envFile;
        }
        existingExtraArgs.sourceMaps = attachArgs.sourceMaps;
        existingExtraArgs.sourceMapRenames = attachArgs.sourceMapRenames;
        if (attachArgs.sourceMapPathOverrides) {
            existingExtraArgs.sourceMapPathOverrides = attachArgs.sourceMapPathOverrides;
        }
        if (attachArgs.skipFiles) {
            existingExtraArgs.skipFiles = attachArgs.skipFiles;
        }
        if (attachArgs.jsDebugTrace) {
            existingExtraArgs.trace = attachArgs.jsDebugTrace;
        }

        return existingExtraArgs;
    }
}
