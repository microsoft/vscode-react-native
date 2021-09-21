// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "../../common/node/childProcess";
import { waitUntil } from "../../common/utils";
import { IDebuggableMobileTarget, MobileTarget } from "../mobileTarget";
import { MobileTargetManager } from "../mobileTargetManager";
import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { QuickPickOptions, window } from "vscode";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface IDebuggableIOSTarget extends IDebuggableMobileTarget {
    name: string;
    system: string;
}

export class IOSTarget extends MobileTarget implements IDebuggableIOSTarget {
    protected _system: string;
    protected _name: string;

    public static fromInterface(obj: IDebuggableIOSTarget): IOSTarget {
        return new IOSTarget(obj.isOnline, obj.isVirtualTarget, obj.id, obj.name, obj.system);
    }

    constructor(
        isOnline: boolean,
        isVirtualTarget: boolean,
        id: string,
        name: string,
        system: string,
    ) {
        super(isOnline, isVirtualTarget, id, name);
        this._system = system;
    }

    get system(): string {
        return this.system;
    }

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }
}

export class IOSTargetManager extends MobileTargetManager {
    protected static readonly XCRUN_SIMCTL_COMMAND = "xcrun simctl";
    protected static readonly LIST_COMMAND = `${IOSTargetManager.XCRUN_SIMCTL_COMMAND} list --json`;
    protected static readonly BOOT_COMMAND = `${IOSTargetManager.XCRUN_SIMCTL_COMMAND} boot`;
    protected static readonly AVAILABLE_SIMULATORS_FILTER = "available";
    protected static readonly BOOTED_SIMULATORS_FILTER = "booted";
    protected static readonly SIMULATOR_START_TIMEOUT = 120;

    protected childProcess: ChildProcess = new ChildProcess();
    protected logger: OutputChannelLogger = OutputChannelLogger.getChannel(
        OutputChannelLogger.MAIN_CHANNEL_NAME,
        true,
    );
    protected lastSelectedSystem: string;
    protected targets?: IDebuggableIOSTarget[];

    public async collectTargets(): Promise<void> {
        // this.targets = [];
        // const res = JSON.parse(
        //     await this.childProcess.execToString(
        //         `${IOSSimulatorManager.SIMULATORS_LIST_COMMAND}`,
        //     ),
        // );
        // Object.keys(res.devices).forEach(rawSystem => {
        //     let system = rawSystem.split(".").slice(-1)[0]; // "com.apple.CoreSimulator.SimRuntime.iOS-11-4" -> "iOS-11-4"
        //     res.devices[rawSystem].forEach((device: any) => {
        //         this.targets?.push( new IOSTarget(
        //             device.state === BOOTED_SIMULATORS_POSTFIX,
        //         ));
        //     });
        // });
        // return simulators;
    }

    public async selectAndPrepareTarget(
        filter?: (el: IDebuggableIOSTarget) => boolean,
    ): Promise<IOSTarget | undefined> {
        const selectedTarget = await this.startSelection(filter);
        if (selectedTarget) {
            if (!selectedTarget.isOnline && selectedTarget.isVirtualTarget) {
                return this.launchSimulator(selectedTarget);
            } else {
                return IOSTarget.fromInterface(selectedTarget);
            }
        }
        return undefined;
    }

    protected async startSelection(
        filter?: (el: IDebuggableIOSTarget) => boolean,
    ): Promise<IDebuggableIOSTarget | undefined> {
        await this.collectTargets();
        const system = await this.selectSystem(filter);
        if (system) {
            return (await this.selectTarget(
                (el: IDebuggableIOSTarget) =>
                    (filter ? filter(el) : true) && el.system === this.lastSelectedSystem,
            )) as IDebuggableIOSTarget | undefined;
        }
        return undefined;
    }

    protected async selectSystem(
        filter?: (el: IDebuggableIOSTarget) => boolean,
    ): Promise<string | undefined> {
        const targets = (await this.getTargetList(filter)) as IDebuggableIOSTarget[];
        const systemsList = [...new Set(targets.map(target => target.system))];
        let result: string | undefined = systemsList[0];
        if (systemsList.length > 1) {
            const quickPickOptions: QuickPickOptions = {
                ignoreFocusOut: true,
                canPickMany: false,
                placeHolder: localize(
                    "SelectIOSSystemVersion",
                    "Select system version of iOS virtual device",
                ),
            };
            result = await window.showQuickPick(systemsList, quickPickOptions);
        }
        return result?.toString();
    }

    protected async launchSimulator(
        virtualTarget: IDebuggableIOSTarget,
    ): Promise<IOSTarget | undefined> {
        const emulatorProcess = this.childProcess.spawn(
            IOSTargetManager.BOOT_COMMAND,
            [virtualTarget.id as string],
            {
                detached: true,
            },
            true,
        );
        emulatorProcess.spawnedProcess.unref();

        const condition = async () => {
            // const connectedDevices = await this.adbHelper.getOnlineTargets();
            // for (let target of connectedDevices) {
            //     const onlineAvdName = await this.adbHelper.getAvdNameById(target.id);
            //     if (onlineAvdName === virtualTarget.name) {
            //         return target.id;
            //     }
            // }
            return null;
        };

        const isBooted = await waitUntil<boolean>(
            condition,
            1000,
            IOSTargetManager.SIMULATOR_START_TIMEOUT * 1000,
        );
        if (isBooted) {
            virtualTarget.isOnline = true;
            this.logger.info(
                localize("SimulatorLaunched", "Launched simulator {0}", virtualTarget.name),
            );
            return IOSTarget.fromInterface(virtualTarget);
        } else {
            throw new Error(
                `Virtual device launch finished with an exception: ${localize(
                    "SimulatorStartWarning",
                    "Could not start the simulator {0} within {1} seconds.",
                    virtualTarget.name,
                    IOSTargetManager.SIMULATOR_START_TIMEOUT,
                )}`,
            );
        }
    }
}
