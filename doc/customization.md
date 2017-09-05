# Customization

There are a few customizations supported by this extension; they can be added to your `.vscode/settings.json` if you need them.

## Specifying custom arguments for `react-native run-*` command

For using custom run arguments for `react-native run-<platform>`:
* **Note:** This overrides all other configuration parameters.

```
{
  "react-native.android.runArguments.simulator": ["--appFolder, "/Users/test/AwesomeProject/android/app", "--deviceId", "emulator-5555"],
  "react-native.ios.runArguments.device": ["--project-path", "ios", "--device", "Max's iPhone"],
}
```

* **Note:** You can get the list of installed simulator devices by:

  iOS devices(MacOS only):

  ```
  xcrun simctl list --json devices
  ```

  Android devices:

  ```
  adb devices
  ```

* **Note:** If you want run application on iOS devices make sure you have `ios-deploy` installed globally.

  ```npm install -g ios-deploy```

## Setting up the react-native packager

To use a custom port for the `react-native` packager:

```
{
  "react-native": {
    "packager" : {
      "port": portNumber
    }
  }
}
```

If you change this port, then for iOS device and simulator scenarios you will have to modify the native code entry point in `AppDelegate.m` to reflect the new port number.
For Android, the extension uses `adb reverse` to tunnel the default port `8081` on the device to the specified port on the local machine, so no further configuration should be necessary. Note that some aspects of React Native hard-code the port to the default as specified in [this issue](https://github.com/facebook/react-native/issues/9145).

## Logging

To expose internal logs to the output, set the following properties:

```
{
  "react-native-tools": {
    "showInternalLogs": true,
    "logLevel": "Trace"
  }
}
```

`logLevel` can be `None` (no logs), `Error`, `Warning`, `Info`, `Debug`, `Trace` (all logs). Default is `None`.

## Project structure

To specify a subfolder in which the react-native project is located, set `react-native-tools.projectRoot`. You can use either an absolute or relative path here:

```
{
  "react-native-tools": {
    "projectRoot": "./your/react-native/project"
  }
}
```

## TypeScript

To use a different `TypeScript TSDK` version than the one that comes with VS Code, set the following:

```
{
  "typescript": {
    "tsdk": "path/to/tsdk"
  }
}
```
