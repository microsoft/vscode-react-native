module.exports = {
    root: true,
    ignorePatterns: ["**/*.d.ts", "**/*.js"],
    parserOptions: {
        ecmaVersion: 2020,
        parser: require.resolve("@typescript-eslint/parser"),
        project: ["package/tsconfig.json", "automation/tsconfig.json"],
        sourceType: "module",
        tsconfigRootDir: __dirname,
    },
    plugins: ["header"],
    extends: ["plugin:@typescript-eslint/recommended"],
    rules: {
        "@typescript-eslint/consistent-type-assertions": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": [
            "warn",
            {
                allowArgumentsExplicitlyTypedAsAny: true,
            },
        ],
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/prefer-namespace-keyword": "off",
        "@typescript-eslint/triple-slash-reference": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "header/header": [
            "error",
            "line",
            [
                " Copyright (c) Microsoft Corporation. All rights reserved.",
                " Licensed under the MIT license. See LICENSE file in the project root for details.",
            ],
        ],
        "prefer-const": "off",
    },
};
