// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import rimraf = require("rimraf");
import * as sinon from "sinon";
import * as extensionHelper from "../../src/common/extensionHelper";
import { Package } from "../../src/common/node/package";
import * as XDL from "../../src/extension/exponent/xdlInterface";
import { PackageLoader, PackageConfig } from "../../src/common/packageLoader";
import { CommandExecutor } from "../../src/common/commandExecutor";
import { HostPlatform } from "../../src/common/hostPlatform";

const packageLoaderTestTimeout = 1000 * 60;
console.log(XDL);

suite("packageLoader", async () => {
    async function getPackageVersionsFromNodeModules(
        projectRoot: string,
        packageName: string,
    ): Promise<string | null> {
        return new Package(projectRoot)
            .getPackageVersionFromNodeModules(packageName)
            .catch(() => null);
    }

    suite("localNodeModules", async () => {
        const sampleProjectPath = path.resolve(
            __dirname,
            "..",
            "resources",
            "sampleReactNative022Project",
        );
        const sampleProjectNodeModulesPath = path.join(sampleProjectPath, "node_modules");
        const sampleProjectPackageLockJsonPath = path.join(sampleProjectPath, "package-lock.json");

        const commandExecutor = new CommandExecutor(
            sampleProjectNodeModulesPath,
            sampleProjectPath,
        );

        let findFileInFolderHierarchyStub: Sinon.SinonStub | undefined;
        let getVersionFromExtensionNodeModulesStub: Sinon.SinonStub | undefined;

        const mkdirpPackageConfig = new PackageConfig("mkdirp", "1.0.4");

        const rimrafPackageFirst = new PackageConfig("rimraf", "3.0.1");
        const rimrafPackageSecond = new PackageConfig("rimraf", "3.0.2");

        const chalkPackageConfig = new PackageConfig("chalk", "4.1.1", "./source/util.js");

        setup(async function () {
            findFileInFolderHierarchyStub = sinon.stub(
                extensionHelper,
                "findFileInFolderHierarchy",
                () => {
                    return sampleProjectNodeModulesPath;
                },
            );
            getVersionFromExtensionNodeModulesStub = sinon.stub(
                extensionHelper,
                "getVersionFromExtensionNodeModules",
                (packageName: string) => {
                    return getPackageVersionsFromNodeModules(sampleProjectPath, packageName);
                },
            );
        });

        teardown(function () {
            this.timeout(packageLoaderTestTimeout);
            findFileInFolderHierarchyStub?.restore();
            getVersionFromExtensionNodeModulesStub?.restore();
            rimraf.sync(sampleProjectNodeModulesPath);
            rimraf.sync(sampleProjectPackageLockJsonPath);
            assert.strictEqual(
                !fs.existsSync(sampleProjectNodeModulesPath) &&
                    !fs.existsSync(sampleProjectPackageLockJsonPath),
                true,
                "Node modules has not been uninstalled from sample directory",
            );
        });

        test("The package loader should install packages in node_modules where these packages are not present", async function () {
            this.timeout(packageLoaderTestTimeout);
            // There is the problem with '--no-save' flag for 'npm install' command for npm v6.
            // Installing npm dependencies with the `--no-save` flag will remove
            // other dependencies that were installed in the same manner (https://github.com/npm/cli/issues/1460).
            // So we should workaround it passing all packages for install to only one npm install command
            const getMkdrip = PackageLoader.getInstance().generateGetPackageFunction<any>(
                mkdirpPackageConfig,
                rimrafPackageFirst,
            );
            const getRimraf = PackageLoader.getInstance().generateGetPackageFunction<any>(
                rimrafPackageFirst,
                mkdirpPackageConfig,
            );
            const packages = await Promise.all([getMkdrip(), getRimraf()]);
            assert.notStrictEqual(
                packages[0] & packages[1],
                undefined,
                "Not all packages has been installed and required",
            );
            const installedVersionOfMkdirp = await getPackageVersionsFromNodeModules(
                sampleProjectPath,
                mkdirpPackageConfig.getPackageName(),
            );
            const installedVersionOfRimraf = await getPackageVersionsFromNodeModules(
                sampleProjectPath,
                rimrafPackageFirst.getPackageName(),
            );
            assert.strictEqual(
                installedVersionOfMkdirp,
                mkdirpPackageConfig.getVersion(),
                `Wrong installed version of ${mkdirpPackageConfig.getPackageName()} package`,
            );
            assert.strictEqual(
                installedVersionOfRimraf,
                rimrafPackageFirst.getVersion(),
                `Wrong installed version of ${rimrafPackageFirst.getPackageName()} package`,
            );
        });

        test("The package loader should not execute installation for packages that are already present in node_modules", async function () {
            this.timeout(packageLoaderTestTimeout);

            await commandExecutor.spawn(HostPlatform.getNpmCliCommand("npm"), [
                "install",
                rimrafPackageFirst.getStringForInstall(),
                "--save-dev",
            ]);
            assert.strictEqual(
                await getPackageVersionsFromNodeModules(
                    sampleProjectPath,
                    rimrafPackageFirst.getPackageName(),
                ),
                rimrafPackageFirst.getVersion(),
                "Package was preinstall with wrong version",
            );

            const tryToRequireAfterInstallStub = sinon.spy(
                PackageLoader.getInstance(),
                "tryToRequireAfterInstall",
            );
            const getRimraf = PackageLoader.getInstance().generateGetPackageFunction<any>(
                rimrafPackageFirst,
            );
            assert.notStrictEqual(await getRimraf(), undefined, "Package was not required");

            assert.strictEqual(
                tryToRequireAfterInstallStub.notCalled,
                true,
                "Package loader executes installation for packages that already exist in node_modules",
            );
            tryToRequireAfterInstallStub.restore();
        });

        test("The package loader should install package with specific version if the package already installed but with another version", async function () {
            this.timeout(packageLoaderTestTimeout);

            await commandExecutor.spawn(HostPlatform.getNpmCliCommand("npm"), [
                "install",
                rimrafPackageFirst.getStringForInstall(),
                "--save-dev",
            ]);
            assert.strictEqual(
                await getPackageVersionsFromNodeModules(
                    sampleProjectPath,
                    rimrafPackageFirst.getPackageName(),
                ),
                rimrafPackageFirst.getVersion(),
                "Package was preinstall with wrong version",
            );

            const tryToRequireAfterInstallStub = sinon.spy(
                PackageLoader.getInstance(),
                "tryToRequireAfterInstall",
            );
            const getRimraf = PackageLoader.getInstance().generateGetPackageFunction<any>(
                rimrafPackageSecond,
            );
            assert.notStrictEqual(await getRimraf(), undefined, "Package was not required");

            assert.strictEqual(
                tryToRequireAfterInstallStub.calledOnce,
                true,
                "Package loader not execute installation for packages that are already present in node_modules but with wrong version",
            );
            tryToRequireAfterInstallStub.restore();

            const installedVersionOfRimraf = await getPackageVersionsFromNodeModules(
                sampleProjectPath,
                rimrafPackageSecond.getPackageName(),
            );
            assert.strictEqual(
                installedVersionOfRimraf,
                rimrafPackageSecond.getVersion(),
                `Wrong installed version of ${rimrafPackageSecond.getPackageName()} package`,
            );
        });

        test("The package loader should install package and require specific subpath for this package", async function () {
            this.timeout(packageLoaderTestTimeout);

            const getChalk = PackageLoader.getInstance().generateGetPackageFunction<any>(
                chalkPackageConfig,
            );
            const chalkPackage = await getChalk();
            assert.notStrictEqual(chalkPackage, undefined, "Package was not required");
            assert.strictEqual(
                !!(chalkPackage.stringReplaceAll && chalkPackage.stringEncaseCRLFWithFirstIndex),
                true,
                "Required package subpath does not contains all members. It means what there are problems with subpath requiring",
            );
        });
    });
});
