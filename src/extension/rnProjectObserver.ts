// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { commands } from "vscode";
import { CONTEXT_VARIABLES_NAMES } from "../common/contextVariablesNames";
import { ProjectVersionHelper, RNPackageVersions } from "../common/projectVersionHelper";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";

export class RNProjectObserver {
    private _isRNMacosProject: boolean;
    private _isRNWindowsProject: boolean;
    private _isRNMacosHermesProject: boolean;
    private _isRNWindowsHermesProject: boolean;
    private _isRNAndroidHermesProject: boolean;
    private _isRNIosHermesProject: boolean;
    private _isRNHermesProject: boolean;

    constructor() {
        this._isRNMacosProject = false;
        this._isRNWindowsProject = false;
        this._isRNMacosHermesProject = false;
        this._isRNWindowsHermesProject = false;
        this._isRNAndroidHermesProject = false;
        this._isRNIosHermesProject = false;
        this._isRNHermesProject = false;
    }

    public initialize(projectRoot: string, rNPackageVersions: RNPackageVersions) {
        if (!ProjectVersionHelper.isVersionError(rNPackageVersions.reactNativeWindowsVersion)) {
            this.updateRNWindowsProjectState(true);
            this.updateRNWindowsHermesProjectState(
                ReactNativeProjectHelper.isWindowsHermesEnabled(projectRoot),
            );
        }

        if (!ProjectVersionHelper.isVersionError(rNPackageVersions.reactNativeMacOSVersion)) {
            this.updateRNMacosProjectState(true);
            this.updateRNMacosHermesProjectState(
                ReactNativeProjectHelper.isMacOSHermesEnabled(projectRoot),
            );
        }

        this.updateRNAndroidHermesProjectState(
            ReactNativeProjectHelper.isAndroidHermesEnabled(projectRoot),
        );
        this.updateRNIosHermesProjectState(
            ReactNativeProjectHelper.isIOSHermesEnabled(projectRoot),
        );

        this.updateRNHermesProjectState();
    }

    public isRNMacosProject(): boolean {
        return this._isRNMacosProject;
    }

    public isRNWindowsProject(): boolean {
        return this._isRNWindowsProject;
    }

    public isRNMacosHermesProject(): boolean {
        return this._isRNMacosHermesProject;
    }

    public isRNWindowsHermesProject(): boolean {
        return this._isRNWindowsHermesProject;
    }

    public isRNAndroidHermesProject(): boolean {
        return this._isRNAndroidHermesProject;
    }

    public isRNIosHermesProject(): boolean {
        return this._isRNIosHermesProject;
    }

    public isRNHermesProject(): boolean {
        this._isRNHermesProject =
            this._isRNMacosHermesProject ||
            this._isRNWindowsHermesProject ||
            this._isRNAndroidHermesProject ||
            this._isRNIosHermesProject;
        return this._isRNHermesProject;
    }

    public updateRNMacosProjectState(isRNMacosProject: boolean): void {
        if (isRNMacosProject !== this._isRNMacosProject) {
            this._isRNMacosProject = isRNMacosProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_MACOS_PROJECT,
                this._isRNMacosProject,
            );
        }
    }

    public updateRNWindowsProjectState(isRNWindowsProject: boolean): void {
        if (isRNWindowsProject !== this._isRNWindowsProject) {
            this._isRNWindowsProject = isRNWindowsProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_WINDOWS_PROJECT,
                this._isRNWindowsProject,
            );
        }
    }

    public updateRNMacosHermesProjectState(isRNMacosHermesProject: boolean): void {
        if (isRNMacosHermesProject !== this._isRNMacosHermesProject) {
            this._isRNMacosHermesProject = isRNMacosHermesProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_MACOS_HERMES_PROJECT,
                this._isRNMacosHermesProject,
            );
            this.updateRNHermesProjectState();
        }
    }

    public updateRNWindowsHermesProjectState(isRNWindowsHermesProject: boolean): void {
        if (isRNWindowsHermesProject !== this._isRNWindowsHermesProject) {
            this._isRNWindowsHermesProject = isRNWindowsHermesProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_WINDOWS_HERMES_PROJECT,
                this._isRNWindowsHermesProject,
            );
            this.updateRNHermesProjectState();
        }
    }

    public updateRNAndroidHermesProjectState(isRNAndroidHermesProject: boolean): void {
        if (isRNAndroidHermesProject !== this._isRNAndroidHermesProject) {
            this._isRNAndroidHermesProject = isRNAndroidHermesProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_ANDROID_HERMES_PROJECT,
                this._isRNAndroidHermesProject,
            );
            this.updateRNHermesProjectState();
        }
    }

    public updateRNIosHermesProjectState(isRNIosHermesProject: boolean): void {
        if (isRNIosHermesProject !== this._isRNIosHermesProject) {
            this._isRNIosHermesProject = isRNIosHermesProject;
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_IOS_HERMES_PROJECT,
                this._isRNIosHermesProject,
            );
            this.updateRNHermesProjectState();
        }
    }

    private updateRNHermesProjectState(): void {
        const isRNHermesProjectPrev = this._isRNHermesProject;
        if (isRNHermesProjectPrev !== this.isRNHermesProject()) {
            this.updateContextState(
                CONTEXT_VARIABLES_NAMES.IS_RN_HERMES_PROJECT,
                this._isRNHermesProject,
            );
        }
    }

    private updateContextState(contextVarName: string, value: boolean) {
        commands.executeCommand("setContext", contextVarName, value);
    }
}
