Tests can be ran on **Windows 10**, **MacOS Mojave** and **Ubuntu** machines. Use respected instructions to your machine type.

## Prerequisites

### Windows
   1. Open Powershell and install [Chocolatey](https://chocolatey.org/):
```ps
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
refreshenv
```

### Mac
1. [Install Homebrew](https://docs.brew.sh/Installation)

## Set up Android SDK environment

1. Install `Java Developement Kit 8`, `Android Studio` and `Git`

   * **Windows**:
    ```ps
    choco install jdk8 -y
    choco install androidstudio -y
    choco install git -y
    ```
   * **Mac**:
    ```bash
    brew tap caskroom/versions
    brew cask install java8
    brew cask install android-studio
    brew install git
    ```
   * **Ubuntu**:
    ```bash
    apt update
    sudo apt install openjdk-8-jdk
    sudo snap install android-studio --classic
    sudo apt install git
    sudo apt install xvfb
    ```

1. Open Android Studio, and go through the setup.
   * Select `Custom Installation`
   * When you will be asked where to install android sdk choose the following directory:
   **Windows**: `C:\Users\<username>\Android\sdk`
   **Mac**: `/Users/<username>/Library/Android/sdk`
   **Linux**: `/home/<username>/Android/sdk`
1. Add android environment variables to path:
   * **Windows**:
    ```ps
    [Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\<username>\Android\sdk",
    [System.EnvironmentVariableTarget]::Machine)
    [Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "%ANDROID_HOME%",
    [System.EnvironmentVariableTarget]::Machine)
    [Environment]::SetEnvironmentVariable("Path", $env:Path+";%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools\bin",
    [System.EnvironmentVariableTarget]::Machine)
    ```
   * **Mac**:
Add these lines to `~/.bash_profile` (create one if you haven't it):
    ```bash
    export ANDROID_HOME=/Users/<username>/Library/Android/sdk
    export ANDROID_SDK_ROOT=$ANDROID_HOME
    PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin"
    ```
   * **Linux**:
Add these lines to `~/.bash_profile` (create one if you haven't it):
    ```bash
    export ANDROID_HOME=/home/<username>/Android/sdk
    export ANDROID_SDK_ROOT=$ANDROID_HOME
    PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin"
    ```
1. (**Linux** only) Install **KVM** on your system
   ```bash
   sudo apt install qemu-kvm
   sudo adduser <user_name> kvm
   ```
   where **<user_name>** - name of the user you want to add access to the **KVM**.
   **Reboot** your system.
1. Open Android studio for any workspace and open **Android Virtual Device Manager(AVD Manager)** at the right top of the window.
1. Create new android virtual device using **x86** image with the parameters you need for testing.
1. You need to create environmental variable with your device name:
   * **Windows**:
    ```ps
    [Environment]::SetEnvironmentVariable("ANDROID_EMULATOR", <device_name>, [System.EnvironmentVariableTarget]::Machine)
    ```
   * **Mac/Linux**:
Add these lines to `~/.bash_profile`:
    ```bash
    export ANDROID_EMULATOR=<device_name>
    ```

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

1. Install XCode from App store
1. Launch Xcode and install additional required components when prompted.
1. Run `sudo xcode-select -s /Applications/Xcode.app` in terminal
1. Run `brew install carthage` in terminal
