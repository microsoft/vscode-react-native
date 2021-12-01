// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./../typings/debugger/sourceMapsCombinator.d.ts" />

import * as fs from "fs";
import * as path from "path";
import {
    SourceMapConsumer,
    RawSourceMap,
    SourceMapGenerator,
    MappingItem,
    Mapping,
    Position,
    NullableMappedPosition,
} from "source-map";
import * as sourceMapResolve from "source-map-resolve";

const DISK_LETTER_RE = /^(?:[a-z]{2,}:\/{3})?[a-z]:/i;

export class SourceMapsCombinator {
    public convert(rawBundleSourcemap: RawSourceMap): RawSourceMap {
        // Find user files from bundle files list
        const consumers: { [key: string]: SourceMapConsumer } = rawBundleSourcemap.sources.reduce(
            (result: { [key: string]: SourceMapConsumer }, file) => {
                // Skip files inside node_modules
                if (file.includes("node_modules")) return result;

                try {
                    const consumer: SourceMapConsumer | null = this.getSourceMapConsumerFrom(file);
                    if (consumer) result[file] = consumer;
                } finally {
                    return result;
                }
            },
            {},
        );

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
            const mapping: Mapping = {
                generated: { line: item.generatedLine, column: item.generatedColumn },
                original: { line: item.originalLine, column: item.originalColumn },
                source: item.source,
                name: item.name,
            };

            if (consumers[item.source]) {
                const jsPosition: Position = {
                    line: item.originalLine,
                    column: item.originalColumn,
                };
                const tsPosition: NullableMappedPosition = consumers[
                    item.source
                ].originalPositionFor(jsPosition);

                if (tsPosition.source === null) {
                    // Some positions from react native generated bundle can not translate to TS source positions
                    // skip them
                    return;
                }

                // Resolve TS source path to absolute because it might be relative to generated JS
                // (this depends on whether "sourceRoot" option is specified in tsconfig.json)
                if (!tsPosition.source.match(DISK_LETTER_RE)) {
                    // This check for Windows tests which were run on MacOs
                    tsPosition.source = path.resolve(
                        <string>rawBundleSourcemap.sourceRoot,
                        path.dirname(item.source),
                        tsPosition.source,
                    );
                }

                // Update mapping w/ mapped position values
                mapping.source = tsPosition.source;
                mapping.name = tsPosition.name || mapping.name;
                if (tsPosition.line !== null && tsPosition.column !== null) {
                    mapping.original = { line: tsPosition.line, column: tsPosition.column };
                }
            }

            try {
                generator.addMapping(mapping);
            } catch (err) {}
        });

        return generator.toJSON();
    }

    private getSourceMapConsumerFrom(generatedFile: string): SourceMapConsumer | null {
        const code = fs.readFileSync(generatedFile);

        const consumer = this.readSourcemap(generatedFile, code.toString());
        return consumer;
    }

    private readSourcemap(file: string, code: string): SourceMapConsumer | null {
        const result = sourceMapResolve.resolveSync(
            code,
            file,
            readFileSync.bind(null, getDiskLetter(file)),
        );
        if (result === null) {
            return null;
        }
        return new SourceMapConsumer(result.map);
    }
}

// Hack for source-map-resolve and cutted disk letter
// https://github.com/lydell/source-map-resolve/issues/9
function readFileSync(diskLetter: string, filePath: string) {
    return filePath.match(DISK_LETTER_RE)
        ? fs.readFileSync(filePath)
        : fs.readFileSync(`${diskLetter}${filePath}`);
}

function getDiskLetter(filePath: string): string {
    const matched = filePath.match(DISK_LETTER_RE);
    return matched ? matched[0] : "";
}
