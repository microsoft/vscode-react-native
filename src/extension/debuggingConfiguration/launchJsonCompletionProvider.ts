// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as path from "path";
import { getLocation } from "jsonc-parser";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export enum JsonLanguages {
    json = "json",
    jsonWithComments = "jsonc",
}

export class LaunchJsonCompletionProvider implements vscode.CompletionItemProvider {
    private readonly configurationNodeName = "configurations";

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        if (!this.canProvideCompletions(document, position)) {
            return [];
        }

        return [
            {
                command: {
                    command: "reactNative.selectAndInsertDebugConfiguration",
                    title: localize(
                        "SelectReactNativeDebugConfiguration",
                        "Select a React Native debug configuration",
                    ),
                    arguments: [document, position, token],
                },
                documentation: localize(
                    "SelectReactNativeDebugConfiguration",
                    "Select a React Native debug configuration",
                ),
                sortText: "AAAA",
                preselect: true,
                kind: vscode.CompletionItemKind.Enum,
                label: "React Native",
                insertText: new vscode.SnippetString(),
            },
        ];
    }

    private canProvideCompletions(document: vscode.TextDocument, position: vscode.Position) {
        if (path.basename(document.uri.fsPath) !== "launch.json") {
            return false;
        }
        const location = getLocation(document.getText(), document.offsetAt(position));
        // Cursor must be inside the configurations array and not in any nested items.
        // Hence path[0] = array, path[1] = array element index.
        return location.path[0] === this.configurationNodeName && location.path.length === 2;
    }
}
