// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ErrorHelper} from "../error/errorHelper";
import {InternalErrorCode} from "../error/internalErrorCode";
import {IRunOptions} from "../launchArgs";
import {GeneralMobilePlatform, MobilePlatformDeps} from "../generalMobilePlatform";
import {ExponentHelper} from "./exponentHelper";

import * as vscode from "vscode";
import * as Q from "q";
import {PackagerRunAs} from "../packager";
import {PackagerStatus} from "../../extension/packagerStatusIndicator";
import {SettingsHelper} from "../../extension/settingsHelper";

const projectRootPath = SettingsHelper.getReactNativeProjectRoot();
const workspaceRootPath = vscode.workspace.rootPath;

export class ExponentPlatform extends GeneralMobilePlatform {
    private exponentTunnelPath: string | null;
    private exponentHelper = new ExponentHelper(workspaceRootPath, projectRootPath);

    constructor(runOptions: IRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
        this.exponentTunnelPath = null;
    }

    public runApp(): Q.Promise<void> {
        const outputMessage = `Application is running on Exponent. Open your exponent app at ${this.exponentTunnelPath} to see it.`;
        this.logger.logMessage(outputMessage);
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.logMessage("Application is running on Exponent. Please shake device and select 'Debug JS Remotely' to enable debugging.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        this.logger.logMessage("Starting Exponent Packager.");
        return this.packager.isRunning().then((running) => {
            if (running) {
                if (this.packager.getRunningAs() !== PackagerRunAs.EXPONENT) {
                    return this.packager.stop().then(() =>
                        this.packageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED));
                }

                this.logger.logMessage("Attaching to running Exponent packager");
            }
            return void 0;
        }).then(() =>
            this.exponentHelper.configureExponentEnvironment()
            ).then(() =>
                this.exponentHelper.loginToExponent(
                    (message, password) => {
                        return Q.Promise((resolve, reject) => {
                            vscode.window.showInputBox({ placeHolder: message, password: password })
                                .then(resolve, reject);
                        });
                    },
                    (message) => {
                        return Q.Promise((resolve, reject) => {
                            vscode.window.showInformationMessage(message)
                                .then(resolve, reject);
                        });
                    }
                ))
            .then(() => {
                return this.packager.startAsExponent();
            })
            .then(exponentUrl => {
                vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(exponentUrl), 1, "Expo QR code");
                this.packageStatusIndicator.updatePackagerStatus(PackagerStatus.EXPONENT_PACKAGER_STARTED);
                return exponentUrl;
            })
            .then(exponentUrl => {
                if (!exponentUrl) {
                    return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath,
                        "No link provided by exponent. Is your project correctly setup?"));
                }
                this.exponentTunnelPath = exponentUrl;
                return Q.resolve(void 0);
            });
    }
}
