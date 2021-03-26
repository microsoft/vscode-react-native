// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AbstractDeviceTracker } from "../abstractDeviceTracker";
import { IOSSimulatorManager, IiOSSimulator } from "./iOSSimulatorManager";
import { DeviceType } from "../launchArgs";
import iosUtil, { DeviceTarget } from "./iOSContainerUtility";
import { DeviceStorage } from "../networkInspector/devices/deviceStorage";
import { ClientOS } from "../networkInspector/clientUtils";
import { IOSClienDevice } from "../networkInspector/devices/iOSClienDevice";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import { ChildProcess, execFile } from "child_process";
import { ChildProcess as ChildProcessUtils } from "../../common/node/childProcess";

export class IOSDeviceTracker extends AbstractDeviceTracker {
    private readonly portForwardingClientPath: string;
    private iOSSimulatorManager: IOSSimulatorManager;
    private portForwarders: Array<ChildProcess>;

    constructor() {
        super();
        this.portForwardingClientPath =
            (findFileInFolderHierarchy(__dirname, "static/PortForwardingMacApp.app") || __dirname) +
            "/Contents/MacOS/PortForwardingMacApp";
        this.iOSSimulatorManager = new IOSSimulatorManager();
        this.portForwarders = [];
    }

    public async start(): Promise<void> {
        this.logger.debug("Start iOS device tracker");
        if (await this.isXcodeDetected()) {
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
        this.processDevices(simulators, "simulator");
        const devices = await this.getActiveDevices();
        this.processDevices(devices, "device");
    }

    private processDevices(
        activeDevices: Array<IiOSSimulator | DeviceTarget>,
        type: DeviceType,
    ): void {
        let currentDevicesIds = new Set(
            [...DeviceStorage.devices.entries()]
                .filter(entry => entry[1] instanceof IOSClienDevice && entry[1].deviceType === type)
                .map(entry => entry[0]),
        );

        for (const activeDevice of activeDevices) {
            if (currentDevicesIds.has(activeDevice.id)) {
                currentDevicesIds.delete(activeDevice.id);
            } else {
                const androidDevice = new IOSClienDevice(
                    activeDevice.id,
                    type,
                    ClientOS.iOS,
                    activeDevice.state || "active",
                    activeDevice.name,
                );
                DeviceStorage.devices.set(androidDevice.id, androidDevice);
            }
        }

        currentDevicesIds.forEach(oldDeviceId => {
            DeviceStorage.devices.delete(oldDeviceId);
        });
    }

    private startDevicePortForwarders(): void {
        if (this.portForwarders.length > 0) {
            // Only ever start them once.
            return;
        }
        // start port forwarding server for real device connections
        this.portForwarders = [this.forwardPort(8089, 8079), this.forwardPort(8088, 8078)];
    }

    private forwardPort(port: number, multiplexChannelPort: number): ChildProcess {
        const childProcess = execFile(
            this.portForwardingClientPath,
            [`-portForward=${port}`, `-multiplexChannelPort=${multiplexChannelPort}`],
            (err, stdout, stderr) => {
                if (!err?.killed) {
                    this.logger.error(
                        `Port forwarding app failed to start: ${err?.message}, ${stdout}, ${stderr}`,
                    );
                }
            },
        );
        this.logger.debug(`Port forwarding app started for ${port} port`);
        childProcess.addListener("error", err => {
            this.logger.error("Port forwarding app error", err);
        });
        childProcess.addListener("exit", code => {
            this.logger.debug(`Port forwarding app exited with code ${code}`);
        });
        return childProcess;
    }

    private getRunningSimulators(): Promise<IiOSSimulator[]> {
        return this.iOSSimulatorManager.collectSimulators("booted");
    }

    private getActiveDevices(): Promise<Array<DeviceTarget>> {
        return iosUtil.targets().catch(e => {
            this.logger.error(e.message);
            return [];
        });
    }

    private isXcodeDetected(): Promise<boolean> {
        const cp = new ChildProcessUtils();
        return cp
            .execToString("xcode-select -p")
            .then(() => true)
            .catch(() => false);
    }
}
