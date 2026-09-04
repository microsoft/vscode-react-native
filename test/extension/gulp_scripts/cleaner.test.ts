// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import proxyquire = require("proxyquire");

suite("cleaner", function () {
    test("waits for cleanup and preserves the VS Code test installation", async function () {
        let resolveDelete: (() => void) | undefined;
        let pathsToDelete: string[] | undefined;
        let deleteOptions: { force?: boolean } | undefined;
        const deletePromise = new Promise<void>(resolve => {
            resolveDelete = resolve;
        });
        const cleaner = proxyquire.noCallThru()("../../../gulp_scripts/cleaner", {
            del: (paths: string[], options: { force?: boolean }) => {
                pathsToDelete = paths;
                deleteOptions = options;
                return deletePromise;
            },
        }) as { clean: () => Promise<void> };

        let completed = false;
        const cleanup = cleaner.clean().then(() => {
            completed = true;
        });
        await Promise.resolve();

        assert.strictEqual(completed, false);
        assert.strictEqual(pathsToDelete?.includes(".vscode-test/"), false);
        assert.deepStrictEqual(deleteOptions, { force: true });

        resolveDelete?.();
        await cleanup;
        assert.strictEqual(completed, true);
    });
});
