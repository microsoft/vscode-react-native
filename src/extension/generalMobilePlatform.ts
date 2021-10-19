// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { TelemetryHelper } from "../common/telemetryHelper";
import { GeneralPlatform, TargetType } from "./generalPlatform";
import { IMobileTarget, MobileTarget } from "./mobileTarget";
import { MobileTargetManager } from "./mobileTargetManager";
import * as nls from "vscode-nls";
import { IOSPlatform } from "./ios/iOSPlatform";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export abstract class GeneralMobilePlatform extends GeneralPlatform {
    protected targetManager: MobileTargetManager;
    protected target?: MobileTarget;

    public async getTargetsCountByFilter(filter?: (el: IMobileTarget) => boolean): Promise<number> {
        return this.targetManager.getTargetsCountWithFilter(filter);
    }

    public async resolveMobileTarget(targetString: string): Promise<MobileTarget | undefined> {
        let collectTargetsCalled = false;

        let isAnyTarget = false;
        let isVirtualTarget: boolean;
        if (targetString.toLowerCase() === TargetType.Simulator) {
            isAnyTarget = true;
            isVirtualTarget = true;
        } else if (targetString.toLowerCase() === TargetType.Device) {
            isAnyTarget = true;
            isVirtualTarget = false;
        } else {
            await this.targetManager.collectTargets();
            collectTargetsCalled = true;
            isVirtualTarget = await this.targetManager.isVirtualTarget(targetString);
        }

        if (!collectTargetsCalled) {
            await this.targetManager.collectTargets(
                isVirtualTarget ? TargetType.Simulator : TargetType.Device,
            );
        }

        const cleanupTargetModifications = () => {
            // Use 'simulator' or 'device' in case we need to specify target
            this.runOptions.target = isVirtualTarget ? TargetType.Simulator : TargetType.Device;
            this.runArguments = this.getRunArguments();
        };

        try {
            this.target = await this.targetManager.selectAndPrepareTarget(target => {
                const conditionForNotAnyTarget = isAnyTarget
                    ? true
                    : target.name === targetString || target.id === targetString;
                const conditionForVirtualTarget = isVirtualTarget === target.isVirtualTarget;
                return conditionForVirtualTarget && conditionForNotAnyTarget;
            });

            if (!this.target) {
                this.logger.warning(
                    localize(
                        "CouldNotFindAnyDebuggableTarget",
                        "Could not find any debuggable target by specified target: {0}",
                        targetString,
                    ),
                );
                this.logger.warning(
                    localize(
                        "ContinueWithRnCliWorkflow",
                        "Continue using standard RN CLI workflow.",
                    ),
                );
                cleanupTargetModifications();
            } else {
                // For iOS we should pass exact target id,
                // because the “react-native run-ios” command does not check booted devices
                // and just launches the first device
                if (this instanceof IOSPlatform || (await this.needToPassTargetToRunArgs())) {
                    this.addTargetToRunArgs(this.target);
                } else {
                    cleanupTargetModifications();
                }
            }
        } catch (error) {
            if (
                error &&
                error.errorCode &&
                error.errorCode === InternalErrorCode.TargetSelectionError
            ) {
                TelemetryHelper.sendErrorEvent(
                    "TargetSelectionError",
                    ErrorHelper.getInternalError(InternalErrorCode.TargetSelectionError),
                );

                this.logger.warning(error);
                this.logger.warning(
                    localize(
                        "ContinueWithRnCliWorkflow",
                        "Continue using standard RN CLI workflow.",
                    ),
                );

                cleanupTargetModifications();
            } else {
                throw error;
            }
        }

        return this.target;
    }

    protected async needToPassTargetToRunArgs(): Promise<boolean> {
        // If we specify a target in "react-native run-*" command, the RN CLI will build applications
        // for development and release, which leads to an increase in build time. Therefore, it's better to
        // avoid passing the target to the CLI command if it's not necessary to improve build performance.
        // We should not pass target to run arguments in case there is only one online simulator or online target
        const targets = await this.targetManager.getTargetList();
        return targets.filter(target => target.isOnline).length > 1;
    }

    protected addTargetToRunArgs(target: MobileTarget): void {
        this.runOptions.target = target.id;
        this.runArguments = this.getRunArguments();
    }

    public abstract getTargetFromRunArgs(): Promise<MobileTarget | undefined>;
}
