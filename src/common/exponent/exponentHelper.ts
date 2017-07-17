// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="exponentHelper.d.ts" />

import * as path from "path";
import * as Q from "q";
import stripJSONComments = require("strip-json-comments");

import {Package} from "../node/package";
import * as XDL from "./xdlInterface";
import { FileSystem } from "../node/fileSystem";
import { Log } from "../log/log";

const APP_JSON = "app.json";
const EXP_JSON = "exp.json";

export class ExponentHelper {
    private projectRootPath: string;
    private fs: FileSystem;
    private hasInitialized: boolean;

    public constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
        this.hasInitialized = false;
        // Constructor is slim by design. This is to add as less computation as possible
        // to the initialization of the extension. If a public method is added, make sure
        // to call this.lazilyInitialize() at the begining of the code to be sure all variables
        // are correctly initialized.
    }

    public configureExponentEnvironment(): Q.Promise<void> {
        this.lazilyInitialize();
        Log.logMessage("Making sure your project uses the correct dependencies for exponent. This may take a while...");
        return this.isExpoApp(true)
            .then(isExpo => {
                Log.logString(".\n");

                return this.patchAppJson();
            });
    }

    /**
     * Returns the current user. If there is none, asks user for username and password and logins to exponent servers.
     */
    public loginToExponent(promptForInformation: (message: string, password: boolean) => Q.Promise<string>, showMessage: (message: string) => Q.Promise<string>): Q.Promise<XDL.IUser> {
        this.lazilyInitialize();
        return XDL.currentUser()
            .then((user) => {
                if (!user) {
                    let username = "";
                    return showMessage("You need to login to exponent. Please provide username and password to login. If you don't have an account we will create one for you.")
                        .then(() =>
                            promptForInformation("Exponent username", false)
                        ).then((name) => {
                            username = name;
                            return promptForInformation("Exponent password", true);
                        })
                        .then((password) =>
                            XDL.login(username, password));
                }
                return user;
            })
            .catch(error => {
                return Q.reject<XDL.IUser>(error);
            });
    }

    public getExpPackagerOptions(): Q.Promise<ExpConfigPackager> {
        this.lazilyInitialize();
        return this.getFromExpConfig<ExpConfigPackager>("packagerOpts")
            .then(opts => opts || {});
    }

    private patchAppJson():  Q.Promise<void> {
        return this.readAppJson()
            .then((config: ExpConfig) => {
                if (!config.name || !config.slug) {
                    return this.getPackageName()
                        .then(name => {
                            config.slug = config.slug || name.replace(" ", "-");
                            config.name = config.name || name;
                            return config;
                        });
                }

                return Q.resolve(null);
            })
            .then((config: ExpConfig) => {
                if (config) {
                    return this.writeAppJson(config);
                }
            });
    };

    /**
     * Name specified on user's package.json
     */
    private getPackageName(): Q.Promise<string> {
        return new Package(this.projectRootPath, { fileSystem: this.fs }).name();
    }

    private getExpConfig(): Q.Promise<ExpConfig> {
        return this.readExpJson()
            .catch(err => {
                if (err.code === "ENOENT") {
                    return this.readAppJson();
                }

                return err;
            });
    }

    private getFromExpConfig<T>(key: string): Q.Promise<T> {
        return this.getExpConfig()
            .then((config: ExpConfig) => config[key]);
    }

    /**
     * Returns the specified setting from exp.json if it exists
     */
    private readExpJson(): Q.Promise<ExpConfig> {
        const expJsonPath = this.pathToFileInWorkspace(EXP_JSON);
        return this.fs.readFile(expJsonPath)
            .then(content => {
                return JSON.parse(stripJSONComments(content));
            });
    }

    private readAppJson(): Q.Promise<ExpConfig> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        return this.fs.readFile(appJsonPath)
            .then(content => {
                return JSON.parse(stripJSONComments(content)).expo;
            });
    }

    private writeAppJson(content: ExpConfig): Q.Promise<void> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        return this.fs.writeFile(appJsonPath, JSON.stringify({
            expo: content
        }, null, 2));
    }

    /**
     * Path to a given file from the workspace root
     */
    private pathToFileInWorkspace(filename: string): string {
        return path.join(this.projectRootPath, filename);
    }

    private isExpoApp(showProgress: boolean = false): Q.Promise<boolean>  {
        Log.logString("Checking if this is Expo app.");
        if (showProgress) {
            Log.logString("...");
        }

        const packageJsonPath = this.pathToFileInWorkspace("package.json");
        return this.fs.readFile(packageJsonPath)
            .then(content => {
                const packageJson = JSON.parse(content);
                const isExp = packageJson.dependencies && !!packageJson.dependencies.expo || false;
                if (showProgress) Log.logString(".");
                return isExp;
            }).catch(() => {
                if (showProgress) {
                    Log.logString(".");
                }
                // Not in a react-native project
                return false;
            });
    }

    /**
     * Works as a constructor but only initiliazes when it's actually needed.
     */
    private lazilyInitialize(): void {
        if (!this.hasInitialized) {
            this.hasInitialized = true;
            this.fs = new FileSystem();

            XDL.configReactNativeVersionWargnings();
            XDL.attachLoggerStream(this.projectRootPath, {
                stream: {
                    write: (chunk: any) => {
                        if (chunk.level <= 30) {
                            Log.logString(chunk.msg);
                        } else if (chunk.level === 40) {
                            Log.logWarning(chunk.msg);
                        } else {
                            Log.logError(chunk.msg);
                        }
                    },
                },
                type: "raw",
            });
        }
    }
}