// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import { SourceMapConsumer, RawSourceMap, SourceMapGenerator, MappingItem, Mapping, Position, MappedPosition } from "source-map";
const sourceMapResolve = require("source-map-resolve");

// Stack: Error: Couldn't import script at <http://localhost:8081/index.android.bundle?platform=android&dev=true&hot=false&minify=false>. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger: Invalid mapping: { "generated":{ "line":1800, "column":16 },"original":{ } }

export class SourceMapsCombinator {

    public convert(rawBundleSourcemap: RawSourceMap): RawSourceMap {

        const bundleConsumer = new SourceMapConsumer(rawBundleSourcemap);

        // Find user files from bundle files list
        const files = this.getUserFiles(rawBundleSourcemap.sources);
        console.log(files);
        let consumers: { [key: string]: SourceMapConsumer } = {};

        let generator = new SourceMapGenerator();

        let consumer: SourceMapConsumer | null;
        for (let file of files) {
            console.log(file);
            try {
                consumer = this.getSourceMapConsumerFrom(file);
            } catch (err) {
                // Cant read users sourcemap
                return rawBundleSourcemap;
            }
            if (consumer !== null) {
                consumers[file] = consumer;
            }
        }

        if (Object.keys(consumers).length === 0) {
            // Sourcemaps not found
            // User dont use TS or coffee script or other transhpilers
            // return original bundle sourcemap
            return rawBundleSourcemap;
        }

        console.log("start");

        let start = Date.now();

        let needTranslate: boolean;
        bundleConsumer.eachMapping((item: MappingItem) => {
            if (item.source === null) {
                // Some mappings in react native bundle have no sources
                return;
            }

            needTranslate = (files.indexOf(item.source) !== -1) && Boolean(consumers[item.source]);
            if (needTranslate) {
                let jsPosition: Position = { line: item.originalLine, column: item.originalColumn }
                let tsPosition: MappedPosition = consumers[item.source].originalPositionFor(jsPosition);

                if (tsPosition.source === null) {
                    // Some positions from react native generated bundle can not translate to TS source positions
                    // skip them
                    return;
                }

                let mapping: Mapping = {
                    generated: { line: item.generatedLine, column: item.generatedColumn },
                    original: { line: tsPosition.line, column: tsPosition.column },
                    source: tsPosition.source,
                    name: tsPosition.name,
                }
                try {
                    generator.addMapping(mapping);
                } catch (err) {

                }
            } else {
                // Copy mappings
                let mapping: Mapping = {
                    generated: { line: item.generatedLine, column: item.generatedColumn },
                    original: { line: item.originalLine, column: item.originalColumn },
                    source: item.source,
                    name: item.name,
                }
                try {
                    generator.addMapping(mapping);
                } catch (err) {

                }
            }
        });

        let dt = Date.now() - start;
        console.log("Combinator time =", dt);

        return generator.toJSON();
    }

    private getSourceMapConsumerFrom(generatedFile: string): SourceMapConsumer | null {
        let code = fs.readFileSync(generatedFile);

        let consumer = this.readSourcemap(generatedFile, code.toString());
        return consumer;
    }

    private getUserFiles(allSourceFiles: string[]) {
        let userFiles: string[] = allSourceFiles.filter(
            (value: string) => {
                if (value.indexOf("node_modules") == -1) {
                    return true;
                }
                return false;
            });
        return userFiles;
    }

    private readSourcemap(file: string, code: string): SourceMapConsumer | null {
        let result = sourceMapResolve.resolveSync(code, file, fs.readFileSync);
        if (result === null) {
            return null;
        }
        return new SourceMapConsumer(result.map);
    }
}
