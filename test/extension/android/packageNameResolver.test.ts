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

    setup(() => {
        // Mock FileSystem methods
        existsStub = sinon.stub(FileSystem.prototype, "exists");
        readFileStub = sinon.stub(FileSystem.prototype, "readFile");
    });

    teardown(() => {
        if (existsStub) existsStub.restore();
        if (readFileStub) readFileStub.restore();
    });

    test("should resolve package name from AndroidManifest.xml if build.gradle is missing", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.manifest">
            </manifest>`;

        existsStub.withArgs(manifestPath).returns(Promise.resolve(true));
        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(false));
        readFileStub.withArgs(manifestPath).returns(Promise.resolve(manifestContent));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        assert.strictEqual(packageName, "com.example.manifest");
    });

    test("should resolve application id from build.gradle", async () => {
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId "com.example.gradle"
                }
            }
        `;

        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(buildGradleContent));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        // This is expected to fail until the fix is implemented
        assert.strictEqual(packageName, "com.example.gradle");
    });

    test("should prioritize build.gradle applicationId over AndroidManifest.xml package", async () => {
        const manifestContent = `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="com.example.manifest">
            </manifest>`;
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId "com.example.gradle"
                }
            }
        `;

        existsStub.withArgs(manifestPath).returns(Promise.resolve(true));
        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        readFileStub.withArgs(manifestPath).returns(Promise.resolve(manifestContent));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(buildGradleContent));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        // This is expected to fail until the fix is implemented
        assert.strictEqual(packageName, "com.example.gradle");
    });

    test("should resolve application id from build.gradle using single quotes", async () => {
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId 'com.example.gradle.singlequote'
                }
            }
        `;

        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(buildGradleContent));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        assert.strictEqual(packageName, "com.example.gradle.singlequote");
    });

    test("should resolve application id from build.gradle using assignment", async () => {
        const buildGradleContent = `
            android {
                defaultConfig {
                    applicationId = "com.example.gradle.assignment"
                }
            }
        `;

        existsStub.withArgs(buildGradlePath).returns(Promise.resolve(true));
        readFileStub.withArgs(buildGradlePath).returns(Promise.resolve(buildGradleContent));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        assert.strictEqual(packageName, "com.example.gradle.assignment");
    });

    test("should fall back to default package name if neither file exists", async () => {
        existsStub.returns(Promise.resolve(false));

        const resolver = new PackageNameResolver("ExampleApp");
        const packageName = await resolver.resolvePackageName(projectRoot);

        assert.strictEqual(packageName, "com.exampleapp");
    });
});
