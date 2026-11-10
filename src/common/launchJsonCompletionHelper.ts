// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import type { DebugConfiguration, TextDocument, Position } from "vscode";
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
        const textBeforeCursor = document.getText().slice(0, document.offsetAt(position));
        const scanner = createScanner(textBeforeCursor, true);
        let previousToken = SyntaxKind.EOF;
        let token = scanner.scan();
        while (token !== SyntaxKind.EOF) {
            previousToken = token;
            token = scanner.scan();
        }
        return previousToken === SyntaxKind.CommaToken;
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
