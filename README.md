# React Native Tools (Preview)

This extension provides a development environment for React Native projects.
You can debug your code, quickly run `react-native` commands from the command palette and use IntelliSense to browse objects, functions and parameters for React Native APIs.

![React Native features](images/react-features.gif)

## Getting started

* Install the extension in VS Code (0.10.8+)
* Run `npm install -g react-native-cli` to install React Native CLI (0.1.10+)
* Set up React Native (0.19+) using the steps detailed on the React Native [getting started documentation ](https://facebook.github.io/react-native/docs/getting-started.html)
* Open your React Native project root directory in VS Code.
* (Optional) [Enable IntelliSense](#enabling-intellisense) support (experimental)

## Setup debug environment

Click the debugging icon ![Choose React Native debugger](images/debug-view-icon.png) in the View bar, and then click the configure gear icon ![Configure-gear](images/configure-gear-icon.png) to choose the React Native debug environment.

![Choose React Native debugger](images/choose-debugger.png)

VS Code will generate a `launch.json` in your project with some default configurations such as shown below.

![React Native launch configuration file](images/launch-config.png)

You can modify these configurations or add new ones to the list. You can use other fields in these configurations as well.

For example, you can modify the `target` field to specify the simulator you want to target for iOS debugging.

## Debugging

To start the debug session, select a configuration from the Configuration dropdown, and then click the start button ![Configure-gear](images/debug-icon.png) (or press F5).

![React Native launch targets](images/debug-targets.png)

You can debug your app on an Android emulator, Android device or iOS simulator. Extension provides [experiemental support](#debugging-on-ios-device) for iOS devices.

More information about debugging using VS Code can be found in this [guide](https://code.visualstudio.com/docs/editor/debugging)

### Troubleshooting

>#### Debugger doesn't stop at breakpoints
>We use some smart tricks to enable React Native app debugging but that currently works only if packager is started by VS Code.
Chances are that you have started the React Packager outside VS Code. To fix this, kill the packager process and try again.

>#### 'adb: command not found'
>If you receive an error `adb: command not found`, you need to update your path variable to include the location of your *ADB* executable.
The *ADB* executable file is located in a subdirectory along with your other Android SDK files.

Note that there is a known issue [Issue #FIX_THIS](https://github.com/facebook/react-native/issues/5850) while running an app targeting iPhone 6

### Debugging on iOS device
Debugging on iOS device isn't straightforward and requires following manual steps:
* TODO 1
* TODO 2

## Using React Native commands in the Command Palette

In the Command Palette, type ```React Native``` and choose a command.

![React Native commands](images/command-palette.png)

The **Run Android** command triggers ```react-native run-android``` and starts your app for android.

The **Run iOS** command similarly triggers ```react-native run-ios``` and starts your app in iOS simulator (iPhone 6).

The **Packager** commands allow you to start/stop the [**React-packager**](https://github.com/facebook/react-native/tree/master/packager).

## Use IntelliSense

IntelliSense helps you discover objects, functions, and parameters in React Native.

![IntelliSense](images/intellisense.png)

### Enabling IntelliSense
React Native IntelliSense depends on experimental features to support JSX in VS Code.
To enable these experimental features, you will see following prompt immediately after opening a React Native project in VS Code after installing the extension.

![IntelliSense prompt](images/intellisense-prompt.png)

This is a one-time prompt and will enable JSX support.
Click **yes** to automatically configure your environment for enabling IntelliSense in your project.

You will need to restart VS Code once for changes to take effect.
You can verify that you have Salsa enabled and you have an installed TypeScript version that supports Salsa by checking the status indicator in the Status Bar. This shows that all is OK

![Salsa Enabled](https://code.visualstudio.com/images/January_salsa-status.png)

Once you have enabled IntelliSense by following above steps, you can start typing in the code editor to see the objects, functions, and parameters of your React Native libraries and your own code.

####TL;DR

Here is what happens behind the scenes to enable JSX support

1. Extension sets environment variable VSCODE_TSJS=1 to enable [Salsa](https://github.com/Microsoft/TypeScript/issues/4789)
2. Salsa requires TypeScript 1.8 but the final 1.8 release isn't available yet. Extension installs `typescript@next` in your user directory
3. Extension drops tsconfig.json in .vscode directory with `typescript.tsdk` pointing to the installed typescript

## Known Issues
Here is the list of known issues you may experience while using the extension
* TODO 1
* TODO 2

## Disable telemetry reporting
VS Code React Native extension collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://www.visualstudio.com/en-us/dn948229) to learn more.

If you don’t wish to send usage data to Microsoft, please follow the instructions below to disable its collection.

* Edit VSCodeTelemetrySettings.json file at ~/.vscode-react-native and add "optIn":false.