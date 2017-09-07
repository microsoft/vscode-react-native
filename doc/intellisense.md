## Using IntelliSense provided by Flowtype

If you've gotten used to using Flowtype to perform static types analysis, you may also want to use it to provide code completions in VS Code instead of the default TypeScript Salsa engine. In order to make IntelliSense understand Flowtype annotations, follow these steps:

* Install the Flow npm package:

  ```
  $ npm install -g flow-bin
  ```

* [Install Flow for VS Code](https://github.com/flowtype/flow-for-vscode)

* Add the following configuration in `$workspace/.vscode/settings.json`

  ```
  {
      "javascript.validate.enable": false,
      "flow.useNPMPackagedFlow": true
  }
  ```

Please also make sure that your project has a `.flowconfig` file.