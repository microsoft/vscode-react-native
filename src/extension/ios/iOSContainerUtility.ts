// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "../../common/node/childProcess";
import { PromiseUtil } from "../../common/node/promise";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import * as fs from "fs";
import * as path from "path";
import { IDebuggableMobileTarget } from "../mobileTarget";

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/c2848df7f210c363113797c0f2e3db8c5d4fd49f/desktop/app/src/server/devices/ios/iOSContainerUtility.tsx
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export const idbPath = "/usr/local/bin/idb";
// Use debug to get helpful logs when idb fails
const idbLogLevel = "DEBUG";

type IdbTarget = {
    name: string;
    udid: string;
    state: string;
    type: string;
    target_type?: string;
    os_version: string;
    architecture: string;
};

export type DeviceTarget = IDebuggableMobileTarget;

const isIdbAvailable = PromiseUtil.promiseCacheDecorator<boolean>(isAvailable);

function isAvailable(): Promise<boolean> {
    if (!idbPath) {
        return Promise.resolve(false);
    }
    return fs.promises
        .access(idbPath, fs.constants.X_OK)
        .then(() => true)
        .catch(() => false);
}

async function isXcodeDetected(): Promise<boolean> {
    return new ChildProcess()
        .execToString("xcode-select -p")
        .then(stdout => {
            return fs.existsSync(stdout.trim());
        })
        .catch(_ => false);
}

async function queryTargetsWithoutXcodeDependency(
    idbCompanionPath: string,
    isPhysicalDeviceEnabled: boolean,
    isAvailableFunc: (idbPath: string) => Promise<boolean>,
): Promise<Array<DeviceTarget>> {
    if (await isAvailableFunc(idbCompanionPath)) {
        return new ChildProcess()
            .execToString(`${idbCompanionPath} --list 1 --only device`)
            .then(stdout => parseIdbTargets(stdout))
            .then(devices => {
                if (devices.length > 0 && !isPhysicalDeviceEnabled) {
                    // TODO: Show a notification to enable the toggle or integrate Doctor to better suggest this advice.
                    console.warn(
                        'You are trying to connect Physical Device. Please enable the toggle "Enable physical iOS device" from the setting screen.',
                    );
                }
                return devices;
            })
            .catch((e: Error) => {
                console.warn(
                    "Failed to query idb_companion --list 1 --only device for physical targets:",
                    e,
                );
                return [];
            });
    } else {
        console.warn(
            `Unable to locate idb_companion in ${idbCompanionPath}. Try running sudo yum install -y fb-idb`,
        );
        return [];
    }
}

function parseIdbTargets(lines: string): Array<DeviceTarget> {
    return lines
        .trim()
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line))
        .filter(({ state }: IdbTarget) => state.toLocaleLowerCase() === "booted")
        .map<IdbTarget>(({ type, target_type, ...rest }: IdbTarget) => ({
            type: (type || target_type) === "simulator" ? "emulator" : "physical",
            ...rest,
        }))
        .map<DeviceTarget>((target: IdbTarget) => ({
            id: target.udid,
            isVirtualTarget: target.type === "emulator",
            name: target.name,
            isOnline: true,
        }));
}

export async function idbListTargets(idbPath: string): Promise<Array<DeviceTarget>> {
    return new ChildProcess()
        .execToString(`${idbPath} list-targets --json`)
        .then(stdout =>
            // See above.
            parseIdbTargets(stdout),
        )
        .catch((e: Error) => {
            console.warn("Failed to query idb for targets:", e);
            return [];
        });
}

