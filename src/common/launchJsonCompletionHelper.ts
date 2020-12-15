// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { DebugConfiguration, TextDocument, Position, Range } from "vscode";
import { createScanner, parse, SyntaxKind } from "jsonc-parser";

export type PositionOfCursor = "InsideEmptyArray" | "BeforeItem" | "AfterItem";
type PositionOfComma = "BeforeCursor";

export class LaunchJsonCompletionHelper {
    /**
     * Gets the string representation of the debug config for insertion in the document.
     * Adds necessary leading or trailing commas (remember the text is added into an array).
     * @param {DebugConfiguration} config
     * @param {PositionOfCursor} cursorPosition
     * @param {PositionOfComma} [commaPosition]
     * @returns
     * @memberof LaunchJsonCompletionItemProvider
     */
    public static getTextForInsertion(
        config: DebugConfiguration,
        cursorPosition: PositionOfCursor,
        commaPosition?: PositionOfComma,
    ): string {
        const json = JSON.stringify(config);
        if (cursorPosition === "AfterItem") {
            // If we already have a comma immediatley before the cursor, then no need of adding a comma.
            return commaPosition === "BeforeCursor" ? json : `,${json}`;
        }
        if (cursorPosition === "BeforeItem") {
            return `${json},`;
        }
        return json;
    }

    public static getCursorPositionInConfigurationsArray(
        document: TextDocument,
        position: Position,
    ): PositionOfCursor | undefined {
        if (this.isConfigurationArrayEmpty(document)) {
            return "InsideEmptyArray";
        }
        const scanner = createScanner(document.getText(), true);
        scanner.setPosition(document.offsetAt(position));
        const nextToken = scanner.scan();
        if (nextToken === SyntaxKind.CommaToken || nextToken === SyntaxKind.CloseBracketToken) {
            return "AfterItem";
        }
        if (nextToken === SyntaxKind.OpenBraceToken) {
            return "BeforeItem";
        }

        return;
    }

    public static isCommaImmediatelyBeforeCursor(
        document: TextDocument,
        position: Position,
    ): boolean {
        const line = document.lineAt(position.line);
        // Get text from start of line until the cursor.
        const currentLine = document.getText(new Range(line.range.start, position));
        if (currentLine.trim().endsWith(",")) {
            return true;
        }
        // If there are other characters, then don't bother.
        if (currentLine.trim().length !== 0) {
            return false;
        }

        // Keep walking backwards until we hit a non-comma character or a comm character.
        let startLineNumber = position.line - 1;
        while (startLineNumber > 0) {
            const lineText = document.lineAt(startLineNumber).text;
            if (lineText.trim().endsWith(",")) {
                return true;
            }
            // If there are other characters, then don't bother.
            if (lineText.trim().length !== 0) {
                return false;
            }
            startLineNumber -= 1;
            continue;
        }
        return false;
    }

    private static isConfigurationArrayEmpty(document: TextDocument): boolean {
        const configuration = parse(document.getText(), [], {
            allowTrailingComma: true,
            disallowComments: false,
        }) as {
            configurations: [];
        };
        return (
            !configuration ||
            !Array.isArray(configuration.configurations) ||
            configuration.configurations.length === 0
        );
    }
}
