// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { AppLauncher } from "../extension/appLauncher";
import { CommandExecutor, CommandVerbosity } from "./commandExecutor";
import customRequire from "./customRequire";
import { findFileInFolderHierarchy, getVersionFromExtensionNodeModules } from "./extensionHelper";
import { HostPlatform } from "./hostPlatform";
import { PromiseUtil } from "./node/promise";

const WRONG_VERSION_ERROR =
    "The installed version of the package is different from the required one";

export class PackageConfig {
    constructor(
        private packageName: string,
        private version?: string,
        private requirePath?: string,
    ) {}

    public getPackageName(): string {
        return this.packageName;
    }
    public getRequirePath(): string | undefined {
        return this.requirePath;
    }
    public getVersion(withPrefix = false): string | undefined {
        if (withPrefix) {
            return this.version ? `@${this.version}` : "";
        }
        return this.version;
    }

    public getStringForInstall(): string {
        return `${this.packageName}${this.getVersion(true) || "undefined"}`;
    }

    public getStringForRequire(): string {
        return this.packageName + (this.requirePath ? `/${this.requirePath}` : "");
    }
}

export class PackageLoader {
    private logger: OutputChannelLogger;
    private packagesQueue: string[];
    private requireQueue: ((load?: string[]) => Promise<boolean>)[];
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

    public installGlobalPackage(packageConfig: PackageConfig, projectRoot: string): Promise<void> {
        const nodeModulesRoot: string = AppLauncher.getNodeModulesRootByProjectPath(projectRoot);
        const commandExecutor = new CommandExecutor(nodeModulesRoot, projectRoot, this.logger);

        return commandExecutor.spawnWithProgress(
            HostPlatform.getNpmCliCommand("npm"),
            ["install", "-g", packageConfig.getStringForInstall(), "--verbose"],
            {
                verbosity: CommandVerbosity.PROGRESS,
            },
        );
    }

    public generateGetPackageFunction<T>(
        packageConfig: PackageConfig,
        ...additionalDependencies: PackageConfig[]
    ): () => Promise<T> {
        return PromiseUtil.promiseCacheDecorator<T>(() =>
            this.loadPackage<T>(packageConfig, ...additionalDependencies),
        );
    }

    private getUniquePackages(packages: string[]): string[] {
        return [...new Set(packages).values()];
    }

    private getTryToRequireFunction<T>(
        packageConfig: PackageConfig,
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void,
    ): (load?: string[]) => Promise<boolean> {
        return (load?: string[]) => {
            let packageWasInstalled = false;
            // Throw exception if we could not find package after installing
            if (load && load.includes(packageConfig.getStringForInstall())) {
                packageWasInstalled = true;
            }
            return this.tryToRequire<T>(packageConfig, resolve, reject, packageWasInstalled);
        };
    }

    private async tryToRequire<T>(
        packageConfig: PackageConfig,
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void,
        packageWasInstalled: boolean,
    ): Promise<boolean> {
        const requiredPackage = packageConfig.getStringForRequire();
        try {
            this.logger.debug(`Getting ${requiredPackage} dependency.`);
            if (packageConfig.getVersion()) {
                const installedVersion = await getVersionFromExtensionNodeModules(
                    packageConfig.getPackageName(),
                );

                if (packageConfig.getVersion() !== installedVersion) {
                    if (packageWasInstalled) {
                        throw WRONG_VERSION_ERROR;
                    }
                    this.logger.debug(
                        `Dependency ${requiredPackage} is present with another version. Retry after install this package with specific version...`,
                    );
                    return false;
                }
            }
            const module = customRequire(requiredPackage);
            resolve(module);
            return true;
        } catch (e) {
            if (packageWasInstalled || e.code !== "MODULE_NOT_FOUND") {
                reject(e);
                return true;
            }
            this.logger.debug(
                `Dependency ${requiredPackage} is not present. Retry after install...`,
            );
            return false;
        }
    }

    private async tryToRequireAfterInstall(
        tryToRequire: (load?: string[]) => Promise<boolean>,
        packageConfig: PackageConfig,
        ...additionalDependencies: PackageConfig[]
    ): Promise<void> {
        this.packagesQueue.push(packageConfig.getStringForInstall());
        additionalDependencies.forEach(dependency => {
            this.packagesQueue.push(dependency.getStringForInstall());
        });
        this.requireQueue.push(tryToRequire);
        if (!this.isCommandsExecuting) {
            this.isCommandsExecuting = true;

            const extensionDirectory: string = path.dirname(
                findFileInFolderHierarchy(__dirname, "package.json") || __dirname,
            );

            const commandExecutor = new CommandExecutor(
                path.join(extensionDirectory, "node_modules"),
                extensionDirectory,
                this.logger,
            );

            while (this.packagesQueue.length) {
                // Install all packages in queue
                this.packagesQueue = this.getUniquePackages(this.packagesQueue);

                const load = this.packagesQueue.length;
                const packagesForInstall = this.packagesQueue.slice(0, load);

                await commandExecutor.spawnWithProgress(
                    HostPlatform.getNpmCliCommand("npm"),
                    ["install", ...packagesForInstall, "--verbose", "--no-save", "--global-style"],
                    {
                        verbosity: CommandVerbosity.PROGRESS,
                    },
                );
                // Try to require all pending packages after every 'npm install ...' command
                const requiresToRemove: ((load?: string[]) => Promise<boolean>)[] = [];
                for (tryToRequire of this.requireQueue) {
                    if (await tryToRequire(packagesForInstall)) {
                        requiresToRemove.push(tryToRequire);
                    }
                }
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
                        const index = this.packagesQueue.indexOf(module);
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
        packageConfig: PackageConfig,
        ...additionalDependencies: PackageConfig[]
    ): Promise<T> {
        return new Promise(async (resolve: (value: T) => void, reject) => {
            const tryToRequire = this.getTryToRequireFunction(packageConfig, resolve, reject);
            if (!(await tryToRequire())) {
                this.tryToRequireAfterInstall(
                    tryToRequire,
                    packageConfig,
                    ...additionalDependencies,
                ).catch(reason => reject(reason));
            }
        });
    }
}
