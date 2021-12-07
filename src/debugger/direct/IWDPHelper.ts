// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { PromiseUtil } from "../../common/node/promise";
import { Request } from "../../common/node/request";
import { IAttachRequestArgs } from "../debugSessionBase";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";

/**
 * Helper class to control [ios-webkit-debug-proxy](https://github.com/google/ios-webkit-debug-proxy)
 */
export class IWDPHelper {
    private iOSWebkitDebugProxyProcess: cp.ChildProcess | null;
    public static readonly iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT: number = 9221;

    constructor() {
        this.iOSWebkitDebugProxyProcess = null;
    }

    public async startiOSWebkitDebugProxy(
        proxyPort: number,
        proxyRangeStart: number,
        proxyRangeEnd: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.cleanUp();

            const portRange = `null:${proxyPort},:${proxyRangeStart}-${proxyRangeEnd}`;
            this.iOSWebkitDebugProxyProcess = cp.spawn("ios_webkit_debug_proxy", ["-c", portRange]);
            this.iOSWebkitDebugProxyProcess.on("error", err => {
                reject(new Error(`Unable to start ios_webkit_debug_proxy: ${String(err)}`));
            });
            // Allow some time for the spawned process to error out
            void PromiseUtil.delay(250).then(() => resolve());
        });
    }

    public async getSimulatorProxyPort(
        attachArgs: IAttachRequestArgs,
    ): Promise<{ targetPort: number; iOSVersion: string }> {
        const response = await Request.request(`http://localhost:${attachArgs.port}/json`, true);
        try {
            // An example of a json response from IWDP
            // [{
            //     "deviceId": "00008020-XXXXXXXXXXXXXXXX",
            //     "deviceName": "iPhone name",
            //     "deviceOSVersion": "13.4.1",
            //     "url": "localhost:9223"
            //  }]
            const endpointsList = JSON.parse(response);

            let devices = endpointsList;
            if (attachArgs.target) {
                devices = endpointsList.filter((entry: { deviceId: string }) =>
                    attachArgs.target?.toLowerCase() === "device"
                        ? entry.deviceId !== "SIMULATOR"
                        : entry.deviceId === "SIMULATOR",
                );
            }

            const device = devices[0];
            // device.url is of the form 'localhost:port'
            return {
                targetPort: parseInt(device.url.split(":")[1], 10),
                iOSVersion: device.deviceOSVersion,
            };
        } catch (e) {
            throw ErrorHelper.getInternalError(
                InternalErrorCode.IOSCouldNotFoundDeviceForDirectDebugging,
            );
        }
    }

    public cleanUp(): void {
        if (this.iOSWebkitDebugProxyProcess) {
            this.iOSWebkitDebugProxyProcess.kill();
            this.iOSWebkitDebugProxyProcess = null;
        }
    }
}
