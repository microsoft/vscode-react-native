// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { spawn, execSync } from "child_process";
import { sleep, waitUntil } from "./utilities";
import * as kill from "tree-kill";
import * as cp from "child_process";
import { SmokeTestLogger } from "./smokeTestLogger";
import { ExpoClientData } from "./androidEmulatorManager";

const XDL = require("xdl");

interface IiOSSimulator {
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

interface RunResult {
    Successful: boolean;
    FailedState?: DeviceState;
}

export default class IosSimulatorManager {
    private static readonly SIMULATOR_START_TIMEOUT = 300_000;
    private static readonly SIMULATOR_TERMINATE_TIMEOUT = 30_000;

    private static readonly APP_INSTALL_AND_BUILD_TIMEOUT = 600_000;
    private static readonly APP_INIT_TIMEOUT = 40_000;
    private simulator: IiOSSimulator;

    constructor(
        name: string | undefined = process.env.IOS_SIMULATOR,
        iosVersion: string | undefined = process.env.IOS_VERSION,
    ) {
        if (!name) {
            throw new Error(
                "Passed iOS simulator name and process.env.IOS_SIMULATOR is not defined!",
            );
        }
        if (process.platform === "darwin") {
            if (iosVersion) {
                const versions = iosVersion?.split(".");
                iosVersion = `iOS-${versions[0]}-${versions[1]}`;
            }
            this.updateSimulatorState(name, iosVersion);
        }
    }

    public getSimulator(): IiOSSimulator {
        return this.simulator;
    }

    public static getIOSBuildPath(
        iosProjectRoot: string,
        projectWorkspaceConfigName: string,
        configuration: string,
        scheme: string,
        sdkType: string,
    ): string {
        const buildSettings = cp.execFileSync(
            "xcodebuild",
            [
                "-workspace",
                projectWorkspaceConfigName,
                "-scheme",
                scheme,
                "-sdk",
                sdkType,
                "-configuration",
                configuration,
                "-showBuildSettings",
            ],
            {
                encoding: "utf8",
                cwd: iosProjectRoot,
            },
        );

        const targetBuildDir = this.getTargetBuildDir(<string>buildSettings);

        if (!targetBuildDir) {
            throw new Error("Failed to get the target build directory.");
        }
        return targetBuildDir;
    }

    private updateSimulatorState(name: string, iosVersion?: string) {
        const simulators = IosSimulatorManager.collectSimulators();
        const simulator = this.findSimulator(simulators, name, iosVersion);
        if (!simulator) {
            throw new Error(
                `Could not find simulator with name: '${name}'${
                    iosVersion ? ` and iOS version: '${iosVersion}'` : ""
                } in system. Exiting...`,
            );
        }
        this.simulator = simulator;
    }

    public async runIosSimulator(): Promise<void> {
        await this.shutdownSimulator();
        // Wipe data on simulator
        await this.eraseSimulator();
        SmokeTestLogger.info(
            `*** Executing iOS simulator with 'xcrun simctl boot "${this.simulator.name}"' command...`,
        );
        await this.bootSimulator();
        await sleep(15 * 1000);
    }

    public async bootSimulator(): Promise<void> {
        const cmd = "boot";
        const result = await IosSimulatorManager.runSimCtlCommand([cmd, this.simulator.name]);
        if (!result.Successful) {
            if (result.FailedState === DeviceState.Booted) {
                // That's okay, it means simulator is already booted
            } else {
                throw IosSimulatorManager.getRunError(cmd, result.FailedState);
            }
        }
        this.updateSimulatorState(this.simulator.name, this.simulator.system);
    }

    public async shutdownSimulator(): Promise<void> {
        await IosSimulatorManager.shutdownSimulator(this.simulator.name);
        this.updateSimulatorState(this.simulator.name, this.simulator.system);
    }

    public async eraseSimulator(): Promise<void> {
        const cmd = "erase";
        const result = await IosSimulatorManager.runSimCtlCommand([cmd, this.simulator.name]);
        if (!result.Successful) {
            throw IosSimulatorManager.getRunError(cmd, result.FailedState);
        }
        this.updateSimulatorState(this.simulator.name, this.simulator.system);
    }

