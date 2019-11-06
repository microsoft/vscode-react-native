# Containerization

The extension has limited support of [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) features.

Please follow [VS Code official documentation](https://code.visualstudio.com/docs/remote/containers) to setup your environment befor using remote development approach.

## Developing inside a Docker Container on Linux

For development of React Native Android application in Docker Container you can use [official React Native Docker image](https://hub.docker.com/r/reactnativecommunity/react-native-android) provided by [react-native-community](https://github.com/react-native-community/docker-android).

Here the steps to run React Native debugging on real Android device inside Docker Container:

1. Open Command Palette and run the following command
    ```
    Remote-Containers: Add Development Container Configuration Files...
    ```
    Then select `Existing Dockerfile` to create `.devcontainer/devcontainer.json` configuration file.
1. You are required to create Dockerfile extending `reactnativecommunity/react-native-android` image.
1. Configure your `devcontainer.json` file just about like this: <br> **NOTE**: This is just a sample of configuration, you can modify your `devcontainer.json` file as you require.
    ```
    {
        "name": "Existing Dockerfile",

        // Sets the run context to one level up instead of the .devcontainer folder.
        "context": "..",

        // Update the 'dockerFile' property if you aren't using the standard 'Dockerfile' filename.
        "dockerFile": "Dockerfile",

        // The optional 'runArgs' property can be used to specify additional runtime arguments.
        "runArgs": [
            "--privileged",
            "--net", "host",
            "-v", "/dev/bus/usb:/dev/bus/usb"
        ],

        "settings": {
            // This will ignore your local shell user setting for Linux since shells like zsh are typically
            // not in base container images. You can also update this to an specific shell to ensure VS Code
            // uses the right one for terminals and tasks. For example, /bin/bash (or /bin/ash for Alpine).
            "terminal.integrated.shell.linux": null
        },

        // Add the IDs of extensions you want installed when the container is created in the array below.
        "extensions": ["msjsdiag.vscode-react-native"]
    }
    ```

1. Open Command Palette and run the following command `Remote-Containers: Open Folder in Container` to reopen your project in container
1. Connect your device via USB and start debugging the same way as on local machine

## Developing inside a Docker Container on macOS and Windows

Unfortunately the above scenario doesn't work on macOS and Windows. Current Docker Container implementation on these OS uses Virtual Machine tools which don't support USB forwarding for mobile devices. So for now React Native Tools extension doesn't support React Native development on macOS and Windows inside Docker Container.
