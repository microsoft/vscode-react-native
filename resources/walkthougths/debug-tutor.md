# Run and Debug your React Native application
## Create and run debugging scenario
This extension supports generating debugging configuration in the `.vscode/launch.json` file by selecting debugging parameters in dropdown lists at the top of the editor.

![Add React Native debug configuration](../images/add-debug-configuration.gif)

To start debugging, just choose the appropriate configuration in the Configuration dropdown, and then press F5 (or click _Green Arrow_ ![Configure-gear](../images/debug-icon.png) button) to start debugging your app in VS Code.

The extension also allows to start debugging without creating the `launch.json` file in one of the following ways:
- Using dynamic debugging configurations

    ![Run dynamic debugging configuration](../images/dynamic-debugging-configuration.gif)
- Using Debug button in the Editor Title area menu

    ![Select and run debugging command](../images/debug-commands-button.png)

## Enable debugging mode and attach to the application
After using one of the suggested methods of launching the application, wait for the application to launch.

Once app is loaded and running, [open the developer menu](https://reactnative.dev/docs/debugging#accessing-the-in-app-developer-menu) inside your application and enable remote debugging by clicking on `Debug JS Remotely` button. After that, please wait until the extension attaches to your application.

![React Native enable remote debug](../images/enable-remote-debug.png)

