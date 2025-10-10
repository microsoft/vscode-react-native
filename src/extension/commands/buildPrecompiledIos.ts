// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { spawn } from "child_process";
import * as os from "os";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ReactNativeCommand } from "./util/reactNativeCommand";

const logger = OutputChannelLogger.getMainChannel();

export class BuildPrecompiledIOS extends ReactNativeCommand {
    codeName = "buildPrecompiledIOS";
    label = "Build Precompiled iOS Bundle";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        "ReactNativeBuildPrecompiledIOS",
        "React Native: Build Precompiled iOS Bundle",
    );

    async baseFn(): Promise<void> {
        // inside baseFn(): use this implementation to first run pod install with env vars, then run the iOS command

        if (os.platform() !== "darwin") {
            logger.error(
                "iOS precompiled build is not supported on this platform (requires macOS + Xcode).",
            );
            void vscode.window.showErrorMessage(
                "iOS 构建需要 macOS 和 Xcode，请在 Mac 上运行或使用 macOS 构建服务器。",
            );
            throw new Error("PlatformNotSupported: iOS build requires macOS.");
        }

        await new Promise<void>((resolve, reject) => {
            // Step 1: pod install with precompile env vars
            const podEnv = {
                ...process.env,
                RCT_USE_RN_DEP: "1",
                RCT_USE_PREBUILT_RNCORE: "1",
            };

            const pod = spawn("bundle", ["exec", "pod", "install"], {
                shell: true,
                cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/ios`, // run inside ios/ folder, adjust if needed
                env: podEnv,
            });

            pod.stdout?.on("data", (data: Buffer | string) => {
                logger.info(String(data));
            });

            pod.stderr?.on("data", (data: Buffer | string) => {
                logger.error(String(data));
            });

            pod.on("error", (err: Error) => {
                const errMessage = err.message || String(err);
                logger.error(`pod install error: ${errMessage}`);
                void vscode.window.showErrorMessage(`pod install failed: ${errMessage}`);
                reject(err);
            });

            pod.on("exit", (code: number | null) => {
                if (code === 0) {
                    logger.info("pod install finished successfully");
                    // Step 2: now run the npx react-native run-ios with the same env vars (if needed)
                    const runEnv = { ...process.env }; // include any env vars as needed, or reuse podEnv if necessary

                    const child = spawn(
                        "npx",
                        ["react-native", "run-ios", "--use-precompiled-bundle"],
                        {
                            shell: true,
                            cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
                            env: runEnv,
                        },
                    );

                    child.stdout?.on("data", (data: Buffer | string) => {
                        logger.info(String(data));
                    });

                    child.stderr?.on("data", (data: Buffer | string) => {
                        logger.error(String(data));
                    });

                    child.on("error", (err: Error) => {
                        const errMessage = err.message || String(err);
                        logger.error(`react-native run-ios error: ${errMessage}`);
                        void vscode.window.showErrorMessage(`Build failed: ${errMessage}`);
                        reject(err);
                    });

                    child.on("exit", (runCode: number | null, signal: string | null) => {
                        if (runCode === 0) {
                            void vscode.window.showInformationMessage(
                                "iOS precompiled build completed successfully!",
                            );
                            resolve();
                        } else {
                            const msg = `react-native run-ios exited with code ${runCode} ${
                                signal ? `signal ${signal}` : ""
                            }`;
                            logger.error(msg);
                            void vscode.window.showErrorMessage(
                                `Build failed (exit code ${runCode})`,
                            );
                            reject(new Error(msg));
                        }
                    });
                } else {
                    const msg = `pod install exited with code ${code}`;
                    logger.error(msg);
                    void vscode.window.showErrorMessage(`pod install failed (exit code ${code})`);
                    reject(new Error(msg));
                }
            });
        });
    }
}
