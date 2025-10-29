// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { spawn } from "child_process";
import * as os from "os";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeCommand } from "./util/reactNativeCommand";
// Removed unused import

export class buildPrecompiledIOS extends ReactNativeCommand {
    codeName = "buildPrecompiledIOS";
    label = "Build Precompiled iOS Bundle";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        "ReactNativeBuildPrecompiledIOS",
        "React Native: Build Precompiled iOS Bundle",
    );

    async baseFn(p0: {
        iosFolder: string;
        useBundler: boolean; // 如果项目用 Bundler 管理 Pods，改为 true
        useRnDep: boolean;
        usePrebuiltRnCore: boolean;
        timeoutMs: number;
    }): Promise<void> {
        if (os.platform() !== "darwin") {
            void vscode.window.showErrorMessage("iOS pod install 仅支持在 macOS 上运行。");
            throw new Error("PlatformNotSupported: iOS pod install requires macOS.");
        }

        await this.baseFn({
            iosFolder: "ios",
            useBundler: false, // 如果项目用 Bundler 管理 Pods，改为 true
            useRnDep: true,
            usePrebuiltRnCore: true,
            timeoutMs: 15 * 60 * 1000, // CI 中可适当加大或减小
        });

        // 创建输出通道
        const output = vscode.window.createOutputChannel("React Native iOS Precompiled Build");
        output.show(true);

        // 设置环境变量
        const env = { ...process.env, RCT_USE_PREBUILT_RNCORE: "1" };

        output.appendLine("[Info] 已设置环境变量：RCT_USE_PREBUILT_RNCORE=1");
        output.appendLine("[Info] 开始执行 pod install...");

        // 执行 pod install
        await new Promise<void>((resolve, reject) => {
            const child = spawn("pod", ["install"], {
                cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/ios`,
                env,
                shell: true,
            });

            child.stdout.on("data", data => output.append(data.toString()));
            child.stderr.on("data", data => output.append(data.toString()));

            child.on("close", code => {
                if (code === 0) {
                    output.appendLine("[Success] pod install 完成 ✅");
                    resolve();
                } else {
                    reject(new Error(`pod install 失败，退出码：${code}`));
                }
            });
        });
    }
}
