// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ExpoHostType, IExponentRunOptions, PlatformType } from "../launchArgs";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import { ExponentHelper } from "./exponentHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { QRCodeContentProvider } from "../qrCodeContentProvider";

import * as vscode from "vscode";
import * as XDL from "./xdlInterface";
import * as url from "url";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ExponentPlatform extends GeneralMobilePlatform {
    private exponentTunnelPath: string | null;
    private exponentHelper: ExponentHelper;
    private qrCodeContentProvider: QRCodeContentProvider = new QRCodeContentProvider();

    constructor(runOptions: IExponentRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.exponentHelper = this.packager.getExponentHelper();
        this.exponentTunnelPath = null;
    }

    public runApp(): Promise<void> {
        let extProps = {
            platform: {
                value: PlatformType.Exponent,
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        return new Promise((resolve, reject) => {
            TelemetryHelper.generate("ExponentPlatform.runApp", extProps, () => {
                return this.loginToExponentOrSkip(this.runOptions.expoHostType)
                    .then(() =>
                        XDL.setOptions(this.projectPath, { packagerPort: this.packager.getPort() }),
                    )
                    .then(() => XDL.startExponentServer(this.projectPath))
                    .then(() => {
                        if (this.runOptions.expoHostType !== "tunnel") {
                            // the purpose of this is to save the same sequence of handling 'adb reverse' command execution as in Expo
                            // https://github.com/expo/expo-cli/blob/1d515d21200841e181518358fd9dc4c7b24c7cd6/packages/xdl/src/Project.ts#L2226-L2370
                            // we added this to be sure that our Expo launching logic doesn't have any negative side effects
                            return XDL.stopAdbReverse(this.projectPath);
                        }
                        return XDL.startTunnels(this.projectPath);
                    })
                    .then(() => {
                        if (this.runOptions.expoHostType !== "local") return false;
                        // we need to execute 'adb reverse' command to bind ports used by Expo and RN of local machine to ports of a connected Android device or a running emulator
                        return XDL.startAdbReverse(this.projectPath);
                    })
                    .then(isAdbReversed => {
                        switch (this.runOptions.expoHostType) {
                            case "lan":
                                return XDL.getUrl(this.projectPath, {
                                    dev: true,
                                    minify: false,
                                    hostType: "lan",
                                });
                            case "local":
                                if (isAdbReversed) {
                                    this.logger.info(
                                        localize(
                                            "ExpoStartAdbReverseSuccess",
                                            "A device or an emulator was found, 'adb reverse' command successfully executed.",
                                        ),
                                    );
                                } else {
                                    this.logger.warning(
                                        localize(
                                            "ExpoStartAdbReverseFailure",
                                            "Adb reverse command failed. Couldn't find connected over usb device or running emulator. Also please make sure that there is only one currently connected device or running emulator.",
                                        ),
                                    );
                                }

                                return XDL.getUrl(this.projectPath, {
                                    dev: true,
                                    minify: false,
                                    hostType: "localhost",
                                });
                            case "tunnel":
                            default:
                                return XDL.getUrl(this.projectPath, { dev: true, minify: false });
                        }
                    })
                    .then(exponentUrl => {
                        return "exp://" + url.parse(exponentUrl).host;
                    })
                    .then(exponentUrl => {
                        if (this.runOptions.openExpoQR) {
                            let exponentPage = vscode.window.createWebviewPanel(
                                "Expo QR Code",
                                "Expo QR Code",
                                vscode.ViewColumn.Two,
                                {},
                            );
                            exponentPage.webview.html = this.qrCodeContentProvider.provideTextDocumentContent(
                                vscode.Uri.parse(exponentUrl),
                            );
                        }
                        return exponentUrl;
                    })
                    .then(exponentUrl => {
                        if (!exponentUrl) {
                            return reject(
                                ErrorHelper.getInternalError(
                                    InternalErrorCode.ExpectedExponentTunnelPath,
                                ),
                            );
                        }
                        this.exponentTunnelPath = exponentUrl;
                        const outputMessage = localize(
                            "ExponentServerIsRunningOpenToSeeIt",
                            "Expo server is running. Open your Expo app at {0} to see it.",
                            this.exponentTunnelPath,
                        );
                        this.logger.info(outputMessage);

                        const copyButton = localize("CopyToClipboard", "Copy to clipboard");

                        vscode.window
                            .showInformationMessage(outputMessage, copyButton)
                            .then(selection => {
                                if (selection === copyButton) {
                                    vscode.env.clipboard.writeText(exponentUrl);
                                }
                            });

                        return resolve();
                    })
                    .catch(reason => {
                        return reject(reason);
                    });
            });
        });
    }

    public loginToExponentOrSkip(expoHostType?: ExpoHostType): Promise<any> {
        if (expoHostType !== "tunnel") {
            return Promise.resolve();
        }
        return this.exponentHelper.loginToExponent(
            (message, password) => {
                return new Promise((resolve, reject) => {
                    vscode.window
                        .showInputBox({ placeHolder: message, password: password })
                        .then(login => {
                            resolve(login || "");
                        }, reject);
                });
            },
            message => {
                return new Promise((resolve, reject) => {
                    const okButton = { title: "Ok" };
                    const cancelButton = { title: "Cancel", isCloseAffordance: true };
                    vscode.window
                        .showInformationMessage(message, { modal: true }, okButton, cancelButton)
                        .then(answer => {
                            if (answer === cancelButton) {
                                reject(
                                    ErrorHelper.getInternalError(
                                        InternalErrorCode.UserCancelledExpoLogin,
                                    ),
                                );
                            }
                            resolve("");
                        }, reject);
                });
            },
        );
    }

    public beforeStartPackager(): Promise<void> {
        return this.exponentHelper.configureExponentEnvironment();
    }

    public enableJSDebuggingMode(): Promise<void> {
        this.logger.info(
            localize(
                "ApplicationIsRunningOnExponentShakeDeviceForRemoteDebugging",
                "Application is running on Expo. Please shake device and select 'Debug JS Remotely' to enable debugging.",
            ),
        );
        return Promise.resolve();
    }

    public getRunArguments(): string[] {
        return [];
    }
}
