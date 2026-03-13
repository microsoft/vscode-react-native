// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { window, Disposable, StatusBarItem, StatusBarAlignment } from "vscode";

/**
 * Shows the currently connected device/simulator name in the status bar during a debug session.
 */
export class DeviceStatusIndicator implements Disposable {
    private static readonly DEVICE_ICON = "$(device-mobile)";
    private static instance: DeviceStatusIndicator | undefined;

    private statusBarItem: StatusBarItem;

    private constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 9);
    }

    private static getInstance(): DeviceStatusIndicator {
        if (!DeviceStatusIndicator.instance) {
            DeviceStatusIndicator.instance = new DeviceStatusIndicator();
        }
        return DeviceStatusIndicator.instance;
    }

    public static show(deviceName: string): void {
        const instance = DeviceStatusIndicator.getInstance();
        instance.statusBarItem.text = `${DeviceStatusIndicator.DEVICE_ICON} ${deviceName}`;
        instance.statusBarItem.tooltip = `Active debug target: ${deviceName}`;
        instance.statusBarItem.show();
    }

    public static hide(): void {
        DeviceStatusIndicator.instance?.statusBarItem.hide();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        DeviceStatusIndicator.instance = undefined;
    }
}
