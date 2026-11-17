// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import type { DebugConfiguration, Position, TextDocument } from "vscode";
import { parse, ParseError } from "jsonc-parser";
import { LaunchJsonCompletionHelper } from "../../src/common/launchJsonCompletionHelper";

suite("LaunchJsonCompletionHelper", function () {
    const config: DebugConfiguration = {
        name: "New configuration",
        type: "reactnativedirect",
        request: "attach",
    };
    const existing = JSON.stringify({ ...config, name: "Existing configuration" });

    function fixture(beforeCursor: string, afterCursor: string) {
        const text = beforeCursor + afterCursor;
        const lines = beforeCursor.split("\n");
        const position = {
            line: lines.length - 1,
            character: lines[lines.length - 1].length,
        } as Position;
        const document: Pick<TextDocument, "getText" | "offsetAt"> = {
            getText: () => text,
            offsetAt: () => beforeCursor.length,
        };
        return { document: document as TextDocument, position };
    }

    const separators = [
        { name: "same-line comma", text: ", ", hasComma: true },
        { name: "comma before blank lines", text: ",\n\n    ", hasComma: true },
        { name: "comma before a line comment", text: ",\n// staging\n    ", hasComma: true },
        {
            name: "comma before a trailing line comment",
            text: ", // staging\n    ",
            hasComma: true,
        },
        {
            name: "comma before a multiline block comment",
            text: ",\n/* staging\nconfiguration */\n    ",
            hasComma: true,
        },
        {
            name: "comma before mixed comments and whitespace",
            text: ",\r\n// staging\r\n\r\n/* another configuration */\r\n    ",
            hasComma: true,
        },
        { name: "no comma", text: "\n    ", hasComma: false },
        {
            name: "line comment ending with a comma but no separator",
            text: "\n// staging,\n    ",
            hasComma: false,
        },
        {
            name: "block comment containing a comma but no separator",
            text: "\n/* staging, */\n    ",
            hasComma: false,
        },
    ];

    for (const { name, text, hasComma } of separators) {
        test(`should insert valid JSONC after ${name}`, function () {
            const beforeCursor = `{"version":"0.2.0","configurations":[${existing}${text}`;
            const afterCursor = "\n]}";
            const { document, position } = fixture(beforeCursor, afterCursor);
            assert.strictEqual(
                LaunchJsonCompletionHelper.isCommaImmediatelyBeforeCursor(document, position),
                hasComma,
            );
            const cursorPosition =
                LaunchJsonCompletionHelper.getCursorPositionInConfigurationsArray(
                    document,
                    position,
                );
            assert.strictEqual(cursorPosition, "AfterItem");
            const inserted = LaunchJsonCompletionHelper.getTextForInsertion(
                config,
                cursorPosition,
                hasComma ? "BeforeCursor" : undefined,
            );
            const errors: ParseError[] = [];
            const result = parse(beforeCursor + inserted + afterCursor, errors, {
                allowTrailingComma: true,
            });
            assert.deepStrictEqual(errors, []);
            assert.deepStrictEqual(result.configurations, [JSON.parse(existing), config]);
        });
    }

    test("should ignore tokens after the cursor on the same line", function () {
        const { document, position } = fixture(`{"configurations":[${existing}, `, `${existing}]}`);
        assert.strictEqual(
            LaunchJsonCompletionHelper.isCommaImmediatelyBeforeCursor(document, position),
            true,
        );
    });

    test("should not treat a comma inside a string as a separator", function () {
        const { document, position } = fixture('{"name":"staging," ', "}");
        assert.strictEqual(
            LaunchJsonCompletionHelper.isCommaImmediatelyBeforeCursor(document, position),
            false,
        );
    });

    for (const beforeItem of [false, true]) {
        test(`should preserve insertion ${
            beforeItem ? "before an item" : "in an empty array"
        }`, function () {
            const beforeCursor = '{"configurations":[ /* staging */ ';
            const afterCursor = beforeItem ? `${existing}]}` : "]}";
            const { document, position } = fixture(beforeCursor, afterCursor);
            const cursorPosition =
                LaunchJsonCompletionHelper.getCursorPositionInConfigurationsArray(
                    document,
                    position,
                );
            assert.strictEqual(cursorPosition, beforeItem ? "BeforeItem" : "InsideEmptyArray");
            const inserted = LaunchJsonCompletionHelper.getTextForInsertion(config, cursorPosition);
            const errors: ParseError[] = [];
            const result = parse(beforeCursor + inserted + afterCursor, errors);
            assert.deepStrictEqual(errors, []);
            assert.deepStrictEqual(
                result.configurations,
                beforeItem ? [config, JSON.parse(existing)] : [config],
            );
        });
    }
});
