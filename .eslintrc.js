/*
static properties

static fn

all definitions

constructor

public

private



exclude en-extension.
*/

module.exports = {
    ignorePatterns: ["**/*.d.ts", "**/*.js"],
    root: true,
    env: {
        node: true,
        browser: false,
        es2020: true,
    },
    parserOptions: {
        parser: require.resolve("@typescript-eslint/parser"),
        tsconfigRootDir: __dirname,
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        // ecmaFeatures: {
        //   jsx: true,
        // },
    },
    plugins: ["@typescript-eslint", "prettier", "import", "promise", "unicorn", "header"],
    extends: [
        "airbnb-typescript/base",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:promise/recommended",
        "plugin:unicorn/recommended",
        "plugin:import/warnings",
        "plugin:import/errors",
        "plugin:import/typescript",
        "prettier",
        "prettier/@typescript-eslint",
    ],
    settings: {
        "import/resolver": {
            [require.resolve("eslint-import-resolver-typescript")]: {},
            [require.resolve("eslint-import-resolver-node")]: {},
            // [require.resolve("eslint-import-resolver-webpack")]: {
            //     config: path.resolve(__dirname, "./build/webpack.config.js"),
            // },
        },
    },
    overrides: [],
    rules: {
        "unicorn/prefer-ternary": "warn",
        "import/no-cycle": "off",
        "import/no-unresolved": "off", // !
        "lines-between-class-members": "off",
        "@typescript-eslint/lines-between-class-members": "off",
        "header/header": [
            "error",
            "line",
            [
                " Copyright (c) Microsoft Corporation. All rights reserved.",
                " Licensed under the MIT license. See LICENSE file in the project root for details.",
            ],
        ],
        "@typescript-eslint/no-unsafe-assignment": "off", // ?
        "@typescript-eslint/no-unsafe-member-access": "off", // ?
        // '@typescript-eslint/no-unsafe-return': ['off'],
        // 'class-methods-use-this': 'off',
        // 'consistent-return': 'off',
        // 'spaced-comment': ['off'],
        "no-restricted-syntax": [
            "error",
            {
                selector: "ForInStatement",
                message:
                    "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
            },
            {
                selector: "LabeledStatement",
                message:
                    "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.",
            },
            {
                selector: "WithStatement",
                message:
                    "`with` is disallowed in strict mode because it makes code impossible to predict and optimize.",
            },
        ],
        "no-void": ["error", { allowAsStatement: true }], // interferes with @typescript-eslint/no-floating-promises
        "@typescript-eslint/explicit-function-return-type": ["off"], // too much hassle, too little value
        "@typescript-eslint/explicit-module-boundary-types": [
            "warn",
            {
                allowArgumentsExplicitlyTypedAsAny: true,
            },
        ],
        "@typescript-eslint/no-use-before-define": [
            // function hoisting is a common, accepted pattern
            "error",
            {
                classes: true,
                functions: false,
                typedefs: true,
                variables: true,
            },
        ],
        "import/extensions": [
            "error",
            "always",
            {
                js: "never",
                jsx: "never",
                mjs: "never",
                ts: "never",
                tsx: "never",
            },
        ],
        "import/order": "warn",
        "import/prefer-default-export": "off", // default exports are bad
        "linebreak-style": "off", // git auto-fixes this
        "max-classes-per-file": "off", // eslint considers too many things to be a class
        "no-nested-ternary": "off", // superseeded by unicorn/no-nested-ternary
        "no-plusplus": "off", // ?
        "no-underscore-dangle": "off", // ?
        "prefer-destructuring": "off", // ?
        // "prettier/prettier": [
        //     "error",
        //     {
        //         trailingComma: "all",
        //         arrowParens: "avoid",
        //         printWidth: 100,
        //         tabWidth: 4,
        //         endOfLine: "auto",
        //         overrides: [
        //             {
        //                 files: ["*.md"],
        //                 options: {
        //                     tabWidth: 2,
        //                     printWidth: 80,
        //                 },
        //             },
        //         ],
        //     },
        // ],
        quotes: ["error", "double"], // single or double - choose either, but this is a required rule
        // semi: ["error", "always"], //
        "unicorn/filename-case": [
            "error",
            {
                cases: {
                    camelCase: true,
                    // pascalCase: true,
                },
            },
        ],
        "unicorn/no-useless-undefined": "off", // interferes with typescript best practices
        "unicorn/prevent-abbreviations": "off", // most abbreviations are well-known
    },

    globals: {
        process: "readonly",
    },
};
