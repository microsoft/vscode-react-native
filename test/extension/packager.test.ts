// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import { Packager } from "../../src/common/packager";
import { Request } from "../../src/common/node/request";
import { ExponentHelper } from "../../src/extension/exponent/exponentHelper";
import { FileSystem } from "../../src/common/node/fileSystem";
import { stripJsonTrailingComma } from "../../src/common/utils";

import * as assert from "assert";
import * as sinon from "sinon";

suite("packager", function () {
    suite("extensionContext", function () {
        let requestStub: Sinon.SinonStub;
        let isExpoManagedAppStub: Sinon.SinonStub;
        let getExpPackagerOptionsStub: Sinon.SinonStub;

        const WORKSPACE_PATH: string = "/workspace";
        const PROJECT_PATH: string = "/workspace";

        setup(() => {
            requestStub = sinon.stub(Request, "request");
            isExpoManagedAppStub = sinon.stub(ExponentHelper.prototype, "isExpoManagedApp");
            getExpPackagerOptionsStub = sinon.stub(
                ExponentHelper.prototype,
                "getExpPackagerOptions",
            );
        });

        teardown(() => {
            requestStub.restore();
            isExpoManagedAppStub.restore();
            getExpPackagerOptionsStub.restore();
        });

        test("isRunning should check correct status URL", async function () {
            requestStub.returns(Promise.resolve("packager-status:running"));

            try {
                const isRunning = await new Packager(
                    WORKSPACE_PATH,
                    PROJECT_PATH,
                    Packager.DEFAULT_PORT,
                ).isRunning();
                assert(isRunning);
                assert(
                    requestStub.firstCall.args[0].match(
                        "http://localhost:" + Packager.DEFAULT_PORT,
                    ),
                );
            } catch (error) {
                assert.fail(null, null, "packager was expected to be running");
            }
        });

        test("isRunning should report false if server doesn't respond", async function () {
            requestStub.returns(Promise.reject());

            try {
                const isRunning = await new Packager(
                    WORKSPACE_PATH,
                    PROJECT_PATH,
                    9091,
                ).isRunning();
                assert(!isRunning);
            } catch (error) {
                assert.fail(null, null, "packager was not expected to be running");
            }
        });

        test("isRunning should report false if request fails", async function () {
            requestStub.returns(Promise.resolve("some_random_string"));

            try {
                const isRunning = await new Packager(
                    WORKSPACE_PATH,
                    PROJECT_PATH,
                    10001,
                ).isRunning();
                assert(!isRunning);
            } catch (error) {
                assert.fail(null, null, "packager was not expected to be running");
            }
        });

        test("getPackagerArgs should return correct value (react-native@0.56.0)", async function () {
            isExpoManagedAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001"];

            const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001).getPackagerArgs(
                PROJECT_PATH,
                rnVersion,
            );
            assert.deepEqual(args, expected);
        });

        test("getPackagerArgs should return correct value (react-native@0.57.0)", async function () {
            isExpoManagedAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--resetCache"];

            const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001).getPackagerArgs(
                PROJECT_PATH,
                rnVersion,
                true,
            );
            assert.deepEqual(args, expected);
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.56.0)", async function () {
            isExpoManagedAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(Promise.resolve({}));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001", "--resetCache", "--root", ".vscode"];

            const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001).getPackagerArgs(
                PROJECT_PATH,
                rnVersion,
                true,
            );
            assert.deepEqual(args, expected);
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.57.0)", async function () {
            isExpoManagedAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(
                Promise.resolve({
                    assetExts: ["txt", "md"],
                }),
            );
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--assetExts", ["txt", "md"]];
            const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001).getPackagerArgs(
                PROJECT_PATH,
                rnVersion,
            );
            assert.deepEqual(args, expected);
        });

        test("getPackagerArgs should return correct value for expo app with android platform", async function () {
            isExpoManagedAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(Promise.resolve({}));
            const rnVersion = "0.70.0";
            const expected = ["--port", "10001", "--android"];

            const projectPath = path.join(__dirname, "..", "resources", "sampleExpoProject");
            const launchJsonPath = path.join(projectPath, "launch.json");
            const fs = new FileSystem();
            const launchJson = await fs.readFile(launchJsonPath).then(content => {
                return stripJsonTrailingComma(content.toString());
            });

            const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001).getPackagerArgs(
                PROJECT_PATH,
                rnVersion,
            );

            if (launchJson.configurations[0].platform === "exponent") {
                args.push(`--${launchJson.configurations[0].expoPlatformType.toLowerCase()}`);
            }
            assert.deepEqual(args, expected);
        });
    });
});
