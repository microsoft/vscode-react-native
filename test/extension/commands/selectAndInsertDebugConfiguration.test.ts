// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("selectAndInsertDebugConfigurationCommand", function () {
    function makePosition(line: number, character: number): any {
        return { line, character };
    }

    function makeCancellationToken(cancelled = false): any {
        return { isCancellationRequested: cancelled };
    }

    function createCommandModule(
        activeEditorDoc: any = {},
        getCursorPositionStub?: Sinon.SinonStub,
        isCommaBeforeCursorStub?: Sinon.SinonStub,
        getTextForInsertionStub?: Sinon.SinonStub,
        provideDebugConfigStub?: Sinon.SinonStub,
        applyEditStub?: Sinon.SinonStub,
        executeCommandStub?: Sinon.SinonStub,
    ) {
        const fakeConfig = { type: "reactnative", name: "Debug", request: "launch" };

        const cursorPosFn = getCursorPositionStub ?? Sinon.stub().returns("InsideEmptyArray");
        const isCommaFn = isCommaBeforeCursorStub ?? Sinon.stub().returns(false);
        const textForInsertFn =
            getTextForInsertionStub ?? Sinon.stub().returns(JSON.stringify(fakeConfig));
        const provideDebugFn =
            provideDebugConfigStub ?? Sinon.stub().returns(Promise.resolve(fakeConfig));
        const applyEditFn = applyEditStub ?? Sinon.stub().returns(Promise.resolve(true));
        const execCommandFn = executeCommandStub ?? Sinon.stub().returns(Promise.resolve());

        const fakeWorkspaceEditInsert = Sinon.stub();

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        class FakeWorkspaceEdit {
            public insert = fakeWorkspaceEditInsert;
        }

        const module = proxyquire.noCallThru().noPreserveCache()(
            "../../../src/extension/commands/selectAndInsertDebugConfiguration",
            {
                "../../common/error/errorHelper": {
                    ErrorHelper: {
                        getInternalError: () => new Error("command failed"),
                    },
                },
                "../../common/error/internalErrorCode": {
                    InternalErrorCode: { CommandFailed: 0 },
                },
                "../rn-extension": {
                    getDebugConfigProvider: () => ({
                        provideDebugConfigurationSequentially: provideDebugFn,
                    }),
                },
                "../../common/launchJsonCompletionHelper": {
                    LaunchJsonCompletionHelper: {
                        getCursorPositionInConfigurationsArray: cursorPosFn,
                        isCommaImmediatelyBeforeCursor: isCommaFn,
                        getTextForInsertion: textForInsertFn,
                    },
                },
                vscode: {
                    window: {
                        activeTextEditor: { document: activeEditorDoc },
                    },
                    workspace: {
                        getWorkspaceFolder: Sinon.stub().returns(undefined),
                        applyEdit: applyEditFn,
                    },
                    WorkspaceEdit: FakeWorkspaceEdit,
                    commands: { executeCommand: execCommandFn },
                },
                "./util/command": { Command: FakeCommand },
                assert: assert,
            },
        ) as typeof import("../../../src/extension/commands/selectAndInsertDebugConfiguration");

        return {
            SelectAndInsertDebugConfiguration: module.SelectAndInsertDebugConfiguration,
            fakeConfig,
            cursorPosFn,
            isCommaFn,
            textForInsertFn,
            provideDebugFn,
            applyEditFn,
            execCommandFn,
            fakeWorkspaceEditInsert,
        };
    }

    test("should throw when required parameters are missing", async function () {
        const stubs = createCommandModule();
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const doc = {} as any;
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await assert.rejects(() => command.baseFn(undefined as any, pos, token));
        await assert.rejects(() => command.baseFn(doc, undefined as any, token));
        await assert.rejects(() => command.baseFn(doc, pos, undefined as any));
    });

    test("should return early when document does not match active editor", async function () {
        const activeEditorDoc = { uri: "active-doc" } as any;
        const stubs = createCommandModule(activeEditorDoc);
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const differentDoc = { uri: "different-doc" } as any;
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(differentDoc, pos, token);

        assert.strictEqual(stubs.provideDebugFn.called, false);
        assert.strictEqual(stubs.applyEditFn.called, false);
    });

    test("should return early when config provider returns null", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const provideStub = Sinon.stub().returns(Promise.resolve(null));
        const stubs = createCommandModule(
            activeEditorDoc,
            undefined,
            undefined,
            undefined,
            provideStub,
        );
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(activeEditorDoc, pos, token);

        assert.strictEqual(stubs.applyEditFn.called, false);
    });

    test("should return early when cancellation token is triggered after config is provided", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const stubs = createCommandModule(activeEditorDoc);
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const cancelledToken = makeCancellationToken(true);

        await command.baseFn(activeEditorDoc, pos, cancelledToken);

        assert.strictEqual(stubs.applyEditFn.called, false);
    });

    test("should return early when cursor position cannot be determined", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const cursorStub = Sinon.stub().returns(undefined);
        const stubs = createCommandModule(activeEditorDoc, cursorStub);
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(activeEditorDoc, pos, token);

        assert.strictEqual(stubs.applyEditFn.called, false);
    });

    test("should insert config text and format document when cursor is inside empty array", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const stubs = createCommandModule(activeEditorDoc);
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(activeEditorDoc, pos, token);

        assert.strictEqual(stubs.applyEditFn.calledOnce, true);
        assert.strictEqual(stubs.fakeWorkspaceEditInsert.calledOnce, true);
        assert.strictEqual(stubs.execCommandFn.calledWith("editor.action.formatDocument"), true);
    });

    test("should pass BeforeCursor comma position when comma precedes cursor", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const isCommaStub = Sinon.stub().returns(true);
        const textStub = Sinon.stub().returns('{"type":"reactnative"}');
        const stubs = createCommandModule(
            activeEditorDoc,
            Sinon.stub().returns("AfterItem"),
            isCommaStub,
            textStub,
        );
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(activeEditorDoc, pos, token);

        assert.strictEqual(
            textStub.calledWith(stubs.fakeConfig, "AfterItem", "BeforeCursor"),
            true,
        );
    });

    test("should pass undefined comma position when no comma precedes cursor", async function () {
        const activeEditorDoc = { uri: "launch.json" } as any;
        const isCommaStub = Sinon.stub().returns(false);
        const textStub = Sinon.stub().returns('{"type":"reactnative"}');
        const stubs = createCommandModule(
            activeEditorDoc,
            Sinon.stub().returns("AfterItem"),
            isCommaStub,
            textStub,
        );
        const command = stubs.SelectAndInsertDebugConfiguration.formInstance();
        const pos = makePosition(0, 1);
        const token = makeCancellationToken();

        await command.baseFn(activeEditorDoc, pos, token);

        assert.strictEqual(textStub.calledWith(stubs.fakeConfig, "AfterItem", undefined), true);
    });
});
