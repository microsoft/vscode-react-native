// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { spawn, execSync } from "child_process";
import * as kill from "tree-kill";
import { sleep } from "./utilities";

interface RunResult {
    Successful: boolean;
    FailedState?: DeviceState;
}

export interface IiOSSimulator {
    system: string;
    name: string;
    id: string;
    state: DeviceState;
}

enum DeviceState {
    Booted = "Booted",
    Shutdown = "Shutdown",
    Unknown = "Unknown",
}

export class IosSimulatorHelper {

    public static SIMULATOR_START_TIMEOUT = 300;

    public static getDevice(): string | undefined {
        if (!process.env.IOS_SIMULATOR) {
            throw new Error("Environment variable 'IOS_SIMULATOR' is not set. Exiting...");
        }
        return process.env.IOS_SIMULATOR;
    }

    public static getDeviceUdid(): string | undefined {
        if (!process.env.IOS_SIMULATOR_UDID) {
            throw new Error("Environment variable 'IOS_SIMULATOR_UDID' is not set. Exiting...");
        }
        return process.env.IOS_SIMULATOR_UDID;
    }

    public static getSimulator(name: string): IiOSSimulator | null {
        if (name) {
            const simulators = this.collectSimulators();
            const device = this.findSimulator(simulators, name);
            return device;
        }
        return null;
    }

    public static async bootSimulator(device: string) {
        const cmd = "boot";
        const result = await this.runSimCtlCommand([cmd, device]);
        if (!result.Successful) {
            if (result.FailedState === DeviceState.Booted) {
                // That's okay, it means simulator is already booted
            } else {
                throw this.getRunError(cmd, result.FailedState);
            }
        }
    }

    public static async shutdownSimulator(device: string) {
        const cmd = "shutdown";
        const result = await this.runSimCtlCommand([cmd, device]);
        if (!result.Successful) {
            if (result.FailedState === DeviceState.Shutdown) {
                // That's okay, it means simulator is already shutted down
            } else {
                throw this.getRunError(cmd, result.FailedState);
            }
        }
    }

    public static async eraseSimulator(device: string) {
        const cmd = "erase";
        const result = await this.runSimCtlCommand([cmd, device]);
        if (!result.Successful) {
            throw this.getRunError(cmd, result.FailedState);
        }
    }

    public static async launchApplication(device: string, bundleId: string) {
        const cmd = "launch";
        const result = await this.runSimCtlCommand([cmd, device, bundleId]);
        if (!result.Successful) {
            throw this.getRunError(cmd, result.FailedState);
        }
    }

