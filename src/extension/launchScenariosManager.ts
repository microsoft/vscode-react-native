// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";

export interface IConfiguration {
    name: string;
    cwd: string | null | undefined;
    platform: string | null | undefined;
    program: string | null | undefined;
    target: string | null | undefined;
    sourceMaps: boolean | null | undefined;
    logCatArguments: [] | null | undefined;
    runArguments: [] | null | undefined;
    env: any | null | undefined;
    envFile: string | null | undefined;
    variant: string | null | undefined;
    scheme: string | null | undefined;
    productName: string | null | undefined;
    skipFiles: string[] | null | undefined;
    trace: string | null | undefined;
    debuggerWorkerUrlPath: string | null | undefined;
    launchActivity: string | null | undefined;
    expoHostType: string | null | undefined;
    enableDebug: boolean | null | undefined;
    type: string | null | undefined;
    request: string | null | undefined;
}
export interface ILaunchScenaros {
    version: string | null | undefined;
    configurations: IConfiguration[] | null | undefined;
    compounds: any[] | null | undefined;
}

export class LaunchScenariosManager {
    private pathToLaunchFile: string;
    private launchScenarios: ILaunchScenaros;

    constructor(rootPath: string) {
        this.pathToLaunchFile = path.resolve(rootPath, ".vscode", "launch.json");
        this.readLaunchScenarios();
    }

    public getLaunchScenarios(): ILaunchScenaros {
        return this.launchScenarios;
    }

    public getFirstScenarioIndexByParams(scenario: IConfiguration): number | undefined {
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
        return undefined;
    }

    public writeLaunchScenarios(launch: ILaunchScenaros = this.launchScenarios): void {
        if (!fs.existsSync(this.pathToLaunchFile)) {
            fs.mkdirSync(this.pathToLaunchFile);
        }
        fs.writeFileSync(this.pathToLaunchFile, JSON.stringify(this.launchScenarios));
    }

    private readLaunchScenarios(): void {
        if (fs.existsSync(this.pathToLaunchFile)) {
            const content = fs.readFileSync(this.pathToLaunchFile, "utf8");
            this.launchScenarios = JSON.parse(content);
        }
    }
}