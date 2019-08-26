# React Native Tools

[![Build status](https://dev.azure.com/vscode-webdiag-extensions/VS%20Code%20WebDiag%20extensions/_apis/build/status/vscode-react-native%20%5Bmaster%5D)](https://dev.azure.com/vscode-webdiag-extensions/VS%20Code%20WebDiag%20extensions/_build/latest?definitionId=2)

This extension provides a development environment for React Native projects.
Using this extension, you can debug your code and quickly run `react-native` commands from the command palette.

![React Native features](images/react-features.gif)

## Getting started

* [Install VS Code](https://code.visualstudio.com).
* [Install the extension](https://code.visualstudio.com/docs/editor/extension-gallery) in VS Code:
  1. Press `Ctrl + Shift + X` (`Cmd + Shift + X` on macOS), wait a moment while the list of available extensions is populated
  2. Type `react-native` and install **React Native Tools**
  3. For more guidance view [VS Code Extension Gallery](https://code.visualstudio.com/docs/editor/extension-gallery)
* If you haven't already, install React Native:
  1. Run `npm install -g react-native-cli` to install React Native CLI
  2. Set up React Native using the steps detailed on the React Native [getting started documentation](https://facebook.github.io/react-native/docs/getting-started.html)
* Open your React Native project root folder in VS Code.

Please notice that the extension uses `.vscode/.react` directory at the project root to store intermediate files required for debugging. Although these files usually get removed after debug session ends, you may want to add this directory to your project's `.gitignore` file.

## Debugging React Native applications

To start debugging create a new debug configuration for your ReactNative app in your `.vscode/launch.json`. Adding a new configuration can be done by opening your `launch.json` file and clicking on `Add Configuration...` button and choosing a relevant debug configuration. All available debug configurations for ReactNative can be accessed by typing in *ReactNative* and picking one from the list populated by Intellisense as shown in the image below.

![Add React Native debug configuration](images/add-debug-configuration.gif)

In case if you haven't created the `.vscode/launch.json` file yet, you can add a whole default debug configuration set. To do that click the debug icon ![Choose React Native debugger](images/debug-view-icon.png) in the View bar, and then click the configuration (gear) icon ![Configure-gear](images/configure-gear-icon.png), then choose the React Native debug environment.

![Choose React Native debugger](images/choose-debugger.png)

VS Code will generate a `launch.json` in your project with some default configuration settings as shown below. You can safely close this file, choose the appropriate configuration in the Configuration dropdown, and then press F5 (or click _Green Arrow_ ![Configure-gear](images/debug-icon.png) button) to start debugging your app in VS Code.

![React Native launch targets](images/debug-targets.png)

Once app is loaded and ran, [open Developer Menu](https://facebook.github.io/react-native/docs/debugging#accessing-the-in-app-developer-menu) inside your application and enable remote debugging by clicking on `Debug JS Remotely` button.

![React Native enable remote debug](images/enable-remote-debug.png)

You can debug your app on an Android emulator, Android device or iOS simulator. This extension provides [experimental support](doc/debugging.md#debugging-on-ios-device) for iOS devices.

More information about debugging using VS Code can be found in this [guide](https://code.visualstudio.com/docs/editor/debugging).

See [Setting up debug environment](doc/debugging.md) for more details.

## React Native debug configuration properties

|Name |Description|Type|Defaults|
|---|---|---|---|
|`cwd`|The path to the project root folder|`string`|`${workspaceFolder}`|
|`sourceMaps`|Whether to use JavaScript source maps to map the generated bundled code back to its original sources|`boolean`|`true`|
|`sourceMapPathOverrides`|A set of mappings for rewriting the locations of source files from what the source map says, to their locations on disk. See [Debugging with TypeScript and Haul](https://github.com/Microsoft/vscode-react-native/blob/master/doc/debugging.md#debugging-with-typescript-and-haul) for details|`object`|n/a|
|`trace`|Logging level in debugger process. May be useful for diagnostics. If set to "Trace" all debugger process logs will be available in `Debug Console` output window|`string`|`log`|
|`address`|TCP/IP address of packager to attach to for debugging|`string`|`localhost`|
|`port`|Port of packager to attach to for debugging|`string`|`8081`|
|`remoteRoot`|The source root of the remote host|`string`|`null`|
|`localRoot`|The local source root that corresponds to the 'remoteRoot'|`string`|`${workspaceFolder}`|
|`skipFiles`|An array of file or folder names, or glob patterns, to skip when debugging|`array`|`[]`|
|`debuggerWorkerUrlPath`|Path to the app debugger worker to override. For example, if debugger tries to attach to http://localhost:8081/debugger-ui/debuggerWorker.js and you get 404 error from packager output then you may want to change debuggerWorkerUrlPath to another value suitable for your packager (\"debugger-ui\" will be replaced with the value you provide)|`string`|`debugger-ui/`|
|`platform`|The platform to target. Possible values: `android`, `ios`, `exponent`, `windows`, `wpf`|`string`|n/a|
|`target`|Target to run on. Possible values: `simulator`, `device`, `<Android emulator/device id>`, `<iOS simulator/device name>`|`string`|`simulator`|
|`logCatArguments`|Arguments to be used for LogCat (The LogCat output will appear on an Output Channel). It can be an array such as: `[":S", "ReactNative:V", "ReactNativeJS:V"]`|`array`|`["*:S", "ReactNative:V", "ReactNativeJS:V"]`|
|`runArguments`|Run arguments to be passed to `react-native run-<platform>` command (override all other configuration params)|`array`|n/a|
|`launchActivity`|The activity to be launched for debugging, specifies `--main-activity` parameter in run arguments|`string`|`MainActivity`|
|`env`|Environment variables passed to the debugger and `react-native run-<platform>` command|`object`|`{}`|
|`envFile`|Absolute path to a file containing environment variable definitions|`string`|`${workspaceFolder}/.env`|
|`variant`|A variant to be passed to `react-native run-android`, e.g. use `devDebug` to specify `--variant=devDebug`|`string`|n/a|
|`scheme`|A scheme name to be passed to `react-native run-ios`, e.g. `devDebug` to specify `--scheme=devDebug`|`string`|n/a|
|`productName`|iOS bundle display name e.g. `AwesomeProject` value means that extension will search for `AwesomeProject.app` bundle|`string`|n/a|

## Using React Native commands in the Command Palette

In the Command Palette, type `React Native` and choose a command.

![React Native commands](images/command-palette.png)

The **Run Android** command triggers `react-native run-android` and starts your app for Android.

The **Run iOS** command similarly triggers `react-native run-ios` and starts your app in the iOS simulator (iPhone 6).

The **Packager** commands allow you to start/stop the [**Metro Bundler**](https://github.com/facebook/metro-bundler) (formerly React Packager).

## Using Expo

We support using Expo to run, debug and publish applications. For more details about configuring and debugging Expo applications see [Expo docs](doc/expo.md)

## Build APK and Generate Bundle

You can add VSCode tasks to build an .apk file and generate iOS/Android bundles. See [here](doc/tasks.md) for more info.

## Customization

Extension can be customized for different use cases. Please, follow [Customization](doc/customization.md) section for more details.

## Contributing

Please see our [contributing guide](CONTRIBUTING.md) for more information

## Known Issues

Here is the list of common known issues you may experience while using the extension:

Issue                                | Description
------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------
Debugger doesn't stop at breakpoints | Breakpoints require sourcemaps to be correctly configured. If you are using TypeScript, then make sure to follow the `Getting started` section for how to ensure sourcemaps are correctly set up. Also, similar issues may occur on React Native version `0.58.*` in some special cases (see [#928](https://github.com/Microsoft/vscode-react-native/issues/928), [#907](https://github.com/Microsoft/vscode-react-native/issues/907)), bumping dependencies versions of `react` and `react-native`  package to the more recent ones should resolve these.
'adb: command not found'             | If you receive an error `adb: command not found`, you need to update your system Path to include the location of your *ADB* executable.The *ADB* executable file is located in a subdirectory along with your other Android SDK files.
Targeting iPhone 6 doesn't work      | There was a known issue with React Native ([#5850](https://github.com/facebook/react-native/issues/5850)) but it was fixed. Please upgrade your version of React Native.
Can't communicate with socket pipe    | (Linux only) If you have two workspaces open that only differ in casing, the extension will fail to communicate effectively.
"Add configuration" button doesn't work when trying to add debug configuration to `launch.json` | You may need to have to add in some json to `launch.json` manually. Please, see ([#985](https://github.com/Microsoft/vscode-react-native/issues/985))

[Known-Issues](https://github.com/Microsoft/vscode-react-native/issues?q=is%3Aissue+label%3Aknown-issues) provides a complete list of active and resolved issues.

## Telemetry reporting

VS Code React Native extension collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://www.visualstudio.com/en-us/dn948229) to learn more.

If you don’t wish to send usage data to Microsoft, edit `VSCodeTelemetrySettings.json` file at `~/.vscode-react-native` and add `optIn:false`.

## Code of conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