async function targets(
    idbPath: string,
    isPhysicalDeviceEnabled: boolean,
): Promise<Array<DeviceTarget>> {
    if (process.platform !== "darwin") {
        return [];
    }
    const isXcodeInstalled = await isXcodeDetected();
    if (!isXcodeInstalled) {
        if (!isPhysicalDeviceEnabled) {
            // TODO: Show a notification to enable the toggle or integrate Doctor to better suggest this advice.
            console.warn(
                'You are trying to connect Physical Device. Please enable the toggle "Enable physical iOS device" from the setting screen.',
            );
        }
        const idbCompanionPath = path.dirname(idbPath) + "/idb_companion";
        return queryTargetsWithoutXcodeDependency(
            idbCompanionPath,
            isPhysicalDeviceEnabled,
            isAvailable,
        );
    }

    // Not all users have idb installed because you can still use
    // Flipper with Simulators without it.
    // But idb is MUCH more CPU efficient than xcrun, so
    // when installed, use it. This still holds true
    // with the move from instruments to xcrun.
    // TODO: Move idb availability check up.
    if (await isIdbAvailable()) {
        return await idbListTargets(idbPath);
    } else {
        return new ChildProcess()
            .execToString("xcrun xctrace list devices")
            .then(stdout =>
                stdout
                    .split("\n")
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(line => /(.+) \([^(]+\) \[(.*)\]( \(Simulator\))?/.exec(line))
                    .filter(el => el !== null)
                    .filter(([_match, _name, _udid, isSim]: RegExpExecArray) => !isSim)
                    .map<DeviceTarget>(([_match, name, id]: RegExpExecArray) => {
                        return { id, isVirtualTarget: false, isOnline: true, name };
                    }),
            )
            .catch(e => {
                console.warn("Failed to query for devices using xctrace:", e);
                return [];
            });
    }
}

async function push(
    udid: string,
    src: string,
    bundleId: string,
    dst: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const cp = new ChildProcess();
    await checkIdbIsInstalled();
    return wrapWithErrorMessage(
        cp
            .execToString(
                `${idbPath} --log ${idbLogLevel} file push --udid ${udid} --bundle-id ${bundleId} '${src}' '${dst}'`,
            )
            .then(() => {
                return;
            })
            .catch(e => handleMissingIdb(e)),
        logger,
    );
}

async function pull(
    udid: string,
    src: string,
    bundleId: string,
    dst: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const cp = new ChildProcess();
    await checkIdbIsInstalled();
    return wrapWithErrorMessage(
        cp
            .execToString(
                `${idbPath} --log ${idbLogLevel} file pull --udid ${udid} --bundle-id ${bundleId} '${src}' '${dst}'`,
            )
            .then(() => {
                return;
            })
            .catch(e => handleMissingIdb(e)),
        logger,
    );
}

export async function checkIdbIsInstalled(): Promise<void> {
    const isInstalled = await isIdbAvailable();
    if (!isInstalled) {
        throw new Error(
            `idb is required to use iOS devices. Please install it with instructions from https://github.com/facebook/idb.`,
        );
    }
}

// The fb-internal idb binary is a shim that downloads the proper one on first run. It requires sudo to do so.
// If we detect this, Tell the user how to fix it.
function handleMissingIdb(e: Error): void {
    if (e.message && e.message.includes("sudo: no tty present and no askpass program specified")) {
        throw new Error(
            `idb doesn't appear to be installed. Run "${idbPath} list-targets" to fix this.`,
        );
    }
    throw e;
}

function wrapWithErrorMessage<T>(p: Promise<T>, logger?: OutputChannelLogger): Promise<T> {
    return p.catch((e: Error) => {
        logger?.error(e.message);
        // Give the user instructions. Don't embed the error because it's unique per invocation so won't be deduped.
        throw new Error(
            "A problem with idb has ocurred. Please run `sudo rm -rf /tmp/idb*` and `sudo yum install -y fb-idb` to update it, if that doesn't fix it, post in https://github.com/microsoft/vscode-react-native.",
        );
    });
}

export default {
    isAvailable,
    targets,
    push,
    pull,
};

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/c2848df7f210c363113797c0f2e3db8c5d4fd49f/desktop/app/src/server/devices/ios/iOSContainerUtility.tsx
 */
