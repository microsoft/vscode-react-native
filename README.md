# React Native Tools (Preview)
[![Build Status](https://travis-ci.org/Microsoft/vscode-react-native.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-react-native)

This extension provides a development environment for React Native projects.
You can debug your code, quickly run `react-native` commands from the command palette and use IntelliSense to browse objects, functions and parameters for React Native APIs.

![React Native features](images/react-features.gif)

## Getting started

* Install the extension in VS Code (0.10.8+)
* Run `npm install -g react-native-cli` to install React Native CLI (0.1.10+)
* Set up React Native (0.19+) using the steps detailed on the React Native [getting started documentation ](https://facebook.github.io/react-native/docs/getting-started.html)
* Open your React Native project root directory in VS Code.
* (Optional) [Enable IntelliSense](#enabling-intellisense) support (experimental)

## Debugging

### Setup debug environment

Click the debugging icon ![Choose React Native debugger](images/debug-view-icon.png) in the View bar, and then click the configure gear icon ![Configure-gear](images/configure-gear-icon.png) to choose the React Native debug environment.

![Choose React Native debugger](images/choose-debugger.png)

VS Code will generate a `launch.json` in your project with some default configurations such as shown below.

![React Native launch configuration file](images/launch-config.png)

You can modify these configurations or add new ones to the list. You can use other fields in these configurations as well.

For example, you can modify the `target` field to specify the simulator you want to target for iOS debugging.

### Start debug session
To start the debug session, select a configuration from the Configuration dropdown, and then click the start button ![Configure-gear](images/debug-icon.png) (or press F5).

![React Native launch targets](images/debug-targets.png)

You can debug your app on an Android emulator, Android device or iOS simulator. This extension provides [experiemental support](#debugging-on-ios-device) for iOS devices.

More information about debugging using VS Code can be found in this [guide](https://code.visualstudio.com/docs/editor/debugging)

#### Debugging on iOS device
Debugging on iOS device would require following manual steps
* Change the `jsCodeLocation` IP in your app using the steps detailed [here](https://facebook.github.io/react-native/docs/running-on-device-ios.html#accessing-development-server-from-device)
* Choose **Debug iOS** configuration from the Configuration dropdown and press F5.
* Shake the device to open development menu and select "Debug in Chrome"

## Using React Native commands in the Command Palette

In the Command Palette, type ```React Native``` and choose a command.

![React Native commands](images/command-palette.png)

The **Run Android** command triggers ```react-native run-android``` and starts your app for android.

The **Run iOS** command similarly triggers ```react-native run-ios``` and starts your app in iOS simulator (iPhone 6).

The **Packager** commands allow you to start/stop the [**React-packager**](https://github.com/facebook/react-native/tree/master/packager).

## Using IntelliSense

IntelliSense helps you discover objects, functions, and parameters in React Native.

![IntelliSense](images/intellisense.png)

### Enabling IntelliSense
React Native IntelliSense depends on experimental features to support JSX in VS Code.
To enable these experimental features, you will see the following prompt immediately after opening a React Native project.

![IntelliSense prompt](images/intellisense-prompt.png)

This is a one-time prompt and will enable JSX support. You will need to restart VS Code once for changes to take effect.

You can verify that you have Salsa enabled and you have an installed TypeScript version that supports Salsa by checking the status indicator in the Status Bar. This shows that all is OK

![Salsa Enabled](https://code.visualstudio.com/images/January_salsa-status.png)

Once you have enabled IntelliSense by following the above steps, you can start typing in the code editor to see the objects, functions, and parameters of your React Native libraries and your own code.

Here is what happens behind the scenes to enable JSX support

1. The environment variable VSCODE_TSJS=1 is set to enable [Salsa](https://github.com/Microsoft/TypeScript/issues/4789)
2. Salsa requires TypeScript 1.8 but the final 1.8 release isn't available yet. Extension installs `typescript@next` in `~/.vscode`
3. A settings.json file is created in the .vscode directory with typescript.tsdk pointing to the typescript@next install location.
4. A tsconfig.json file is created in the project root with `allowJs: true` to allow TypeScript to process JavaScript files.
5. Typings for React Native are copied into the .vscode directory.

## Known Issues

Here is the list of common known issues you may experience while using the extension

Issue                                | Description
------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------
Debugger doesn't stop at breakpoints | The debugger only works if the packager is started by VS Code. Stop the packager if it is already running outside VSCode.
'adb: command not found'             | If you receive an error `adb: command not found`, you need to update your path variable to include the location of your *ADB* executable.The *ADB* executable file is located in a subdirectory along with your other Android SDK files.
Targeting iPhone 6 doesn't work      | There is a known issue [#5850](https://github.com/facebook/react-native/issues/5850) while running an app targeting iPhone 6

Click [here](https://github.com/Microsoft/vscode-react-native/issues?q=is%3Aopen+is%3Aissue+label%3Apreview-known-issues) for the complete list of known issues.

## Disable telemetry reporting
VS Code React Native extension collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://www.visualstudio.com/en-us/dn948229) to learn more.

If you don’t wish to send usage data to Microsoft, please follow the instructions below to disable its collection.

* Edit VSCodeTelemetrySettings.json file at ~/.vscode-react-native and add `optIn:false`.