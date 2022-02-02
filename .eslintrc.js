const prettierConfig = require("./package.json").prettier;

const isFix = process.argv.includes("--fix");

module.exports = {
    root: true,
    ignorePatterns: ["**/*.d.ts", "**/*.js"],
    env: {
        node: true,
        browser: false,
        es2020: true,
    },
    parserOptions: {
        ecmaVersion: 2020,
        parser: require.resolve("@typescript-eslint/parser"),
        project: "./tsconfig.json",
        sourceType: "module",
        tsconfigRootDir: __dirname,
    },
    plugins: ["@typescript-eslint", "prettier", "import", "promise", "unicorn", "header"],
    extends: [
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:promise/recommended",
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
        },
    },
    overrides: [],
    rules: {
        // before adding new rules - https://github.com/prettier/eslint-plugin-prettier/issues/65
        "@typescript-eslint/unbound-method": "warn",
        "@typescript-eslint/dot-notation": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": [
            "warn",
            {
                allowArgumentsExplicitlyTypedAsAny: true,
            },
        ],
        "@typescript-eslint/lines-between-class-members": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": [
            "warn",
            {
                ignoreParameters: true,
                ignoreProperties: true,
            },
        ],
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-shadow": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
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
        "@typescript-eslint/prefer-regexp-exec": "off",
        "@typescript-eslint/require-await": "warn",
        "class-methods-use-this": "off",
        "consistent-return": "off",
        eqeqeq: "warn",
        "header/header": [
            "error",
            "line",
            [
                " Copyright (c) Microsoft Corporation. All rights reserved.",
                " Licensed under the MIT license. See LICENSE file in the project root for details.",
            ],
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
        "import/newline-after-import": "warn",
        "import/no-cycle": "off",
        "import/no-extraneous-dependencies": "off",
        "import/no-mutable-exports": "off",
        "import/no-require": "off",
        "import/no-unresolved": "off",
        "import/no-useless-path-segments": "warn",
        "import/order": "warn",
        "import/prefer-default-export": "off",
        "linebreak-style": "off",
        "lines-between-class-members": "off",
        "max-classes-per-file": "off",
        "no-async-promise-executor": "warn",
        "no-await-in-loop": "warn",
        "no-else-return": "warn",
        "no-empty-function": "off",
        "no-extra-boolean-cast": "warn",
        "no-lonely-if": "warn",
        "no-nested-ternary": "warn",
        "no-param-reassign": "warn",
        "no-plusplus": "off",
        "no-promise-executor-return": "error",
        "no-restricted-globals": "warn",
        "no-restricted-syntax": [
            "error",
            {
                message:
                    "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
                selector: "ForInStatement",
            },
            {
                message:
                    "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.",
                selector: "LabeledStatement",
            },
            {
                message:
                    "`with` is disallowed in strict mode because it makes code impossible to predict and optimize.",
                selector: "WithStatement",
            },
        ],
        "no-shadow": "off",
        "no-undef-init": "error",
        "no-underscore-dangle": "off",
        "no-unneeded-ternary": "warn",
        "no-useless-computed-key": "error",
        "no-useless-escape": "warn",
        "no-useless-return": "off",
        "no-void": [
            "error",
            {
                allowAsStatement: true,
            },
        ],
        "object-shorthand": "warn",
        "prefer-destructuring": "off",
        "prefer-template": "error",
        "prettier/prettier": ["error", prettierConfig],
        "promise/always-return": "off",
        "promise/catch-or-return": "off",
        "promise/param-names": "off",
        "promise/valid-params": "warn",
        "spaced-comment": [
            "error",
            "always",
            {
                markers: ["/"],
            },
        ],
        "unicorn/better-regex": "warn",
        "unicorn/filename-case": [
            "warn",
            {
                cases: {
                    camelCase: true, // pascalCase: true,
                },
                ignore: [/rn-extension\.ts/],
            },
        ],
        "unicorn/no-array-reduce": "warn",
        "unicorn/no-for-loop": isFix ? "off" : "warn",
        "unicorn/no-instanceof-array": "warn",
        "unicorn/no-new-array": "warn",
        "unicorn/no-new-buffer": "warn",
        "unicorn/prefer-array-find": "warn",
        "unicorn/prefer-array-index-of": "warn",
        "unicorn/prefer-array-some": "warn",
        "unicorn/prefer-includes": "warn",
        "unicorn/prefer-ternary": isFix ? "off" : "warn",
        "use-isnan": "warn",
        "valid-typeof": "warn",
        yoda: "warn",
    },

    globals: {
        process: "readonly",
    },
};
