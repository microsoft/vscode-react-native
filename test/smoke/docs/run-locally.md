# Running automated smoke tests locally

Tests support running on **Windows 10**, **MacOS Catalina** and **Ubuntu 18.04** machines. Use instructions respected to your machine type.
Please, be aware that automated tests don't cover debugging cases on real devices - only emulators/simulators.

## Prerequisites

Make sure you are on `Node.JS >=10.x and <=12.x` or `14.x`.

Tests are running using [VS Code automation package](https://github.com/microsoft/vscode/tree/master/test/automation), so before the tests runs the VS Code build tools are required to be installed. Please make sure that [instructions for building VS Code from sources](https://github.com/microsoft/vscode/wiki/How-to-Contribute#prerequisites) are completed before running the tests.

### Windows only
   * [Install Chocolatey](https://chocolatey.org/install)

### Mac only
   * [Install Homebrew](https://docs.brew.sh/Installation)

## Set up Android SDK environment

1. Install `Java Developement Kit 8`, `Android Studio` and `Git`

   * **Windows**:
    ```ps1
    choco install jdk8 -y
    choco install androidstudio -y
    choco install git -y
    ```
   * **Mac**:
    ```bash
    brew tap caskroom/versions
    brew cask install adoptopenjdk/openjdk/adoptopenjdk8
    brew cask install android-studio
    brew install git
    brew install watchman
    ```
   * **Ubuntu**:
    ```bash
    apt update
    sudo apt install openjdk-8-jdk
    sudo snap install android-studio --classic
    sudo apt install git
    sudo apt install xvfb
    ```

1. Open Android Studio and go through the setup.
   * Select `Custom Installation`
   * When you will be asked where to install android sdk choose the following directory:
     * **Windows**: `C:\Users\<username>\Android\sdk`
     * **Mac**: `/Users/<username>/Library/Android/sdk`
     * **Linux**: `/home/<username>/Android/sdk`
1. Add android environment variables to path:
   * **Windows** (Powershell):
    ```ps1
    [Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\<username>\Android\sdk",
    [System.EnvironmentVariableTarget]::Machine)
    [Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "%ANDROID_HOME%",
    [System.EnvironmentVariableTarget]::Machine)
    [Environment]::SetEnvironmentVariable("Path", $env:Path+";%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools\bin",
    [System.EnvironmentVariableTarget]::Machine)
    ```
   * **Mac**:
Add these lines to `~/.bash_profile` (create one if it doesn't exist):
    ```bash
    export JAVA_HOME="$(/usr/libexec/java_home)"
    export ANDROID_HOME=/Users/<username>/Library/Android/sdk
    export ANDROID_SDK_ROOT=$ANDROID_HOME
    PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin"
    ```
   * **Linux**:
Add these lines to `~/.bash_profile` (create one if it doesn't exist):
    ```bash
    export JAVA_HOME=$(readlink -f /usr/bin/javac | sed "s:/bin/javac::")
    export ANDROID_HOME=/home/<username>/Android/sdk
    export ANDROID_SDK_ROOT=$ANDROID_HOME
    PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin"
    ```
    > Notice: it's important to add $ANDROID_HOME/emulator before other paths because otherwise emulator will refuse to start from any directory but sdk ones.
1. (**Linux** only) Install **KVM** on your system and **reboot** your system.
   ```bash
   sudo apt install qemu-kvm
   sudo adduser <user_name> kvm
   ```
   where **<user_name>** - name of the user you want to add access to the **KVM**.

1. Open Android studio for any workspace and open **Android Virtual Device Manager(AVD Manager)** at the right top of the window.
1. Create a new android virtual device using **x86** image with the parameters you need for testing.
1. Run this command and if emulator starts - you are all set with Android!
    ```bash
    emulator -avd <device_name>
    ```
1. (**Linux** only) Add this line to your `/etc/sysctl.conf` file to manage with [file watching limitation on Linux](https://code.visualstudio.com/docs/setup/linux#_visual-studio-code-is-unable-to-watch-for-file-changes-in-this-large-workspace-error-enospc):
   ```bash
   fs.inotify.max_user_watches=524288
   ```
   Then run
   ```bash
   sudo sysctl -p
   ```
   to apply settings.

## Set up iOS SDK environment (**Mac** only)

1. Install [XCode](https://itunes.apple.com/ru/app/xcode/id497799835?l=en&mt=12)
1. Launch Xcode and install additional required components when prompted.
1. Run `sudo xcode-select -s /Applications/Xcode.app` in terminal
1. Run `brew install carthage` in terminal (*required by Appium*)

## Set up Windows development dependencies (**Windows** only)
Follow [the official RNW guide](https://microsoft.github.io/react-native-windows/docs/rnw-dependencies)

## Set up tests

1. Install React Native CLI
   ```sh
   npm i react-native-cli -g
   ```
1. Install Expo CLI
   ```sh
   npm i expo-cli -g
   ```
1. Install Appium
   ```sh
   npm i appium -g
   ```
1. Install Yarn
   ```sh
   npm i yarn -g
   ```
1. [Create](https://expo.io/signup) Expo account if you haven't one. Then login to Expo
   ```sh
   expo login -u 'YOUR_EXPO_LOGIN' -p 'YOUR_EXPO_PASSWORD'
   ```
1. Open the root directory of the extension project and install node packages
   ```sh
   npm install
   ```
1. Copy extension VSIX to `test/smoke/package/resources/drop-win` directory

## Running tests

Tests require several environment variables to be set up before starting:

|Variable|Examples|Explanation|
|---|---|---|
|`ANDROID_EMULATOR`|`Nexus_5X_API_29`|Name of the emulated device|
|`ANDROID_VERSION`|10|Version of Android installed on emulated device|
|`IOS_SIMULATOR`|`iPhone8`|(**Only for iOS tests**) Name of the simulated device|
|`IOS_VERSION`|14.4|(**Only for iOS tests**) Version of iOS on the simulated device|
|`CODE_VERSION`|`*`, `1.50.1`, `insiders`|Version of VS Code to download and run while running tests|
|`EXPO_XDL_VERSION` (optional)|`59.0.27`, `skip`|Version of expo/xdl package to install to the extension directory. If set to "skip" then package installation will be skipped|
|`EXPO_SDK_MAJOR_VERSION` (optional)|`40`, `skip`|Version of `expo-sdk` for Expo applications. If set to "skip" then the latest `expo-sdk` version will be used|
|`RN_VERSION` (optional)|`0.64.0-rc.2`, `skip`|Version of a React Native application to debug while running tests. If set to "skip" then the latest version will be installed|
|`PURE_RN_VERSION` (optional)|`0.63.4`, `skip`|Version of React Native while running tests on pure RN app with Expo. If set to "skip" then the latest version will be installed|
|`PURE_EXPO_VERSION` (optional)|`40`, `skip`|Version of Expo while running tests on pure RN app with Expo. If set to "skip" then the latest version will be installed|
|`RN_MAC_OS_VERSION` (optional)|`0.62.0`, `skip`|(**Only for macOS tests**) Version of a React Native application for RN macOS tests. If set to "skip" then the latest version will be installed|
|`RNW_VERSION` (optional)|`0.63.2`, `skip`|(**Only for RNW tests**) Version of a React Native application for RNW tests. If set to "skip" then the latest version will be installed|

To create environment variable you can use these commands:
   * **Windows** (Powershell):

   ```ps1
   [Environment]::SetEnvironmentVariable("YOUR_VARIABLE", VALUE, [System.EnvironmentVariableTarget]::Machine)
   ```

   * **Mac/Linux**: Add these lines to `~/.bash_profile` or `~/.zshrc`:

   ```bash
   export YOUR_VARIABLE=VALUE
   ```

In the directory `test/smoke/package` there is a `config.json` configuration file with predefined settings for environment variables.
This approach would be more suitable for CI.

For local runs, it is more convenient to create file `config.dev.json` inside `test/smoke/package` directory and specify variables there. For example:
```js
{
    "ANDROID_EMULATOR": "Nexus_5X_API_28_x86",
    "ANDROID_VERSION": "9",
    "IOS_SIMULATOR": "iPhone 11",
    "IOS_VERSION": "13.5",
    "CODE_VERSION" : "*"
}
```

To run tests simply go to the root directory and run the command:
```sh
yarn smoke-tests
```
This command will perform pre-tests setup (creating applications, downloading VS Code, cleaning up, etc) and then run Android, iOS, RNW and macOS tests.

> Notice (**Mac only**): when the tests are being run for the first time, you need to give permissions for `runsvc.sh` agent process for System Events. Request for the permissions will appear automatically during the tests, so you need to just press `Allow` button. This is required for `expo client:install:ios` command which runs graphical iOS simulator.

Also, it supports the following parameters:

|Parameter|Explanation|
|---|---|
|`--skip-setup`|Skip pre-tests setup|
|`--reset-cache`|Reinstall test projects|
|`--ios`|Run iOS tests only|
|`--android`|Run Android tests only|
|`--basic-only`|Run basic tests only (Debug Android, Debug iOS)|
|`--dont-delete-vsix`|Do not delete extension VSIX at the end of the tests execution|

> Notice: if `--ios`, `--android` and `--basic-only` parameters are not set, all iOS and Android tests will be executed.

> Notice: if `--dont-delete-vsix` is not set, then extension will be deleted after execution of the tests.

## Troubleshooting

1. Several diagnostic logs are written during tests run. `SmokeTestLogs` directory is created on each tests run and contains
* zero-based numbering named directories that corresponds to particular test. There are different diagnostic logs inside such as:
  * `extensionLogs/ReactNative*` - extension output windows logs
  * `extensionLogs/webdriverIOLogs*` - logs of webdriverIO library
  * `chromedriver.log` - logs of Chrome Driver that are used by Spectron
* `appium.log` - logs of Appium server
* `SetupEnvironmentCommandsLogs.txt` - logs of console commands that are used for installing and patching RN projects
Also, VS Code instance, that is downloaded and used for running tests, is located in `test/smoke/vscode/test/smoke/resources/.vscode-test` directory.
2. (Linux only) There are some known issues with launching VS Code using virtual display servers:
```
libGL error: No matching fbConfigs or visuals found
libGL error: failed to load driver: swrast
```
There is a [workaround](https://github.com/microsoft/vscode/issues/3451#issuecomment-217716116) for these issues. Also [make sure to pass virtual display resolution argument to Xvfb, since it may lead to errors on VS Code based on Electron 6](https://github.com/microsoft/vscode/issues/89147#issuecomment-578674329)
