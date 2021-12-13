// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess, execFile } from "child_process";
import { AbstractDeviceTracker } from "../abstractDeviceTracker";
import { DeviceStorage } from "../networkInspector/devices/deviceStorage";
import { ClientOS } from "../networkInspector/clientUtils";
import { IOSClienDevice } from "../networkInspector/devices/iOSClienDevice";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import iosUtil, { DeviceTarget, isXcodeDetected } from "./iOSContainerUtility";
import { IDebuggableIOSTarget, IOSTargetManager } from "./iOSTargetManager";

export class IOSDeviceTracker extends AbstractDeviceTracker {
    private readonly portForwardingClientPath: string;
    private iOSTargetManager: IOSTargetManager;
    private portForwarders: Array<ChildProcess>;

    constructor() {
        super();
        this.portForwardingClientPath = `${
            findFileInFolderHierarchy(__dirname, "static/PortForwardingMacApp.app") || __dirname
        }/Contents/MacOS/PortForwardingMacApp`;
        this.iOSTargetManager = new IOSTargetManager();
        this.portForwarders = [];
    }

    public async start(): Promise<void> {
        this.logger.debug("Start iOS device tracker");
        if (await isXcodeDetected()) {
            this.startDevicePortForwarders();
        }
        await this.queryDevicesLoop();
    }

    public stop(): void {
        this.logger.debug("Stop iOS device tracker");
        this.isStop = true;
        this.portForwarders.forEach(process => process.kill());
    }

    protected async queryDevices(): Promise<void> {
        const simulators = await this.getRunningSimulators();
        this.processDevices(simulators, true);
        const devices = await this.getActiveDevices();
        this.processDevices(devices, false);
    }

    private processDevices(activeDevices: Array<DeviceTarget>, isVirtualTarget: boolean): void {
        const currentDevicesIds = new Set(
            [...DeviceStorage.devices.entries()]
                .filter(
                    entry =>
                        entry[1] instanceof IOSClienDevice &&
                        entry[1].isVirtualTarget === isVirtualTarget,
                )
                .map(entry => entry[0]),
        );

        for (const activeDevice of activeDevices) {
            if (currentDevicesIds.has(activeDevice.id)) {
                currentDevicesIds.delete(activeDevice.id);
            } else {
                const iosDevice = new IOSClienDevice(
                    activeDevice.id,
                    isVirtualTarget,
                    ClientOS.iOS,
                    activeDevice.isOnline,
                    activeDevice.name,
                );
                DeviceStorage.devices.set(iosDevice.id, iosDevice);
            }
        }

        currentDevicesIds.forEach(oldDeviceId => {
            DeviceStorage.devices.delete(oldDeviceId);
        });
    }

    /**
     * @preserve
     * Start region: The code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L81-L88
     *
     * Copyright (c) Facebook, Inc. and its affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *
     * @format
     */
    private startDevicePortForwarders(): void {
        if (this.portForwarders.length > 0) {
            // Only ever start them once.
            return;
        }
        // start port forwarding server for real device connections
        this.portForwarders = [this.forwardPort(8089, 8079), this.forwardPort(8088, 8078)];
    }

    /**
     * @preserve
     * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L81-L88
     */

    /**
     * @preserve
     * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L63-L79
     *
     * Copyright (c) Facebook, Inc. and its affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *
     * @format
     */
    private forwardPort(port: number, multiplexChannelPort: number): ChildProcess {
        const childProcess = execFile(
            this.portForwardingClientPath,
            [`-portForward=${port}`, `-multiplexChannelPort=${multiplexChannelPort}`],
            (err, stdout, stderr) => {
                if (!err?.killed) {
                    this.logger.error(
                        `Port forwarding app failed to start: ${String(
                            err?.message,
                        )}, ${stdout}, ${stderr}`,
                    );
                }
            },
        );
        this.logger.debug(`Port forwarding app started for ${port} port`);
        childProcess.addListener("error", err => {
            this.logger.error("Port forwarding app error", err);
        });
        childProcess.addListener("exit", code => {
            this.logger.debug(`Port forwarding app exited with code ${String(code)}`);
        });
        return childProcess;
    }

    /**
     * @preserve
     * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L63-L79
     */

    private async getRunningSimulators(): Promise<IDebuggableIOSTarget[]> {
        return (await this.iOSTargetManager.getTargetList(
            target => target.isOnline,
        )) as IDebuggableIOSTarget[];
    }

    /**
     * @preserve
     * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L227-L232
     *
     * Copyright (c) Facebook, Inc. and its affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *
     * @format
     */
    private getActiveDevices(): Promise<Array<DeviceTarget>> {
        return iosUtil.targets().catch(e => {
            this.logger.error(e.message);
            return [];
        });
    }

    /**
     * @preserve
     * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/dispatcher/iOSDevice.tsx#L227-L232
     */
}
