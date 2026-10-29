// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { DebugScenarioNameGenerator } from "../../../src/extension/debuggingConfiguration/debugScenarioNameGenerator";
import {
    DEBUG_TYPES,
    DebugScenarioType,
} from "../../../src/extension/debuggingConfiguration/debugConfigTypesAndConstants";
import { PlatformType } from "../../../src/extension/launchArgs";

suite("DebugScenarioNameGenerator", function () {
    test("creates a React Native Android run scenario name", function () {
        const name = DebugScenarioNameGenerator.createScenarioName(
            DebugScenarioType.RunApp,
            DEBUG_TYPES.REACT_NATIVE,
            PlatformType.Android,
        );

        assert.strictEqual(name, "Run Android");
    });

    test("creates a React Native attach scenario name", function () {
        const name = DebugScenarioNameGenerator.createScenarioName(
            DebugScenarioType.AttachApp,
            DEBUG_TYPES.REACT_NATIVE,
            PlatformType.iOS,
        );

        assert.strictEqual(name, "Attach to packager");
    });

    test("includes Hermes in a direct iOS debug scenario name", function () {
        const name = DebugScenarioNameGenerator.createScenarioName(
            DebugScenarioType.DebugApp,
            DEBUG_TYPES.REACT_NATIVE_DIRECT,
            PlatformType.iOS,
            true,
        );

        assert.strictEqual(name, "Debug iOS Hermes");
    });

    test("includes the Expo platform and experimental suffix", function () {
        const name = DebugScenarioNameGenerator.createScenarioName(
            DebugScenarioType.RunApp,
            DEBUG_TYPES.REACT_NATIVE,
            PlatformType.Exponent,
            false,
            true,
            "Android",
        );

        assert.strictEqual(name, "Run in Exponent Android - Experimental");
    });
});
