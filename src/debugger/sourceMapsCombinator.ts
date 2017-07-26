// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { SourceMapConsumer, RawSourceMap, SourceMapGenerator, MappingItem, Mapping, Position, MappedPosition } from "source-map";
import sourceMapResolve = require("source-map-resolve");

export class SourceMapsCombinator {

    public convert(rawBundleSourcemap: RawSourceMap): RawSourceMap {

        // Find user files from bundle files list
        const consumers: { [key: string]: SourceMapConsumer } = rawBundleSourcemap.sources
            .reduce((result, file) => {
                // Skip files inside node_modules
                if (file.indexOf("node_modules") >= 0) {
                    return result;
                }

                try {
                    let consumer: SourceMapConsumer = this.getSourceMapConsumerFrom(file);
                    if (consumer) {
                        result[file] = consumer;
                    }
                } finally {
                    return result;
                }
            }, {});

        if (Object.keys(consumers).length === 0) {
            // Sourcemaps not found, so return original bundle sourcemap
            return rawBundleSourcemap;
        }

        const generator = new SourceMapGenerator();
        const bundleConsumer = new SourceMapConsumer(rawBundleSourcemap);

        bundleConsumer.eachMapping((item: MappingItem) => {
            if (item.source === null) {
                // Some mappings in react native bundle have no sources
                return;
            }

            // Copy mappings
            let mapping: Mapping = {
                generated: { line: item.generatedLine, column: item.generatedColumn },
                original: { line: item.originalLine, column: item.originalColumn },
                source: item.source,
                name: item.name,
            };

            if (consumers[item.source]) {
                let jsPosition: Position = { line: item.originalLine, column: item.originalColumn };
                let tsPosition: MappedPosition = consumers[item.source].originalPositionFor(jsPosition);

                if (tsPosition.source === null) {
                    // Some positions from react native generated bundle can not translate to TS source positions
                    // skip them
                    return;
                }

                // Resolve TS source path to absolute because it might be relative to generated JS
                // (this depends on whether "sourceRoot" option is specified in tsconfig.json)
                tsPosition.source = path.resolve(
                    rawBundleSourcemap.sourceRoot,
                    path.dirname(item.source),
                    tsPosition.source
                );

                // Update mapping w/ mapped position values
                mapping = {
                    ...mapping, ...tsPosition,
                    original: { line: tsPosition.line, column: tsPosition.column },
                };
            }

            try {
                generator.addMapping(mapping);
            } catch (err) {
                // ignore
            }
        });

        return generator.toJSON();
    }

    private getSourceMapConsumerFrom(generatedFile: string): SourceMapConsumer | null {
        let code = fs.readFileSync(generatedFile);

        let consumer = this.readSourcemap(generatedFile, code.toString());
        return consumer;
    }

    private readSourcemap(file: string, code: string): SourceMapConsumer | null {
        let result = sourceMapResolve.resolveSync(code, file, fs.readFileSync);
        if (result === null) {
            return null;
        }
        return new SourceMapConsumer(result.map);
    }
}
