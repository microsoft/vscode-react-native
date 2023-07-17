// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import {
    MultiStepInput,
    IQuickPickParameters,
} from "../extension/debuggingConfiguration/multiStepInput";
import { ILaunchRequestArgs } from "../debugger/debugSessionBase";
import { ExpoHostType, PlatformType } from "../extension/launchArgs";
import {
    DebugConfigurationState,
    DebugConfigurationQuickPickItem,
    appTypePickConfig,
    expoHostTypePickConfig,
    shouldUseHermesEngine,
    DEBUG_TYPES,
    browserTypePickConfig,
} from "../extension/debuggingConfiguration/debugConfigTypesAndConstants";
import { IWDPHelper } from "../debugger/direct/IWDPHelper";
import { BrowserTargetType } from "../extension/generalPlatform";
import { Packager } from "./packager";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ConfigurationProviderHelper {
    public async selectPlatform(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        platformTypePickConfig: DebugConfigurationQuickPickItem[],
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("PlatformSelectionTitle", "Select platform"),
            placeholder: localize("PlatformSelectionPrompt", "Platform to run on"),
            step,
            totalSteps,
            items: platformTypePickConfig,
            activeItem: platformTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Platform is not selected");
        }

        config.platform = pick.type;
        return config;
    }

    public async selectApplicationType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize(
                "ApplicationTypeSelectionTitle",
                "Select type of React Native application",
            ),
            placeholder: localize(
                "ApplicationTypeSelectionPrompt",
                "Type of React Native application",
            ),
            step,
            totalSteps,
            items: appTypePickConfig,
            activeItem: appTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Application type is not selected");
        }

        config.type = pick.type;
        return config;
    }

    public async selectBrowserTargetType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("BrowserTargetTypeSelectionTitle", "Select type of browser"),
            placeholder: localize("BrowserTargetTypeSelectionPrompt", "Type of browser"),
            step,
            totalSteps,
            items: browserTypePickConfig,
            activeItem: browserTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Browser type is not selected");
        }

        config.type = pick.type;
        return config;
    }

    public async shouldUseHermesEngine(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const shouldUseHermes = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("UseHermesEngine", "Use Hermes engine"),
            placeholder: localize(
                "UseHermesEnginePrompt",
                "Use Hermes engine for direct debugging?",
            ),
            step,
            totalSteps,
            items: shouldUseHermesEngine,
            activeItem: shouldUseHermesEngine[0],
        });

        if (!shouldUseHermes) {
            throw new Error(
                localize("UseHermesEngineInvalid", "Using Hermes engine is not confirmed"),
            );
        }

        config.useHermesEngine = shouldUseHermes.type === "yes";

        return config;
    }

    public async selectExpoHostType(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("ExpoHostTypeSelectionTitle", "Select type of Expo host parameter"),
            placeholder: localize("ExpoHostTypeSelectionPrompt", "Type of Expo host parameter"),
            step,
            totalSteps,
            items: expoHostTypePickConfig,
            activeItem: expoHostTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Expo host type is not selected");
        }

        config.expoHostType = pick.type as ExpoHostType;
        return config;
    }

    public async selectBrowserTarget(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: localize("BrowserTargetTypeSelectionTitle", "Select type of browser"),
            placeholder: localize("BrowserTargetTypeSelectionPrompt", "Type of browser"),
            step,
            totalSteps,
            items: browserTypePickConfig,
            activeItem: browserTypePickConfig[0],
        });

        if (!pick) {
            throw new Error("Browser target type is not selected");
        }

        config.browserTarget = pick.type as BrowserTargetType;
        return config;
    }

    public async configureAddress(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
        defaultAddress: string,
    ): Promise<Partial<ILaunchRequestArgs>> {
        delete config.address;
        const address = await input.showInputBox({
            title: localize("AddressInputTitle", "The address of the host"),
            step,
            totalSteps,
            value: defaultAddress,
            prompt: localize("AddressInputPrompt", "Enter the address of the host"),
            validate: value =>
                Promise.resolve(
                    value && value.trim().length > 0
                        ? undefined
                        : localize("AddressInputInvalid", "Enter a valid host name or IP address"),
                ),
        });

        if (address && address.trim() !== defaultAddress) {
            config.address = address.trim();
        }

        return config;
    }

    public async configurePort(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<ILaunchRequestArgs>,
        step: number,
        totalSteps: number,
    ): Promise<Partial<ILaunchRequestArgs>> {
        delete config.port;
        const defaultPort = String(
            config.type === DEBUG_TYPES.REACT_NATIVE_DIRECT &&
                config.platform === PlatformType.iOS &&
                !config.useHermesEngine
                ? IWDPHelper.iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT
                : Packager.DEFAULT_PORT,
        );
        const portRegex = /^\d+$/;

        const portStr = await input.showInputBox({
            title: localize("PortInputTitle", "The port of the host"),
            step,
            totalSteps,
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

        if (portNumber && portNumber !== Packager.DEFAULT_PORT) {
            config.port = portNumber;
        }

        return config;
    }
}
