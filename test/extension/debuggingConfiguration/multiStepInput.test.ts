// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import proxyquire = require("proxyquire");
import type * as MultiStepInputModule from "../../../src/extension/debuggingConfiguration/multiStepInput";
import {
    DEBUG_TYPES,
    DebugConfigurationState,
    DebugScenarioType,
} from "../../../src/extension/debuggingConfiguration/debugConfigTypesAndConstants";

const vscodeStub = {
    QuickInputButtons: { Back: { iconPath: "back" } },
    window: {
        createQuickPick: () => ({}),
        createInputBox: () => ({}),
    },
    "@noCallThru": true,
};

const { InputFlowAction, MultiStepInput } = proxyquire(
    "../../../src/extension/debuggingConfiguration/multiStepInput",
    {
        vscode: vscodeStub,
    },
) as typeof MultiStepInputModule;

suite("MultiStepInput", function () {
    test("returns true when all steps complete normally", async function () {
        const input = new MultiStepInput<DebugConfigurationState>();
        const state: DebugConfigurationState = {
            config: {},
            scenarioType: DebugScenarioType.AttachApp,
        };

        const completed = await input.run(async (_stepInput, s) => {
            s.config = {
                name: "Attach to packager",
                request: "attach",
                type: DEBUG_TYPES.REACT_NATIVE,
                cwd: "${workspaceFolder}",
            };
        }, state);

        assert.strictEqual(completed, true);
    });

    test("returns false when canceled mid-flow after partial config mutation", async function () {
        const input = new MultiStepInput<DebugConfigurationState>();
        const state: DebugConfigurationState = {
            config: {},
            scenarioType: DebugScenarioType.AttachApp,
        };

        const completed = await input.run(async (_stepInput, s) => {
            Object.assign(s.config, {
                name: "Attach to application",
                request: "attach",
                type: DEBUG_TYPES.REACT_NATIVE_DIRECT,
                cwd: "${workspaceFolder}",
            });
            return async () => {
                throw InputFlowAction.cancel;
            };
        }, state);

        assert.strictEqual(completed, false);
    });
});
