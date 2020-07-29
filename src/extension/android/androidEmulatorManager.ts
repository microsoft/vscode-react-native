// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { QuickPickOptions, window } from "vscode";
import { AdbHelper } from "./adb";
import { ChildProcess } from "../../common/node/childProcess";
import * as nls from "vscode-nls";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize = nls.loadMessageBundle();

export interface IEmulator {
    name: string;
    id: string;
}

export class AndroidEmulatorManager {
    private static readonly EMULATOR_COMMAND = "emulator";
    private static readonly EMULATOR_LIST_AVDS_COMMAND = `-list-avds`;
    private static readonly EMULATOR_AVD_START_COMMAND = `-avd`;

    private static readonly EMULATOR_START_TIMEOUT = 120;

    private adbHelper: AdbHelper;
    private childProcess: ChildProcess;

    constructor(adbHelper: AdbHelper) {
        this.adbHelper = adbHelper;
        this.childProcess = new ChildProcess();
    }

    public async startEmulator(target: string): Promise<IEmulator | null> {
        if (target && (await this.adbHelper.getConnectedDevices()).length === 0) {
            if (target === "simulator") {
                const newEmulator = await this.selectEmulator();
                if (newEmulator) {
                    const emulatorId = await this.tryLaunchEmulatorByName(newEmulator);
                    return {name: newEmulator, id: emulatorId};
                }
            }
            else if (!target.includes("device")) {
                const emulatorId = await this.tryLaunchEmulatorByName(target);
                return {name: target, id: emulatorId};
            }
        }
        return null;
    }

    public async tryLaunchEmulatorByName(emulatorName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const cp = this.childProcess.spawn(AndroidEmulatorManager.EMULATOR_COMMAND, [AndroidEmulatorManager.EMULATOR_AVD_START_COMMAND, emulatorName], {
                detached: true,
                stdio: 'ignore',
              });
            cp.spawnedProcess.unref();

            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not start emulator within ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
            }, AndroidEmulatorManager.EMULATOR_START_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                const connectedDevices = await this.adbHelper.getConnectedDevices();
                if (connectedDevices.length > 0) {
                    cleanup();
                    resolve(connectedDevices[0].id);
                }
            }, 1000);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(bootCheckInterval);
            };
        });
    }

    public  async selectEmulator(): Promise<string | undefined> {
        const emulatorsList = await this.getEmulatorsList();
        const quickPickOptions: QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
            placeHolder: localize("SelectEmulator", "Select emulator for launch application"),
        };
        let result: string | undefined = emulatorsList[0];
        if (emulatorsList.length > 1) {
            result = await window.showQuickPick(emulatorsList, quickPickOptions);
        }
        return result?.toString();
    }

    private async getEmulatorsList(): Promise<string[]> {
        const res = await this.childProcess.execToString(`${AndroidEmulatorManager.EMULATOR_COMMAND} ${AndroidEmulatorManager.EMULATOR_LIST_AVDS_COMMAND}`);
        let emulatorsList: string[] = [];
        if (res) {
            emulatorsList = res.split("\r\n");
            if (emulatorsList.length == 1) {
                emulatorsList[0].trim();
            }
        }
        return emulatorsList;
    }
}