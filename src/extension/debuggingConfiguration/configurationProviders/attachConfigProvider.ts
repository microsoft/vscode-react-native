// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseConfigProvider } from "./baseConfigProvider";
import { MultiStepInput, InputStep } from "../multiStepInput";
import { ILaunchRequestArgs } from "../../../debugger/debugSessionBase";
import {
    DebugConfigurationState,
    platformTypeDirectPickConfig,
    DEBUG_TYPES,
    DebugScenarioType,
} from "../debugConfigTypesAndConstants";
import { PlatformType } from "../../launchArgs";
import { IWDPHelper } from "../../../debugger/direct/IWDPHelper";
import { Packager } from "../../../common/packager";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class AttachConfigProvider extends BaseConfigProvider {
    private readonly defaultAddress: string;

    constructor() {
        super();
        this.defaultAddress = "localhost";
        this.maxStepCount = 3;
    }

    public async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        this.maxStepCount = 3;
        state.config = {};
        const config: Partial<ILaunchRequestArgs> = {
            name: "Attach to application",
            request: "attach",
            type: DEBUG_TYPES.REACT_NATIVE,
            cwd: "${workspaceFolder}",
        };

        state.scenarioType = DebugScenarioType.AttachApp;

        await this.configurationProviderHelper.selectApplicationType(
            input,
            config,
            1,
            this.maxStepCount,
        );

        Object.assign(state.config, config);

        if (state.config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT) {
            this.maxStepCount++;
            return () => this.configureDirectPlatform(input, state.config);
        } else {
            return () => this.configureAddress(input, state.config);
        }
    }

    private async configureDirectPlatform(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        delete config.platform;
        await this.configurationProviderHelper.selectPlatform(
            input,
            config,
            platformTypeDirectPickConfig,
            2,
            this.maxStepCount,
        );

        if (config.platform === PlatformType.iOS) {
            delete config.useHermesEngine;
            this.maxStepCount = this.maxStepCount + 1;
            await this.configurationProviderHelper.shouldUseHermesEngine(
                input,
                config,
                3,
                this.maxStepCount,
            );
        }

        return () => this.configureAddress(input, config);
    }

    private async configureAddress(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        delete config.address;
        let address = await input.showInputBox({
            title: localize("AddressInputTitle", "The address of the host"),
            step:
                config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT
                    ? config.platform === PlatformType.iOS
                        ? 4
                        : 3
                    : 2,
            totalSteps: this.maxStepCount,
            value: this.defaultAddress,
            prompt: localize("AddressInputPrompt", "Enter the address of the host"),
            validate: value =>
                Promise.resolve(
                    value && value.trim().length > 0
                        ? undefined
                        : localize("AddressInputInvalid", "Enter a valid host name or IP address"),
                ),
        });

        if (address && address.trim() !== this.defaultAddress) {
            config.address = address.trim();
        }

        return () => this.configurePort(input, config);
    }

    private async configurePort(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        delete config.port;
        const defaultPort = String(
            config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT &&
                config.platform === PlatformType.iOS &&
                !config.useHermesEngine
                ? IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT
                : Packager.DEFAULT_PORT,
        );
        const portRegex = /^\d+$/;

        let portStr = await input.showInputBox({
            title: localize("PortInputTitle", "The port of the host"),
            step:
                config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT
                    ? config.platform === PlatformType.iOS
                        ? 5
                        : 4
                    : 3,
            totalSteps: this.maxStepCount,
            value: defaultPort,
            prompt: localize(
                "PortInputPrompt",
                "Enter the port number that the debug server is listening on",
            ),
            validate: value =>
                Promise.resolve(
                    value && portRegex.test(value.trim())
                        ? undefined
                        : localize("PortInputInvalid", "Enter a valid port number"),
                ),
        });

        let portNumber: number | undefined;
        if (portStr && portRegex.test(portStr.trim())) {
            portNumber = parseInt(portStr, 10);
        }

        if (portNumber) {
            config.port = portNumber;
        }
    }
}
