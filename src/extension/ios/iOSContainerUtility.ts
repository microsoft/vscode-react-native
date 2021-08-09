// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "../../common/node/childProcess";
import { notNullOrUndefined } from "../../common/utils";
import { PromiseUtil } from "../../common/node/promise";
import { IVirtualDevice } from "../VirtualDeviceManager";
import { DeviceType } from "../launchArgs";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { promises, constants } from "fs";

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/iOSContainerUtility.tsx
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
    os_version: string;
    architecture: string;
};

export interface DeviceTarget extends IVirtualDevice {
    type: DeviceType;
    state: string;
}

const isIdbAvailable = PromiseUtil.promiseCacheDecorator<boolean>(isAvailable);

function isAvailable(): Promise<boolean> {
    if (!idbPath) {
        return Promise.resolve(false);
    }
    return promises
        .access(idbPath, constants.X_OK)
        .then(() => true)
        .catch(() => false);
}

async function targets(): Promise<Array<DeviceTarget>> {
    const cp = new ChildProcess();
    if (process.platform !== "darwin") {
        return [];
    }

    // Not all users have idb installed because you can still use
    // Flipper with Simulators without it.
    // But idb is MUCH more CPU efficient than instruments, so
    // when installed, use it.
    if (await isIdbAvailable()) {
        return cp.execToString(`${idbPath} list-targets --json`).then(stdout =>
            // It is safe to assume this to be non-null as it only turns null
            // if the output redirection is misconfigured:
            // https://stackoverflow.com/questions/27786228/node-child-process-spawn-stdout-returning-as-null
            stdout!
                .trim()
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => JSON.parse(line))
                .filter(({ type }: IdbTarget) => type !== "simulator")
                .map((target: IdbTarget) => {
                    return {
                        id: target.udid,
                        type: "device",
                        name: target.name,
                        state: target.state,
                    };
                }),
        );
    } else {
        await cp.killOrphanedInstrumentsProcesses();
        return cp.execToString("instruments -s devices").then(stdout =>
            stdout!
                .toString()
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => /(.+) \([^(]+\) \[(.*)\]( \(Simulator\))?/.exec(line))
                .filter(notNullOrUndefined)
                .filter(([_match, _name, _udid, isSim]) => !isSim)
                .map(([_match, name, udid]) => {
                    return {
                        id: udid,
                        type: "device",
                        name,
                        state: "active",
                    };
                }),
        );
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
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/iOSContainerUtility.tsx
 */
