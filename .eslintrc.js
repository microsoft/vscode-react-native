module.exports = {
    ignorePatterns: [
      "**/*.d.ts",
      "**/*.js",
      "node_modules/**",
      "test/resources/sampleReactNative022Project/**/*.js",
      "test/smoke/package/node_modules/**",
      "test/smoke/automation/node_modules/**",
      "test/smoke/resources/**",
      "test/smoke/vscode/**",
    ],
    parser: "@typescript-eslint/parser",
    extends: [
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    plugins: ["header"],
    parserOptions: {
      ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
      sourceType: "module", // Allows for the use of imports
    },
    rules: {
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/prefer-namespace-keyword": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
      "header/header": [
        "error",
        "line",
        [" Copyright (c) Microsoft Corporation. All rights reserved.", " Licensed under the MIT license. See LICENSE file in the project root for details."],
      ],
      // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
      // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    },
  };
