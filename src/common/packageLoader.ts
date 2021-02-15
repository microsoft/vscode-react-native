// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { CommandExecutor, CommandVerbosity } from "./commandExecutor";
import customRequire from "./customRequire";
import { findFileInFolderHierarchy } from "./extensionHelper";
import { HostPlatform } from "./hostPlatform";
import * as path from "path";

export default class PackageLoader {
    private static logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();
    private static packagesQueue: string[] = [];
    private static requireQueue: (() => boolean)[] = [];
    // private static resolveByPackageName = new Map<
    //     string,
    //     (value: any | PromiseLike<any>) => void
    // >();
    private static isCommandsExecuting: boolean = false;

    private static getUniquePackages(packages: string[]): string[] {
        return [...new Set(packages).values()];
    }

    private static getTryToRequireFunction<T>(
        packageName: string,
        resolve: (value: T | PromiseLike<T>) => void,
    ) {
        return () => {
            return this.tryToRequire<T>(packageName, resolve);
        };
    }

    private static tryToRequire<T>(
        packageName: string,
        resolve: (value: T | PromiseLike<T>) => void,
    ) {
        try {
            console.log("Try to require " + packageName);
            this.logger.debug("Getting dependency.");
            const module = customRequire(packageName);
            console.log("Try to require " + packageName + " : Success");
            resolve(module);
            return true;
        } catch (e) {
            console.log("Try to require " + packageName + " : Failed");
            console.log(e.code);
            if (e.code === "MODULE_NOT_FOUND") {
                this.logger.debug("Dependency not present. Installing it...");
            } else {
                throw e;
            }
            return false;
        }
    }

    private static async tryToRequireAfterInstall<T>(
        // resolve: (value: T | PromiseLike<T>) => void,
        tryToRequire: () => boolean,
        packageName: string,
        ...additionalDependencies: string[]
    ) {
        this.packagesQueue.push(packageName, ...additionalDependencies);
        // if (!this.resolveByPackageName.has(packageName)) {
        //     this.resolveByPackageName.set(packageName, resolve);
        // }
        this.requireQueue.push(tryToRequire);
        if (!this.isCommandsExecuting) {
            this.isCommandsExecuting = true;
            const commandExecutor = new CommandExecutor(
                path.dirname(findFileInFolderHierarchy(__dirname, "package.json") || __dirname),
                this.logger,
            );
            console.log("this.packagesQueue");
            console.log(this.packagesQueue);
            while (this.packagesQueue.length) {
                // Install all packages in queue
                this.packagesQueue = this.getUniquePackages(this.packagesQueue);
                const load = this.packagesQueue.length;
                const packagesForInstall = this.packagesQueue.slice(0, load);
                console.log("packagesForInstall");
                console.log(packagesForInstall);
                await commandExecutor
                    .spawnWithProgress(
                        HostPlatform.getNpmCliCommand("npm"),
                        ["install", ...packagesForInstall, "--verbose", "--no-save"],
                        {
                            verbosity: CommandVerbosity.PROGRESS,
                        },
                    )
                    .then(() => {
                        // this.resolveByPackageName.forEach((resolve, module) => {
                        //     resolve(customRequire(module));
                        //     this.resolveByPackageName.delete(module)
                        // });
                        this.requireQueue.forEach((tryToRequire, index) => {
                            if (tryToRequire()) {
                                this.requireQueue.splice(index, 1);
                            }
                        });
                    });
                this.packagesQueue = this.getUniquePackages(this.packagesQueue);
                packagesForInstall.forEach(module => {
                    const index = this.packagesQueue.findIndex(el => el === module);
                    if (index !== -1) {
                        this.packagesQueue.splice(index, 1);
                    }
                });
                console.log("this.packagesQueue");
                console.log(this.packagesQueue);
            }
            console.log("endOfWhile");
            this.isCommandsExecuting = false;
            console.log("this.isCommandsExecuting");
            console.log(this.isCommandsExecuting);
        }
    }

    private static async loadPackage<T>(
        packageName: string,
        ...additionalDependencies: string[]
    ): Promise<T> {
        return new Promise(async resolve => {
            // if (!this.tryToRequire(packageName, resolve)) {
            //     await this.tryToRequireAfterInstall(
            //         resolve,
            //         packageName,
            //         ...additionalDependencies,
            //     );
            // }
            const tryToRequire = this.getTryToRequireFunction(packageName, resolve);
            if (!tryToRequire()) {
                await this.tryToRequireAfterInstall(
                    tryToRequire,
                    packageName,
                    ...additionalDependencies,
                );
            }
        });
    }

    public static generateGetPackageFunction<T>(
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
}