    public async waitUntilIosSimulatorStarting(): Promise<boolean> {
        const condition = () => {
            this.updateSimulatorState(this.simulator.name, this.simulator.system);
            if (this.simulator.state === DeviceState.Booted) {
                return true;
            } else return false;
        };

        return waitUntil(condition, IosSimulatorManager.SIMULATOR_START_TIMEOUT).then(result => {
            if (result) {
                SmokeTestLogger.success(
                    `*** iOS simulator ${this.simulator.name} has been started.`,
                );
            } else {
                SmokeTestLogger.error(
                    `*** Could not start iOS simulator ${this.simulator.name} after ${IosSimulatorManager.SIMULATOR_START_TIMEOUT}.`,
                );
            }
            return result;
        });
    }

    public async waitUntilIosSimulatorTerminating(): Promise<boolean> {
        const condition = () => {
            this.updateSimulatorState(this.simulator.name, this.simulator.system);
            if (this.simulator.state === DeviceState.Shutdown) {
                return true;
            } else return false;
        };

        return waitUntil(condition, IosSimulatorManager.SIMULATOR_TERMINATE_TIMEOUT).then(
            result => {
                if (result) {
                    SmokeTestLogger.success(
                        `*** iOS simulator ${this.simulator.name} has been terminated.`,
                    );
                } else {
                    SmokeTestLogger.error(
                        `*** Could not terminate iOS simulator ${this.simulator.name} after ${IosSimulatorManager.SIMULATOR_TERMINATE_TIMEOUT}.`,
                    );
                }
                return result;
            },
        );
    }

    public async waitUntilIosAppIsInstalled(appBundleId: string): Promise<void> {
        // Start watcher for launch events console logs in simulator and wait until needed app is launched
        // TODO is not compatible with parallel test run (race condition)
        let launched = false;
        const predicate = `eventMessage contains "Launch successful for '${appBundleId}'"`;
        const args = [
            "simctl",
            "spawn",
            this.simulator.name,
            "log",
            "stream",
            "--predicate",
            predicate,
        ];
        const proc = spawn("xcrun", args, { stdio: "pipe" });
        proc.stdout.on("data", (data: string) => {
            data = data.toString();
            SmokeTestLogger.info(data);
            if (data.startsWith("Filtering the log data")) {
                return;
            }
            const regexp = new RegExp(`Launch successful for '${appBundleId}'`);
            if (regexp.test(data)) {
                launched = true;
            }
        });
        proc.stderr.on("error", (data: string) => {
            SmokeTestLogger.error(data.toString());
        });
        proc.on("error", err => {
            SmokeTestLogger.error(err);
            kill(proc.pid);
        });

        let awaitRetries: number = IosSimulatorManager.APP_INSTALL_AND_BUILD_TIMEOUT / 1000;
        let retry = 1;
        await new Promise((resolve, reject) => {
            const check = setInterval(async () => {
                if (retry % 5 === 0) {
                    SmokeTestLogger.info(
                        `*** Check if app with bundleId ${appBundleId} is installed, ${retry} attempt`,
                    );
                }
                if (launched) {
                    clearInterval(check);
                    const initTimeout = IosSimulatorManager.APP_INIT_TIMEOUT || 10000;
                    SmokeTestLogger.success(
                        `*** Installed ${appBundleId} app found, await ${initTimeout}ms for initializing...`,
                    );
                    await sleep(initTimeout);
                    resolve();
                } else {
                    retry++;
                    if (retry >= awaitRetries) {
                        clearInterval(check);
                        kill(proc.pid, () => {
                            reject(
                                `${appBundleId} not found after ${IosSimulatorManager.APP_INSTALL_AND_BUILD_TIMEOUT}ms`,
                            );
                        });
                    }
                }
            }, 1000);
        });
    }

    public async getExpoAndroidClientForSDK(expoSdkMajorVersion: string): Promise<ExpoClientData> {
        const sdkVersion = (await XDL.Versions.sdkVersionsAsync())[`${expoSdkMajorVersion}.0.0`];
        return {
            url: sdkVersion.iosClientUrl,
            version: sdkVersion.iosClientVersion,
        };
    }

    public async installExpoAppOnIos(): Promise<void> {
        this.updateSimulatorState(this.simulator.name, this.simulator.system);
        if (this.simulator.state === DeviceState.Booted) {
            const expoClientData = await this.getExpoAndroidClientForSDK(
                process.env.EXPO_SDK_MAJOR_VERSION || "",
            );

            SmokeTestLogger.projectPatchingLog(
                `*** Installing Expo app v${expoClientData.version} on iOS simulator using Expo XDL function`,
            );

            await XDL.Simulator.installExpoOnSimulatorAsync({
                simulator: {
                    name: this.simulator.name || "",
                    udid: this.simulator.id || "",
                },
                url: expoClientData.url,
                version: expoClientData.version,
            });
        } else {
            throw new Error(
                "*** Could not install Expo app on iOS simulator because it is not booted",
            );
        }
    }

