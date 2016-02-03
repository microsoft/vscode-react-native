// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import {Log} from "../utils/commands/log";
import {OutputChannel} from "vscode";
import {PlatformResolver} from "./platformResolver";
import {PromiseUtil} from "../utils/node/promise";
import {Request} from "../utils/node/request";
import * as Q from "q";

export class Packager {
    public static HOST = "localhost:8081";
    private projectPath: string;
    private packagerProcess: ChildProcess;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
    }

    private isRunning(): Q.Promise<boolean> {
        let statusURL = `http://${Packager.HOST}/status`;

        return new Request().request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    private awaitStart(retryCount = 30, delay = 2000): Q.Promise<boolean> {
        let pu: PromiseUtil = new PromiseUtil();
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, "Could not start the packager.");
    }

    public start(skipDebuggerEnvSetup?: boolean, outputChannel?: OutputChannel): Q.Promise<void> {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        this.isRunning().done(running => {
            if (!running) {
                let mandatoryArgs = ["start"];
                let args = mandatoryArgs.concat(desktopPlatform.reactPackagerExtraParameters);
                let childEnvForDebugging = Object.assign({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                if (outputChannel) {
                    outputChannel.appendLine("######### Starting the Packager ##########");
                    outputChannel.show();
                }
                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish

                let spawnOptions = skipDebuggerEnvSetup ? {} : { env: childEnvForDebugging };
                new CommandExecutor(this.projectPath).spawn(desktopPlatform.reactNativeCommandName, args, spawnOptions).then((packagerProcess) => {
                    this.packagerProcess = packagerProcess;
                }).done();
            }
        });

        return this.awaitStart().then(() => {
            if (outputChannel) {
                outputChannel.appendLine("######### Packager started ##########");
            } else {
                Log.logMessage("Packager started.");
            }
        });
    }

    public stop(outputChannel?: OutputChannel): void {
        if (outputChannel) {
            outputChannel.appendLine("######### Stopping the Packager ##########");
            outputChannel.show();
        }

        if (this.packagerProcess) {
            this.packagerProcess.kill();
        }

        if (outputChannel) {
            outputChannel.appendLine("######### Packager stopped ##########");
        } else {
            Log.logMessage("Packager stopped.");
        }
    }
}
