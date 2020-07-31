// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AdbHelper } from "./adb";
import { ChildProcess } from "../../common/node/childProcess";
import { IEmulator, EmulatorManager } from "../EmulatorManager";

export interface IAndroidEmulator extends IEmulator {
}

export class AndroidEmulatorManager extends EmulatorManager{
    private static readonly EMULATOR_COMMAND = "emulator";
    private static readonly EMULATOR_LIST_AVDS_COMMAND = `-list-avds`;
    private static readonly EMULATOR_AVD_START_COMMAND = `-avd`;

    private static readonly EMULATOR_START_TIMEOUT = 120;

    private adbHelper: AdbHelper;
    private childProcess: ChildProcess;

    constructor(adbHelper: AdbHelper) {
        super();
        this.adbHelper = adbHelper;
        this.childProcess = new ChildProcess();
    }

    public async startEmulator(target: string): Promise<IAndroidEmulator | null> {
        if (target && (await this.adbHelper.getOnlineDevices()).length === 0) {
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
            this.childProcess.spawn(AndroidEmulatorManager.EMULATOR_COMMAND, [AndroidEmulatorManager.EMULATOR_AVD_START_COMMAND, emulatorName], {
                detached: true,
                stdio: 'ignore',
              });

            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not start the emulator within ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
            }, AndroidEmulatorManager.EMULATOR_START_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                const connectedDevices = await this.adbHelper.getOnlineDevices();
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

    protected async getEmulatorsNamesList(): Promise<string[]> {
        const res = await this.childProcess.execToString(`${AndroidEmulatorManager.EMULATOR_COMMAND} ${AndroidEmulatorManager.EMULATOR_LIST_AVDS_COMMAND}`);
        let emulatorsList: string[] = [];
        if (res) {
            emulatorsList = res.split(/\r?\n|\r/g);
        }
        return emulatorsList;
    }
}
