// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { downloadExpoGo } from "../../common/downloadHelper";
import { installAndroidApplication, installiOSApplication } from "../../common/installHelper";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();
const logger = OutputChannelLogger.getMainChannel();

export class InstallExpoGoApplication extends Command {
    codeName = "installExpoGoApplication";
    label = "Download and install Expo Go on simulator or device";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToInstallExpoGo);

    async baseFn(): Promise<void> {
        assert(this.project);
        const item = await vscode.window.showQuickPick(["Android", "iOS"], {
            placeHolder: "Select type for mobile OS",
        });
        const installItem = await vscode.window.showQuickPick(["Manual", "Auto"], {
            placeHolder: "How to install application",
        });
        const expoHelper = this.project.getExponentHelper();
        logger.info(localize("CheckExpoEnvironment", "Checking Expo project environment."));
        const isExpo = await expoHelper.isExpoManagedApp(true);

        const expoGoListAPI = "https://api.expo.dev/v2/versions";
        const apiJson = await fetchJson(expoGoListAPI);
        const jsonContent = JSON.parse(apiJson);

        if (isExpo) {
            const currentSdkVersion = await expoHelper.exponentSdk(true);
            const expoUrlInfo = jsonContent.sdkVersions[currentSdkVersion];

            if (item == "Android") {
                void vscode.window.showInformationMessage("Downloading Expo Go for Android.");
                logger.logStream(
                    localize("DownloadAndroidExpoGo", "\nDownloading Expo Go for Android. \n"),
                );

                const targetUrl = expoUrlInfo.androidClientUrl;
                const androidClientVersion = expoUrlInfo.androidClientVersion as string;
                const fileName = `${this.project
                    .getPackager()
                    .getProjectPath()}/expogo_${androidClientVersion}.apk`;

                if (!fs.existsSync(fileName)) {
                    try {
                        await downloadExpoGo(targetUrl, fileName);
                    } catch {
                        throw new Error(
                            localize("FailedToDownloadExpoGo", "Failed to download Expo Go."),
                        );
                    }
                }

                if (installItem == "Auto") {
                    try {
                        await installAndroidApplication(this.project, fileName);
                    } catch {
                        throw new Error(
                            localize("FailedToInstallExpoGo", "Failed to install Expo Go."),
                        );
                    }
                } else {
                    logger.logStream(
                        localize(
                            "ManualInstall",
                            "Please manually install Expo Go from project root path. \n",
                        ),
                    );
                }
            } else if (item == "iOS") {
                if (os.platform() != "darwin") {
                    logger.warning(
                        localize(
                            "NotDarwinPlatform",
                            "Current OS may not support iOS installer. The Expo Go may not be installed.\n",
                        ),
                    );
                }
                void vscode.window.showInformationMessage("Downloading Expo Go for iOS.");
                logger.logStream(
                    localize("DownloadiOSExpoGo", "\nDownloading Expo Go for iOS. \n"),
                );

                const targetUrl = expoUrlInfo.iosClientUrl;
                const iOSClientVersion = expoUrlInfo.iosClientVersion as string;

                const tarFile = `${this.project
                    .getPackager()
                    .getProjectPath()}/expogo_${iOSClientVersion}.tar.gz`;

                if (!fs.existsSync(tarFile)) {
                    try {
                        await downloadExpoGo(
                            targetUrl,
                            `${this.project
                                .getPackager()
                                .getProjectPath()}/expogo_${iOSClientVersion}.tar.gz`,
                        );
                    } catch {
                        throw new Error(
                            localize("FailedToDownloadExpoGo", "Failed to download Expo Go."),
                        );
                    }
                }

                if (installItem == "Auto") {
                    try {
                        await installiOSApplication(this.project, tarFile);
                    } catch {
                        throw new Error(
                            localize("FailedToInstallExpoGo", "Failed to install Expo Go."),
                        );
                    }
                } else {
                    logger.logStream(
                        localize(
                            "ManualInstall",
                            "Please manually install Expo Go from project root path. \n",
                        ),
                    );
                }
            } else {
                return;
            }
        } else {
            throw new Error(localize("NotExpoProject", "Current project is not Expo managed."));
        }
    }
}

async function fetchJson(url: string): Promise<string> {
    return new Promise<string>((fulfill, reject) => {
        const requestOptions: https.RequestOptions = {};
        requestOptions.rejectUnauthorized = false; // CodeQL [js/disabling-certificate-validation] Debug extension does not need to verify certificate

        const request = https.get(url, requestOptions, response => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
                data += chunk;
            });
            response.on("end", () => fulfill(data));
            response.on("error", reject);
        });

        request.on("error", reject);
        request.end();
    });
}
