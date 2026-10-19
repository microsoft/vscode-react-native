// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { ChildProcess } from "../common/node/childProcess";
import { AdbHelper } from "./android/adb";
import { AndroidTargetManager } from "./android/androidTargetManager";
import { TargetType } from "./generalPlatform";
import { IDebuggableIOSTarget, IOSTargetManager } from "./ios/iOSTargetManager";
import { PlatformType } from "./launchArgs";
import { OutputChannelLogger } from "./log/OutputChannelLogger";
import { IDebuggableMobileTarget } from "./mobileTarget";
import { ProjectsStorage } from "./projectsStorage";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface Device {
    platform: PlatformType.Android | PlatformType.iOS;
    /** Stable identity, saved and passed as `target`: AVD name, Android serial or iOS UDID. */
    key: string;
    /** Runtime id shown in the picker: serial (emulator-5554) or UDID. */
    id: string;
    name: string;
    isVirtual: boolean;
    isOnline: boolean;
    /** iOS only, e.g. "iOS 27.0". */
    system?: string;
}

export interface DeviceItem extends vscode.QuickPickItem {
    device?: Device;
    coldBoot?: boolean;
}

export function statusBarText(device: Device | undefined): string {
    if (!device) {
        return localize("NoDevice", "No Device");
    }
    let kind = "";
    if (device.isVirtual) {
        kind = device.platform === PlatformType.iOS ? " simulator" : " emulator";
    }
    return `${device.name} (${device.platform}${kind})`;
}

export function statusBarTooltip(devices: Device[]): string | undefined {
    const count = devices.filter(device => device.isOnline).length;
    if (count === 0) {
        return undefined;
    }
    return count === 1
        ? localize("OneDeviceConnected", "1 Device Connected")
        : localize("DevicesConnected", "{0} Devices Connected", count);
}

export function buildPickerItems(devices: Device[], current: Device | undefined): DeviceItem[] {
    const isCurrent = (device: Device) => device.key === current?.key;
    const online = devices
        .filter(device => device.isOnline)
        .sort(
            (a, b) => Number(isCurrent(b)) - Number(isCurrent(a)) || a.name.localeCompare(b.name),
        );
    const offline = devices.filter(device => !device.isOnline && device.isVirtual);
    const items: DeviceItem[] = [];

    if (online.length) {
        items.push({
            kind: vscode.QuickPickItemKind.Separator,
            label: localize("AvailableDevices", "Available Devices"),
        });
        for (const device of online) {
            items.push({
                label: `$(device-mobile) ${device.name}`,
                description: `${device.id} - ${device.platform}`,
                detail: isCurrent(device) ? localize("CurrentDevice", "Current Device") : undefined,
                device,
            });
        }
    }

    if (offline.length) {
        items.push({
            kind: vscode.QuickPickItemKind.Separator,
            label: localize("OfflineEmulators", "Offline Emulators"),
        });
        for (const device of offline) {
            const label = `$(play) ${localize("StartDevice", "Start {0}", device.name)}`;
            if (device.platform === PlatformType.Android) {
                items.push({ label, description: "mobile emulator", device });
                items.push({
                    label,
                    description: "mobile emulator (cold boot)",
                    device,
                    coldBoot: true,
                });
            } else {
                items.push({
                    label,
                    description: `mobile simulator (${device.system ?? ""})`,
                    device,
                });
            }
        }
    }

    return items;
}

/**
 * Picks the current device after a refresh. Pass `previous === undefined` on the first refresh.
 * A newly connected device is selected unless the current one is the device the user picked
 * (`saved`); the picked device is always re-selected when it reconnects.
 */
export function nextCurrent(
    current: Device | undefined,
    previous: Device[] | undefined,
    devices: Device[],
    saved: string | undefined,
): Device | undefined {
    const online = devices.filter(device => device.isOnline);
    const find = (key: string | undefined) => online.find(device => device.key === key);
    const fallback = () => find(saved) ?? online[0];
    if (!previous) {
        return fallback();
    }

    const wasOnline = new Set(previous.filter(device => device.isOnline).map(device => device.key));
    let next = find(current?.key);
    for (const device of online) {
        const isNew = !wasOnline.has(device.key);
        if (isNew && (!next || device.key === saved || next.key !== saved)) {
            next = device;
        }
    }
    return next ?? fallback();
}

/**
 * Fills `config.target` from the selected device when the launch config leaves the target open.
 * Returns a note for the output channel when the selection could not be used.
 */
