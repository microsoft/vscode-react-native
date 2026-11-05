// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import assert = require("assert");
import { Node } from "../../src/common/node/node";
import { ReactNativeProjectHelper } from "../../src/common/reactNativeProjectHelper";

suite("ReactNativeProjectHelper", function () {
    const fsHelper = new Node.FileSystem();
    const sampleReactNativeProjectDir = path.join(
        __dirname,
        "..",
        "resources",
        "sampleReactNativeProject",
    );

    suite("isAndroidHermesEnabled", () => {
        const buildGradleFilePath = path.join(
            sampleReactNativeProjectDir,
            "android",
            "app",
            "build.gradle",
        );
        const gradlePropertiesPath = path.join(
            sampleReactNativeProjectDir,
            "android",
            "gradle.properties",
        );

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(buildGradleFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNativeProjectDir, "android"));
        });

        teardown(() => {
            for (const filePath of [buildGradleFilePath, gradlePropertiesPath]) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        });

        for (const [properties, expected] of [
            ["hermesEnabled=true", true],
            ["hermesEnabled=false", false],
            ["  hermesEnabled = true  \r\n", true],
            ["hermesEnabled: true", true],
            ["hermesEnabled=TRUE", true],
            ["hermesEnabled=true\nhermesEnabled=false", false],
            ["hermesEnabled=false\nhermesEnabled=true", true],
            ["# hermesEnabled=true\n! hermesEnabled=true", false],
            ["hermesEnabled=trueSuffix", false],
            ["otherHermesEnabled=true", false],
        ] as const) {
            test(`detects Gradle properties ${JSON.stringify(
                properties,
            )} as ${expected} without build.gradle`, () => {
                fs.writeFileSync(gradlePropertiesPath, properties);
                assert.strictEqual(
                    ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                    expected,
                );
            });
        }

        for (const enabled of [true, false]) {
            test(`prefers hermesEnabled=${enabled} over the opposite legacy value`, () => {
                fs.writeFileSync(gradlePropertiesPath, `hermesEnabled=${enabled}`);
                fs.writeFileSync(
                    buildGradleFilePath,
                    `project.ext.react = [enableHermes: ${!enabled}]`,
                );
                assert.strictEqual(
                    ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                    enabled,
                );
            });
        }

        test("falls back to legacy configuration when the property is absent or commented", () => {
            fs.writeFileSync(
                gradlePropertiesPath,
                "android.useAndroidX=true\n# hermesEnabled=false\n! hermesEnabled=false",
            );
            fs.writeFileSync(buildGradleFilePath, "project.ext.react = [enableHermes: true]");
            assert.strictEqual(
                ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                true,
            );
        });

        for (const content of [
            "// Repro only: enableHermes: true",
            "/* enableHermes: true */",
            "/*\n enableHermes: true,\n*/",
            "// enableHermes: true\nproject.ext.react = [enableHermes: false]",
            'def example = "enableHermes: true"',
            "def example = 'enableHermes: true'",
            "project.ext.react = [enableHermes: trueSuffix]",
        ]) {
            test(`ignores commented, quoted or invalid legacy configuration ${JSON.stringify(
                content,
            )}`, () => {
                fs.writeFileSync(buildGradleFilePath, content);
                assert.strictEqual(
                    ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                    false,
                );
            });
        }

        test("preserves active legacy configuration after strings and comments", () => {
            fs.writeFileSync(
                buildGradleFilePath,
                "def url = 'https://example.com'\n/* enableHermes: false */\n" +
                    "project.ext.react = [enableHermes: true] // active configuration",
            );
            assert.strictEqual(
                ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                true,
            );
        });

        test("returns false when the project root or both configuration files are missing", () => {
            assert.strictEqual(ReactNativeProjectHelper.isAndroidHermesEnabled(""), false);
            assert.strictEqual(
                ReactNativeProjectHelper.isAndroidHermesEnabled(sampleReactNativeProjectDir),
                false,
            );
        });

        test("isAndroidHermesEnabled should return 'true' if Hermes engine is enabled in the build.gradle file", () => {
            const buildGradleFileContent =
                "project.ext.react = [\nenableHermes: true,  // clean and rebuild if changing\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, true);
        });

        test("isAndroidHermesEnabled should return 'false' if Hermes engine is disabled in the build.gradle file", () => {
            const buildGradleFileContent =
                "project.ext.react = [\nenableHermes: false,  // clean and rebuild if changing\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, false);
        });

        test("isAndroidHermesEnabled should return 'false' if the Hermes engine parameter is absent in the build.gradle file", () => {
            const buildGradleFileContent = "project.ext.react = [\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, false);
        });
    });

    suite("isIOSHermesEnabled", () => {
        const podfileFilePath = path.join(sampleReactNativeProjectDir, "ios", "Podfile");

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(podfileFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNativeProjectDir, "ios"));
        });

        test("isIOSHermesEnabled should return 'true' if Hermes engine is enabled in the Podfile file", () => {
            const podfileFileContent =
                "  use_react_native!(\n" +
                "    :path => config[:reactNativePath],\n" +
                "    # to enable hermes on iOS, change `false` to `true` and then install pods\n" +
                "    :hermes_enabled => true\n" +
                "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const iOSHermesEnabled = ReactNativeProjectHelper.isIOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(iOSHermesEnabled, true);
        });

        test("isIOSHermesEnabled should return 'false' if Hermes engine is disabled in the Podfile file", () => {
            const podfileFileContent =
                "  use_react_native!(\n" +
                "    :path => config[:reactNativePath],\n" +
                "    # to enable hermes on iOS, change `false` to `true` and then install pods\n" +
                "    :hermes_enabled => false\n" +
                "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const iOSHermesEnabled = ReactNativeProjectHelper.isIOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(iOSHermesEnabled, false);
        });

        test("isIOSHermesEnabled should return 'false' if the Hermes engine parameter is absent in the Podfile file", () => {
            const podfileFileContent =
                "  use_react_native!(\n" + "    :path => config[:reactNativePath],\n" + "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const iOSHermesEnabled = ReactNativeProjectHelper.isIOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(iOSHermesEnabled, false);
        });
    });

    suite("isMacOSHermesEnabled", () => {
        const podfileFilePath = path.join(sampleReactNativeProjectDir, "macos", "Podfile");

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(podfileFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNativeProjectDir, "macos"));
        });

        test("isMacOSHermesEnabled should return 'true' if the 'hermes_enabled' parameter in the Podfile file is uncommented and equal to 'true'", () => {
            const podfileFileContent =
                "  use_react_native!(\n" +
                "    :path => '../node_modules/react-native-macos',\n" +
                "    # To use Hermes, install the `hermes-engine-darwin` npm package, e.g.:\n" +
                "    #   $ yarn add 'hermes-engine-darwin@~0.5.3'\n" +
                "    #\n" +
                "    # Then enable this option:\n" +
                "    :hermes_enabled => true\n" +
                "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const macOSHermesEnabled = ReactNativeProjectHelper.isMacOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(macOSHermesEnabled, true);
        });

        test("isMacOSHermesEnabled should return 'true' if the \"pod 'hermes'\" parameter in the Podfile file is uncommented", () => {
            const podfileFileContent =
                "  target 'rnmacos62-macOS' do\n" +
                "    platform :macos, '10.13'\n" +
                "    use_native_modules!\n" +
                "    # Enables Hermes\n" +
                "    #\n" +
                "    # Be sure to first install the `hermes-engine-darwin` npm package, e.g.:\n" +
                "    #\n" +
                "    #   $ yarn add 'hermes-engine-darwin@^0.4.3'\n" +
                "    #\n" +
                "    pod 'React-Core/Hermes', :path => '../node_modules/react-native-macos/'\n" +
                "    pod 'hermes', :path => '../node_modules/hermes-engine-darwin'\n" +
                "    pod 'libevent', :podspec => '../node_modules/react-native-macos/third-party-podspecs/libevent.podspec'\n" +
                "    # Pods specifically for macOS target\n" +
                "  end\n";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const macOSHermesEnabled = ReactNativeProjectHelper.isMacOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(macOSHermesEnabled, true);
        });

        test("isMacOSHermesEnabled should return 'false' if the 'hermes_enabled' parameter in the Podfile file is commented and equal to 'true'", () => {
            const podfileFileContent =
                "  use_react_native!(\n" +
                "    :path => '../node_modules/react-native-macos',\n" +
                "    # To use Hermes, install the `hermes-engine-darwin` npm package, e.g.:\n" +
                "    #   $ yarn add 'hermes-engine-darwin@~0.5.3'\n" +
                "    #\n" +
                "    # Then enable this option:\n" +
                "    #   :hermes_enabled => true\n" +
                "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const macOSHermesEnabled = ReactNativeProjectHelper.isMacOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(macOSHermesEnabled, false);
        });

        test("isMacOSHermesEnabled should return 'false' if the Hermes engine parameter is absent in the Podfile file", () => {
            const podfileFileContent =
                "  use_react_native!(\n" +
                "    :path => '../node_modules/react-native-macos',\n" +
                "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const macOSHermesEnabled = ReactNativeProjectHelper.isMacOSHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(macOSHermesEnabled, false);
        });
    });

    suite("isWindowsHermesEnabled", () => {
        const experimentalFeaturesFilePath = path.join(
            sampleReactNativeProjectDir,
            "windows",
            "ExperimentalFeatures.props",
        );

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(experimentalFeaturesFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNativeProjectDir, "windows"));
        });

        test("isWindowsHermesEnabled should return 'true' if Hermes engine is enabled in the ExperimentalFeatures.props file", () => {
            const experimentalFeaturesFileContent =
                '  <PropertyGroup Label="Microsoft.ReactNative Experimental Features">\n' +
                "    <!--\n" +
                "      Enables default usage of Hermes.\n" +
                "      \n" +
                "      See https://microsoft.github.io/react-native-windows/docs/hermes\n" +
                "    -->\n" +
                "    <UseHermes>true</UseHermes>\n" +
                "    <UseWinUI3>false</UseWinUI3>\n" +
                "  </PropertyGroup>";
            fs.writeFileSync(experimentalFeaturesFilePath, experimentalFeaturesFileContent);

            const windowsHermesEnabled = ReactNativeProjectHelper.isWindowsHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(windowsHermesEnabled, true);
        });

        test("isWindowsHermesEnabled should return 'fasle' if Hermes engine is disabled in the ExperimentalFeatures.props file", () => {
            const experimentalFeaturesFileContent =
                '  <PropertyGroup Label="Microsoft.ReactNative Experimental Features">\n' +
                "    <!--\n" +
                "      Enables default usage of Hermes.\n" +
                "      \n";
            "      See https://microsoft.github.io/react-native-windows/docs/hermes\n" +
                "    -->\n" +
                "    <UseHermes>false</UseHermes>\n" +
                "    <UseWinUI3>false</UseWinUI3>\n" +
                "  </PropertyGroup>";
            fs.writeFileSync(experimentalFeaturesFilePath, experimentalFeaturesFileContent);

            const windowsHermesEnabled = ReactNativeProjectHelper.isWindowsHermesEnabled(
                sampleReactNativeProjectDir,
            );

            assert.strictEqual(windowsHermesEnabled, false);
        });

        test("isWindowsHermesEnabled should return 'fasle' if there is no the ExperimentalFeatures.props file", () => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNativeProjectDir, "windows"));
            const windowsHermesEnabled = ReactNativeProjectHelper.isWindowsHermesEnabled(
                sampleReactNativeProjectDir,
            );
            assert.strictEqual(windowsHermesEnabled, false);
        });
    });

    suite("verifyMetroConfigFile", () => {
        test("Should not throw an error for verifyMetroConfigFile function", async () => {
            try {
                ReactNativeProjectHelper.verifyMetroConfigFile(sampleReactNativeProjectDir);
            } catch (err) {
                assert.fail(err as any);
            }
        });
    });
});
