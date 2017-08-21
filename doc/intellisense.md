## Using intellisense provided by Flowtype

If you've got used to Flowtype to perform static types analysis you also might want to use it to provide code completions in VSCode instead of default TypeScript Salsa engine. In order to make intellisense understand Flow type annotations follow the steps below:

* Install Flow npm package:

  ```
  $ npm install --global flow-bin
  ```

* [Install Flow for VS Code](https://github.com/flowtype/flow-for-vscode)

* Add the following configuration in `$workspace/.vscode/settings.json`

  ```
  {
      "javascript.validate.enable": false,
      "flow.useNPMPackagedFlow": true
  }
  ```

Please also make sure that your project has a `.flowconfig` file
