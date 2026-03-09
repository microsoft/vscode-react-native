// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import assert = require("assert");
import { findFile } from "./helper/utilities";

interface LanguageContribution {
    id: string;
    extensions?: string[];
}

interface GrammarContribution {
    language: string;
    path: string;
    scopeName: string;
}

interface ExtensionPackageJson {
    contributes?: {
        languages?: LanguageContribution[];
        grammars?: GrammarContribution[];
    };
}

function getInstalledExtensionPath(): string {
    const extensionDirectory = path.join(__dirname, "..", ".vscode-test", "extensions");
    const extensionFolder = findFile(extensionDirectory, /^msjsdiag\.vscode-react-native-/);
    assert.ok(extensionFolder, "Installed React Native extension folder was not found.");

    return path.join(extensionDirectory, extensionFolder as string);
}

export function startLogGrammarTests(): void {
    describe("LogGrammarTest", () => {
        it("Verify simplified RN output grammar is contributed in installed extension", async () => {
            const extensionPath = getInstalledExtensionPath();
            const packageJsonPath = path.join(extensionPath, "package.json");
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf-8"),
            ) as ExtensionPackageJson;

            const language = packageJson.contributes?.languages?.find(
                contributedLanguage => contributedLanguage.id === "rn-output-log",
            );
            assert.ok(language, "Language contribution 'rn-output-log' is missing.");
            assert.ok(
                language?.extensions?.includes(".rn-output"),
                "Language contribution does not include '.rn-output' extension.",
            );

            const grammar = packageJson.contributes?.grammars?.find(
                contributedGrammar => contributedGrammar.language === "rn-output-log",
            );

            assert.ok(grammar, "Grammar contribution for 'rn-output-log' is missing.");
            assert.strictEqual(
                grammar?.path,
                "./syntaxes/rn-output-simple.tmGrammar.json",
                "Grammar path does not point to simplified rn output grammar.",
            );
            assert.strictEqual(
                grammar?.scopeName,
                "react-native-tools-output-simple",
                "Grammar scope name is unexpected.",
            );

            const simplifiedGrammarPath = path.join(
                extensionPath,
                "syntaxes",
                "rn-output-simple.tmGrammar.json",
            );
            const legacyGrammarPath = path.join(
                extensionPath,
                "syntaxes",
                "rn-output.tmGrammar.json",
            );

            assert.ok(
                fs.existsSync(simplifiedGrammarPath),
                "Simplified grammar file does not exist in installed extension.",
            );
            assert.ok(
                !fs.existsSync(legacyGrammarPath),
                "Legacy grammar file still exists in installed extension.",
            );
        });
    });
}