export function applySelectedDevice(
    config: vscode.DebugConfiguration,
    device: Device | undefined,
): string | undefined {
    if (
        config.request !== "launch" ||
        (config.platform !== PlatformType.Android && config.platform !== PlatformType.iOS)
    ) {
        return undefined;
    }
    const target = typeof config.target === "string" ? config.target.toLowerCase() : "";
    if (target && target !== TargetType.Simulator && target !== TargetType.Device) {
        return undefined; // an explicit target always wins
    }
    if (!device) {
        return localize(
            "NoDeviceSelected",
            "No device selected; using the default target selection.",
        );
    }
    if (device.platform !== config.platform) {
        return localize(
            "SelectedDeviceMismatch",
            "Selected device '{0}' ({1}) doesn't match '{2}' ({3}); using the default target selection.",
            device.name,
            device.platform,
            config.name,
            config.platform,
        );
    }
    const typeMatches =
        !target ||
        (target === TargetType.Simulator && device.isVirtual) ||
        (target === TargetType.Device && !device.isVirtual);
    if (typeMatches) {
        config.target = device.key;
    }
    return undefined;
}

interface RunningAndroidTarget {
    id: string;
    isVirtual: boolean;
    name: string;
}

/** Running emulators are keyed by AVD name (serials change between boots), phones by serial. */
export function toAndroidDevices(running: RunningAndroidTarget[], avdNames: string[]): Device[] {
    const devices = running.map(
        (target): Device => ({
            platform: PlatformType.Android,
            key: target.isVirtual ? target.name : target.id,
            id: target.id,
            name: target.name,
            isVirtual: target.isVirtual,
            isOnline: true,
        }),
    );
    const runningAvds = new Set(devices.filter(device => device.isVirtual).map(d => d.key));
    for (const avd of avdNames) {
        if (!runningAvds.has(avd)) {
            devices.push({
                platform: PlatformType.Android,
                key: avd,
                id: avd,
                name: avd,
                isVirtual: true,
                isOnline: false,
            });
        }
    }
    return devices;
}

/**
 * Flutter-style device selector: a status bar item showing the selected device, a picker to
 * change it or start an offline emulator/simulator, and a debug config resolver that runs
 * launches on the selected device.
 */
export class DeviceSelector implements vscode.DebugConfigurationProvider, vscode.Disposable {
    public static instance: DeviceSelector | undefined;

    private static readonly SAVED_DEVICE_KEY = "reactNative.selectedDevice";
    private static readonly REFRESH_INTERVAL_MS = 5000;
    // ponytail: `xcrun xctrace list devices` takes ~2.5 s, so physical iPhones refresh only every
    // 6th tick (~30 s) and when the picker opens. Switch to `xcrun devicectl list devices`
    // (0.14 s) once its JSON format settles (fields are deprecated in Xcode 27).
    private static readonly IOS_DEVICES_EVERY_N_REFRESHES = 6;

    private readonly statusBarItem: vscode.StatusBarItem;
    private readonly logger = OutputChannelLogger.getMainChannel();
    private readonly childProcess = new ChildProcess();
    private readonly simulatorManager = new IOSTargetManager();
    private readonly iosDeviceManager = new IOSTargetManager();
    private readonly onDidChangeDevices = new vscode.EventEmitter<void>();
    private readonly androidNames = new Map<string, string>();
    private readonly loggedErrors = new Set<string>();
    private readonly disposables: vscode.Disposable[] = [];
    private adbHelper?: AdbHelper;
    private devices?: Device[];
    private iosDevices: Device[] = [];
    private current?: Device;
    private launchingText?: string;
    private refreshing?: Promise<void>;
    private wantIosDevices = false;
    private refreshCount = 0;
    private timer?: NodeJS.Timeout;

