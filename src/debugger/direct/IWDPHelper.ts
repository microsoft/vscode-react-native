// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PromiseUtil } from "../../common/node/promise";
import { Request } from "../../common/node/request";
import { IAttachRequestArgs } from "../debugSessionBase";
import * as cp from "child_process";
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

    public startiOSWebkitDebugProxy(
        proxyPort: number,
        proxyRangeStart: number,
        proxyRangeEnd: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.cleanUp();

            let portRange = `null:${proxyPort},:${proxyRangeStart}-${proxyRangeEnd}`;
            this.iOSWebkitDebugProxyProcess = cp.spawn("ios_webkit_debug_proxy", ["-c", portRange]);
            this.iOSWebkitDebugProxyProcess.on("error", err => {
                reject(new Error("Unable to start ios_webkit_debug_proxy: " + err));
            });
            // Allow some time for the spawned process to error out
            PromiseUtil.delay(250).then(() => resolve());
        });
    }

    public getSimulatorProxyPort(
        attachArgs: IAttachRequestArgs,
    ): Promise<{ targetPort: number; iOSVersion: string }> {
        return Request.request(`http://localhost:${attachArgs.port}/json`, true).then(
            (response: string) => {
                try {
                    // An example of a json response from IWDP
                    // [{
                    //     "deviceId": "00008020-XXXXXXXXXXXXXXXX",
                    //     "deviceName": "iPhone name",
                    //     "deviceOSVersion": "13.4.1",
                    //     "url": "localhost:9223"
                    //  }]
                    let endpointsList = JSON.parse(response);

                    let devices = endpointsList;
                    if (attachArgs.target) {
                        devices = endpointsList.filter((entry: { deviceId: string }) =>
                            attachArgs.target?.toLowerCase() === "device"
                                ? entry.deviceId !== "SIMULATOR"
                                : entry.deviceId === "SIMULATOR",
                        );
                    }

                    let device = devices[0];
                    // device.url is of the form 'localhost:port'
                    return Promise.resolve({
                        targetPort: parseInt(device.url.split(":")[1], 10),
                        iOSVersion: device.deviceOSVersion,
                    });
                } catch (e) {
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.IOSCouldNotFoundDeviceForDirectDebugging,
                    );
                }
            },
        );
    }

    public cleanUp(): void {
        if (this.iOSWebkitDebugProxyProcess) {
            this.iOSWebkitDebugProxyProcess.kill();
            this.iOSWebkitDebugProxyProcess = null;
        }
    }
}
