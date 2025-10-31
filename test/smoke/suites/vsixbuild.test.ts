import * as fs from "fs";
import * as path from "path";
import assert = require("assert");

export function startVsixExistenceTest(): void {
    describe("VSIX existence check", () => {
        const targetDir = path.resolve(
            process.env.USERPROFILE || process.env.HOME || "",
            "vscode-extensions",
            "vscode-react-native",
            "test",
            "smoke",
            "resources",
            "extension",
        );

        it.only("Verify at least one .vsix file exists in target directory", () => {
            const files = fs.existsSync(targetDir)
                ? fs.readdirSync(targetDir).filter(f => f.endsWith(".vsix"))
                : [];
            assert.ok(files.length > 0, `No .vsix file found in ${targetDir}`);
        });
    });
}
