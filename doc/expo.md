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

   From here you can run and debug the app as normal.

## Configuring Expo

When you use Exponent for the first time in VS Code for **pure React Native** (either to run, debug or publish) your `app.json` will be patched by Expo configuration like this:
```
  "expo": {
    "slug": "LatestRNApp",
    "name": "LatestRNApp",
    "sdkVersion": "31.0.0",
    "entryPoint": "<Path to your project>\\.vscode\\exponentIndex.js"
  }
```
When running **pure React Native** under Exponent, your application will start via `.vscode/exponentIndex.js` will reference the entry point file name (`index.js`) from the root project folder.

**NOTE: Pure Expo App working without`.vscode/exponentIndex.js` and its `app.json` contains `expo` section by default**

If you change your application's entry point (e.g. changing from `index.ios.js` to `index.android.js`), delete or update `.vscode/exponentIndex.js` for it to take effect.

If you are an experienced exponent user, or you want to customize your `expo` section in `app.json` use [this reference](https://docs.expo.io/versions/latest/workflow/configuration).

## FAQ

 **Q: I was working with a React Native version and after debugging in exponent I decided to update it, why is exponent not updating automatically?**

 The extension caches the version of the exponent SDK used by your project. This is helpfull since we don't want to install the SDK each time you run exponent. If you want the extension to update the SDK version based on your React Native version, just restart VS Code and we should be able to do it if it's supported.
