// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import * as assert from "assert";
import { Node } from "../../src/common/node/node";
import { ReactNativeProjectHelper } from "../../src/common/reactNativeProjectHelper";

suite("ReactNativeProjectHelper", function () {
    const fsHelper = new Node.FileSystem();
    const sampleReactNative022ProjectDir = path.join(
        __dirname,
        "..",
        "resources",
        "sampleReactNative022Project",
    );

    suite("isAndroidHermesEnabled", () => {
        const buildGradleFilePath = path.join(
            sampleReactNative022ProjectDir,
            "android",
            "app",
            "build.gradle",
        );

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(buildGradleFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(
                path.join(sampleReactNative022ProjectDir, "android"),
            );
        });

        test("isAndroidHermesEnabled should return 'true' if Hermes engine is enabled in the build.gradle file", () => {
            const buildGradleFileContent =
                "project.ext.react = [\nenableHermes: true,  // clean and rebuild if changing\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, true);
        });

        test("isAndroidHermesEnabled should return 'false' if Hermes engine is disabled in the build.gradle file", () => {
            const buildGradleFileContent =
                "project.ext.react = [\nenableHermes: false,  // clean and rebuild if changing\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, false);
        });

        test("isAndroidHermesEnabled should return 'false' if the Hermes engine parameter is absent in the build.gradle file", () => {
            const buildGradleFileContent = "project.ext.react = [\n]";
            fs.writeFileSync(buildGradleFilePath, buildGradleFileContent);

            const androidHermesEnabled = ReactNativeProjectHelper.isAndroidHermesEnabled(
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(androidHermesEnabled, false);
        });
    });

    suite("isIOSHermesEnabled", () => {
        const podfileFilePath = path.join(sampleReactNative022ProjectDir, "ios", "Podfile");

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(podfileFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "ios"));
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
                sampleReactNative022ProjectDir,
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
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(iOSHermesEnabled, false);
        });

        test("isIOSHermesEnabled should return 'false' if the Hermes engine parameter is absent in the Podfile file", () => {
            const podfileFileContent =
                "  use_react_native!(\n" + "    :path => config[:reactNativePath],\n" + "  )";
            fs.writeFileSync(podfileFilePath, podfileFileContent);

            const iOSHermesEnabled = ReactNativeProjectHelper.isIOSHermesEnabled(
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(iOSHermesEnabled, false);
        });
    });

    suite("isMacOSHermesEnabled", () => {
        const podfileFilePath = path.join(sampleReactNative022ProjectDir, "macos", "Podfile");

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(podfileFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "macos"));
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
                sampleReactNative022ProjectDir,
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
                sampleReactNative022ProjectDir,
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
                sampleReactNative022ProjectDir,
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
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(macOSHermesEnabled, false);
        });
    });

    suite("isWindowsHermesEnabled", () => {
        const experimentalFeaturesFilePath = path.join(
            sampleReactNative022ProjectDir,
            "windows",
            "ExperimentalFeatures.props",
        );

        suiteSetup(() => {
            fsHelper.makeDirectoryRecursiveSync(path.dirname(experimentalFeaturesFilePath));
        });

        suiteTeardown(() => {
            fsHelper.removePathRecursivelySync(
                path.join(sampleReactNative022ProjectDir, "windows"),
            );
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
                sampleReactNative022ProjectDir,
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
                sampleReactNative022ProjectDir,
            );

            assert.strictEqual(windowsHermesEnabled, false);
        });

        test("isWindowsHermesEnabled should return 'fasle' if there is no the ExperimentalFeatures.props file", () => {
            fsHelper.removePathRecursivelySync(
                path.join(sampleReactNative022ProjectDir, "windows"),
            );
            const windowsHermesEnabled = ReactNativeProjectHelper.isWindowsHermesEnabled(
                sampleReactNative022ProjectDir,
            );
            assert.strictEqual(windowsHermesEnabled, false);
        });
    });
});
