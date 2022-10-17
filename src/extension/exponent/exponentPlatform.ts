// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as url from "url";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { generate } from "qrcode-terminal";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ExpoHostType, IExponentRunOptions, PlatformType } from "../launchArgs";
import { GeneralPlatform, MobilePlatformDeps } from "../generalPlatform";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { QRCodeContentProvider } from "../qrCodeContentProvider";
import { ExponentHelper } from "./exponentHelper";

import * as XDL from "./xdlInterface";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ExponentPlatform extends GeneralPlatform {
    private exponentTunnelPath: string | null;
    private exponentHelper: ExponentHelper;
    private qrCodeContentProvider: QRCodeContentProvider = new QRCodeContentProvider();

    constructor(runOptions: IExponentRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.exponentHelper = this.packager.getExponentHelper();
        this.exponentTunnelPath = null;
    }

    public async runApp(): Promise<void> {
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

        await TelemetryHelper.generate("ExponentPlatform.runApp", extProps, async () => {
            await this.loginToExponentOrSkip(this.runOptions.expoHostType);
            await XDL.setOptions(this.projectPath, { packagerPort: this.packager.getPort() });
            await XDL.startExponentServer(this.projectPath);

            // the purpose of this is to save the same sequence of handling 'adb reverse' command execution as in Expo
            // https://github.com/expo/expo-cli/blob/1d515d21200841e181518358fd9dc4c7b24c7cd6/packages/xdl/src/Project.ts#L2226-L2370
            // we added this to be sure that our Expo launching logic doesn't have any negative side effects

            if (this.runOptions.expoHostType === "tunnel") {
                await this.prepareExpoTunnels();
            } else {
                await XDL.stopAdbReverse(this.projectPath);
            }

            const isAdbReversed =
                this.runOptions.expoHostType !== "local"
                    ? false
                    : // we need to execute 'adb reverse' command to bind ports used by Expo and RN of local machine to ports of a connected Android device or a running emulator
                      await XDL.startAdbReverse(this.projectPath);
            let exponentUrl = "";
            switch (this.runOptions.expoHostType) {
                case "lan":
                    exponentUrl = await XDL.getUrl(this.projectPath, {
                        dev: true,
                        minify: false,
                        hostType: "lan",
                    });
                    break;
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

                    exponentUrl = await XDL.getUrl(this.projectPath, {
                        dev: true,
                        minify: false,
                        hostType: "localhost",
                    });
                    break;
                case "tunnel":
                default:
                    exponentUrl = await XDL.getUrl(this.projectPath, { dev: true, minify: false });
            }
            exponentUrl = `exp://${String(url.parse(exponentUrl).host)}`;

            if (!exponentUrl) {
                throw ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath);
            }

            this.exponentTunnelPath = exponentUrl;
            const outputMessage = localize(
                "ExponentServerIsRunningOpenToSeeIt",
                "Expo server is running. Open your Expo app at {0} to see it.",
                this.exponentTunnelPath,
            );
            this.logger.info(outputMessage);

            if (this.runOptions.openExpoQR) {
                const exponentPage = vscode.window.createWebviewPanel(
                    "Expo QR Code",
                    "Expo QR Code",
                    vscode.ViewColumn.Two,
                    {},
                );
                exponentPage.webview.html = this.qrCodeContentProvider.provideTextDocumentContent(
                    vscode.Uri.parse(exponentUrl),
                );
                const outputMessage = localize(
                    "QRCodeOutputInstructions",
                    "Scan below QR code to open your app:",
                );
                this.logger.info(outputMessage);
                generate(exponentUrl, { small: true }, (qrcode: string) =>
                    this.logger.info(`\n${qrcode}`),
                );
            }

            const copyButton = localize("CopyToClipboard", "Copy to clipboard");

            void vscode.window.showInformationMessage(outputMessage, copyButton).then(selection => {
                if (selection === copyButton) {
                    void vscode.env.clipboard.writeText(exponentUrl);
                }
            });
        });
    }

    public async loginToExponentOrSkip(expoHostType?: ExpoHostType): Promise<any> {
        if (expoHostType !== "tunnel") {
            return;
        }

        return await this.exponentHelper.loginToExponent(
            async (message, password) =>
                (await vscode.window.showInputBox({
                    placeHolder: message,
                    password,
                })) || "",
            async message => {
                const okButton = { title: "Ok" };
                const cancelButton = { title: "Cancel", isCloseAffordance: true };
                const answer = await vscode.window.showInformationMessage(
                    message,
                    { modal: true },
                    okButton,
                    cancelButton,
                );
                if (answer === cancelButton) {
                    throw ErrorHelper.getInternalError(InternalErrorCode.UserCancelledExpoLogin);
                }
                return "";
            },
        );
    }

    public async beforeStartPackager(): Promise<void> {
        return this.exponentHelper.configureExponentEnvironment();
    }

    public async enableJSDebuggingMode(): Promise<void> {
        this.logger.info(
            localize(
                "ApplicationIsRunningOnExponentShakeDeviceForRemoteDebugging",
                "Application is running on Expo. Please shake device and select 'Debug JS Remotely' to enable debugging.",
            ),
        );
    }

    public getRunArguments(): string[] {
        return [];
    }

    private async prepareExpoTunnels(): Promise<void> {
        try {
            await this.exponentHelper.findOrInstallNgrokGlobally();
            await XDL.startTunnels(this.projectPath);
        } finally {
            this.exponentHelper.removeNodeModulesPathFromEnvIfWasSet();
        }
    }
}
