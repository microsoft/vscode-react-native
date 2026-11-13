// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { InternalError } from "../../../src/common/error/internalError";
import { InternalErrorCode } from "../../../src/common/error/internalErrorCode";

suite("stopPackagerCommand", function () {
    function createProjectWithPackager(stopStub: Sinon.SinonStub): any {
        return {
            getPackager: () => ({
                stop: stopStub,
            }),
        };
    }

    function createProjectWithoutPackager(): any {
        return {
            getPackager: () => undefined,
        };
    }

    function createCommandModule() {
        const superOnBeforeExecuteStub = Sinon.stub().returns(Promise.resolve());
        const selectProjectStub = Sinon.stub();

        class FakeAppLauncher {}

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }

            async onBeforeExecute(...args: any[]): Promise<void> {
                await superOnBeforeExecuteStub(...args);
            }

            async selectProject(): Promise<any> {
                return selectProjectStub();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/stopPackager", {
            "../appLauncher": {
                AppLauncher: FakeAppLauncher,
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/stopPackager");

        return {
            StopPackager: module.StopPackager,
            FakeAppLauncher,
            superOnBeforeExecuteStub,
            selectProjectStub,
        };
    }

    test("should use the provided AppLauncher without selecting a project", async function () {
        const { StopPackager, FakeAppLauncher, superOnBeforeExecuteStub, selectProjectStub } =
            createCommandModule();
        const command = StopPackager.formInstance();
        const appLauncher = new FakeAppLauncher();

        await command.onBeforeExecute(appLauncher as any);

        assert.strictEqual(superOnBeforeExecuteStub.calledWithExactly(appLauncher), true);
        assert.strictEqual((command as any).project, appLauncher);
        assert.strictEqual(selectProjectStub.called, false);
    });

    test("should select a project when the argument is not an AppLauncher", async function () {
        const { StopPackager, superOnBeforeExecuteStub, selectProjectStub } = createCommandModule();
        const command = StopPackager.formInstance();
        const selectedProject = createProjectWithoutPackager();
        const nonAppLauncherArgument = {};
        selectProjectStub.returns(Promise.resolve(selectedProject));

        await command.onBeforeExecute(nonAppLauncherArgument as any);

        assert.strictEqual(
            superOnBeforeExecuteStub.calledWithExactly(nonAppLauncherArgument),
            true,
        );
        assert.strictEqual((command as any).project, selectedProject);
        assert.strictEqual(selectProjectStub.calledOnce, true);
    });

    test("should propagate a superclass failure without selecting a project", async function () {
        const { StopPackager, superOnBeforeExecuteStub, selectProjectStub } = createCommandModule();
        const command = StopPackager.formInstance();
        const argument = {};
        const failure = new Error("Superclass preparation failed");
        superOnBeforeExecuteStub.returns(Promise.reject(failure));

        await assert.rejects(
            () => command.onBeforeExecute(argument as any),
            (error: unknown) => error === failure,
        );

        assert.strictEqual(superOnBeforeExecuteStub.calledOnce, true);
        assert.strictEqual(superOnBeforeExecuteStub.calledWithExactly(argument), true);
        assert.strictEqual(selectProjectStub.called, false);
        assert.strictEqual((command as any).project, undefined);
    });

    for (const { scenario, failure } of [
        { scenario: "fails", failure: new Error("Project selection failed") },
        {
            scenario: "is canceled",
            failure: new InternalError(
                InternalErrorCode.CommandCanceled,
                "Project selection canceled",
            ),
        },
    ]) {
        test(`should propagate the error when project selection ${scenario}`, async function () {
            const { StopPackager, superOnBeforeExecuteStub, selectProjectStub } =
                createCommandModule();
            const command = StopPackager.formInstance();
            const argument = {};
            selectProjectStub.returns(Promise.reject(failure));

            await assert.rejects(
                () => command.onBeforeExecute(argument as any),
                (error: unknown) => error === failure,
            );

            assert.strictEqual(superOnBeforeExecuteStub.calledOnce, true);
            assert.strictEqual(superOnBeforeExecuteStub.calledWithExactly(argument), true);
            assert.strictEqual(selectProjectStub.calledOnce, true);
            assert.strictEqual(selectProjectStub.calledWithExactly(), true);
            assert.strictEqual((command as any).project, undefined);
        });
    }

    test("should stop the current packager", async function () {
        const { StopPackager } = createCommandModule();
        const command = StopPackager.formInstance();
        const stopStub = Sinon.stub().returns(Promise.resolve());
        (command as any).project = createProjectWithPackager(stopStub);

        await command.baseFn();

        assert.strictEqual(stopStub.calledOnce, true);
    });

    test("should not throw when the current project has no packager", async function () {
        const { StopPackager } = createCommandModule();
        const command = StopPackager.formInstance();
        (command as any).project = createProjectWithoutPackager();

        await command.baseFn();
    });

    test("should reject when stopping the packager fails", async function () {
        const { StopPackager } = createCommandModule();
        const command = StopPackager.formInstance();
        const failure = new Error("Failed to stop the packager");
        const stopStub = Sinon.stub().returns(Promise.reject(failure));
        (command as any).project = createProjectWithPackager(stopStub);

        await assert.rejects(
            () => command.baseFn(),
            (error: unknown) => error === failure,
        );

        assert.strictEqual(stopStub.calledOnce, true);
        assert.strictEqual(stopStub.calledWithExactly(), true);
    });
});
