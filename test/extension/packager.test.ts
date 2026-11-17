// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";
import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import * as vscode from "vscode";
import { Packager } from "../../src/common/packager";
import { ISpawnResult } from "../../src/common/node/childProcess";
import { PackagerStatus } from "../../src/extension/packagerStatusIndicator";
import { CONTEXT_VARIABLES_NAMES } from "../../src/common/contextVariablesNames";
import { CommandExecutor } from "../../src/common/commandExecutor";
import { ProjectVersionHelper } from "../../src/common/projectVersionHelper";
import { AppLauncher } from "../../src/extension/appLauncher";
import { Request } from "../../src/common/node/request";
import { ExponentHelper } from "../../src/extension/exponent/exponentHelper";
import { FileSystem } from "../../src/common/node/fileSystem";
import { stripJsonTrailingComma } from "../../src/common/utils";
import { rimrafAsync } from "../common/utils";

import assert = require("assert");
import * as sinon from "sinon";

suite("packager", function () {
    suite("process lifecycle", function () {
        class MetroProcess extends EventEmitter implements ChildProcess {
            stdin = new PassThrough();
            stdout = new PassThrough();
            stderr = new PassThrough();
            stdio: ChildProcess["stdio"] = [this.stdin, this.stdout, this.stderr];
            killed = false;
            pid = 12345;
            connected = false;
            exitCode: number | null = null;
            signalCode: string | null = null;
            kill = sinon.spy();
            send = sinon.stub().returns(false);
            disconnect = sinon.spy();
            ref = sinon.spy();
            unref = sinon.spy();
        }

        let packager: Packager;
        let running: boolean;
        let stubs: Sinon.SinonStub[];
        let spawnStub: Sinon.SinonStub;
        let killStub: Sinon.SinonStub;
        let contextStub: Sinon.SinonStub;
        let nextProcess: ReturnType<typeof createProcess>;
        let startupError: Error | undefined;

        function createProcess() {
            const child = new MetroProcess();
            let resolveOutcome!: () => void;
            let rejectOutcome!: (error: Error) => void;
            const result: ISpawnResult = {
                spawnedProcess: child,
                stdin: child.stdin,
                stdout: child.stdout,
                stderr: child.stderr,
                outcome: new Promise<void>((resolve, reject) => {
                    resolveOutcome = resolve;
                    rejectOutcome = reject;
                }),
            };
            return { child, result, resolveOutcome, rejectOutcome };
        }

        setup(function () {
            const projectPath = path.resolve(__dirname, "..", "resources");
            running = false;
            startupError = undefined;
            packager = new Packager(projectPath, projectPath, Packager.DEFAULT_PORT);
            stubs = [
                sinon.stub(packager, "isRunning", async () => running),
                sinon
                    .stub(ProjectVersionHelper, "getReactNativeVersions")
                    .returns(Promise.resolve({ reactNativeVersion: "0.87.1" })),
                sinon
                    .stub(Object.getPrototypeOf(packager), "monkeyPatchOpnForRNPackager")
                    .returns(Promise.resolve()),
                sinon
                    .stub(Object.getPrototypeOf(packager), "stopWithlowNode")
                    .returns(Promise.resolve(false)),
                sinon
                    .stub(Object.getPrototypeOf(packager), "verifiyTSVersion")
                    .returns(Promise.resolve()),
                sinon.stub(packager, "getPackagerArgs").returns(Promise.resolve([])),
                sinon.stub(AppLauncher, "getNodeModulesRootByProjectPath").returns(projectPath),
                sinon
                    .stub(ExponentHelper.prototype, "isExpoManagedApp")
                    .returns(Promise.resolve(false)),
            ];
            spawnStub = sinon.stub(CommandExecutor.prototype, "spawnReactPackager", () => {
                if (startupError) {
                    nextProcess.child.exitCode = 1;
                    nextProcess.rejectOutcome(startupError);
                } else {
                    running = true;
                }
                return nextProcess.result;
            });
            killStub = sinon.stub(CommandExecutor.prototype, "killReactPackager", async () => {
                running = false;
            });
            contextStub = sinon.stub(vscode.commands, "executeCommand").returns(Promise.resolve());
            stubs.push(spawnStub, killStub, contextStub);
        });

        teardown(function () {
            stubs.reverse().forEach(stub => stub.restore());
            packager.getStatusIndicator().dispose();
        });

        function spawn(process: ReturnType<typeof createProcess>): void {
            nextProcess = process;
            startupError = undefined;
        }

        test("restarts after an externally terminated Metro process", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STARTED);

            running = false;
            first.child.signalCode = "SIGTERM";
            first.rejectOutcome(new Error("Metro terminated externally"));
            await Promise.resolve();

            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STOPPED);
            assert(
                contextStub.calledWith(
                    "setContext",
                    CONTEXT_VARIABLES_NAMES.IS_RN_PACKAGER_RUNNING,
                    false,
                ),
            );
            const second = createProcess();
            spawn(second);
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STARTED);
        });

        test("restarts after Metro exits successfully", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            running = false;
            first.child.exitCode = 0;
            first.resolveOutcome();
            await Promise.resolve();

            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STOPPED);
            spawn(createProcess());
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
        });

        test("reports startup failure and allows retry after fixing a configuration error", async function () {
            const failed = createProcess();
            spawn(failed);
            startupError = new Error("METRO_CONFIG_REPRO");

            await assert.rejects(packager.start());
            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STOPPED);
            spawn(createProcess());
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STARTED);
        });

        test("allows stop then start after Metro exits before its outcome is delivered", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            running = false;
            first.child.exitCode = 1;

            assert.strictEqual(await packager.stop(true), true);
            assert.strictEqual(killStub.called, false);
            spawn(createProcess());
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
        });

        test("a delayed outcome from an exited process does not clear a replacement process", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            running = false;
            first.child.exitCode = 1;

            const second = createProcess();
            spawn(second);
            await packager.start();
            first.rejectOutcome(new Error("Delayed exit notification"));
            await Promise.resolve();

            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STARTED);
            await packager.stop(true);
            assert.strictEqual(killStub.firstCall.args[0], second.child);
        });

        test("preserves normal stop and restart behavior", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            assert.strictEqual(await packager.stop(true), true);
            assert.strictEqual(killStub.firstCall.args[0], first.child);
            assert.strictEqual(packager.getPackagerStatus(), PackagerStatus.PACKAGER_STOPPED);
            spawn(createProcess());
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
        });

        test("stops an owned process even when its status endpoint is unavailable", async function () {
            const first = createProcess();
            spawn(first);
            await packager.start();
            running = false;
            await packager.stop(true);
            assert.strictEqual(killStub.firstCall.args[0], first.child);
            spawn(createProcess());
            await packager.start();
            assert.strictEqual(spawnStub.callCount, 2);
        });

        test("does not terminate a packager started outside the extension", async function () {
            running = true;
            await packager.start();
            assert.strictEqual(await packager.stop(true), false);
            assert.strictEqual(spawnStub.called, false);
            assert.strictEqual(killStub.called, false);
        });
    });

    suite("Windows Metro paths", function () {
        const projectPath = "d:\\workspace\\app";
        const nodeModulesRoot = "d:\\workspace";
        const stopBeforeSpawn = new Error("Stop before spawning Metro");
        let stubs: Sinon.SinonStub[];
        let packager: Packager;
        let realpathStub: Sinon.SinonStub;
        let spawnStub: Sinon.SinonStub;
        let nodeModulesRootStub: Sinon.SinonStub;

        setup(function () {
            if (process.platform !== "win32") {
                this.skip();
            }
            stubs = [];
            packager = new Packager(projectPath, projectPath, Packager.DEFAULT_PORT);
            stubs.push(sinon.stub(packager, "isRunning").returns(Promise.resolve(false)));
            stubs.push(
                sinon
                    .stub(ProjectVersionHelper, "getReactNativeVersions")
                    .returns(Promise.resolve({ reactNativeVersion: "0.87.1" })),
            );
            stubs.push(
                sinon
                    .stub(Object.getPrototypeOf(packager), "monkeyPatchOpnForRNPackager")
                    .returns(Promise.resolve()),
            );
            stubs.push(
                sinon
                    .stub(packager, "getPackagerArgs")
                    .returns(Promise.resolve(["--port", "8081"])),
            );
            nodeModulesRootStub = sinon
                .stub(AppLauncher, "getNodeModulesRootByProjectPath")
                .returns(nodeModulesRoot);
            stubs.push(nodeModulesRootStub);
            realpathStub = sinon.stub(fs, "realpath");
            stubs.push(realpathStub);
            spawnStub = sinon
                .stub(CommandExecutor.prototype, "spawnReactPackager")
                .throws(stopBeforeSpawn);
            stubs.push(spawnStub);
        });

        teardown(function () {
            (stubs || []).reverse().forEach(stub => stub.restore());
        });

        test("uses real paths for both Metro cwd and CLI without changing project identity", async function () {
            realpathStub.withArgs(projectPath).returns(Promise.resolve("D:\\workspace\\app"));
            realpathStub.withArgs(nodeModulesRoot).returns(Promise.resolve("D:\\workspace"));

            await assert.rejects(packager.start(), (error: unknown) => error === stopBeforeSpawn);

            const executor = spawnStub.firstCall.thisValue;
            assert.strictEqual(executor.currentWorkingDirectory, "D:\\workspace\\app");
            assert.strictEqual(executor.nodeModulesRoot, "D:\\workspace");
            assert.strictEqual(packager.getProjectPath(), projectPath);
            assert.deepEqual(spawnStub.firstCall.args[0], ["--port", "8081"]);
        });

        test("propagates path resolution errors instead of starting Metro with unsafe paths", async function () {
            const resolutionError = new Error("Cannot resolve project path");
            realpathStub.withArgs(projectPath).returns(Promise.reject(resolutionError));
            realpathStub.withArgs(nodeModulesRoot).returns(Promise.resolve("D:\\workspace"));

            await assert.rejects(packager.start(), (error: unknown) => error === resolutionError);
            assert.strictEqual(spawnStub.called, false);
        });

        async function checkFilesystemPaths(
            prepare: (directory: string) => Promise<{ project: string; root: string }>,
        ): Promise<void> {
            realpathStub.restore();
            stubs.splice(stubs.indexOf(realpathStub), 1);
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rn-metro-paths-"));
            try {
                const { project, root } = await prepare(directory);
                const inputProject = project.replace(/^[A-Z]:/, drive => drive.toLowerCase());
                const inputRoot = root.replace(/^[A-Z]:/, drive => drive.toLowerCase());
                packager = new Packager(inputProject, inputProject, Packager.DEFAULT_PORT);
                stubs.push(sinon.stub(packager, "isRunning").returns(Promise.resolve(false)));
                stubs.push(
                    sinon
                        .stub(packager, "getPackagerArgs")
                        .returns(Promise.resolve(["--port", "8081"])),
                );
                nodeModulesRootStub.returns(inputRoot);

                await assert.rejects(
                    packager.start(),
                    (error: unknown) => error === stopBeforeSpawn,
                );

                const executor = spawnStub.firstCall.thisValue;
                assert.strictEqual(executor.currentWorkingDirectory, await fs.realpath(project));
                assert.strictEqual(executor.nodeModulesRoot, await fs.realpath(root));
                assert.strictEqual(packager.getProjectPath(), inputProject);
                const cli = path.join(
                    executor.nodeModulesRoot,
                    "node_modules",
                    ".bin",
                    "react-native",
                );
                assert.strictEqual(await fs.readFile(cli, "utf8"), "fixture CLI");
            } finally {
                await rimrafAsync(directory, {});
            }
        }

        async function createCli(root: string): Promise<void> {
            const bin = path.join(root, "node_modules", ".bin");
            await fs.mkdir(bin, { recursive: true });
            await fs.writeFile(path.join(bin, "react-native"), "fixture CLI");
        }

        test("normalizes a real project with spaces without losing CLI access", async function () {
            await checkFilesystemPaths(async directory => {
                const project = path.join(directory, "Project With Spaces");
                await createCli(project);
                return { project, root: project };
            });
        });

        test("resolves a real junction to its target for both cwd and CLI", async function () {
            await checkFilesystemPaths(async directory => {
                const target = path.join(directory, "target");
                const project = path.join(directory, "linked-project");
                await createCli(target);
                await fs.symlink(target, project, "junction");
                assert.strictEqual((await fs.lstat(project)).isSymbolicLink(), true);
                assert.notStrictEqual(project, await fs.realpath(project));
                return { project, root: project };
            });
        });

        test("preserves separate project and hoisted CLI roots through a workspace junction", async function () {
            await checkFilesystemPaths(async directory => {
                const target = path.join(directory, "monorepo");
                const root = path.join(directory, "linked-monorepo");
                await createCli(target);
                await fs.mkdir(path.join(target, "packages", "app"), { recursive: true });
                await fs.symlink(target, root, "junction");
                return { project: path.join(root, "packages", "app"), root };
            });
        });

        test("does not resolve paths or spawn Metro when an existing packager is running", async function () {
            packager.isRunning = () => Promise.resolve(true);
            stubs.push(
                sinon
                    .stub(Object.getPrototypeOf(packager), "stopWithlowNode")
                    .returns(Promise.resolve(false)),
                sinon
                    .stub(Object.getPrototypeOf(packager), "verifiyTSVersion")
                    .returns(Promise.resolve()),
                sinon
                    .stub(Object.getPrototypeOf(packager), "awaitStart")
                    .returns(Promise.resolve()),
            );

            await packager.start();

            assert.strictEqual(realpathStub.called, false);
            assert.strictEqual(spawnStub.called, false);
        });
    });

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