    constructor(private readonly workspaceState: vscode.Memento) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            "reactNative.device",
            vscode.StatusBarAlignment.Right,
            Number.MIN_SAFE_INTEGER, // rightmost: lower priority sits further right
        );
        this.statusBarItem.name = "React Native Device";
        this.statusBarItem.command = "reactNative.selectDevice";
        DeviceSelector.instance = this;
    }

    /** Shows the status bar item and starts refreshing. Safe to call more than once. */
    public start(): void {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            if (vscode.window.state.focused) {
                void this.refresh();
            }
        }, DeviceSelector.REFRESH_INTERVAL_MS);
        this.disposables.push(
            vscode.window.onDidChangeWindowState(state => {
                if (state.focused) {
                    void this.refresh();
                }
            }),
        );
        this.render();
        this.statusBarItem.show();
        void this.refresh();
    }

    public async showPicker(): Promise<void> {
        const quickPick = vscode.window.createQuickPick<DeviceItem>();
        quickPick.placeholder = localize("SelectDeviceToUse", "Select a device to use");
        quickPick.ignoreFocusOut = true;
        const updateItems = () => {
            quickPick.items = buildPickerItems(this.devices ?? [], this.current);
        };
        const subscription = this.onDidChangeDevices.event(updateItems);
        updateItems();
        quickPick.busy = true;
        void this.refresh(true).finally(() => {
            quickPick.busy = false;
        });

        const selection = await new Promise<DeviceItem | undefined>(resolve => {
            quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
            quickPick.onDidHide(() => resolve(undefined));
            quickPick.show();
        });
        subscription.dispose();
        quickPick.dispose();

        if (selection?.device?.isOnline) {
            this.select(selection.device);
        } else if (selection?.device) {
            await this.launch(selection.device, !!selection.coldBoot);
        }
    }

    public resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
    ): vscode.DebugConfiguration {
        const note = applySelectedDevice(config, this.current);
        if (note) {
            this.logger.info(note);
        }
        return config;
    }

    public dispose(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.disposables.forEach(disposable => disposable.dispose());
        this.onDidChangeDevices.dispose();
        this.statusBarItem.dispose();
        DeviceSelector.instance = undefined;
    }

    private select(device: Device): void {
        this.current = device;
        void this.workspaceState.update(DeviceSelector.SAVED_DEVICE_KEY, device.key);
        this.render();
    }

    private render(): void {
        this.statusBarItem.text = this.launchingText ?? statusBarText(this.current);
        this.statusBarItem.tooltip = statusBarTooltip(this.devices ?? []);
    }

    /** Coalesces concurrent calls; a request for iOS devices during a run triggers one more run. */
    private refresh(withIosDevices = false): Promise<void> {
        this.wantIosDevices = this.wantIosDevices || withIosDevices;
        if (!this.refreshing) {
            this.refreshing = this.collectAll().finally(() => {
                this.refreshing = undefined;
                if (this.wantIosDevices) {
                    void this.refresh();
                }
            });
        }
        return this.refreshing;
    }

    private async collectAll(): Promise<void> {
        const withIosDevices =
            this.wantIosDevices ||
            this.refreshCount++ % DeviceSelector.IOS_DEVICES_EVERY_N_REFRESHES === 0;
        this.wantIosDevices = false;
        const [android, simulators, iosDevices] = await Promise.all([
            this.collectAndroid(),
            this.collectIos(this.simulatorManager, TargetType.Simulator),
            withIosDevices
                ? this.collectIos(this.iosDeviceManager, TargetType.Device)
                : Promise.resolve(this.iosDevices),
        ]);
        this.iosDevices = iosDevices;
        this.update([...android, ...simulators, ...iosDevices]);
    }

    private update(devices: Device[]): void {
        const previous = this.devices;
        if (previous && JSON.stringify(previous) === JSON.stringify(devices)) {
            return;
        }
        this.devices = devices;
        this.current = nextCurrent(
            this.current,
            previous,
            devices,
            this.workspaceState.get<string>(DeviceSelector.SAVED_DEVICE_KEY),
        );
        this.render();
        this.onDidChangeDevices.fire();
    }

    private async collectAndroid(): Promise<Device[]> {
        const adbHelper = this.getAdbHelper();
        if (!adbHelper) {
            return [];
        }
        const [avdNames, running] = await Promise.all([
            this.attempt("Android emulators", () => adbHelper.getAvdsNames(), [] as string[]),
            this.attempt("Android devices", () => this.runningAndroidTargets(adbHelper), []),
        ]);
        return toAndroidDevices(running, avdNames);
    }

    private async runningAndroidTargets(adbHelper: AdbHelper): Promise<RunningAndroidTarget[]> {
        const online = await adbHelper.getOnlineTargets();
        for (const serial of this.androidNames.keys()) {
            if (!online.some(target => target.id === serial)) {
                this.androidNames.delete(serial);
            }
        }
        return Promise.all(
            online.map(async target => ({
                id: target.id,
                isVirtual: target.isVirtualTarget,
                name: await this.androidName(adbHelper, target),
            })),
        );
    }

    /** AVD name for emulators, model for phones. Lookups that fail are retried next refresh. */
    private async androidName(
        adbHelper: AdbHelper,
        target: IDebuggableMobileTarget,
    ): Promise<string> {
        const cached = this.androidNames.get(target.id);
        if (cached) {
            return cached;
        }
        const name = target.isVirtualTarget
            ? await adbHelper.getAvdNameById(target.id)
            : (
                  await adbHelper
                      .executeShellCommand(target.id, "getprop ro.product.model")
                      .catch(() => "")
              ).trim();
        if (!name) {
            return target.id;
        }
        this.androidNames.set(target.id, name);
        return name;
    }

    private getAdbHelper(): AdbHelper | undefined {
        const project = Object.values(ProjectsStorage.projectsCache)[0];
        if (!this.adbHelper && project) {
            try {
                this.adbHelper = new AdbHelper(
                    project.getPackager().getProjectPath(),
                    project.getOrUpdateNodeModulesRoot(),
                );
            } catch {
                // node_modules is not resolvable yet; retried on the next refresh
            }
        }
        return this.adbHelper;
    }

    private async collectIos(manager: IOSTargetManager, targetType: TargetType): Promise<Device[]> {
        if (process.platform !== "darwin") {
            return [];
        }
        const source = targetType === TargetType.Simulator ? "iOS simulators" : "iOS devices";
        return this.attempt(
            source,
            async () => {
                await manager.collectTargets(targetType);
                const targets = (await manager.getTargetList()) as IDebuggableIOSTarget[];
                return targets.map(
                    (target): Device => ({
                        platform: PlatformType.iOS,
                        key: target.id,
                        id: target.id,
                        name: target.name,
                        isVirtual: target.isVirtualTarget,
                        isOnline: target.isOnline,
                        system: target.system,
                    }),
                );
            },
            [],
        );
    }

    /** Runs `collect`. Its first failure per source is logged until it succeeds again. */
    private async attempt<T>(source: string, collect: () => Promise<T>, fallback: T): Promise<T> {
        try {
            const result = await collect();
            this.loggedErrors.delete(source);
            return result;
        } catch (error) {
            if (!this.loggedErrors.has(source)) {
                this.loggedErrors.add(source);
                this.logger.warning(
                    localize(
                        "CouldNotListDevices",
                        "Could not list {0}: {1}",
                        source,
                        error instanceof Error ? error.message : String(error),
                    ),
                );
            }
            return fallback;
        }
    }

    private async launch(device: Device, coldBoot: boolean): Promise<void> {
        const isIos = device.platform === PlatformType.iOS;
        this.launchingText = isIos
            ? localize("LaunchingSimulator", "Launching simulator...")
            : localize("LaunchingEmulator", "Launching emulator...");
        this.render();
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: localize("LaunchingDevice", "Launching {0}...", device.name),
                },
                () => (isIos ? this.bootSimulator(device) : this.bootEmulator(device, coldBoot)),
            );
            await this.refresh();
            this.select(
                this.devices?.find(d => d.key === device.key && d.isOnline) ?? {
                    ...device,
                    isOnline: true,
                },
            );
        } catch (error) {
            void vscode.window.showErrorMessage(
                localize(
                    "FailedToLaunchDevice",
                    "Failed to launch {0}: {1}",
                    device.name,
                    error instanceof Error ? error.message : String(error),
                ),
            );
        } finally {
            this.launchingText = undefined;
            this.render();
        }
    }

    private async bootEmulator(device: Device, coldBoot: boolean): Promise<void> {
        const adbHelper = this.getAdbHelper();
        if (!adbHelper) {
            throw new Error(localize("NoReactNativeProject", "No React Native project is open"));
        }
        await new AndroidTargetManager(adbHelper).launchSimulator(
            { name: device.key, isOnline: false, isVirtualTarget: true },
            coldBoot,
        );
    }

    private async bootSimulator(device: Device): Promise<void> {
        // A separate manager instance: launchSimulator re-collects targets while it waits,
        // which would race with the refresh loop's simulatorManager.
        await new IOSTargetManager().launchSimulator({
            id: device.id,
            name: device.name,
            system: device.system ?? "",
            isVirtualTarget: true,
            isOnline: false,
        });
        // `simctl boot` starts the simulator without a window. Xcode 27 renamed Simulator.app to DeviceHub.app.
        await this.childProcess
            .execFileToString("open", ["-a", "DeviceHub"])
            .catch(() => this.childProcess.execFileToString("open", ["-a", "Simulator"]))
            .catch(error => this.logger.warning(error));
    }
}
