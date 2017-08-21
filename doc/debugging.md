### Setup debug environment

Click the debugging icon ![Choose React Native debugger](images/debug-view-icon.png) in the View bar, and then click the configure gear icon ![Configure-gear](images/configure-gear-icon.png) to choose the React Native debug environment.

![Choose React Native debugger](images/choose-debugger.png)

VS Code will generate a `launch.json` in your project with some default configurations such as shown below.

![React Native launch configuration file](images/launch-config.png)

You can modify these configurations or add new ones to the list. You can use other fields in these configurations as well.

For example, you can modify the `target` field to specify the simulator you want to target for iOS debugging.

### Debugging with Typescript and Haul
If you use Haul instead react-native packager, you have to add `sourceMapPathOverrides` option to `launch.json`

For example:
```
"sourceMapPathOverrides": {
    "webpack:///./~/*":   "${workspaceRoot}/node_modules/*",
    "webpack:///./*":   "${workspaceRoot}/*",
    "webpack:///*":     "*"
}
```
See more about source map overrides [here](https://github.com/Microsoft/vscode-node-debug2#sourcemappathoverrides)

### Start debug session
To start the debug session, select a configuration from the Configuration dropdown, and then click the start button ![Configure-gear](images/debug-icon.png) (or press F5).

![React Native launch targets](images/debug-targets.png)

You can debug your app on an Android emulator, Android device or iOS simulator. This extension provides [experimental support](#debugging-on-ios-device) for iOS devices.

More information about debugging using VS Code can be found in this [guide](https://code.visualstudio.com/docs/editor/debugging).

#### Debugging on iOS device
Debugging on iOS device would require following manual steps.
* You need to install [ios-deploy](https://www.npmjs.com/package/ios-deploy) `npm install -g ios-deploy`
* You need to have a valid iOS Development certificate installed.
* In your launch.json file, set `"target"` to `"device"` or use '"launchArguments"' property to specify particular device to run on if you have multiple devices connected, e.g. `"arguments": [ "--device", "My iPhone" ]`
* Choose **Debug iOS** configuration from the Configuration dropdown and press F5.
* Shake the device to open development menu and select "Debug JS Remotely".