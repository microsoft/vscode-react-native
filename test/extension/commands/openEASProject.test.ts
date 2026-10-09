// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("openEASProjectCommand", function () {
    function createCommandModule() {
        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
        };
        const showErrorMessageStub = Sinon.stub();
        const openExternalStub = Sinon.stub().returns(Promise.resolve(true));
        const parseStub = Sinon.stub().returns({ parsed: true });
        const isExpoManagedAppStub = Sinon.stub().returns(Promise.resolve(true));
        const getExpoEasProjectIdStub = Sinon.stub().returns(Promise.resolve("project-id"));
        const getExpoEasProjectOwnerStub = Sinon.stub().returns(Promise.resolve("project-owner"));
        const getExpoEasProjectNameStub = Sinon.stub().returns(Promise.resolve("project-name"));

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/openEASProject", {
            "vscode-nls": {
                config: () => () => undefined,
                loadMessageBundle: () => (_key: string, message: string) => message,
                MessageFormat: { bundle: "bundle" },
                BundleFormat: { standalone: "standalone" },
            },
            vscode: {
                env: { openExternal: openExternalStub },
                Uri: { parse: parseStub },
                window: { showErrorMessage: showErrorMessageStub },
            },
            "../log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => logger,
                },
            },
            "../../common/error/errorHelper": {
                ErrorHelper: {
                    getInternalError: () => new Error("open EAS project failed"),
                },
            },
            "../../common/error/internalErrorCode": {
                InternalErrorCode: {
                    FailedToOpenProjectPage: 0,
                },
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/openEASProject");

        const project = {
            getExponentHelper: Sinon.stub().returns({
                isExpoManagedApp: isExpoManagedAppStub,
                getExpoEasProjectId: getExpoEasProjectIdStub,
                getExpoEasProjectOwner: getExpoEasProjectOwnerStub,
                getExpoEasProjectName: getExpoEasProjectNameStub,
            }),
        };

        return {
            OpenEASProject: module.OpenEASProject,
            project,
            logger,
            showErrorMessageStub,
            openExternalStub,
            parseStub,
            isExpoManagedAppStub,
            getExpoEasProjectIdStub,
            getExpoEasProjectOwnerStub,
            getExpoEasProjectNameStub,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>) {
        const command = stubs.OpenEASProject.formInstance();
        (command as any).project = stubs.project;
        await command.baseFn();
    }

    test("should stop without opening a URL for a non-Expo project", async function () {
        const stubs = createCommandModule();
        stubs.isExpoManagedAppStub.returns(Promise.resolve(false));

        await runCommand(stubs);

        assert.strictEqual(stubs.isExpoManagedAppStub.calledWithExactly(true), true);
        assert.strictEqual(stubs.getExpoEasProjectIdStub.called, false);
        assert.strictEqual(stubs.openExternalStub.called, false);
    });

    for (const missingField of ["id", "owner"] as const) {
        test(`should show an error when the EAS project ${missingField} is missing`, async function () {
            const stubs = createCommandModule();
            const missingFieldStub =
                missingField === "id"
                    ? stubs.getExpoEasProjectIdStub
                    : stubs.getExpoEasProjectOwnerStub;
            missingFieldStub.returns(Promise.resolve(null));

            await runCommand(stubs);

            assert.strictEqual(stubs.showErrorMessageStub.calledOnce, true);
            assert.strictEqual(stubs.logger.error.calledOnce, true);
            assert.strictEqual(
                stubs.logger.error.firstCall.args[0],
                stubs.showErrorMessageStub.firstCall.args[0],
            );
            assert.strictEqual(stubs.openExternalStub.called, false);
        });
    }

    test("should open the linked EAS project URL", async function () {
        const stubs = createCommandModule();

        await runCommand(stubs);

        assert.strictEqual(
            stubs.parseStub.calledWithExactly(
                "https://expo.dev/accounts/project-owner/projects/project-name",
            ),
            true,
        );
        assert.strictEqual(stubs.openExternalStub.calledWithExactly({ parsed: true }), true);
    });

    test("should not open a URL when the EAS project name is missing", async function () {
        const stubs = createCommandModule();
        stubs.getExpoEasProjectNameStub.returns(Promise.resolve(null));

        await runCommand(stubs);

        assert.strictEqual(stubs.parseStub.called, false);
        assert.strictEqual(stubs.openExternalStub.called, false);
        assert.strictEqual(stubs.showErrorMessageStub.called, false);
    });

    test("should log an error when EAS project details cannot be read", async function () {
        const error = new Error("failed to read EAS project details");
        const stubs = createCommandModule();
        stubs.getExpoEasProjectOwnerStub.returns(Promise.reject(error));

        await runCommand(stubs);

        assert.strictEqual(stubs.logger.error.calledOnce, true);
        assert.strictEqual(stubs.openExternalStub.called, false);
    });

    test("should require a project before reading EAS details", async function () {
        const stubs = createCommandModule();
        const command = stubs.OpenEASProject.formInstance();

        await assert.rejects(() => command.baseFn(), assert.AssertionError);

        assert.strictEqual(stubs.isExpoManagedAppStub.called, false);
        assert.strictEqual(stubs.openExternalStub.called, false);
    });
});
