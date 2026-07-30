// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { InternalErrorCode } from "../../../src/common/error/internalErrorCode";

suite("reopenQRCodeCommand", function () {
    function createCommandModule(qrCodeUrl?: string) {
        const webview = { html: "" };
        const createWebviewPanelStub = Sinon.stub().returns({ webview });
        const parsedUri = {};
        const parseStub = Sinon.stub().returns(parsedUri);
        const getQRCodeUrlStub = Sinon.stub().returns(qrCodeUrl);
        const provideTextDocumentContentStub = Sinon.stub().returns("<html>QR Code</html>");

        class FakeQRCodeContentProvider {
            provideTextDocumentContent = provideTextDocumentContentStub;
        }

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/reopenQRCode", {
            vscode: {
                window: {
                    createWebviewPanel: createWebviewPanelStub,
                },
                ViewColumn: {
                    Two: 2,
                },
                Uri: {
                    parse: parseStub,
                },
            },
            "../qrCodeContentProvider": {
                QRCodeContentProvider: FakeQRCodeContentProvider,
            },
            "../exponent/exponentPlatform": {
                getQRCodeUrl: getQRCodeUrlStub,
            },
            "./util/command": {
                Command: FakeCommand,
            },
        }) as typeof import("../../../src/extension/commands/reopenQRCode");

        return {
            ReopenQRCode: module.ReopenQRCode,
            webview,
            createWebviewPanelStub,
            parsedUri,
            parseStub,
            getQRCodeUrlStub,
            provideTextDocumentContentStub,
        };
    }

    test("should reopen the current Expo QR Code in a webview", async function () {
        const qrCodeUrl = "exp://127.0.0.1:8081";
        const {
            ReopenQRCode,
            webview,
            createWebviewPanelStub,
            parsedUri,
            parseStub,
            provideTextDocumentContentStub,
        } = createCommandModule(qrCodeUrl);
        const command = ReopenQRCode.formInstance();

        await command.baseFn();

        assert.strictEqual(createWebviewPanelStub.calledOnce, true);
        assert.deepStrictEqual(createWebviewPanelStub.firstCall.args, [
            "Expo QR Code",
            "Expo QR Code",
            2,
            {},
        ]);
        assert.strictEqual(parseStub.calledWithExactly(qrCodeUrl), true);
        assert.strictEqual(provideTextDocumentContentStub.calledWithExactly(parsedUri), true);
        assert.strictEqual(webview.html, "<html>QR Code</html>");
    });

    test("should throw when there is no Expo QR Code URL", async function () {
        const {
            ReopenQRCode,
            createWebviewPanelStub,
            parseStub,
            getQRCodeUrlStub,
            provideTextDocumentContentStub,
        } = createCommandModule();
        const command = ReopenQRCode.formInstance();

        await assert.rejects(
            () => command.baseFn(),
            (error: any) => {
                assert.strictEqual(error.errorCode, InternalErrorCode.FailedToReopenQRCode);
                return true;
            },
        );

        assert.strictEqual(getQRCodeUrlStub.calledOnce, true);
        assert.strictEqual(createWebviewPanelStub.called, false);
        assert.strictEqual(parseStub.called, false);
        assert.strictEqual(provideTextDocumentContentStub.called, false);
    });
});
