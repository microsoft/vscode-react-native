## Debugging Expo applications

To debug a project created using Expo or the create-react-native-app task, you can use embedded support for Expo.

Your environment must meet the following prerequisites:

- Install the [Expo app](https://getexponent.com/) on the target device or emulator
- Ensure that the react-native-cli is installed globally (`npm install -g react-native-cli`)

To start debugging in Expo follow these steps:

1. Open your project in VS Code with this extension installed.
2. Create a debug configuration (as described in [Debugging React Native applications](../README.md#debugging-react-native-applications)), select `Debug in Exponent` in the debug drop-down menu, and start debugging
4. Wait while some dependencies are configured - the extension will install `xde` and `@expo/ngrok` when this feature is used for the first time.
5. If you have not used exponent on this system before, you will be prompted for an exponent username and password.
   If you have not created an exponent account, then specifying a new username and password will create one.
   Note that there is no e-mail associated with the account, and no way to recover a forgotten password.
6. Once the packager starts, the extension will open a separate tab with QR code to scan from the Exponent app. Once you do so, the Exponent app will connect to the packager and begin running your app.

7. Once app is loaded and ran, [open Developer Menu](https://facebook.github.io/react-native/docs/debugging#accessing-the-in-app-developer-menu) inside your application and enable remote debugging by clicking on `Debug JS Remotely` button.

![React Native enable remote debug](../images/enable-remote-debug.png)

   From here you can run and debug the app as normal.

## Configuring Expo

The extension supports running through Exponent not just the applications created with Expo but even pure React Native applications (in that case you need to add `expo` package to `node_modules` in order to make it work with Expo: `npm install expo --save-dev`. In either cases it uses `app.json` configuration file in the root of the project.

If you are running `Debug in Exponent` configuration or any of pallette commands like `Run in Exponent`, `Publish to Exponent` then this file will be created automatically if absent or updated with the following basic configuration section:

```
  "expo": {
    "slug": "MyApp", // Project slug
    "name": "MyApp", // Project name
    "sdkVersion": "31.0.0", // Expo SDK version
    "entryPoint": ".vscode\\exponentIndex.js" // Entrypoint for the project
  },
  "name": "MyApp", // Project name
```

Full list of configurational parameters for `expo` section in `app.json` may be found on [official Expo documentation page](https://docs.expo.io/versions/latest/workflow/configuration).

For running **pure React Native app**, extension, also, creates and uses `.vscode/exponentIndex.js` which is point to the app entrypoint (`index.js` or `index.android.js` or `index.ios.js`) file.

If you want to change your app entrypoint (for example, from `index.js` to `index.android.js`), delete `.vscode/exponentIndex.js` and then restart your debugging session.

## FAQ

 **Q: I was working with a React Native version and after debugging in exponent I decided to update it, why is exponent not updating automatically?**

 The extension caches the version of the exponent SDK used by your project. This is helpfull since we don't want to install the SDK each time you run exponent. If you want the extension to update the SDK version based on your React Native version, just restart VS Code and we should be able to do it if it's supported.
