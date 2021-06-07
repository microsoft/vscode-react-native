// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import rimraf = require("rimraf");
import * as sinon from "sinon";
import * as extensionHelper from "../../src/common/extensionHelper";
import { Package } from "../../src/common/node/package";
import PackageLoader, { PackageConfig } from "../../src/common/packageLoader";

const packageLoaderTestTimeout = 1000 * 60 * 3;

suite("packageLoader", async () => {
    async function getPackageVersionsFromNodeModules(
        projectRoot: string,
        packageName: string,
    ): Promise<string | undefined> {
        try {
            return new Package(projectRoot).getPackageVersionFromNodeModules(packageName);
        } catch (e) {
            return Promise.resolve(undefined);
        }
    }

    suite("localNodeModules", async () => {
        const sampleProjectPath = path.resolve(
            __dirname,
            "..",
            "resources",
            "sampleReactNative022Project",
        );
        const sampleProjectNodeModulesPath = path.join(sampleProjectPath, "node_modules");
        let findFileInFolderHierarchyStub: Sinon.SinonStub | undefined;

        const mkdirpPackageFirst: PackageConfig = { packageName: "mkdirp", version: "1.0.4" };
        // const mkdirpPackageSecond: PackageConfig = { packageName: "mkdirp", version: "1.0.3" };

        const rimrafPackageFirst: PackageConfig = { packageName: "rimraf", version: "3.0.1" };
        // const rimrafPackageSecond: PackageConfig = { packageName: "rimraf", version: "3.0.2" };

        // const chalkPackageFirst: PackageConfig = { packageName: "chalk", version: "" };
        // const chalkPackageSecond: PackageConfig = { packageName: "chalk", version: "" };

        suiteSetup(async () => {
            findFileInFolderHierarchyStub = sinon.stub(
                extensionHelper,
                "findFileInFolderHierarchy",
                () => {
                    return sampleProjectPath;
                },
            );
        });
        suiteTeardown(async () => {
            findFileInFolderHierarchyStub?.restore();
        });

        teardown(() => {
            rimraf.sync(sampleProjectNodeModulesPath);
            assert.strictEqual(
                fs.existsSync(sampleProjectNodeModulesPath),
                false,
                "Node modules has not been uninstalled from sample directory",
            );
        });

        test("The package loader should install packages in node_modules where these packages are not present", async () => {
            const getMkdrip = PackageLoader.getInstance().generateGetPackageFunction<any>(
                mkdirpPackageFirst,
            );
            const getRimraf = PackageLoader.getInstance().generateGetPackageFunction<any>(
                rimrafPackageFirst,
            );
            const packages = await Promise.all([getMkdrip(), getRimraf()]);
            assert.notStrictEqual(
                packages[0] & packages[1],
                undefined,
                "Not all packages has been installed and requared",
            );
            const installedVersionOfMkdrip = await getPackageVersionsFromNodeModules(
                sampleProjectPath,
                mkdirpPackageFirst.packageName,
            );
            const installedVersionOfRimraf = await getPackageVersionsFromNodeModules(
                sampleProjectPath,
                rimrafPackageFirst.packageName,
            );
            assert.strictEqual(
                installedVersionOfMkdrip,
                mkdirpPackageFirst.version,
                `Wrong installed version of ${mkdirpPackageFirst.packageName} package`,
            );
            assert.strictEqual(
                installedVersionOfRimraf,
                rimrafPackageFirst.version,
                `Wrong installed version of ${rimrafPackageFirst.packageName} package`,
            );
        });
    }).timeout(packageLoaderTestTimeout);
});
