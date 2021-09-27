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
    protected lastTarget?: MobileTarget;

    public async getAllTargets(): Promise<IMobileTarget[]> {
        return this.targetManager.getTargetList();
    }

    public async resolveMobileTarget(targetString: string): Promise<MobileTarget | undefined> {
        await this.targetManager.collectTargets();

        let isAnyTarget = false;
        let isVirtualTarget: boolean;
        if (targetString.toLowerCase() === TargetType.Simulator) {
            isAnyTarget = true;
            isVirtualTarget = true;
        } else if (targetString.toLowerCase() === TargetType.Device) {
            isAnyTarget = true;
            isVirtualTarget = false;
        } else {
            isVirtualTarget = await this.targetManager.isVirtualTarget(targetString);
        }

        const cleanupTargetModifications = () => {
            // Use 'simulator' or 'device' in case we need to specify target
            this.runOptions.target = isVirtualTarget ? TargetType.Simulator : TargetType.Device;
            this.runArguments = this.getRunArguments();
        };

        try {
            this.lastTarget = await this.targetManager.selectAndPrepareTarget(target => {
                const conditionForNotAnyTarget = isAnyTarget
                    ? true
                    : target.name === targetString || target.id === targetString;
                const conditionForVirtualTarget = isVirtualTarget === target.isVirtualTarget;
                return conditionForVirtualTarget && conditionForNotAnyTarget;
            });

            if (!this.lastTarget) {
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
                // becouse run-ios did not check booted devices and just launch first device
                if (
                    this instanceof IOSPlatform ||
                    (await this.isNeedToPassTargetToRunArgs(isVirtualTarget))
                ) {
                    this.addTargetToRunArgs(this.lastTarget);
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

        return this.lastTarget;
    }

    protected async isNeedToPassTargetToRunArgs(isVirtualTarget: boolean): Promise<boolean> {
        // If we specify a target in "react-native run-*" command, the RN CLI will build applications
        // for development and release, which leads to an increase in build time. Therefore, it's better to
        // avoid passing the target to the CLI command if it's not necessary to improve build performance.
        // We should not pass target to run arguments in case there is only one online simulator or online target

        const targets = await this.targetManager.getTargetList();
        return (
            targets.filter(target => target.isOnline && target.isVirtualTarget === isVirtualTarget)
                .length > 1
        );
    }

    protected addTargetToRunArgs(target: MobileTarget): void {
        this.runOptions.target = target.id;
        this.runArguments = this.getRunArguments();
    }
}
