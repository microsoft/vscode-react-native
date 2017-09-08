// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "./log/log";
import {IRunOptions} from "./launchArgs";
import {RemoteExtension} from "./remoteExtension";

export interface MobilePlatformDeps {
    remoteExtension?: RemoteExtension;
}

export type TargetType = "device" | "simulator";

export class GeneralMobilePlatform {
    protected projectPath: string;
    protected remoteExtension: RemoteExtension;
    protected platformName: string;

    protected static deviceString: TargetType = "device";
    protected static simulatorString: TargetType = "simulator";

    constructor(protected runOptions: IRunOptions, { remoteExtension }: MobilePlatformDeps = {}) {
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
        Log.logMessage("Starting React Native Packager.");
        return this.remoteExtension.startPackager();
    }

    public prewarmBundleCache(): Q.Promise<void> {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Q.resolve<void>(void 0);
    }

    public getRunArgument(): string[] | Q.Promise<string[]> {
        throw new Error("Not yet implemented: GeneralMobilePlatform.getRunArgument");
    }
}
