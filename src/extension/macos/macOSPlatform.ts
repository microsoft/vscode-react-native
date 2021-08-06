// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import * as path from "path";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import { MacOSDebugModeManager } from "./macOSDebugModeManager";
import { ImacOSRunOptions, PlatformType } from "../launchArgs";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { PlistBuddy, IOSBuildLocationData } from "../ios/plistBuddy";
import { ChildProcess } from "../../common/node/childProcess";

/**
 * macOS specific platform implementation for debugging RN applications.
 */
export class MacOSPlatform extends GeneralMobilePlatform {
    private static SUCCESS_PATTERNS = ["Launching app"];
    private static FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Unrecognized command 'run-macos'",
            errorCode: InternalErrorCode.ReactNativemacOSIsNotInstalled,
        },
    ];

    public static DEFAULT_MACOS_PROJECT_RELATIVE_PATH = "macos";

    private macosProjectRoot: string;
    private plistBuddy: PlistBuddy;
    private macOSDebugModeManager: MacOSDebugModeManager;

    constructor(protected runOptions: ImacOSRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);

        const macosProjectFolderPath = MacOSPlatform.getOptFromRunArgs(
            this.runArguments,
            "--project-path",
            false,
        );
        this.macosProjectRoot = path.join(
            this.projectPath,
            macosProjectFolderPath || MacOSPlatform.DEFAULT_MACOS_PROJECT_RELATIVE_PATH,
        );
        this.plistBuddy = new PlistBuddy();

        const schemeFromArgs = MacOSPlatform.getOptFromRunArgs(
            this.runArguments,
            "--scheme",
            false,
        );
        this.macOSDebugModeManager = new MacOSDebugModeManager(
            this.macosProjectRoot,
            this.projectPath,
            schemeFromArgs ? schemeFromArgs : this.runOptions.scheme,
        );
    }

    public async runApp(): Promise<void> {
        let extProps: any = {
            platform: {
                value: PlatformType.macOS,
                isPii: false,
            },
        };

        if (this.runOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
        }

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        return TelemetryHelper.generate("MacOSPlatform.runApp", extProps, () => {
            const env = GeneralMobilePlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /*Custom RN implementations should support this flag*/ ||
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    MacOSPlatform.NO_PACKAGER_VERSION,
                )
            ) {
                this.runArguments.push("--no-packager");
            }

            const runmacOSSpawn = new CommandExecutor(
                this.runOptions.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand(`run-${this.platformName}`, this.runArguments, { env });
            return new OutputVerifier(
                () => Promise.resolve(MacOSPlatform.SUCCESS_PATTERNS),
                () => Promise.resolve(MacOSPlatform.FAILURE_PATTERNS),
                this.platformName,
            ).process(runmacOSSpawn);
        });
    }

    public async prewarmBundleCache(): Promise<void> {
        return this.packager.prewarmBundleCache(PlatformType.macOS);
    }

    public getRunArguments(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments.push(...this.runOptions.runArguments);
        } else {
            let target =
                this.runOptions.target === MacOSPlatform.simulatorString
                    ? ""
                    : this.runOptions.target;
            if (target) {
                runArguments.push(`--${target}`);
            }
        }

        return runArguments;
    }

    public async enableJSDebuggingMode(): Promise<void> {
        // Configure the app for debugging
        // Wait until the configuration file exists, and check to see if debugging is enabled
        const [debugModeEnabled, appName] = await Promise.all<boolean | string>([
            this.macOSDebugModeManager.getAppRemoteDebuggingSetting(
                this.runOptions.configuration,
                this.runOptions.productName,
            ),
            this.getApplicationName(),
        ]);
        if (debugModeEnabled) {
            return;
        }

        // Debugging must still be enabled
        // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
        // but that file is written to by the app on occasion. To avoid races, we shut the app
        // down before writing to the file.
        await this.terminateMacOSapp(<string>appName);
        // Write to the settings file while the app is not running to avoid races
        await this.macOSDebugModeManager.setAppRemoteDebuggingSetting(
            /*enable=*/ true,
            this.runOptions.configuration,
            this.runOptions.productName,
        );
        // Relaunch the app
        await this.runApp();
    }

    public disableJSDebuggingMode(): Promise<void> {
        return this.macOSDebugModeManager.setAppRemoteDebuggingSetting(
            /*enable=*/ false,
            this.runOptions.configuration,
            this.runOptions.productName,
        );
    }

    private async getApplicationName(): Promise<string> {
        const iOSBuildLocationData = await this.plistBuddy.getExecutableAndConfigurationFolder(
            this.macosProjectRoot,
            this.projectPath,
            PlatformType.macOS,
            false,
            this.runOptions.configuration,
            this.runOptions.productName,
            this.getSchemeFromDebuggingParameters(),
        );
        return iOSBuildLocationData.executable;
    }

    private getSchemeFromDebuggingParameters(): string | undefined {
        let scheme = this.runOptions.scheme;
        if (!scheme) {
            const schemeFromArgs = MacOSPlatform.getOptFromRunArgs(
                this.runArguments,
                "--scheme",
                false,
            );
            if (schemeFromArgs) {
                scheme = schemeFromArgs;
            }
        }
        return scheme;
    }

    private async terminateMacOSapp(appName: string): Promise<void> {
        let childProcess = new ChildProcess();
        // An example of the output from the command above:
        // 40943 ??         4:13.97 node /Users/user/Documents/rn_for_mac_proj/node_modules/.bin/react-native start --port 8081
        // 40959 ??         0:10.36 /Users/user/.nvm/versions/node/v10.19.0/bin/node /Users/user/Documents/rn_for_mac_proj/node_modules/metro/node_modules/jest-worker/build/workers/processChild.js
        // 41004 ??         0:21.34 /Users/user/Library/Developer/Xcode/DerivedData/rn_for_mac_proj-ghuavabiztosiqfqkrityjoxqfmv/Build/Products/Debug/rn_for_mac_proj.app/Contents/MacOS/rn_for_mac_proj
        // 75514 ttys007    0:00.00 grep --color=auto --exclude-dir=.bzr --exclude-dir=CVS --exclude-dir=.git --exclude-dir=.hg --exclude-dir=.svn rn_for_mac_proj
        const searchResults = await childProcess.execToString(`ps -ax | grep ${appName}`);
        if (searchResults) {
            const processIdRgx = /(^\d*)\s\?\?/g;
            //  We are looking for a process whose path contains the "appName.app" part
            const processData = searchResults.split("\n").find(str => str.includes(appName));

            if (processData) {
                const match = processIdRgx.exec(processData.trim());
                if (match && match[1]) {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    await childProcess.execToString(`kill ${match[1]}`);
                }
            }
        }
    }
}
