// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { EventEmitter } from "events";
import proxyquire = require("proxyquire");

suite("downloadHelper", function () {
    type Pipeline = (
        source: unknown,
        destination: unknown,
        callback: (error?: Error | null) => void,
    ) => void;
    type Unlink = (path: string, callback: (error?: NodeJS.ErrnoException) => void) => void;

    function createDownloadHelper(
        pipelineStub: Pipeline,
        unlinkStub: Unlink = () => undefined,
    ): { downloadFile: (url: string, targetFile: string) => Promise<void> } {
        const response = new EventEmitter() as any;
        response.statusCode = 200;
        response.headers = { "content-length": "10" };
        response.resume = () => undefined;

        const request = new EventEmitter() as any;
        request.end = () => undefined;

        const getStub = (_url: string, callback: (value: any) => void) => {
            callback(response);
            return request;
        };

        return proxyquire.noCallThru()("../../src/common/downloadHelper", {
            fs: {
                createWriteStream: () => ({}),
                unlink: unlinkStub,
            },
            https: { get: getStub },
            stream: { pipeline: pipelineStub },
            vscode: { window: { showInformationMessage: () => undefined } },
            "../extension/log/OutputChannelLogger": {
                OutputChannelLogger: {
                    getMainChannel: () => ({ logStream: () => undefined }),
                },
            },
        });
    }

    test("resolves only after the file pipeline finishes", async function () {
        let pipelineCallback: ((error?: Error | null) => void) | undefined;
        const pipelineStub: Pipeline = (_source, _destination, callback) => {
            pipelineCallback = callback;
        };
        const { downloadFile } = createDownloadHelper(pipelineStub);

        let resolved = false;
        const download = downloadFile("https://example.com/expo.apk", "expo.apk").then(() => {
            resolved = true;
        });
        await Promise.resolve();

        assert.strictEqual(resolved, false);
        pipelineCallback?.();
        await download;
        assert.strictEqual(resolved, true);
    });

    test("removes the partial file when the pipeline fails", async function () {
        const pipelineError = new Error("write failed");
        const pipelineStub: Pipeline = (_source, _destination, callback) => {
            callback(pipelineError);
        };
        let removedPath: string | undefined;
        const unlinkStub: Unlink = (path, callback) => {
            removedPath = path;
            callback();
        };
        const { downloadFile } = createDownloadHelper(pipelineStub, unlinkStub);

        await assert.rejects(
            downloadFile("https://example.com/expo.apk", "expo.apk"),
            pipelineError,
        );
        assert.strictEqual(removedPath, "expo.apk");
    });
});
