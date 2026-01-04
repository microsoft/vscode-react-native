// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { SettingsHelper } from "../settingsHelper";
import { ReactNativeCommand } from "./util/reactNativeCommand";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { HostPlatform, HostPlatformId } from "../../common/hostPlatform";

const logger = OutputChannelLogger.getMainChannel();

export class CleanRestartPackager extends ReactNativeCommand {
    codeName = "cleanRestartPackager";
    label = "Clean & Restart Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToCleanRestartPackager);

    async baseFn(): Promise<void> {
        assert(this.project);
        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(nodeModulesRoot);

        const projectPath = this.project.getPackager().getProjectPath();
        const packagerPort = SettingsHelper.getPackagerPort(
            this.project.getWorkspaceFolderUri().fsPath,
        );

        logger.info("Starting Metro Packager cleanup and restart...");

        // Step 1: Kill Metro process on port 8081
        await this.killMetroProcess(packagerPort);

        // Step 2: Clean Metro cache
        await this.cleanMetroCache(projectPath);

        // Step 3: Clean Watchman cache (if available)
        await this.cleanWatchmanCache();

        // Step 4: Restart packager with reset cache
        logger.info("Restarting Packager with clean cache...");
        await this.project.getPackager().restart(packagerPort);

        logger.info("Metro Packager cleanup and restart completed successfully.");
    }

    private async killMetroProcess(port: number): Promise<void> {
        logger.info(`Step 1/3: Terminating Metro process on port ${port}...`);

        try {
            const platformId = HostPlatform.getPlatformId();
            const childProcess = new ChildProcess();

            if (platformId === HostPlatformId.WINDOWS) {
                // Windows: Use netstat and taskkill
                try {
                    const netstatResult = await childProcess.exec(
                        `netstat -ano | findstr :${port}`,
                    );
                    const outcome = await netstatResult.outcome;

                    if (outcome) {
                        // Extract PID from netstat output
                        const lines = outcome.split("\n");
                        for (const line of lines) {
                            const match = line.match(/\s+LISTENING\s+(\d+)/);
                            if (match && match[1]) {
                                const pid = match[1];
                                logger.info(`Found Metro process with PID: ${pid}`);
                                await childProcess.exec(`taskkill /PID ${pid} /F /T`);
                                logger.info(`Successfully terminated process ${pid}`);
                            }
                        }
                    }
                } catch (error) {
                    logger.info(`No Metro process found on port ${port}`);
                }
            } else {
                // macOS/Linux: Use lsof and kill
                try {
                    const lsofResult = await childProcess.exec(`lsof -ti:${port}`);
                    const outcome = await lsofResult.outcome;

                    if (outcome && outcome.trim()) {
                        const pid = outcome.trim();
                        logger.info(`Found Metro process with PID: ${pid}`);
                        await childProcess.exec(`kill -9 ${pid}`);
                        logger.info(`Successfully terminated process ${pid}`);
                    }
                } catch (error) {
                    logger.info(`No Metro process found on port ${port}`);
                }
            }
        } catch (error) {
            logger.warning(`Failed to kill Metro process: ${error}`);
        }
    }

    private async cleanMetroCache(projectPath: string): Promise<void> {
        logger.info("Step 2/3: Cleaning Metro cache...");

        const metroCachePath = path.join(projectPath, "node_modules", ".cache", "metro");

        try {
            if (fs.existsSync(metroCachePath)) {
                // Use recursive directory deletion
                await this.deleteDirectory(metroCachePath);
                logger.info(`Successfully cleaned Metro cache at: ${metroCachePath}`);
            } else {
                logger.info("Metro cache directory not found, skipping...");
            }
        } catch (error) {
            logger.warning(`Failed to clean Metro cache: ${error}`);
        }
    }

    private async cleanWatchmanCache(): Promise<void> {
        logger.info("Step 3/3: Cleaning Watchman cache...");

        try {
            const childProcess = new ChildProcess();
            const watchmanResult = await childProcess.exec("watchman watch-del-all");
            await watchmanResult.outcome;
            logger.info("Successfully cleaned Watchman cache");
        } catch (error) {
            logger.info("Watchman not available or failed to clean cache, continuing...");
        }
    }

    private async deleteDirectory(dirPath: string): Promise<void> {
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    await this.deleteDirectory(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            }

            fs.rmdirSync(dirPath);
        }
    }
}
