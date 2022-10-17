const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");
const srcPath = "src";
const distDir = appRoot + "/dist";
const distSrcDir = `${distDir}/src`;

/** Run webpack to bundle the extension output files */
async function webpackBundle() {
    const packages = [
        {
            entry: `${srcPath}/extension/rn-extension.ts`,
            filename: "rn-extension.js",
            library: true,
        },
    ];
    return runWebpack({ packages });
}

async function runWebpack({
    packages = [],
    devtool = false,
    compileInPlace = false,
    mode = process.argv.includes("watch") ? "development" : "production",
} = options) {
    let configs = [];
    for (const { entry, library, filename } of packages) {
        const config = {
            mode,
            target: "node",
            entry: path.resolve(entry),
            output: {
                path: compileInPlace ? path.resolve(path.dirname(entry)) : path.resolve(distDir),
                filename: filename || path.basename(entry).replace(".js", ".bundle.js"),
                devtoolModuleFilenameTemplate: "../[resource-path]",
            },
            devtool: devtool,
            resolve: {
                extensions: [".js", ".ts", ".json"],
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        exclude: /node_modules/,
                        use: [
                            {
                                // vscode-nls-dev loader:
                                // * rewrite nls-calls
                                loader: "vscode-nls-dev/lib/webpack-loader",
                                options: {
                                    base: path.join(appRoot),
                                },
                            },
                            {
                                // configure TypeScript loader:
                                // * enable sources maps for end-to-end source maps
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
                minimize: true,
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

        if (library) {
            config.output.libraryTarget = "commonjs2";
        }

        if (process.argv.includes("--analyze-size")) {
            config.plugins = [
                new (require("webpack-bundle-analyzer").BundleAnalyzerPlugin)({
                    analyzerMode: "static",
                    reportFilename: path.resolve(distSrcDir, path.basename(entry) + ".html"),
                }),
            ];
        }

        configs.push(config);
    }

    await new Promise((resolve, reject) =>
        webpack(configs, (err, stats) => {
            if (err) {
                reject(err);
            } else if (stats.hasErrors()) {
                reject(stats);
            } else {
                resolve();
            }
        }),
    );
}

module.exports = {
    webpackBundle,
};
