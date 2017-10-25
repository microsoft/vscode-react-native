// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {IRunOptions} from "./launchArgs";
import {Packager, PackagerRunAs} from "../common/packager";
import {PackagerStatus, PackagerStatusIndicator} from "./packagerStatusIndicator";
import {SettingsHelper} from "./settingsHelper";
import {OutputChannelLogger} from "./log/OutputChannelLogger";

export interface MobilePlatformDeps {
    packager?: Packager;
}

export type TargetType = "device" | "simulator";

export class GeneralMobilePlatform {
    protected projectPath: string;
    protected platformName: string;
    protected packager: Packager;
    protected logger: OutputChannelLogger;

    protected static deviceString: TargetType = "device";
    protected static simulatorString: TargetType = "simulator";

    constructor(protected runOptions: IRunOptions, platformDeps: MobilePlatformDeps = {}) {
        this.platformName = this.runOptions.platform;
        this.projectPath = this.runOptions.projectRoot;
        this.packager = platformDeps.packager || new Packager(this.runOptions.workspaceRoot, this.projectPath, SettingsHelper.getPackagerPort(this.runOptions.workspaceRoot), new PackagerStatusIndicator());
        this.logger = OutputChannelLogger.getChannel(`React Native: Run ${this.platformName}`, true);
        this.logger.clear();
    }

    public runApp(): Q.Promise<void> {
        this.logger.info("Connected to packager. You can now open your app in the simulator.");
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info("Debugger ready. Enable remote debugging in app.");
        return Q.resolve<void>(void 0);
    }

    public disableJSDebuggingMode(): Q.Promise<void> {
        this.logger.info("Debugger ready. Disable remote debugging in app.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        this.logger.info("Starting React Native Packager.");
        return this.packager.isRunning().then((running) => {
            if (running) {
                if (this.packager.getRunningAs() !== PackagerRunAs.REACT_NATIVE) {
                    return this.packager.stop().then(() =>
                        this.packager.statusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED)
                    );
                }

                this.logger.info("Attaching to running React Native packager");
            }
            return void 0;
        })
            .then(() => {
                return this.packager.startAsReactNative();
            })
            .then(() =>
                this.packager.statusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    public prewarmBundleCache(): Q.Promise<void> {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Q.resolve<void>(void 0);
    }

    public getRunArgument(): string[] {
        throw new Error("Not yet implemented: GeneralMobilePlatform.getRunArgument");
    }
}
