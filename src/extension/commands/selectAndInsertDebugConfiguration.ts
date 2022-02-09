// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { debugConfigProvider } from "../rn-extension";
import { LaunchJsonCompletionHelper } from "../../common/launchJsonCompletionHelper";
import { Command } from "./util/command";

export class SelectAndInsertDebugConfiguration extends Command {
    codeName = "selectAndInsertDebugConfiguration";
    label = "";
    error = ErrorHelper.getInternalError(InternalErrorCode.CommandFailed);

    async baseFn(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ) {
        assert(this.project);

        assert(
            debugConfigProvider && document && position && token,
            ErrorHelper.getInternalError(InternalErrorCode.CommandFailed),
        );

        if (
            !vscode.window.activeTextEditor ||
            vscode.window.activeTextEditor.document !== document
        ) {
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        const config = await debugConfigProvider.provideDebugConfigurationSequentially(
            folder,
            token,
        );

        // #review> token is checked here because of await↑ ? Are we sure it is required like that?
        if (token.isCancellationRequested || !config) {
            return;
        }

        // Always use the first available debug configuration.
        const cursorPosition = LaunchJsonCompletionHelper.getCursorPositionInConfigurationsArray(
            document,
            position,
        );

        if (!cursorPosition) {
            return;
        }

        const commaPosition = LaunchJsonCompletionHelper.isCommaImmediatelyBeforeCursor(
            document,
            position,
        )
            ? "BeforeCursor"
            : undefined;

        const formattedJson = LaunchJsonCompletionHelper.getTextForInsertion(
            config,
            cursorPosition,
            commaPosition,
        );

        const workspaceEdit = new vscode.WorkspaceEdit();

        workspaceEdit.insert(document.uri, position, formattedJson);

        await vscode.workspace.applyEdit(workspaceEdit);

        vscode.commands.executeCommand("editor.action.formatDocument").then(
            () => {},
            () => {},
        );
    }
}
