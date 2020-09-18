// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IVirtualDevice, VirtualDeviceManager } from "../VirtualDeviceManager";
import { ChildProcess } from "../../common/node/childProcess";
import { QuickPickOptions, window } from "vscode";
import * as nls from "vscode-nls";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize = nls.loadMessageBundle();

export interface IiOSSimulator extends IVirtualDevice {
    system: string;
    state?: string;
}

export class IOSSimulatorManager extends VirtualDeviceManager {
    private static SIMULATORS_LIST_COMMAND = "xcrun simctl list --json devices available";

    private childProcess: ChildProcess;
    private simulators: IiOSSimulator[];
    private lastSelectedSystem: string;

    constructor() {
        super();
        this.childProcess = new ChildProcess();
        this.simulators = [];
    }

    public findSimulator(name: string, system: string | null = this.lastSelectedSystem, simulators?: IiOSSimulator[]): IiOSSimulator | null {
        const sims = simulators ? simulators : this.simulators;
        const foundSimulator = sims.find((value) => value.name === name && (!system || value.system === system));
        if (!foundSimulator) {
            return null;
        }
        return foundSimulator;
    }

    public getSimulatorById(udid: string, simulators?: IiOSSimulator[]): IiOSSimulator | null {
        const sims = simulators ? simulators : this.simulators;
        const foundSimulator = sims.find((value) => value.id === udid);
        if (!foundSimulator) {
            return null;
        }
        return foundSimulator;
    }

    public async collectSimulators(): Promise<IiOSSimulator[]> {
        const simulators: IiOSSimulator[] = [];
        const res = JSON.parse(await this.childProcess.execToString(IOSSimulatorManager.SIMULATORS_LIST_COMMAND));

        Object.keys(res.devices).forEach((system) => {
            res.devices[system].forEach((device: any) => {
                simulators.push({
                    name: device.name,
                    id: device.udid,
                    system: system.split(".").slice(-1)[0], // "com.apple.CoreSimulator.SimRuntime.iOS-11-4" -> "iOS-11-4"
                    state: device.state,
                });
            });
        });

        return simulators;
    }

    private async selectSystem(): Promise<string | undefined> {
        const systemsList = this.getSystemsList();
        const quickPickOptions: QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
            placeHolder: localize("SelectIOSSystemVersion", "Select system version of iOS virtual device"),
        };
        let result: string | undefined = systemsList[0];
        if (systemsList.length > 1) {
            result = await window.showQuickPick(systemsList, quickPickOptions);
        }
        return result?.toString();
    }

    public async startSelection(): Promise<string | undefined> {
        this.simulators = await this.collectSimulators();
        const runningSimulator = this.getRunningSimulator(this.simulators);
        if (runningSimulator) {
            return runningSimulator.name;
        }
        const system = await this.selectSystem();
        if (system) {
            this.lastSelectedSystem = system;
            const filter = (el: IiOSSimulator) => el.system === this.lastSelectedSystem;
            return this.selectVirtualDevice(filter);
        }
        return undefined;
    }

    protected async getVirtualDevicesNamesList(filter?: (el: IiOSSimulator) => unknown): Promise<string[]> {
        const names: string[] = [];
        this.simulators.forEach((el: IiOSSimulator) => {
            if (el.name && (!filter || filter(el))) {
                names.push(el.name);
            }
        });
        return names;
    }

    protected getSystemsList(): string[] {
        const names: Set<string> = new Set();
        this.simulators.forEach((el: IiOSSimulator) => {
            if (el.system.indexOf("iOS") >= 0) {
                names.add(el.system);
            }
        });
        return Array.from(names);
    }

    private getRunningSimulator(simulators: IiOSSimulator[]): IiOSSimulator | undefined {
        return simulators.find(el => el.state === "Booted");
    }
}
