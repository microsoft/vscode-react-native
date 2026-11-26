// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import type { DebugConfigurationState } from "../../src/extension/debuggingConfiguration/debugConfigTypesAndConstants";
import type { InputBoxParameters } from "../../src/extension/debuggingConfiguration/multiStepInput";

suite("ConfigurationProviderHelper port validation", function () {
    const { MultiStepInput } = proxyquire.noCallThru()(
        "../../src/extension/debuggingConfiguration/multiStepInput",
        { vscode: {} },
    ) as typeof import("../../src/extension/debuggingConfiguration/multiStepInput");
    const { ConfigurationProviderHelper } = proxyquire.noCallThru()(
        "../../src/common/configurationProviderHelper",
        {
            "../extension/debuggingConfiguration/debugConfigTypesAndConstants": {
                DEBUG_TYPES: { REACT_NATIVE_DIRECT: "reactnativedirect" },
            },
            "../debugger/direct/IWDPHelper": {
                IWDPHelper: { iOS_WEBKIT_DEBUG_PROXY_DEFAULT_PORT: 9221 },
            },
            "./packager": { Packager: { DEFAULT_PORT: 8081 } },
        },
    ) as typeof import("../../src/common/configurationProviderHelper");

    test("validates the range and format of port input", async function () {
        const input = new MultiStepInput<DebugConfigurationState>();
        const showInputBox = Sinon.stub(input, "showInputBox").returns(Promise.resolve("8081"));
        await new ConfigurationProviderHelper().configurePort(input, {}, 2, 2);
        const options: InputBoxParameters = showInputBox.firstCall.args[0];

        await Promise.all(
            ["1", "65535", " 8081 ", "00001"].map(async value => {
                assert.strictEqual(await options.validate(value), undefined, value);
            }),
        );
        await Promise.all(
            ["0", "65536", "-1", "1.5", "abc", "", "  ", "9".repeat(400)].map(async value => {
                const error = await options.validate(value);
                assert.ok(error, value);
                assert.ok(/1.*65535/.test(error), error);
            }),
        );
    });

    test("writes valid boundary ports to the configuration", async function () {
        await Promise.all(
            ["1", "65535"].map(async port => {
                const input = new MultiStepInput<DebugConfigurationState>();
                Sinon.stub(input, "showInputBox").returns(Promise.resolve(port));
                const config = await new ConfigurationProviderHelper().configurePort(
                    input,
                    {},
                    2,
                    2,
                );
                assert.strictEqual(config.port, Number(port));
            }),
        );
    });
});
