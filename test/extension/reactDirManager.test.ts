// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// The module "assert" provides assertion methods from node
import assert = require("assert");
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FileSystem } from "../../src/common/node/fileSystem";
import { ReactDirManager } from "../../src/extension/reactDirManager";

suite("reactDirManager.ts", () => {
    suite("extensionContext", function () {
        suite("ReactDirPath", function () {
            test("Should end with the correct path to the react folder", () => {
                let reactPath = new ReactDirManager("").reactDirPath;

                assert.strictEqual(".react", path.basename(reactPath));
                reactPath = path.dirname(reactPath);
                assert.strictEqual(".vscode", path.basename(reactPath));
            });
        });
    });

    test("Should not follow a symbolic link when setting up the react folder", async () => {
        const testRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "react-dir-manager-"));
        const workspaceRoot = path.join(testRoot, "workspace");
        const targetPath = path.join(testRoot, "target");
        const targetFilePath = path.join(targetPath, "important.txt");
        const manager = new ReactDirManager(workspaceRoot);

        try {
            await fs.promises.mkdir(manager.vscodeDirPath, { recursive: true });
            await fs.promises.mkdir(targetPath);
            await fs.promises.writeFile(targetFilePath, "must not be deleted");
            await fs.promises.symlink(targetPath, manager.reactDirPath, "junction");

            await manager.setup();

            assert.strictEqual(fs.existsSync(targetFilePath), true);
            assert.strictEqual(
                (await fs.promises.lstat(manager.reactDirPath)).isSymbolicLink(),
                false,
            );
        } finally {
            new FileSystem().removePathRecursivelySync(testRoot);
        }
    });

    test("Should not follow a symbolic link when disposing the react folder", async () => {
        const testRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "react-dir-manager-"));
        const workspaceRoot = path.join(testRoot, "workspace");
        const targetPath = path.join(testRoot, "target");
        const targetFilePath = path.join(targetPath, "important.txt");
        const manager = new ReactDirManager(workspaceRoot);

        try {
            await fs.promises.mkdir(manager.vscodeDirPath, { recursive: true });
            await fs.promises.mkdir(targetPath);
            await fs.promises.writeFile(targetFilePath, "must not be deleted");
            await fs.promises.symlink(targetPath, manager.reactDirPath, "junction");

            manager.dispose();

            assert.strictEqual(fs.existsSync(targetFilePath), true);
            await assert.rejects(fs.promises.lstat(manager.reactDirPath), { code: "ENOENT" });
        } finally {
            new FileSystem().removePathRecursivelySync(testRoot);
        }
    });

    test("Should not follow a symbolic link in the parent vscode folder during setup", async () => {
        const testRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "react-dir-manager-"));
        const workspaceRoot = path.join(testRoot, "workspace");
        const targetPath = path.join(testRoot, "target");
        const targetReactPath = path.join(targetPath, ".react");
        const targetFilePath = path.join(targetReactPath, "important.txt");
        const manager = new ReactDirManager(workspaceRoot);

        try {
            await fs.promises.mkdir(workspaceRoot, { recursive: true });
            await fs.promises.mkdir(targetPath, { recursive: true });
            await fs.promises.mkdir(targetReactPath, { recursive: true });
            await fs.promises.writeFile(targetFilePath, "must not be deleted");
            await fs.promises.symlink(targetPath, manager.vscodeDirPath, "junction");

            await assert.rejects(manager.setup(), /symbolic link/);

            assert.strictEqual(fs.existsSync(targetFilePath), true);
            assert.strictEqual(
                (await fs.promises.lstat(manager.vscodeDirPath)).isSymbolicLink(),
                true,
            );
        } finally {
            new FileSystem().removePathRecursivelySync(testRoot);
        }
    });

    test("Should not follow a symbolic link in the parent vscode folder during disposal", async () => {
        const testRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "react-dir-manager-"));
        const workspaceRoot = path.join(testRoot, "workspace");
        const targetPath = path.join(testRoot, "target");
        const targetReactPath = path.join(targetPath, ".react");
        const targetFilePath = path.join(targetReactPath, "important.txt");
        const manager = new ReactDirManager(workspaceRoot);

        try {
            await fs.promises.mkdir(workspaceRoot, { recursive: true });
            await fs.promises.mkdir(targetPath, { recursive: true });
            await fs.promises.mkdir(targetReactPath, { recursive: true });
            await fs.promises.writeFile(targetFilePath, "must not be deleted");
            await fs.promises.symlink(targetPath, manager.vscodeDirPath, "junction");

            manager.dispose();

            assert.strictEqual(fs.existsSync(targetFilePath), true);
            assert.strictEqual(
                (await fs.promises.lstat(manager.vscodeDirPath)).isSymbolicLink(),
                true,
            );
        } finally {
            new FileSystem().removePathRecursivelySync(testRoot);
        }
    });
});
