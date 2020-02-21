// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");
import { LoggingDebugSession, Logger, logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { getLoggingDirectory } from "../extension/log/LogHelper";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { ILaunchArgs } from "../extension/launchArgs";
import { ProjectVersionHelper } from "../common/projectVersionHelper";
import { TelemetryHelper } from "../common/telemetryHelper";

export interface IAttachRequestArgs extends DebugProtocol.AttachRequestArguments, ILaunchArgs {
    cwd: string; /* Automatically set by VS Code to the currently opened folder */
    port: number;
    url?: string;
    address?: string;
}

export interface ILaunchRequestArgs extends DebugProtocol.LaunchRequestArguments, IAttachRequestArgs { }

export class RNDebugSession extends LoggingDebugSession {

    private projectRootPath: string;
    // private remoteExtension: RemoteExtension;

    constructor(private session: vscode.DebugSession) {
        super();
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        super.initializeRequest(response, args);
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArgs, request?: DebugProtocol.Request): Promise<void> {

        return Promise.resolve();
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArgs, request?: DebugProtocol.Request): void {

    }

    private initializeSettings(args: any): Q.Promise<any> {
        let chromeDebugCoreLogs = getLoggingDirectory();
        if (chromeDebugCoreLogs) {
            chromeDebugCoreLogs = path.join(chromeDebugCoreLogs, "ChromeDebugCoreLogs.txt");
        }
        let logLevel: string = args.trace;
        if (logLevel) {
            logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
            logger.setup(Logger.LogLevel[logLevel], chromeDebugCoreLogs || false);
        } else {
            logger.setup(Logger.LogLevel.Log, chromeDebugCoreLogs || false);
        }

        if (!args.sourceMaps) {
            args.sourceMaps = true;
        }

        const projectRootPath = getProjectRoot(args);
        return ReactNativeProjectHelper.isReactNativeProject(projectRootPath)
            .then((result) => {
                if (!result) {
                    throw ErrorHelper.getInternalError(InternalErrorCode.NotInReactNativeFolderError);
                }
                this.projectRootPath = projectRootPath;

                return void 0;
            });
    }
}

/**
 * Parses settings.json file for workspace root property
 */
function getProjectRoot(args: any): string {
    const vsCodeRoot = args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
    const settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
    try {
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools.projectRoot"] || parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    } catch (e) {
        logger.verbose(`${settingsPath} file doesn't exist or its content is incorrect. This file will be ignored.`);
        return args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
    }
}
