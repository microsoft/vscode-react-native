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
