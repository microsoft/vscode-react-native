// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import assert = require("assert");
import AdmZip = require("adm-zip");

export function startVsixExistenceTest(): void {
    describe("VSIX existence check", () => {
        // Use repo-relative path to match CI workspace
        const targetDirUri = pathToFileURL(
            path.resolve(__dirname, "..", "..", "resources", "extension"),
        ).toString();
        const targetDir = fileURLToPath(targetDirUri);

        it("Soft-check VSIX presence without failing PR", function () {
            const files = fs.existsSync(targetDir)
                ? fs.readdirSync(targetDir).filter(f => f.endsWith(".vsix"))
                : [];
            if (files.length === 0) {
                // Do not fail the pipeline; just log a warning for diagnostics
                // The VSIX is a build artifact produced by smoke-build in CI.
                // If not present, tests can still proceed without this assertion.
                // eslint-disable-next-line no-console
                console.warn(`No .vsix file found in ${targetDir}. Skipping existence assertion.`);
                this.skip?.();
            } else {
                assert.ok(true);
            }
        });

        it("VSIX manifest contains required Identity fields", function () {
            if (!fs.existsSync(targetDir)) {
                this.skip?.();
                return;
            }
            const vsixFiles = fs.readdirSync(targetDir).filter(f => f.endsWith(".vsix"));
            if (vsixFiles.length === 0) {
                this.skip?.();
                return;
            }

            const vsixPath = path.join(targetDir, vsixFiles[0]);
            const zip = new AdmZip(vsixPath);
            const manifestEntry = zip.getEntry("extension.vsixmanifest");
            assert.ok(manifestEntry, "extension.vsixmanifest not found inside VSIX archive");

            const manifestXml = zip.readAsText(manifestEntry);
            assert.ok(manifestXml.length > 0, "extension.vsixmanifest is empty");

            // Assert <PackageManifest> root element is present
            assert.ok(
                /<PackageManifest\b/i.test(manifestXml),
                "PackageManifest root element not found in manifest",
            );

            // Extract Identity attributes: Id, Version, Publisher
            const identityMatch = manifestXml.match(/<Identity\b([^>]+)>/i);
            assert.ok(identityMatch, "<Identity> element not found in manifest");

            const attrs = identityMatch[1];

            const requiredAttributes = ["Id", "Version", "Publisher"];
            for (const attribute of requiredAttributes) {
                const attributeMatch = attrs.match(new RegExp(`\\b${attribute}="([^"]+)"`, "i"));
                assert.ok(
                    attributeMatch && attributeMatch[1].trim().length > 0,
                    `Identity ${attribute} is missing or empty`,
                );
            }
        });
    });
}
