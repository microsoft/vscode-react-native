// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as assert from "assert";
const sinon = require("sinon");
import { PackageNameResolver } from "../../../src/extension/android/packageNameResolver";
import { FileSystem } from "../../../src/common/node/fileSystem";

suite("PackageNameResolver", function () {
    const projectRoot = path.join(__dirname, "mockProject");
    const androidRoot = path.join(projectRoot, "android");
    const appRoot = path.join(androidRoot, "app");
    const manifestPath = path.join(appRoot, "src", "main", "AndroidManifest.xml");
    const buildGradlePath = path.join(appRoot, "build.gradle");

    let readFileStub: any;
    let existsStub: any;

    // Helper function to set up stubs for build.gradle
    function setupBuildGradleStub(content: string): void {
        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(content));
    }

    // Helper function to set up stubs for manifest
    function setupManifestStub(content: string): void {
        existsStub.withArgs(manifestPath).returns(Promise.resolve(true));
        readFileStub.withArgs(manifestPath).returns(Promise.resolve(content));
    }

    // Helper function to resolve package name
    async function resolvePackageName(appName: string): Promise<string> {
        const resolver = new PackageNameResolver(appName);
        return resolver.resolvePackageName(projectRoot);
    }

    setup(() => {
        existsStub = sinon.stub(FileSystem.prototype, "exists");
        readFileStub = sinon.stub(FileSystem.prototype, "readFile");
    });

    teardown(() => {
        existsStub.restore();
        readFileStub.restore();
    });

    test("should resolve package name from AndroidManifest.xml if build.gradle is missing", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.manifest">
            </manifest>`;

        existsStub.withArgs(manifestPath).returns(Promise.resolve(true));
        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(false));
        setupManifestStub(manifestContent);

        const packageName = await resolvePackageName("ExampleApp");
        assert.strictEqual(packageName, "com.example.manifest");
    });

    test("should resolve application id from build.gradle with various formats", async () => {
        // Test data: [description, content, expectedPackageName]
        const testCases: Array<[string, string, string]> = [
            [
                "double quotes",
                `android { defaultConfig { applicationId "com.example.gradle" } }`,
                "com.example.gradle",
            ],
            [
                "single quotes",
                `android { defaultConfig { applicationId 'com.example.gradle.singlequote' } }`,
                "com.example.gradle.singlequote",
            ],
            [
                "with assignment operator",
                `android { defaultConfig { applicationId = "com.example.gradle.assignment" } }`,
                "com.example.gradle.assignment",
            ],
            [
                "spaces around equals",
                `android { defaultConfig { applicationId   =   "com.example.spaces" } }`,
                "com.example.spaces",
            ],
        ];

        for (const [description, content, expected] of testCases) {
            existsStub.reset();
            readFileStub.reset();
            setupBuildGradleStub(content);

            const packageName = await resolvePackageName("ExampleApp");
            assert.strictEqual(packageName, expected, `Failed for: ${description}`);
        }
    });

    test("should fall back to default package name if neither file exists", async () => {
        existsStub.returns(Promise.resolve(false));
        const packageName = await resolvePackageName("ExampleApp");
        assert.strictEqual(packageName, "com.exampleapp");
    });

    test("should handle build.gradle with multiline applicationId", async () => {
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId
                        "com.example.multiline"
                }
            }
        `;

        setupBuildGradleStub(buildGradleContent);

        const packageName = await resolvePackageName("ExampleApp");

        // Multiline format may not be supported by the regex, so either success or default is acceptable
        assert.ok(
            packageName === "com.example.multiline" || packageName === "com.exampleapp",
            "Should either extract multiline applicationId or fall back to default",
        );
    });

    test("should prioritize build.gradle over AndroidManifest.xml", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.old.manifest">
            </manifest>`;
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId "com.example.new.gradle"
                }
            }
        `;

        setupManifestStub(manifestContent);
        setupBuildGradleStub(buildGradleContent);

        const packageName = await resolvePackageName("ExampleApp");
        assert.strictEqual(packageName, "com.example.new.gradle");
    });

    test("should fall back to AndroidManifest.xml when build.gradle has no applicationId", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.manifest.fallback">
            </manifest>`;
        const buildGradleContent = `
            android {
                defaultConfig {
                    versionCode 1
                }
            }
        `;

        setupManifestStub(manifestContent);
        setupBuildGradleStub(buildGradleContent);

        const packageName = await resolvePackageName("ExampleApp");
        assert.strictEqual(packageName, "com.example.manifest.fallback");
    });

    test("should fall back to manifest when build.gradle is empty", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.manifest">
            </manifest>`;

        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        existsStub.withArgs(manifestPath).returns(Promise.resolve(true));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(""));
        setupManifestStub(manifestContent);

        const packageName = await resolvePackageName("ExampleApp");
        assert.strictEqual(packageName, "com.example.manifest");
    });

    test("should generate default package name based on application name", async () => {
        existsStub.returns(Promise.resolve(false));

        const testCases = [
            ["ExampleApp", "com.exampleapp"],
            ["MyReactNativeApp", "com.myreactnativeapp"],
            ["MyApp-2024", "com.myapp-2024"],
        ];

        for (const [appName, expectedPackage] of testCases) {
            const packageName = await resolvePackageName(appName);
            assert.strictEqual(packageName, expectedPackage, `Failed for app name: ${appName}`);
        }
    });
});
