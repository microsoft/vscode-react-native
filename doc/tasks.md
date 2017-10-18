This is default `tasks.json` for `react-native init` projects.
Put it into `.vscode` folder in your project.

```
{
    "version": "2.0.0",
    "presentation": {
        "reveal": "always",
        "panel": "new"
    },
    "tasks": [
        {
            "taskName": "Build APK Debug",
            "group": "build",
            "type": "shell",
            "windows": {
                "command": "cd android; if($?) {./gradlew assembleDebug}"
            },
            "linux": {
                "command": "cd android && ./gradlew assembleDebug"
            }
        },
        {
            "taskName": "Build APK Release",
            "group": "build",
            "type": "shell",
            "windows": {
                "command": "cd android; if($?) {./gradlew assembleRelease}"
            },
            "linux": {
                "command": "cd android && ./gradlew assembleRelease"
            }
        },
        {
            "taskName": "Generate Android Bundle",
            "group": "build",
            "type": "shell",
            "command": "react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/main.jsbundle"
        },
        {
            "taskName": "Generate iOS Bundle",
            "group": "build",
            "type": "shell",
            "command": "react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle"
        }
    ]
}
```
* Note: if you use `react-native@0.48` or lower change `index.js` to `index.ios.js`/`index.android.js` or your own entry-file.

More about `tasks` in VSCode read [here](https://code.visualstudio.com/docs/editor/tasks)

How to [Generating Signed APK](https://facebook.github.io/react-native/docs/signed-apk-android.html)