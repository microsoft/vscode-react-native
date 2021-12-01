// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { MobileTargetManager } from "../mobileTargetManager";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { IDebuggableMobileTarget, IMobileTarget, MobileTarget } from "../mobileTarget";
import { TargetType } from "../generalPlatform";
import { PromiseUtil } from "../../common/node/promise";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { AdbHelper } from "./adb";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class AndroidTarget extends MobileTarget {
    public static fromInterface(obj: IDebuggableMobileTarget): AndroidTarget {
        return new AndroidTarget(obj.isOnline, obj.isVirtualTarget, obj.id, obj.name);
    }

    constructor(isOnline: boolean, isVirtualTarget: boolean, id: string, name?: string) {
        super(isOnline, isVirtualTarget, id, name ? name : id);
    }
}

export class AndroidTargetManager extends MobileTargetManager {
    private static readonly EMULATOR_COMMAND = "emulator";
    private static readonly EMULATOR_AVD_START_COMMAND = "-avd";
    private static readonly EMULATOR_START_TIMEOUT = 120;

    private logger: OutputChannelLogger;
    private adbHelper: AdbHelper;
    private childProcess: ChildProcess;

    constructor(adbHelper: AdbHelper) {
        super();
        this.adbHelper = adbHelper;
        this.logger = OutputChannelLogger.getChannel(OutputChannelLogger.MAIN_CHANNEL_NAME, true);
        this.childProcess = new ChildProcess();
    }

    public async isVirtualTarget(target: string): Promise<boolean> {
        try {
            if (target === TargetType.Device) {
                return false;
            } else if (
                target === TargetType.Simulator ||
                target.match(AdbHelper.AndroidSDKEmulatorPattern)
            ) {
                return true;
            } else {
                const onlineTarget = await this.adbHelper.findOnlineTargetById(target);
                if (onlineTarget) {
                    return onlineTarget.isVirtualTarget;
                } else if ((await this.adbHelper.getAvdsNames()).includes(target)) {
                    return true;
                } else {
                    throw new Error("There is no such target");
                }
            }
        } catch (error) {
            throw ErrorHelper.getNestedError(
                error,
                InternalErrorCode.CouldNotRecognizeTargetType,
                target,
            );
        }
    }

    public async selectAndPrepareTarget(
        filter?: (el: IMobileTarget) => boolean,
    ): Promise<AndroidTarget | undefined> {
        const selectedTarget = await this.startSelection(filter);
        if (selectedTarget) {
            if (!selectedTarget.isOnline && selectedTarget.isVirtualTarget) {
                return this.launchSimulator(selectedTarget);
            } else {
                if (selectedTarget.id) {
                    return AndroidTarget.fromInterface(<IDebuggableMobileTarget>selectedTarget);
                }
            }
        }
        return undefined;
    }

    public async collectTargets(targetType?: TargetType): Promise<void> {
        const targetList: IMobileTarget[] = [];
        const collectSimulators = !targetType || targetType === TargetType.Simulator;
        const collectDevices = !targetType || targetType === TargetType.Device;

        try {
            if (collectSimulators) {
                const emulatorsNames: string[] = await this.adbHelper.getAvdsNames();
                targetList.push(
                    ...emulatorsNames.map(name => {
                        return { name, isOnline: false, isVirtualTarget: true };
                    }),
                );
            }
        } catch (error) {
            // We throw an exception only if the target type is explicitly specified,
            // otherwise we collect only those targets that we can collect
            if (targetType === TargetType.Simulator) {
                throw error;
            }
            this.logger.warning(
                localize(
                    "CouldNotUseEmulators",
                    "An error occurred while trying to get installed emulators: {0}\nContinue using only online targets",
                    error instanceof Error ? error.message : error.toString(),
                ),
            );
        }

        const onlineTargets = await this.adbHelper.getOnlineTargets();
        for (const device of onlineTargets) {
            if (device.isVirtualTarget && collectSimulators) {
                const avdName = await this.adbHelper.getAvdNameById(device.id);
                const emulatorTarget = targetList.find(target => target.name === avdName);
                if (emulatorTarget) {
                    emulatorTarget.isOnline = true;
                    emulatorTarget.id = device.id;
                }
            } else if (!device.isVirtualTarget && collectDevices) {
                targetList.push({ id: device.id, isOnline: true, isVirtualTarget: false });
            }
        }

        this.targets = targetList;
    }

    protected async startSelection(
        filter?: (el: IMobileTarget) => boolean,
    ): Promise<IMobileTarget | undefined> {
        return this.selectTarget(filter);
    }

    protected async launchSimulator(emulatorTarget: IMobileTarget): Promise<AndroidTarget> {
        return new Promise<AndroidTarget>((resolve, reject) => {
            const emulatorProcess = this.childProcess.spawn(
                AndroidTargetManager.EMULATOR_COMMAND,
                [AndroidTargetManager.EMULATOR_AVD_START_COMMAND, emulatorTarget.name as string],
                {
                    detached: true,
                },
                true,
            );
            emulatorProcess.outcome.catch(error => {
                if (
                    process.platform == "win32" &&
                    process.env.SESSIONNAME &&
                    process.env.SESSIONNAME.toLowerCase().includes("rdp-tcp")
                ) {
                    this.logger.warning(
                        localize(
                            "RDPEmulatorWarning",
                            "Android emulator was launched from the Windows RDP session, this might lead to failures.",
                        ),
                    );
                }
                reject(new Error(`Virtual device launch finished with an exception: ${String(error)}`));
            });
            emulatorProcess.spawnedProcess.unref();

            const condition = async () => {
                const connectedDevices = await this.adbHelper.getOnlineTargets();
                for (const target of connectedDevices) {
                    const onlineAvdName = await this.adbHelper.getAvdNameById(target.id);
                    if (onlineAvdName === emulatorTarget.name) {
                        return target.id;
                    }
                }
                return null;
            };

            return PromiseUtil.waitUntil<string>(
                condition,
                1000,
                AndroidTargetManager.EMULATOR_START_TIMEOUT * 1000,
            ).then(emulatorId => {
                if (emulatorId) {
                    emulatorTarget.id = emulatorId;
                    emulatorTarget.isOnline = true;
                    this.logger.info(
                        localize(
                            "EmulatorLaunched",
                            "Launched Android emulator {0}",
                            emulatorTarget.name,
                        ),
                    );
                    resolve(AndroidTarget.fromInterface(<IDebuggableMobileTarget>emulatorTarget));
                } else {
                    reject(
                        new Error(
                            `Virtual device launch finished with an exception: ${localize(
                                "EmulatorStartWarning",
                                "Could not start the emulator {0} within {1} seconds.",
                                emulatorTarget.name,
                                AndroidTargetManager.EMULATOR_START_TIMEOUT,
                            )}`,
                        ),
                    );
                }
            });
        });
    }
}
