// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { IRunOptions } from "../launchArgs";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import { ExponentHelper } from "./exponentHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { QRCodeContentProvider } from "../qrCodeContentProvider";

import * as vscode from "vscode";
import * as Q from "q";
import * as XDL from "./xdlInterface";
import * as url from "url";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();


export class ExponentPlatform extends GeneralMobilePlatform {
    private exponentTunnelPath: string | null;
    private exponentHelper: ExponentHelper;
    private qrCodeContentProvider: QRCodeContentProvider = new QRCodeContentProvider();

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
                        const okButton =  { title: "Ok" };
                        const cancelButton =  { title: "Cancel", isCloseAffordance: true };
                        vscode.window.showInformationMessage(message, {modal: true}, okButton, cancelButton)
                            .then(answer => {
                                if (answer === cancelButton) {
                                    reject(ErrorHelper.getInternalError(InternalErrorCode.UserCancelledExpoLogin));
                                }
                                resolve("");
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
                    let exponentPage = vscode.window.createWebviewPanel("Expo QR Code", "Expo QR Code", vscode.ViewColumn.Two, { });
                    exponentPage.webview.html = this.qrCodeContentProvider.provideTextDocumentContent(vscode.Uri.parse(exponentUrl));
                    return exponentUrl;
                })
                .then(exponentUrl => {
                    if (!exponentUrl) {
                        return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath));
                    }
                    this.exponentTunnelPath = exponentUrl;
                    const outputMessage = localize("ApplicationIsRunningOnExponentOpenToSeeIt", "Application is running on Exponent. Open your exponent app at {0} to see it.", this.exponentTunnelPath);
                    this.logger.info(outputMessage);

                    return Q.resolve(void 0);
                });
        });
    }

    public beforeStartPackager(): Q.Promise<void> {
        return this.exponentHelper.configureExponentEnvironment();
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info(localize("ApplicationIsRunningOnExponentShakeDeviceForRemoteDebugging", "Application is running on Exponent. Please shake device and select 'Debug JS Remotely' to enable debugging."));
        return Q.resolve<void>(void 0);
    }

    public getRunArguments(): string[] {
        return [];
    }
}
