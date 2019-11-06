# Containerization

The extension limited supporters [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) features.

Please follow [VS Code official documentation](https://code.visualstudio.com/docs/remote/containers) to setup your environment.

## Developing inside a Docker Container on Linux

To debug React Native Android applications you can use [official React Native Docker image](https://hub.docker.com/r/reactnativecommunity/react-native-android) provided by [react-native-community](https://github.com/react-native-community/docker-android).

Here the steps to run React Native debugging on real Android device:

1. Open Command Palette and run the following command `Remote-Containers: Add Development Container Configuration Files...` then select `Existing Dockerfile` to create `.devcontainer/devcontainer.json` configuration file.
1. You are required to create Dockerfile extending `reactnativecommunity/react-native-android` image.
1. Configure your `devcontainer.json` just about like this: <br> **NOTE**: This is just a sample of configuration, you can modify your `devcontainer.json` as you require.
    ```
    {
        "name": "Existing Dockerfile",

        // Sets the run context to one level up instead of the .devcontainer folder.
        "context": "..",

        // Update the 'dockerFile' property if you aren't using the standard 'Dockerfile' filename.
        "dockerFile": "Dockerfile",

        // The optional 'runArgs' property can be used to specify additional runtime arguments.
        "runArgs": [

        ],

        // Uncomment the next line if you want to publish any ports.
        // "appPort": [],

        // Uncomment the next line to run commands after the container is created - for example installing git.
        // "postCreateCommand": "apt-get update && apt-get install -y git",

        // Add the IDs of extensions you want installed when the container is created in the array below.
        "extensions": []
    }
    ```

1. Open Command Palette and run the following command `Remote-Containers: Open Folder in Container` to reopen your project in container
1. Connect your device via USB and start debugging same way as on local machine

## Developing inside a Docker Container on macOS and Windows

Unfortunately the above scenario doesn't work on macOS and Windows. Current Docker Container implementation on these OS are used Virtual Machine tools which don't support USB forwarding for mobile devices. So for now React Native Tools extension doesn't support remote development on macOS and Windows.
