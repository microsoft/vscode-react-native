// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.


// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");
import { objectsContains, waitUntil } from "./utilities";

export interface IConfiguration {
    name: string;
    platform?: string;
    target?: string;
    type?: string;
    request?: string;
}
export interface ILaunchScenarios {
    configurations?: IConfiguration[];
}

export class LaunchConfigurationManager {
    private static LAUNCH_CONFIG_UPDATE_TIMEOUT = 30_000;
    private pathToLaunchFile: string;
    private launchScenarios: ILaunchScenarios;

    constructor(workspaceDirectory: string) {
        this.pathToLaunchFile = path.resolve(workspaceDirectory, ".vscode", "launch.json");
        this.readLaunchScenarios();
    }

    public getLaunchScenarios(): ILaunchScenarios {
        return this.launchScenarios;
    }

    private getFirstScenarioIndexByParams(scenario: IConfiguration): number | null {
        if (this.launchScenarios.configurations) {
            for (let i = 0; i < this.launchScenarios.configurations.length; i++) {
                const config = this.launchScenarios.configurations[i];
                if (scenario.name === config.name &&
                    scenario.platform === config.platform &&
                    scenario.type === config.type &&
                    scenario.request === config.request) {
                        return i;
                    }
            }
        }
        return null;
    }

    private writeLaunchScenarios(launch: ILaunchScenarios = this.launchScenarios): void {
        if (fs.existsSync(this.pathToLaunchFile)) {
            fs.writeFileSync(this.pathToLaunchFile, JSON.stringify(launch, null, 4));
        }
    }

    public readLaunchScenarios(): ILaunchScenarios {
        if (fs.existsSync(this.pathToLaunchFile)) {
            const content = fs.readFileSync(this.pathToLaunchFile, "utf8");
            this.launchScenarios = JSON.parse(stripJsonComments(content));
        }
        return this.launchScenarios;
    }

    public updateLaunchScenario(launchConfig: IConfiguration, updates: any): void {
        this.readLaunchScenarios();
        let launchConfigIndex = this.getFirstScenarioIndexByParams(launchConfig);
        const launchScenarios = this.getLaunchScenarios();
        if (launchConfigIndex !== null && launchScenarios.configurations) {
            Object.assign(launchScenarios.configurations[launchConfigIndex], updates);
            this.writeLaunchScenarios(launchScenarios);
        }
    }

    public waitUntilLaunchScenarioUpdate(updates: any, launchConfig?: IConfiguration): Promise<boolean> {
        const condition = (): boolean => {
            const configs = this.readLaunchScenarios().configurations;
            if (configs) {
                if (launchConfig) {
                    const index = this.getFirstScenarioIndexByParams(launchConfig);
                    if (index) {
                        return objectsContains(configs[index], updates);
                    }
                }
                else {
                    configs.forEach((config) => {
                        if (objectsContains(config, updates)) {
                            return true;
                        }
                    });
                }
            }
            return false;
        };

        return waitUntil(condition, LaunchConfigurationManager.LAUNCH_CONFIG_UPDATE_TIMEOUT);
    }
}