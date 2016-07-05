// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../common/log/log";
import {IRunOptions} from "../common/launchArgs";
import {RemoteExtension} from "../common/remoteExtension";
import {Packager} from "../common/packager";

export class GeneralMobilePlatform {
    protected projectPath: string;
    protected remoteExtension: RemoteExtension;
    protected platformName: string;

    constructor(protected runOptions: IRunOptions, { remoteExtension = null } = {}) {
        this.platformName = this.runOptions.platform;
        this.projectPath = this.runOptions.projectRoot;
        this.remoteExtension = (remoteExtension) ? remoteExtension : RemoteExtension.atProjectRootPath(runOptions.projectRoot);
    }

    public runApp(): Q.Promise<void> {
        Log.logMessage("Conected to packager. You can now open your app in the simulator.");
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        Log.logMessage("Debugger ready. Enable remote debugging in app.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        return this.remoteExtension.getPackagerPort().then(port => {
            return Packager.isPackagerRunning(Packager.getHostForPort(port))
            .then(isRunning => {
                if (isRunning) {
                    Log.logMessage("Attaching to running packager at port: " + port);
                    return Q.resolve<void>(void 0);
                }
                return this.remoteExtension.startPackager();
            });
        });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Q.resolve<void>(void 0);
    }
}
