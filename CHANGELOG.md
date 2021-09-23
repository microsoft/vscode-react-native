## 1.7.0
* Fixed certificates for Network inspector feature forwarding on Windows [#1661](https://github.com/microsoft/vscode-react-native/pull/1661)
* Improved expo dependencies management [#1665](https://github.com/microsoft/vscode-react-native/pull/1665)
* Improved extension security [#1658](https://github.com/microsoft/vscode-react-native/pull/1658), [#1662](https://github.com/microsoft/vscode-react-native/pull/1662), [#1670](https://github.com/microsoft/vscode-react-native/pull/1670)
* Internal changes:
    * Migrated to async/await API [#1637](https://github.com/microsoft/vscode-react-native/pull/1637)


## 1.6.1
* Improved error logging on debugging [#1633](https://github.com/microsoft/vscode-react-native/pull/1633)
* Improved parsing of `sdk.dir` parameter in Android `local.properties` [#1643](https://github.com/microsoft/vscode-react-native/pull/1643)
* Fixed typos in error messages, thanks to [Alexander Sklar(@asklar)](https://github.com/asklar) [#1648](https://github.com/microsoft/vscode-react-native/pull/1648)
* Enhanced documentation about extension commands usage [#1649](https://github.com/microsoft/vscode-react-native/pull/1649)
* Improved tips notifications functionality [#1642](https://github.com/microsoft/vscode-react-native/pull/1642)
* Added a settings parameter for controlling the version of the `@expo/ngrok` package [#1652](https://github.com/microsoft/vscode-react-native/pull/1652)
* Improved extension security [#1635](https://github.com/microsoft/vscode-react-native/pull/1635), [#1640](https://github.com/microsoft/vscode-react-native/pull/1640), [#1641](https://github.com/microsoft/vscode-react-native/pull/1641)


## 1.6.0
* Added support of debugging of React Native for Windows Hermes applications: [more info](https://github.com/microsoft/vscode-react-native#windows-hermes-debugging) [#1624](https://github.com/microsoft/vscode-react-native/pull/1624)
* Added tips about rarely used extension features [#1610](https://github.com/microsoft/vscode-react-native/pull/1610)
* Updated documentation about `ios-deploy` installation, thanks to [Lucas Johnston(@lucasjohnston)](https://github.com/lucasjohnston) [#1611](https://github.com/microsoft/vscode-react-native/pull/1611)
* Implemented debugging of Expo Hermes applications [#1608](https://github.com/microsoft/vscode-react-native/pull/1608)
* Added context variables to configure custom key bindings with [`when` clauses](https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts) for pair extension commands [#1606](https://github.com/microsoft/vscode-react-native/pull/1606)
* Improved extension security [#1625](https://github.com/microsoft/vscode-react-native/pull/1625)
* Internal changes:
    * Smoke tests were updated to work with VS Code 1.58.1 [#1609](https://github.com/microsoft/vscode-react-native/pull/1609)


## 1.5.2
* Added the `sourceMapRenames` parameter to debugging configurations [#1602](https://github.com/microsoft/vscode-react-native/pull/1602)
* Implemented debugging mode control for macOS apps [#1589](https://github.com/microsoft/vscode-react-native/pull/1589)
* Added the `sourceMapPathOverrides` parameter to launch debugging configurations [#1589](https://github.com/microsoft/vscode-react-native/pull/1589)
* Implemented settings parameters for controlling versions of the `xdl` and `@expo/metro-config` packages [#1578](https://github.com/microsoft/vscode-react-native/pull/1578)
* Added `Run Windows` and `Run MacOS` Command Palette commands for running RNW and RNmacOS apps [#1576](https://github.com/microsoft/vscode-react-native/pull/1576)
* Improved extension security [#1587](https://github.com/microsoft/vscode-react-native/pull/1587), [#1592](https://github.com/microsoft/vscode-react-native/pull/1592), [#1593](https://github.com/microsoft/vscode-react-native/pull/1593), [#1594](https://github.com/microsoft/vscode-react-native/pull/1594)
* Internal changes:
    * Adapted new VS Code API version for creating Packager status indicator on the status bar [#1597](https://github.com/microsoft/vscode-react-native/pull/1597)


## 1.5.1
* Improved debugging on remote Android devices [#1577](https://github.com/microsoft/vscode-react-native/pull/1577)
* Fixed getting React Native version in cases `projectRoot` has been customized [#1583](https://github.com/microsoft/vscode-react-native/pull/1583)
* Improved extension security [#1581](https://github.com/microsoft/vscode-react-native/pull/1581), [#1579](https://github.com/microsoft/vscode-react-native/pull/1579)


## 1.5.0
* Removed support of the deprecated WPF platform [#1554](https://github.com/microsoft/vscode-react-native/pull/1554)
* Improved Expo tunnel debugging and set default Expo host type as `lan` [#1556](https://github.com/microsoft/vscode-react-native/pull/1556)
* Added support of the `--appIdSuffix` flag to `runArguments` for Android apps [#1549](https://github.com/microsoft/vscode-react-native/pull/1549)
* Implemented Network Inspector [#1550](https://github.com/microsoft/vscode-react-native/pull/1550)
* Improved multiroot workspace support [#1540](https://github.com/microsoft/vscode-react-native/pull/1540)
* Improved error handling for building React Native for Windows apps [#1560](https://github.com/microsoft/vscode-react-native/pull/1560)
* Improved extension security [#1565](https://github.com/microsoft/vscode-react-native/pull/1565)
* Implemented support of [Workspace Trust feature](https://github.com/microsoft/vscode-react-native/issues/1559) [#1563](https://github.com/microsoft/vscode-react-native/pull/1563)
* Configured support of [virtual workspaces](https://github.com/microsoft/vscode-react-native/issues/1562) [#1570](https://github.com/microsoft/vscode-react-native/pull/1570)
* Internal changes:
    * Updated code coverage checking functional [#1570](https://github.com/microsoft/vscode-react-native/pull/1570)
    * Stabilized Expo smoke tests [#1568](https://github.com/microsoft/vscode-react-native/pull/1568)


## 1.4.2
* Added support for debugging AppleTV apps, thanks to [Michele Bonazza(@micheleb)](https://github.com/micheleb) [#1498](https://github.com/microsoft/vscode-react-native/pull/1498)
* Improved extension security [#1538](https://github.com/microsoft/vscode-react-native/pull/1538), [#1527](https://github.com/microsoft/vscode-react-native/pull/1527), [#1547](https://github.com/microsoft/vscode-react-native/pull/1547)
* Resolved a conflict with [vscode-jest](https://github.com/jest-community/vscode-jest) extension while fast refreshing React Native apps [#1530](https://github.com/microsoft/vscode-react-native/pull/1530)
* Migrated from `@expo/xdl` package to `xdl` package for debugging Expo applications [#1532](https://github.com/microsoft/vscode-react-native/pull/1532)
* Internal changes:
    * Improved sending error events to Telemetry [#1526](https://github.com/microsoft/vscode-react-native/pull/1526)


## 1.4.1
* Fixed resolving of custom file extensions while starting the packager for Expo [#1502](https://github.com/microsoft/vscode-react-native/pull/1502)
* Updated documentation for debugging RNW apps [#1513](https://github.com/microsoft/vscode-react-native/pull/1513)
* Enhanced extension security [#1521](https://github.com/microsoft/vscode-react-native/pull/1521), [#1505](https://github.com/microsoft/vscode-react-native/pull/1505), [#1520](https://github.com/microsoft/vscode-react-native/pull/1520)
* Internal changes:
    * Smoke tests refactoring [#1507](https://github.com/microsoft/vscode-react-native/pull/1507)


## 1.4.0
* Added support of debugging of React Native macOS Hermes applications: [more info](https://github.com/microsoft/vscode-react-native#macos-hermes-debugging) [#1495](https://github.com/microsoft/vscode-react-native/pull/1495)
* Added support of debugging of React Native iOS Hermes applications: [more info](https://github.com/microsoft/vscode-react-native#ios-hermes-debugging) [#1488](https://github.com/microsoft/vscode-react-native/pull/1488)
* Fixed attachment to the packager after a previous failed attempt to attach to it [#1489](https://github.com/microsoft/vscode-react-native/pull/1489)


## 1.3.0
* Enhanced creation of debugging configurations. Now debugging configurations are generated interactively. You just need to click on `React Native` button in the IntelliSense prompt in `launch.json` file and then select required parameters in selection panels [#1468](https://github.com/microsoft/vscode-react-native/pull/1468)
* Added a notification with a link to the CHANGELOG after the extension update [#1476](https://github.com/microsoft/vscode-react-native/pull/1476)
* Fixed the bug with incorrect recursive deletion of paths when activating the extension [#1481](https://github.com/microsoft/vscode-react-native/pull/1481)
* Improved extension security [#1472](https://github.com/microsoft/vscode-react-native/pull/1472)
* Enhanced contributing guide and documentation about debugging React Native for Windows and macOS applications [#1477](https://github.com/microsoft/vscode-react-native/pull/1477), [#1469](https://github.com/microsoft/vscode-react-native/pull/1469)
* Internal changes:
    * Fixed ESLint issues in the code and added Prettier support [#1463](https://github.com/microsoft/vscode-react-native/pull/1463), [#1475](https://github.com/microsoft/vscode-react-native/pull/1475)


## 1.2.0
* Added `Run React Native LogCat Monitor` and `Stop React Native LogCat Monitor` Command Palette commands. These commands allow to control LogCat outputs monitoring and create monitors for Android devices on demand. See [more information here](https://github.com/microsoft/vscode-react-native#configure-an-android-logcat-monitor) [#1461](https://github.com/microsoft/vscode-react-native/pull/1461)
* Updated documentation for cases when React Native projects are opened via symbolic links on Linux. This might cause sourcemaps breakage, so it is not recommended [#1459](https://github.com/microsoft/vscode-react-native/pull/1459)
* Internal changes:
    * Smoke tests improvements [#1441](https://github.com/microsoft/vscode-react-native/issues/1441)


## 1.1.1
* Updated the extension supported languages for breakpoints in order to work with the latest VS Code API [#1451](https://github.com/microsoft/vscode-react-native/pull/1451)


## 1.1.0
* Added React Native macOS debugging support: [more info](https://github.com/microsoft/vscode-react-native#react-native-for-macos) [#1409](https://github.com/microsoft/vscode-react-native/pull/1409)
* Added support for `openExpoQR` debugging argument determining whether to open a tab with a QR code after launching the Expo server or not. Enhanced the workflow for Expo server starting [#1413](https://github.com/microsoft/vscode-react-native/pull/1413)
* Fixed launch scenarios for iOS direct debugging [#1430](https://github.com/microsoft/vscode-react-native/pull/1430)
* Values in the `target` debug scenario argument are no longer replaced by UDID in case the existing simulator name is already used there [#1431](https://github.com/microsoft/vscode-react-native/pull/1431)
* Fixed minor extension issues [#1424](https://github.com/microsoft/vscode-react-native/issues/1424), [#1425](https://github.com/microsoft/vscode-react-native/issues/1425)


## 1.0.1
* Fixed issue connected to incorrect project caching when the `projectRoot` argument is used in `settings.json`


## 1.0.0
* Added `sourcemaps` parameters for Direct debugging scenarios [#1395](https://github.com/microsoft/vscode-react-native/pull/1395)
* Fixed the `Debug Windows` scenario for React Native Windows applications v0.63 [#1395](https://github.com/microsoft/vscode-react-native/pull/1395), [#1412](https://github.com/microsoft/vscode-react-native/pull/1412)
* Implemented experimental support of iOS direct debugging. It could be used in next versions of React Native with support of [TurboModules](https://github.com/react-native-community/discussions-and-proposals/issues/40) and [Hermes engine for iOS](https://github.com/facebook/hermes/issues/34) [#1367](https://github.com/microsoft/vscode-react-native/pull/1367)
* Implemented selection of iOS and Android emulators for launch and run scenarios and Command Palette commands [#1361](https://github.com/microsoft/vscode-react-native/pull/1361), [#1374](https://github.com/microsoft/vscode-react-native/pull/1374)
* Implemented automatic launch of the packager in `attach` scenarios in case it is not running yet [#1320](https://github.com/microsoft/vscode-react-native/pull/1320)
* Added scenarios (`Run Android, Run iOS, etc`) to run applications without debugging [#1319](https://github.com/microsoft/vscode-react-native/pull/1319)
* Minor logging improvement [#1392](https://github.com/microsoft/vscode-react-native/pull/1392), [#1330](https://github.com/microsoft/vscode-react-native/pull/1330)
* Updated documentation
* The minimum supported version of VS Code has been increased from `1.31.0` to `1.40.0`
* Internal changes:
    * Migrated from the [`vscode-node-debug2`](https://github.com/microsoft/vscode-node-debug2) debugger to [`js-debug`](https://github.com/microsoft/vscode-js-debug) one
    * Integrated the debug adapter directly inside the extension, which allows VS Code to connect to it instead of launching a new external debug adapter per extension's debugging session. See [`DebugAdapterDescriptorFactory`](https://code.visualstudio.com/api/extension-guides/debugger-extension#alternative-approach-to-develop-a-debugger-extension) approach for more details
    * Improved debug sessions control
    * Added Webpack bundling for the extension [#1308](https://github.com/microsoft/vscode-react-native/pull/1308)
    * Got rid of Q promises [#1354](https://github.com/microsoft/vscode-react-native/pull/1354)


## 0.17.0
* Enhanced extension security [#1339](https://github.com/microsoft/vscode-react-native/pull/1339), [#1350](https://github.com/microsoft/vscode-react-native/pull/1350), [#1355](https://github.com/microsoft/vscode-react-native/pull/1355), [#1362](https://github.com/microsoft/vscode-react-native/pull/1362)
* Updated extension troubleshooting for the Expo debugging case [#1338](https://github.com/microsoft/vscode-react-native/pull/1338)
* Fixed the Github organisation name capitalization in URLs to the repository, thanks to [Frieder Bluemle(@friederbluemle)](https://github.com/friederbluemle) [#1324](https://github.com/microsoft/vscode-react-native/pull/1324)
* Updated Packager statusbar indicator representation [#1340](https://github.com/microsoft/vscode-react-native/pull/1340), [#1353](https://github.com/microsoft/vscode-react-native/pull/1353):
    * Now there are two representations available: `Full` and `Short`. To change it add `react-native.packager.status-indicator` property with a value `Full` for full representation or `Short` for icon only mode. [More info](https://github.com/microsoft/vscode-react-native/pull/1353).


## 0.16.1
* Improved extension security [#1310](https://github.com/microsoft/vscode-react-native/pull/1310), [#1329](https://github.com/microsoft/vscode-react-native/pull/1329)
* Fixed the incorrect handling of spaces in `adb` path from `local.properties` [#1326](https://github.com/microsoft/vscode-react-native/pull/1326)
* Internal changes:
    * Migrated from TSLint to ESLint [#1315](https://github.com/microsoft/vscode-react-native/pull/1315)
    * Implemented service for running different checks of the extension work [#1309](https://github.com/microsoft/vscode-react-native/pull/1309), [#1322](https://github.com/microsoft/vscode-react-native/pull/1322)
    * Smoke tests were updated to work with VS Code 1.45.1 and Expo SDK 38


## 0.16.0
* Improved extension security [#1253](https://github.com/microsoft/vscode-react-native/pull/1253)
* Updated extension license to MIT [#1286](https://github.com/microsoft/vscode-react-native/pull/1286)
* Fixed fonts usage with Expo SDK 37 [#1260](https://github.com/microsoft/vscode-react-native/pull/1260), [#1264](https://github.com/microsoft/vscode-react-native/pull/1264)
* Increased packager starting time and fixed handling of StatusBar items click [#1268](https://github.com/microsoft/vscode-react-native/pull/1268)
* Fixed links in Table of Contents and typos, thanks to [Max von Webel(@343max)](https://github.com/343max) [#1284](https://github.com/microsoft/vscode-react-native/pull/1284)
* Internal changes:
    * Migrated unit tests to vscode-test [#1256](https://github.com/microsoft/vscode-react-native/pull/1256)
    * Updated smoke tests docs [#1281](https://github.com/microsoft/vscode-react-native/pull/1281)


## 0.15.0
* Improved extension security [#1227](https://github.com/microsoft/vscode-react-native/pull/1227)
* Added an option to add environment variables to the React Native packager process. [More info](https://github.com/microsoft/vscode-react-native#custom-environment-variables) [#1248](https://github.com/microsoft/vscode-react-native/pull/1248)
* Readme extension homepage has been updated [#1243](https://github.com/microsoft/vscode-react-native/pull/1243), [#1250](https://github.com/microsoft/vscode-react-native/pull/1250), [#1251](https://github.com/microsoft/vscode-react-native/pull/1251)
* Minor logging improvement [#1237](https://github.com/microsoft/vscode-react-native/pull/1237)
* Internal changes:
    * Added YAML Azure Pipelines support for the extension repository
    * Smoke tests were updated to work with React Native 0.62 and Expo SDK 37


## 0.14.2
* Improved extension security [#1219](https://github.com/microsoft/vscode-react-native/pull/1219), [#1222](https://github.com/microsoft/vscode-react-native/pull/1222), [#1223](https://github.com/microsoft/vscode-react-native/pull/1223), [#1224](https://github.com/microsoft/vscode-react-native/pull/1224)
* Updated extension dependencies [#1224](https://github.com/microsoft/vscode-react-native/pull/1224)
* Added support for running iOS debugging on a specific device using flag `target: 'device=<iOS_device_name>'`. [More info](https://github.com/microsoft/vscode-react-native/blob/master/doc/debugging.md#debugging-on-ios-device). [#1207](https://github.com/microsoft/vscode-react-native/pull/1207)
* Fixed launch of iOS apps with custom project's configuration: custom scheme name, custom app bundle name. [#1213](https://github.com/microsoft/vscode-react-native/pull/1213)


## 0.14.1
* Implemented Expo debugging without mandatory logging in and Internet connection [#1188](https://github.com/microsoft/vscode-react-native/issues/1188)
    * Added `expoHostType` parameter to Expo debug scenario configuration. See the [documentation](https://github.com/microsoft/vscode-react-native#react-native-debug-configuration-properties) for more details
* Fixed iOS debugging according to [XCode build caching changes in React Native CLI v3.1.0](https://github.com/react-native-community/cli/releases/tag/v3.1.0) [#1198](https://github.com/microsoft/vscode-react-native/issues/1198)

## 0.14.0
* Enhanced extension security [#1171](https://github.com/microsoft/vscode-react-native/pull/1171)
* Deps: `vscode-chrome-debug-core@6.8.8` [#1193](https://github.com/microsoft/vscode-react-native/pull/1193)
* Enhanced extension logging [#1175](https://github.com/microsoft/vscode-react-native/pull/1175)
* Added `Debug Windows` scenario configuration to extension's debug scenarios configurations layouts ([#1189](https://github.com/microsoft/vscode-react-native/pull/1189), [#1191](https://github.com/microsoft/vscode-react-native/pull/1191)), thanks to [David Serafimov(@nasadigital)](https://github.com/nasadigital)
* Fixed typos in documentation ([#1190](https://github.com/microsoft/vscode-react-native/pull/1190)), thanks to [Ivan Tse(@ivantse)](https://github.com/ivantse)
* Enhanced React Native Hermes applications debugging [#1099](https://github.com/microsoft/vscode-react-native/issues/1099) ([#548](https://github.com/microsoft/vscode-chrome-debug-core/pull/548))
    * Fixed incorrect displaying of `Global`, `Closure` variables
    * Fixed incorrect displaying of value of numeric variables
    * Fixed incorrect displaying of `this` object content
    * Fixed incorrect handling of arrays on debugging
    * Fixed displaying of redundant React Native Hermes native functions calls in Call Stack [#1187](https://github.com/microsoft/vscode-react-native/pull/1187)
* Internal changes:
    * Enhanced smoke tests workflow ([#1180](https://github.com/microsoft/vscode-react-native/pull/1180))
    * Enhanced extension telemetry ([#1175](https://github.com/microsoft/vscode-react-native/pull/1175))

## 0.13.2
* Added support for Haul packager 0.15 [#1166](https://github.com/microsoft/vscode-react-native/pull/1166)
* Fixed security vulnerability [#1165](https://github.com/microsoft/vscode-react-native/pull/1165)

## 0.13.1
* Fixed command palette commands execution in cases when `projectRoot` has been customized [#1160](https://github.com/microsoft/vscode-react-native/pull/1160)

## 0.13.0
* The algorithm of processing React Native CLI commands was changed, the [following changes were made](https://github.com/microsoft/vscode-react-native/pull/1093):
  * Extension can now work without the `react-native-cli` installed globally. Now it uses local CLI from `react-native` package installed in `node_modules` of the React Native project
  * Added `reactNativeGlobalCommandName` property support to `settings.json` that is allowing to switch between locally installed CLI and global ones ([more info](https://github.com/microsoft/vscode-react-native/blob/master/doc/customization.md#setting-up-react-native-global-cli))
  * Added error handling in cases if React Native package is not installed in `node_modules`
* Added additional verbose mode error logging in cases if `settings.json` file is incorrect or absent [#1148](https://github.com/microsoft/vscode-react-native/pull/1148)
* Fixed --project-path React Native command argument handling for iOS [#1143](https://github.com/microsoft/vscode-react-native/pull/1143)
* Fixed Hermes debug scenarios quick configurations names [#1140](https://github.com/microsoft/vscode-react-native/pull/1140)
* Fixed `port` argument handling for launch and attach Hermes debug scenarios [#1140](https://github.com/microsoft/vscode-react-native/pull/1140)
* Added support for `@expo/xdl` greater than 56.1 [#1155](https://github.com/microsoft/vscode-react-native/pull/1155), [@expo/expo-cli#864](https://github.com/expo/expo-cli/issues/864)
* Improved extension security [#1145](https://github.com/microsoft/vscode-react-native/pull/1145)

## 0.12.1
* Fixed debugging issues with React Native 0.61 applications if some additional packages were installed, such as `react-native-navigation` or `react-native-splash-screen`

## 0.12.0
* Added experimental support for React Native Android applications on Hermes engine. Experimental means that the debugger is on early stage of development and some bugs can be revealed. If you tried experimental feature and would like to provide feedback, please post it to [Github issue](https://github.com/microsoft/vscode-react-native/issues/1099).
* Added support for React Native 0.61 [#1122](https://github.com/microsoft/vscode-react-native/pull/1122)
* Added wait phase for initializing React Native app bundle sourcemaps to avoid breakpoints skip on application initialization [#1081](https://github.com/microsoft/vscode-react-native/issues/1081)
* Added [inline breakpoints feature](https://github.com/microsoft/vscode/issues/31612) support
* Improved extension security [#1125](https://github.com/microsoft/vscode-react-native/pull/1125)

## 0.11.2
* Fixed `Attach to packager` debugging issue when Haul packager is being used [#1108](https://github.com/microsoft/vscode-react-native/issues/1108)
* Optimized extension activation events [#1114](https://github.com/microsoft/vscode-react-native/pull/1114)

## 0.11.1
* Fixed debugging issue when using `broadcast-channels` package in React Native application [#1083](https://github.com/microsoft/vscode-react-native/issues/1083)
* Added `launchActivity` debug configuration parameter for Android allowing to choose the activity to launch on `Debug Android` scenario [#1084](https://github.com/microsoft/vscode-react-native/pull/1084)
* Added error handling for some specific cases [#1086](https://github.com/microsoft/vscode-react-native/pull/1086)
* Optimized extension activation events [#1103](https://github.com/microsoft/vscode-react-native/pull/1103)

## 0.11.0
* Fixed the folder `.vscode/.react` isn't created when opening directory with nested RN project
* Fixed usage of removed `-v` option for `react-native` command from @react-native-community/cli
* Updated extension translation
* [Internal] Improved smoke tests workflow

## 0.10.2
* Fixed security vulnerabilities ([#1050](https://github.com/microsoft/vscode-react-native/pull/1050), [#1052](https://github.com/microsoft/vscode-react-native/pull/1052), [#1055](https://github.com/microsoft/vscode-react-native/pull/1055))
* Fixed readme markup ([#1051](https://github.com/microsoft/vscode-react-native/pull/1051))

## 0.10.1
* Added support for React Native 0.60 ([#1043](https://github.com/microsoft/vscode-react-native/pull/1043))
* Fixed `diff` security vulnerability ([#1029](https://github.com/microsoft/vscode-react-native/pull/1029))
* `program` debug configuration property is deprecated and will be removed in future, please remove it from debug configurations and replace it by `"cwd": "${workspaceFolder}"`
* Added documentation for debug configurations properties ([#1040](https://github.com/microsoft/vscode-react-native/pull/1040))

## 0.10.0
* Added support for Expo SDK 33 ([#1025](https://github.com/microsoft/vscode-react-native/pull/1025))
* Simplified `launch.json` debug configuration file generation, added debug configuration provider UI which allows to choose needed debug configurations ([#830](https://github.com/microsoft/vscode-react-native/issues/830))
* `outDir` debug configuration property was removed, `sourceMaps` property was excluded from initial debug configurations and set to `true` if not specified explicitly ([#1033](https://github.com/microsoft/vscode-react-native/pull/1033))
* Changed `Reload App` Command Pallete command approach for Android ([#1016](https://github.com/microsoft/vscode-react-native/pull/1016)), thanks to [Alter Code(@muhamad-rizki)](https://github.com/muhamad-rizki)
* Fixed some logging typos ([#1018](https://github.com/microsoft/vscode-react-native/pull/1018)), thanks to [Adam Krantz(@akrantz)](https://github.com/akrantz)

## 0.9.3
* Fixed `Show Dev Menu` and `Reload App` Command Pallette commands for iOS ([#978](https://github.com/microsoft/vscode-react-native/issues/978))
* Fixed debugging functionality on Node.js 12 due to deprecating of Node cli argument `--debug-brk` ([#1000](https://github.com/microsoft/vscode-react-native/issues/1000))
* Fixed scheme configuration variable handling for iOS native apps, added instruction for using `scheme` variable ([#989](https://github.com/microsoft/vscode-react-native/issues/989))
* Added debug configuration setup instruction[(#986)](https://github.com/microsoft/vscode-react-native/pull/986), thanks to [Peadar Coyle(@springcoil)](https://github.com/springcoil)
* Changed extension publisher from `vsmobile` to `msjsdiag`

## 0.9.2
* Fixed issue when using `console.trace()` caused error on native app [#974](https://github.com/microsoft/vscode-react-native/issues/974)
* Fixed [tar security vulnerabilities](https://www.npmjs.com/advisories/803)
* Fixed logging for `attach` event
* Updated documentation

## 0.9.1
* Added debugger configuration parameter `debuggerWorkerUrlPath` that provides the ability to change path to the React Native `debuggerWorker.js` file [#947](https://github.com/microsoft/vscode-react-native/issues/947)
* Fixed [js-yaml security vulnerability](https://www.npmjs.com/advisories/788)
* Bumped debug core dependencies versions to the more recent ones
* Fixed wording for "Run Android on Emulator" command, thanks to [Frieder Bluemle(@friederbluemle)](https://github.com/friederbluemle)

## 0.9.0
* Finished localization of the extension
* Bumped debug core dependencies versions to the more recent ones
* Fixed debugging issue on iOS due to changes in building process in RN 0.59
* Fixed several documentation wordings, thanks to [Kristian Sakarisson (@Sakarisson)](https://github.com/Sakarisson), [Brendan McGill (@brendanmc6)](https://github.com/brendanmc6)
* Other minor improvements

## 0.8.0
* Improved extension security
* Improved error logging
* Improved Expo login workflow
* Added warning if RN application is being ran using `Debug In Exponent` configuration and `expo` package is not installed [#882](https://github.com/microsoft/vscode-react-native/issues/882)
* Fixed debugger url problem for haul projects [#875](https://github.com/microsoft/vscode-react-native/issues/875)
* Added localization for next languages:
    * Chinese Simplified
    * Chinese Traditional
    * Japanese
    * Korean
    * German
    * French
    * Spanish
    * Russian
    * Italian
    * Czech
    * Turkish
    * Portuguese
    * Polish

**Some localizations may not be completed, they will be updated in future**

## 0.7.0
* Added `Run Element Inspector` command that runs standalone [React Developer Tools](https://github.com/facebook/react-devtools)
* Migrate to [WebView Api](https://code.visualstudio.com/docs/extensions/webview) instead of using deprecated `vscode.previewHtml` command
* Added minimal externalization support for Italian language
* Moved to Azure pipelines builds instead of Travis CI for pull requests validation
* Replaced deprecated dependency gulp-util
* Updated documentation: improved `Debugging React Native applications` section and Expo instructions

## 0.6.18
* Fix parsing `sdk.dir` in `android/local.properties` on Windows machines

## 0.6.17
* Return changes from 0.6.14 - 0.6.15
* Added support for react-native versions >= 0.57
* Bug fixes

## 0.6.16
* Reverted to the state of 0.6.13

## 0.6.15
* Fixed critical issue with android debugging introduced in 0.6.14

## 0.6.14
* Added reading SDK location from `local.properties`
* Added support for building iOS apps with custom configuration names
* Bug fixes and improvements

## 0.6.13
* Fixed "Inverified breakpoint" error while debugging apps with RN >= 0.54.3 < 0.55
* Fixed issue with ignoring getAssetExts() in rn-cli.config.js during debugging
* Fixed leaking global variable "process.versions" from debugger process to worker

## 0.6.12
* Added debugger for WPF platform(react-native-windows > 0.55.0)
* Minor bug fixes and improvements

## 0.6.11
* Fixed activation event promises handling
* Fixed "connect ENOENT *.sock" error during debugging from within non React Native project root
* Minor bug fixes and improvements

## 0.6.10
* Minor fixes and improvements

## 0.6.9
* Migrated CodePush functionality to App Center extension for VS Code

## 0.6.8
* Bug fixes

## 0.6.7
* Bug fixes

## 0.6.6
* Bug fixes

## 0.6.5
* Fixed issue with SourceMaps generation for RN 0.54.x

## 0.6.4
* Narrow down activation events for extension
* Remove local file dependencies for code-push libs from package.json
* Bug fixes

## 0.6.3
* Updated README

## 0.6.2
* Fixed issue with finding index{os}.js file

## 0.6.1
* Fixed issue with detecting react-native-code-push
* Minor fixes

## 0.6.0
* Added support for react-native-code-push commands

## 0.5.7
* Bug fixes

## 0.5.6
* Bug fixes

## 0.5.4
* Bug fixes

## 0.5.3
* Environment Variable setting for debug configurations
* Improved multi-root workspaces support
* Bug fixes

## 0.5.2
* Added support React-Native 0.50 and greater

## 0.5.1
* Bug fixes

## 0.5.0
* Multi-root workspaces support
* Debugging for Haxe project
* Some bugs fixed

## 0.4.4
* Fixed issue with Run iOS on device

## 0.4.3
* Added custom packager port support
* Added separate channels for logs output
* Added Reload App and Open Dev Menu commands
* Added launch options to attach to remote packager

## 0.4.2
* Fixed annoying error message when app's entry point is not `index.<platform>.js`
* Added `runArguments` [configuration option](doc/customization.md#specifying-custom-arguments-for-react-native-run--command) to allow passing custom arguments to `react-native run-*` commands
* Reorganized documentation structure
* Switched to direct usage of React Native CLI instead of `ideviceinstaller` to run iOS
* Fixed automatic enable of JS debugging on iOS simulator

## 0.4.1
* Added notice about `.vscode/.react` directory (#505)
* Fixed bug in typescript sourcemaps rewrite logic when project and vscode are on different drives
* Fixed regression causing `react-native` commands ran from command palette to fail
* Fixed regression causing debugging to fail when start debugging Expo project first time

## 0.4.0
* Fixed issue with infinite loops when reloading RN app
* Fixed compatibility issues with react-native >=0.45
* Added more robust sourcemaps support to enable Typescript debugging
* Added instructions to enable Flowtype intellisense
* Fixed error "Error processing 'continue'" appearing when reloading app while staying on breakpoint
* Added “scheme” option to `launch.json` to pass build scheme to xcodebuild
* Improved LogCat logging - now reusing existing output channel when possible
* Refactored extension to support debugging of Expo and CRNA apps better (#478)
* Added support for displaying Expo's QR code

## 0.3.2
* Rename launch.json snippets to make it easier to add React Native launch configurations to existing `launch.json`
* Fix regressions in app worker introduced after moving to 'node2' debugger
* Fix bug with loading assets in exponent and upgrade XDL
* Prevent unhandled rejection warnings to be logged to debug console when breakpoints are not set up successfully
* Prefer `xcworkspace` files over `xcodeproj` when launching `xcodebuild`
* Updated README `.babelrc` instructions

## 0.3.1
* Fixed an issue when no .vscode folder is present in a project
* Added support for launch.json snippets

## 0.3.0
* Updated to use node2 debug engine instead of node. We now spawn a separate node process to run the app logic rather than using node's `vm` infrastructure.
* Fixed support for android variants
* Fixed the ability to open source files by tapping on stack frames when the app red-boxes

## 0.2.5
* Removed `require` from app worker context to work around change in node 7. `__debug__.require` is still present for applications which need it

## 0.2.4
* Allowed using this extension in a workspace with the react-native project in a subfolder.
* Ignore references to inline sourcemaps, in the hopes of finding another reference to a map file
* Exposed `react-native-tools.showInternalLogs` and `react-native-tools.logLevel` to print additional output for debugging issues with the extension.
* Added CHANGELOG.md!

## 0.2.3
* Added a workaround for max-stack issues with react-native 0.37
