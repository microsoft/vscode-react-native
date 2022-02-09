// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper, REACT_NATIVE_PACKAGES } from "../../common/projectVersionHelper";
import { PlatformType } from "../launchArgs";
import { AndroidPlatform } from "../android/androidPlatform";
import { IOSPlatform } from "../ios/iOSPlatform";
import { WindowsPlatform } from "../windows/windowsPlatform";
import { getRunOptions } from "./util";
import { Command } from "./util/command";
import { AppLauncher } from "../appLauncher";
import {
    debugConfigurations,
    DEBUG_CONFIGURATION_NAMES,
} from "../debuggingConfiguration/debugConfigTypesAndConstants";
import * as vscode from "vscode";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

const startDebug = (debugConfig: typeof debugConfigurations[string], project: AppLauncher) => {
    assert(
        debugConfig,
        new Error(
            localize(
                "CouldNotFindPredefinedDebugConfig",
                "Couldn't find predefined debugging configuration by name '{0}'",
                debugConfig.name,
            ),
        ),
    );

    // #todo> why is this here?
    debugConfig.isDynamic = true;
    void vscode.debug.startDebugging(project.getWorkspaceFolder(), debugConfig);
};

export class AttachHermesApplicationExperimental extends Command {
    codeName = "debugScenario.attachHermesApplicationExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[
                DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION_EXPERIMENTAL
            ],
            this.project,
        );
    }
}

export class AttachDirectIosExperimental extends Command {
    codeName = "debugScenario.attachDirectIosExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.ATTACH_TO_DIRECT_IOS_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.ATTACH_TO_DIRECT_IOS_EXPERIMENTAL],
            this.project,
        );
    }
}

export class AttachToPackager extends Command {
    codeName = "debugScenario.attachDirectIosExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.ATTACH_TO_PACKAGER,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.ATTACH_TO_PACKAGER], this.project);
    }
}

export class DebugAndroid extends Command {
    codeName = "debugScenario.debugAndroid";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID], this.project);
    }
}

export class DebugIos extends Command {
    codeName = "debugScenario.debugIos";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_IOS,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_IOS], this.project);
    }
}

export class DebugWindows extends Command {
    codeName = "debugScenario.debugWindows";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS], this.project);
    }
}

export class DebugMacos extends Command {
    codeName = "debugScenario.debugMacos";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS], this.project);
    }
}

export class DebugInExponent extends Command {
    codeName = "debugScenario.debugInExponent";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_IN_EXPONENT], this.project);
    }
}

export class DebugAndroidHermesExperimental extends Command {
    codeName = "debugScenario.debugAndroidHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class DebugDirectIosExperimental extends Command {
    codeName = "debugScenario.debugDirectIosExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_DIRECT_IOS_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_DIRECT_IOS_EXPERIMENTAL],
            this.project,
        );
    }
}

export class DebugIosHermesExperimental extends Command {
    codeName = "debugScenario.debugIosHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class DebugMacosHermesExperimental extends Command {
    codeName = "debugScenario.debugMacosHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class DebugWindowsHermesExperimental extends Command {
    codeName = "debugScenario.debugWindowsHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class RunAndroid extends Command {
    codeName = "debugScenario.runAndroid";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.RUN_ANDROID,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.RUN_ANDROID], this.project);
    }
}

export class RunIos extends Command {
    codeName = "debugScenario.runIos";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.RUN_IOS,
    );

    async baseFn() {
        assert(this.project);
        startDebug(debugConfigurations[DEBUG_CONFIGURATION_NAMES.RUN_IOS], this.project);
    }
}

export class RunAndroidHermesExperimental extends Command {
    codeName = "debugScenario.runAndroidHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class RunIosHermesExperimental extends Command {
    codeName = "debugScenario.runIosHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES_EXPERIMENTAL],
            this.project,
        );
    }
}

export class RunDirectIosExperimental extends Command {
    codeName = "debugScenario.runIosHermesExperimental";
    label = "";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.DebuggingCommandFailed,
        DEBUG_CONFIGURATION_NAMES.RUN_DIRECT_IOS_EXPERIMENTAL,
    );

    async baseFn() {
        assert(this.project);
        startDebug(
            debugConfigurations[DEBUG_CONFIGURATION_NAMES.RUN_DIRECT_IOS_EXPERIMENTAL],
            this.project,
        );
    }
}
