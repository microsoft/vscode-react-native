// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../automation";
import { runVSCode, RNworkspacePath } from "./main";

const startPackagerCommand = "Запустить упаковщик";
const packagerStartedCheck = "Упаковщик React Native: запущен";
export function setup() {
    describe("Localization test", () => {
        let app: Application;

        afterEach(async () => {
            if (app) {
                await app.stop();
            }
        });

        it("Test localization", async function () {
            app = await runVSCode(RNworkspacePath, "ru");
            console.log("Localization test: Starting packager");
            await app.workbench.quickaccess.runDebugScenario(startPackagerCommand);
            console.log(`Localization test: Search for '${packagerStartedCheck}' string output`);
            await app.workbench.statusbar.waitForStatusbarText(packagerStartedCheck);
            console.log(`Localization test: Output found`);
        });
    });
}