    public static async waitUntilIosAppIsInstalled(appBundleId: string, waitTime: number, waitInitTime?: number) {
        // Start watcher for launch events console logs in simulator and wait until needed app is launched
        // TODO is not compatible with parallel test run (race condition)
        let launched = false;
        const predicate = `eventMessage contains "Launch successful for '${appBundleId}'"`;
        const args = ["simctl", "spawn", <string>IosSimulatorHelper.getDevice(), "log", "stream", "--predicate", predicate];
        const proc = spawn("xcrun", args, {stdio: "pipe"});
        proc.stdout.on("data", (data: string) => {
            data = data.toString();
            console.log(data);
            if (data.startsWith("Filtering the log data")) {
                return;
            }
            const regexp = new RegExp(`Launch successful for '${appBundleId}'`);
            if (regexp.test(data)) {
                launched = true;
            }
        });
        proc.stderr.on("error", (data: string) => {
            console.error(data.toString());
        });
        proc.on("error", (err) => {
            console.error(err);
            kill(proc.pid);
        });

        let awaitRetries: number = waitTime / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            const check = setInterval(async () => {
                if (retry % 5 === 0) {
                    console.log(`*** Check if app with bundleId ${appBundleId} is installed, ${retry} attempt`);
                }
                if (launched) {
                    clearInterval(check);
                    const initTimeout = waitInitTime || 10000;
                    console.log(`*** Installed ${appBundleId} app found, await ${initTimeout}ms for initializing...`);
                    await sleep(initTimeout);
                    resolve();
                } else {
                    retry++;
                    if (retry >= awaitRetries) {
                        clearInterval(check);
                        kill(proc.pid, () => {
                            reject(`${appBundleId} not found after ${waitTime}ms`);
                        });
                    }
                }
            }, 1000);
        });
    }

    public static async waitUntilIosSimulatorStarting(name?: string): Promise<IiOSSimulator> {
        return new Promise((resolve, reject) => {
            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not start the iOS simulator within ${IosSimulatorHelper.SIMULATOR_START_TIMEOUT} seconds.`);
            }, IosSimulatorHelper.SIMULATOR_START_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                if (name) {
                    const simulator = this.getSimulator(name);
                    if (simulator?.state === DeviceState.Booted) {
                        console.log(`*** iOS simulator ${simulator.name} has been booted.`);
                        cleanup();
                        resolve(simulator);
                    }
                } else {
                    const bootedSimulators = this.getBootedDevices();
                    if (bootedSimulators.length > 0) {
                        console.log(`*** iOS simulator ${bootedSimulators[0].name} has been booted.`);
                        cleanup();
                        resolve(bootedSimulators[0]);
                    }
                }
            }, 1000);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(bootCheckInterval);
            };
        });
    }

    public static findSimulator(simulators: IiOSSimulator[], name: string, system?: string): IiOSSimulator | null {
        const foundSimulator = simulators.find((value) => value.name === name && (!system || value.system === system));
        if (!foundSimulator) {
            return null;
        }
        return foundSimulator;
    }

    public static collectSimulators(): IiOSSimulator[] {
        const simulators: IiOSSimulator[] = [];
        const res = execSync("xcrun simctl list --json devices available").toString();
        const simulatorsJson = JSON.parse(res);
        Object.keys(simulatorsJson.devices).forEach((rawSystem) => {
            let system = rawSystem.split(".").slice(-1)[0]; // "com.apple.CoreSimulator.SimRuntime.iOS-11-4" -> "iOS-11-4"
            system = system.split("-").slice(1).join("."); // "iOS-11-4" -> "11.4"
            simulatorsJson.devices[rawSystem].forEach((device: any) => {
                simulators.push({
                    name: device.name,
                    id: device.udid,
                    system: system,
                    state: device.state,
                });
            });
        });

        return simulators;
    }

    public static getBootedDevices(): IiOSSimulator[] {
        const simulators = this.collectSimulators();
        const bootedSimulators = simulators.filter((sim) => sim.state === DeviceState.Booted);
        return bootedSimulators;
    }

    private static async runSimCtlCommand(args: string[]): Promise<RunResult> {
        return new Promise<RunResult>((resolve, reject) => {
            let stderr = "";
            const command = "xcrun";
            const commandArgs = ["simctl"].concat(args);
            const cp = spawn(command, commandArgs);
            cp.on("close", () => {
                const lines = stderr.split("\n").filter((value) => value); // filter empty lines
                if (lines.length === 0) {
                    // No error output
                    resolve({
                        Successful: true,
                    });
                    return;
                }
                const lastLine = lines[lines.length - 1];
                if (lastLine.startsWith(`Unable to ${args[0]}`)) {
                    const match = lastLine.match(/in current state: (.+)/);
                    if (!match || match.length !== 2) {
                        reject(new Error(`Error parsing ${[command].concat(commandArgs).join(" ")} output`));
                    }
                    const state = DeviceState[match![1]];
                    if (!state) {
                        console.log(`Unknown state: ${match![1]}`);
                        resolve({
                            Successful: false,
                            FailedState: DeviceState.Unknown,
                        });
                    } else {
                        resolve({
                            Successful: false,
                            FailedState: state,
                        });
                    }
                    resolve({
                        Successful: true,
                    });
                } else {
                    reject(new Error(`Error occurred while running ${[command].concat(commandArgs).join(" ")}`));
                }
            });
            cp.stderr.on("data", (chunk: string | Buffer) => {
                stderr += chunk;
                process.stderr.write(chunk);
            });
            cp.stdout.on("data", (chunk: string | Buffer) => {
                process.stdout.write(chunk);
            });
        });
    }

    private static getRunError(command: string, failedState?: DeviceState) {
        return new Error(`Couldn't run ${command} simulator` + (failedState) ? `, because it in ${failedState} state` : "");
    }
}
