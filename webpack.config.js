const TerserPlugin = require("terser-webpack-plugin");
const assert = require("assert");
const path = require("path");

module.exports = (env, argv) => {
    /** @type {import('webpack').Configuration} */
    const webpackConfig = {
        target: "node",
        entry: path.resolve(`./src/extension/rn-extension.ts`),
        output: {
            libraryTarget: "commonjs2",
            filename: "rn-extension.js",
            devtoolModuleFilenameTemplate: "../[resource-path]",
        },
        resolve: {
            extensions: [".js", ".ts", ".json"],
        },
        plugins: [],
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "vscode-nls-dev/lib/webpack-loader",
                            options: {
                                base: __dirname,
                            },
                        },
                        {
                            loader: "ts-loader",
                            options: {
                                compilerOptions: {
                                    sourceMap: true,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        optimization: {
            // minimize: true, // automatically set by 'mode'
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: /^\**!|@preserve/i,
                        },
                    },
                    extractComments: false,
                }),
            ],
        },
        node: {
            __dirname: false,
            __filename: false,
        },
        externals: {
            vscode: "commonjs vscode",
        },
    };

    return webpackConfig;
};