    private findSimulator(
        simulators: IiOSSimulator[],
        name: string,
        system?: string,
    ): IiOSSimulator | null {
        const foundSimulator = simulators.find(
            value => value.name === name && (!system || value.system === system),
        );
        if (!foundSimulator) {
            return null;
        }
        return foundSimulator;
    }

    private static getBootedDevices(): IiOSSimulator[] {
        const simulators = this.collectSimulators();
        const bootedSimulators = simulators.filter(sim => sim.state === DeviceState.Booted);
        return bootedSimulators;
    }

    private static collectSimulators(): IiOSSimulator[] {
        const simulators: IiOSSimulator[] = [];
        const res = execSync("xcrun simctl list --json devices available").toString();
        const simulatorsJson = JSON.parse(res);
        Object.keys(simulatorsJson.devices).forEach(rawSystem => {
            let system = rawSystem.split(".").slice(-1)[0]; // "com.apple.CoreSimulator.SimRuntime.iOS-11-4" -> "iOS-11-4"
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

    private static async runSimCtlCommand(args: string[]): Promise<RunResult> {
        return new Promise<RunResult>((resolve, reject) => {
            let stderr = "";
            const command = "xcrun";
            const commandArgs = ["simctl"].concat(args);
            const cp = spawn(command, commandArgs);
            cp.on("close", () => {
                const lines = stderr.split("\n").filter(value => value); // filter empty lines
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
                        reject(
                            new Error(
                                `Error parsing ${[command].concat(commandArgs).join(" ")} output`,
                            ),
                        );
                    }
                    const state = DeviceState[match![1]];
                    if (!state) {
                        SmokeTestLogger.warn(`Unknown state: ${match![1]}`);
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
                    reject(
                        new Error(
                            `Error occurred while running ${[command]
                                .concat(commandArgs)
                                .join(" ")}`,
                        ),
                    );
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
        return new Error(
            `Couldn't run ${command} simulator` + failedState
                ? `, because it in ${failedState} state`
                : "",
        );
    }

    public static async shutdownAllSimulators(): Promise<boolean> {
        const promises: Promise<void>[] = [];
        IosSimulatorManager.getBootedDevices().forEach(device => {
            promises.push(IosSimulatorManager.shutdownSimulator(device.name));
        });
        await Promise.all(promises);
        return this.waitUntilAllIosSimulatorsTerminating();
    }

    private static async shutdownSimulator(simulatorName: string): Promise<void> {
        const cmd = "shutdown";
        const result = await IosSimulatorManager.runSimCtlCommand([cmd, simulatorName]);
        if (!result.Successful) {
            if (result.FailedState === DeviceState.Shutdown) {
                // That's okay, it means simulator is already shutted down
            } else {
                throw IosSimulatorManager.getRunError(cmd, result.FailedState);
            }
        }
        SmokeTestLogger.success(
            `*** iOS simulators with name "${simulatorName}" has been terminated.`,
        );
    }

    public static async waitUntilAllIosSimulatorsTerminating(): Promise<boolean> {
        const condition = () => {
            if (IosSimulatorManager.getBootedDevices().length === 0) {
                return true;
            } else return false;
        };

        return waitUntil(condition, IosSimulatorManager.SIMULATOR_TERMINATE_TIMEOUT).then(
            result => {
                if (result) {
                    SmokeTestLogger.success(`*** All iOS simulators has been terminated.`);
                } else {
                    SmokeTestLogger.error(
                        `*** Could not terminate all iOS simulators after ${IosSimulatorManager.SIMULATOR_TERMINATE_TIMEOUT}.`,
                    );
                }
                return result;
            },
        );
    }

    /**
     *
     * The function was taken from https://github.com/react-native-community/cli/blob/master/packages/platform-ios/src/commands/runIOS/index.ts#L369-L374
     *
     * @param {string} buildSettings
     * @returns {string | null}
     */
    private static getTargetBuildDir(buildSettings: string) {
        const targetBuildMatch = /TARGET_BUILD_DIR = (.+)$/m.exec(buildSettings);
        return targetBuildMatch && targetBuildMatch[1] ? targetBuildMatch[1].trim() : null;
    }
}
