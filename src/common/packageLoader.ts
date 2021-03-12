// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { CommandExecutor, CommandVerbosity } from "./commandExecutor";
import customRequire from "./customRequire";
import { findFileInFolderHierarchy } from "./extensionHelper";
import { HostPlatform } from "./hostPlatform";
import * as path from "path";

export default class PackageLoader {
    private logger: OutputChannelLogger;
    private packagesQueue: string[];
    private requireQueue: ((load?: string[]) => boolean)[];
    private isCommandsExecuting: boolean;

    private static instance: PackageLoader;

    private constructor() {
        this.logger = OutputChannelLogger.getMainChannel();
        this.packagesQueue = [];
        this.requireQueue = [];
        this.isCommandsExecuting = false;
    }

    public static getInstance(): PackageLoader {
        if (!this.instance) {
            this.instance = new PackageLoader();
        }
        return this.instance;
    }

    public generateGetPackageFunction<T>(
        packageName: string,
        ...additionalDependencies: string[]
    ): () => Promise<T> {
        let promise: Promise<T>;
        return (): Promise<T> => {
            // Using the promise saved in lexical environment to prevent module reloading
            if (promise) {
                return promise;
            } else {
                promise = this.loadPackage<T>(packageName, ...additionalDependencies);
                return promise;
            }
        };
    }

    private getUniquePackages(packages: string[]): string[] {
        return [...new Set(packages).values()];
    }

    private getTryToRequireFunction<T>(
        packageName: string,
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void,
    ): (load?: string[]) => boolean {
        return (load?: string[]) => {
            let itWasInstalled = false;
            // Throw exception if we could not find package after installing
            if (load && load.includes(packageName)) {
                itWasInstalled = true;
            }
            return this.tryToRequire<T>(packageName, resolve, reject, itWasInstalled);
        };
    }

    private tryToRequire<T>(
        packageName: string,
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void,
        itWasInstalled: boolean,
    ): boolean {
        try {
            this.logger.debug(`Getting ${packageName} dependency.`);
            const module = customRequire(packageName);
            resolve(module);
            return true;
        } catch (e) {
            if (itWasInstalled || e.code !== "MODULE_NOT_FOUND") {
                reject(e);
                return true;
            }
            this.logger.debug(`Dependency ${packageName} is not present. Retry after install...`);
            return false;
        }
    }

    private async tryToRequireAfterInstall(
        tryToRequire: (load?: string[]) => boolean,
        packageName: string,
        ...additionalDependencies: string[]
    ) {
        this.packagesQueue.push(packageName, ...additionalDependencies);
        this.requireQueue.push(tryToRequire);
        if (!this.isCommandsExecuting) {
            this.isCommandsExecuting = true;
            const commandExecutor = new CommandExecutor(
                path.dirname(findFileInFolderHierarchy(__dirname, "package.json") || __dirname),
                this.logger,
            );
            while (this.packagesQueue.length) {
                // Install all packages in queue
                this.packagesQueue = this.getUniquePackages(this.packagesQueue);
                const load = this.packagesQueue.length;
                const packagesForInstall = this.packagesQueue.slice(0, load);
                await commandExecutor.spawnWithProgress(
                    HostPlatform.getNpmCliCommand("npm"),
                    ["install", ...packagesForInstall, "--verbose", "--no-save"],
                    {
                        verbosity: CommandVerbosity.PROGRESS,
                    },
                );
                // Try to require all pending packages after every 'npm install ...' command
                const requiresToRemove: ((load?: string[]) => boolean)[] = [];
                this.requireQueue.forEach(tryToRequire => {
                    if (tryToRequire(packagesForInstall)) {
                        requiresToRemove.push(tryToRequire);
                    }
                });
                // Remove resolved requires from queue
                requiresToRemove.forEach(tryToRequire => {
                    const index = this.requireQueue.indexOf(tryToRequire);
                    if (index > -1) {
                        this.requireQueue.splice(index, 1);
                    }
                });
                // If we resolved all requires, we should not install any other packages
                if (this.requireQueue.length) {
                    this.packagesQueue = this.getUniquePackages(this.packagesQueue);
                    packagesForInstall.forEach(module => {
                        const index = this.packagesQueue.findIndex(el => el === module);
                        if (index !== -1) {
                            this.packagesQueue.splice(index, 1);
                        }
                    });
                } else {
                    this.packagesQueue = [];
                }
            }
            this.isCommandsExecuting = false;
        }
    }

    private async loadPackage<T>(
        packageName: string,
        ...additionalDependencies: string[]
    ): Promise<T> {
        return new Promise(async (resolve: (value: T) => void, reject) => {
            const tryToRequire = this.getTryToRequireFunction(packageName, resolve, reject);
            if (!tryToRequire()) {
                this.tryToRequireAfterInstall(tryToRequire, packageName, ...additionalDependencies);
            }
        });
    }
}
