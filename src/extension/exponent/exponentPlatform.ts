// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { IRunOptions } from "../launchArgs";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import { ExponentHelper } from "./exponentHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";

import * as vscode from "vscode";
import * as Q from "q";
import * as XDL from "./xdlInterface";
import * as url from "url";

export class ExponentPlatform extends GeneralMobilePlatform {
    private exponentTunnelPath: string | null;
    private exponentHelper: ExponentHelper;

    constructor(runOptions: IRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.exponentHelper = new ExponentHelper(runOptions.workspaceRoot, runOptions.projectRoot);
        this.exponentTunnelPath = null;
    }

    public runApp(): Q.Promise<void> {
        const extProps = {
            platform: {
                value: "exponent",
                isPii: false,
            },
        };

        return TelemetryHelper.generate("ExponentPlatform.runApp", extProps, () => {
            return this.exponentHelper.loginToExponent(
                (message, password) => {
                    return Q.Promise((resolve, reject) => {
                        vscode.window.showInputBox({ placeHolder: message, password: password })
                            .then(login => {
                                resolve(login || "");
                            }, reject);
                    });
                },
                (message) => {
                    return Q.Promise((resolve, reject) => {
                        vscode.window.showInformationMessage(message)
                            .then(password => {
                                resolve(password || "");
                            }, reject);
                    });
                }
            )
                .then(() =>
                    XDL.setOptions(this.projectPath, { packagerPort: this.packager.port })
                )
                .then(() =>
                    XDL.startExponentServer(this.projectPath)
                )
                .then(() =>
                    XDL.startTunnels(this.projectPath)
                )
                .then(() =>
                    XDL.getUrl(this.projectPath, { dev: true, minify: false })
                ).then(exponentUrl => {
                    return "exp://" + url.parse(exponentUrl).host;
                })
                .catch(reason => {
                    return Q.reject<string>(reason);
                })
                .then(exponentUrl => {
                    vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(exponentUrl), 1, "Expo QR code");
                    return exponentUrl;
                })
                .then(exponentUrl => {
                    if (!exponentUrl) {
                        return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath,
                            "No link provided by exponent. Is your project correctly setup?"));
                    }
                    this.exponentTunnelPath = exponentUrl;
                    const outputMessage = `Application is running on Exponent. Open your exponent app at ${this.exponentTunnelPath} to see it.`;
                    this.logger.info(outputMessage);

                    return Q.resolve(void 0);
                });
        });
    }

    public beforeStartPackager(): Q.Promise<void> {
        return this.exponentHelper.configureExponentEnvironment();
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info("Application is running on Exponent. Please shake device and select 'Debug JS Remotely' to enable debugging.");
        return Q.resolve<void>(void 0);
    }

    public getRunArguments(): string[] {
        return [];
    }
}
