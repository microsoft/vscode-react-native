// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import proxyquire = require("proxyquire");
import { ClientOS } from "../../../src/extension/networkInspector/clientUtils";

suite("certificateProvider", function () {
    function createCertificateProviderModule() {
        const logger = {
            info: () => {},
            warning: () => {},
            error: () => {},
            debug: () => {},
        };

        const module = proxyquire.noCallThru()(
            "../../../src/extension/networkInspector/certificateProvider",
            {
                "../../common/opensslWrapperWithPromises": {
                    openssl: () => Promise.resolve(""),
                    isInstalled: () => true,
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getChannel: () => logger,
                    },
                },
            },
        ) as typeof import("../../../src/extension/networkInspector/certificateProvider");

        return {
            CertificateProvider: module.CertificateProvider,
        };
    }

    function createProvider() {
        const { CertificateProvider } = createCertificateProviderModule();
        return new CertificateProvider({} as any) as any;
    }

    function getIOSAllowedDestination(): string {
        return path.join(
            process.env.HOME || "/Users",
            "Library",
            "Developer",
            "CoreSimulator",
            "Devices",
            "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
            "data",
            "Containers",
            "Data",
            "Application",
            "FFFFFFFF-GGGG-HHHH-IIII-JJJJJJJJJJJJ",
            "Documents",
        );
    }

    test("should reject destination path traversal attempts", function () {
        const provider = createProvider();
        const traversalDestination = `${getIOSAllowedDestination()}${path.sep}..${
            path.sep
        }Documents`;

        assert.throws(() => {
            provider.validateDestinationPath(traversalDestination, ClientOS.iOS);
        }, /Path traversal not allowed in destination/);
    });

    test("should allow iOS destinations under the simulator devices directory", function () {
        const provider = createProvider();

        assert.doesNotThrow(() => {
            provider.validateDestinationPath(getIOSAllowedDestination(), ClientOS.iOS);
        });
    });

    test("should reject iOS destinations outside the allowed simulator directory", function () {
        const provider = createProvider();

        assert.throws(() => {
            provider.validateDestinationPath(path.join(process.cwd(), "Documents"), ClientOS.iOS);
        }, /Destination path is not within an allowed directory/);
    });
});
