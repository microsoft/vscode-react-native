## Debugging Expo applications

To debug a project created using Expo or create-react-native-app you can use embedded support for Expo.

There are the following prerequisites need to be met:

- You'll need to have [Expo app](https://getexponent.com/) installed on device/emulator
- Make sure that you have react-native-cli installed globally

To start debugging in Expo follow the steps below:

1. Open your project in VSCode with our extension
2. Create debugging configuration (as described in [Debugging React Native applications](../readme.md#debugging-react-native-applications)), select `Debug in Exponent` in the debug drop-down menu, and start debugging
4. Wait while some dependencies are configured - we install `xde` and `@expo/ngrok` dependencies when this feature is used for the first time.
5. If you have not used exponent on that machine before, you will be prompted for an exponent username and password.
   If you have not created an exponent account, then specifying a new username and password will create one.
   Note that there is no e-mail associated with the account, and no way to recover a forgotten password.
6. Once the packager starts, the extension will open a separate tab with QR code to scan from Exponent app. Once you do so, the exponent app will connect to the packager and begin running your app.


   From here you can run and debug the app as normal.

## Configuring Expo

When you use exponent for the first time in vscode (either to run, debug or publish) you will notice that we created a couple of files for you.

This files are: `.vscode/exponentIndex.js`, `.vscode/vscodeExponent.json` and `exp.json`.

Under your `.vscode/` directory there will be a `vscodeExponent.json` file. This file has the settings used for us to setup exponent correctly.

```
{
    "entryPointFilename": ""          // File under the project root that is used as an entrypoint. We look for index.ios.js or index.android.js
    "entryPointComponent": ""         // Name of the main component used in your entrypoint. By default it's the same name as your app
    "createOrOverwriteExpJson": false  // If true we will create and overwrite exp.json everytime. If you need a custom exp.json ensure this is false.
}
```

We attempt to guess some defaults, but you may need to change it yourself.
If we guessed the filename or component wrong, or you want to try out different entrypoints feel free to modify `.vscode/vscodeExponent.json` to try
out whatever suits your needs.

When running under exponent, your application will start via `.vscode/exponentIndex.js` will reference the `entryPointFilename` from `vscodeExponent.json`.
If you change your application's entry point (e.g. changing from `index.ios.js` to `index.android.js`), delete or update `.vscode/exponentIndex.js`
for it to take effect.

If you are an experienced exponent user, or you want to customize your `exp.json` set `createOrOverwriteExpJson` to false in `.vscode/vscodeExponent.json`.
This will let you have your own version of `exp.json` without overwritting it wach time we run something.

## FAQ

 **Q: I was working with a React Native version and after debugging in exponent I decided to update it, why is exponent not updating automatically?**

 We have a cache that keeps the version of the exponent SDK used by your project. This is helpfull since we don't want to install the SDK each time you run
 exponent. If you want us to update the SDK version based on your React Native version just restart VSCode and we should be able to do it if it's supported.
