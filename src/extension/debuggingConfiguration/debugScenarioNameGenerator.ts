// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { PlatformType } from "../launchArgs";
import { DebugScenarioType, DEBUG_TYPES } from "./debugConfigTypesAndConstants";

interface DebugScenarioName {
    debugScenarioType: string;
    prePlatformTypeDescription?: string;
    platformType?: string;
    postPlatformTypeDescription?: string;
    experimentalDescription?: string;
}

export class DebugScenarioNameGenerator {
    public static createScenarioName(
        debugScenarioType: DebugScenarioType,
        debugType: string,
        platformType?: PlatformType | string,
        useHermesEngine: boolean = false,
        isExperimental: boolean = false,
    ): string {
        const debugScenarioName: DebugScenarioName =
            this.createScenarioAccordingToDebugScenarioType(debugScenarioType);
        debugScenarioName.platformType = this.getPlatformTypeName(platformType);
        if (debugType === DEBUG_TYPES.REACT_NATIVE) {
            this.configureNotDirectModeScenario(
                debugScenarioName,
                debugScenarioType,
                debugType,
                platformType,
            );
        } else {
            this.configureDirectModeScenario(
                debugScenarioName,
                debugScenarioType,
                debugType,
                useHermesEngine,
                platformType,
            );
        }

        if (platformType === PlatformType.ExpoWeb) {
            isExperimental = true;
        }

        if (isExperimental) {
            debugScenarioName.experimentalDescription = "- Experimental";
        }

        return this.debugScenarioNameToString(debugScenarioName);
    }

    private static createScenarioAccordingToDebugScenarioType(
        debugScenarioType: DebugScenarioType,
    ): DebugScenarioName {
        switch (debugScenarioType) {
            case DebugScenarioType.RunApp:
                return {
                    debugScenarioType: "Run",
                };
            case DebugScenarioType.DebugApp:
                return {
                    debugScenarioType: "Debug",
                };
            case DebugScenarioType.AttachApp:
                return {
                    debugScenarioType: "Attach to",
                };
        }
    }

    private static configureNotDirectModeScenario(
        debugScenarioName: DebugScenarioName,
        debugScenarioType: DebugScenarioType,
        debugType: string,
        platformType?: PlatformType | string,
    ): void {
        if (debugScenarioType === DebugScenarioType.AttachApp) {
            debugScenarioName.platformType = "packager";
        }
        if (platformType === PlatformType.Exponent) {
            debugScenarioName.prePlatformTypeDescription = "in";
        }
    }

    private static configureDirectModeScenario(
        debugScenarioName: DebugScenarioName,
        debugScenarioType: DebugScenarioType,
        debugType: string,
        useHermesEngine: boolean,
        platformType?: PlatformType | string,
    ) {
        if (useHermesEngine) {
            debugScenarioName.postPlatformTypeDescription =
                debugScenarioType === DebugScenarioType.AttachApp ? "Hermes application" : "Hermes";
        }
        switch (platformType) {
            case PlatformType.iOS:
                if (!useHermesEngine) {
                    debugScenarioName.prePlatformTypeDescription = "Direct";
                }
                break;
        }
    }

    private static getPlatformTypeName(platformType?: PlatformType | string): string {
        switch (platformType) {
            case PlatformType.Android:
                return "Android";
            case PlatformType.iOS:
                return "iOS";
            case PlatformType.Exponent:
                return "Exponent";
            case PlatformType.Windows:
                return "Windows";
            case PlatformType.macOS:
                return "macOS";
            case PlatformType.ExpoWeb:
                return "Expo Web";
            default:
                return "";
        }
    }

    private static debugScenarioNameToString(debugScenarioName: DebugScenarioName): string {
        let debugScenarioNameStr = debugScenarioName.debugScenarioType;
        if (debugScenarioName.prePlatformTypeDescription) {
            debugScenarioNameStr += ` ${debugScenarioName.prePlatformTypeDescription}`;
        }
        if (debugScenarioName.platformType) {
            debugScenarioNameStr += ` ${debugScenarioName.platformType}`;
        }
        if (debugScenarioName.postPlatformTypeDescription) {
            debugScenarioNameStr += ` ${debugScenarioName.postPlatformTypeDescription}`;
        }
        if (debugScenarioName.experimentalDescription) {
            debugScenarioNameStr += ` ${debugScenarioName.experimentalDescription}`;
        }

        return debugScenarioNameStr;
    }
}
