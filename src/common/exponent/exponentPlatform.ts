// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ErrorHelper} from "../error/errorHelper";
import {InternalErrorCode} from "../error/internalErrorCode";
import {IRunOptions} from "../launchArgs";
import {Log} from "../log/log";
import {GeneralMobilePlatform} from "../generalMobilePlatform";

import * as Q from "q";

export class ExponentPlatform extends GeneralMobilePlatform {
    private exponentTunnelPath: string;

    constructor(runOptions: IRunOptions, { remoteExtension = null } = {}) {
        super(runOptions, { remoteExtension: remoteExtension });
        this.exponentTunnelPath = null;
    }

    public runApp(): Q.Promise<void> {
        Log.logMessage(`Application is running on Exponent. Open your exponent app at ${this.exponentTunnelPath} to see it.`);
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        Log.logMessage("Application is running on Exponent. Please shake device and select 'Debug JS Remotely' to enable debugging.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        Log.logMessage("Starting React Native Packager.");
        return this.remoteExtension.startExponentPackager()
            .then(exponentUrl => {
                if (!exponentUrl) {
                    return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath,
                        "No link provided by exponent. Is your project correctly setup?"));
                }
                this.exponentTunnelPath = exponentUrl;
            });
    }
}