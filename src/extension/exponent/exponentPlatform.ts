// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { IExponentRunOptions } from "../launchArgs";
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

    constructor(runOptions: IExponentRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.exponentHelper = new ExponentHelper(runOptions.workspaceRoot, runOptions.projectRoot);
        this.exponentTunnelPath = null;
    }

    public runApp(): Q.Promise<void> {
        let extProps = {
            platform: {
                value: "exponent",
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addPropertyToTelemetryProperties(this.runOptions.reactNativeVersions.reactNativeVersion, "reactNativeVersion", extProps);

        return TelemetryHelper.generate("ExponentPlatform.runApp", extProps, () => {
            return this.loginToExponentOrSkip(this.runOptions.expoConnectionType)
                .then(() =>
                    XDL.setOptions(this.projectPath, { packagerPort: this.packager.port })
                )
                .then(() =>
                    XDL.startExponentServer(this.projectPath)
                )
                .then(() => {
                    if (this.runOptions.expoConnectionType !== "tunnel") {
                        // we should cancel previous adb reverse to prevent future possible conflicts
                        // stopAdbReverse function is also called in startTunnels func by Expo design
                        return XDL.stopAdbReverse(this.projectPath);
                    }
                    return XDL.startTunnels(this.projectPath);
                })
                .then(() => {
                    if (this.runOptions.expoConnectionType !== "local") return false;
                    return XDL.startAdbReverse(this.projectPath);
                })
                .then((isAdbReversed) => {
                    if (this.runOptions.expoConnectionType === "tunnel") {
                        return XDL.getUrl(this.projectPath, { dev: true, minify: false });
                    } else {
                        if (isAdbReversed) {
                            this.logger.info(localize("ExpoStartAdbReverseSuccess", "A device or an emulator was found, 'adb reverse' command successfully executed."));
                        } else {
                            this.logger.warning(localize("ExpoStartAdbReverseFailure", "Adb reverse command failed. Couldn't find connected over usb device or running simulator. Also please make sure that there is only one currently connected device or running emulator."));
                        }

                        if (this.runOptions.expoConnectionType === "lan") {
                            return XDL.getUrl(this.projectPath, { dev: true, minify: false, hostType: "lan" });
                        } else {
                            return XDL.getUrl(this.projectPath, { dev: true, minify: false, hostType: "localhost" });
                        }
                    }
                })
                .then(exponentUrl => {
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
                    const outputMessage = localize("ApplicationIsRunningOnExponentOpenToSeeIt", "Application is running on Expo. Open your Expo app at {0} to see it.", this.exponentTunnelPath);
                    this.logger.info(outputMessage);

                    return Q.resolve(void 0);
                });
        });
    }

    public loginToExponentOrSkip(expoConnectionType?: "tunnel" | "lan" | "local") {
        if (expoConnectionType !== "tunnel") return  Q({});
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
        );
    }

    public beforeStartPackager(): Q.Promise<void> {
        return this.exponentHelper.configureExponentEnvironment();
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info(localize("ApplicationIsRunningOnExponentShakeDeviceForRemoteDebugging", "Application is running on Expo. Please shake device and select 'Debug JS Remotely' to enable debugging."));
        return Q.resolve<void>(void 0);
    }

    public getRunArguments(): string[] {
        return [];
    }
}
