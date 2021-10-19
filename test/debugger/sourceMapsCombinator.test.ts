// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SourceMapsCombinator } from "../../src/debugger/sourceMapsCombinator";
import { RawSourceMap } from "source-map";
import * as assert from "assert";
import * as sinon from "sinon";
import * as fs from "fs";
import * as path from "path";

suite("sourceMapsCombinator", function () {
    suite("#convert", function () {
        let fsReadFileStub: Sinon.SinonStub;
        const pathToJS = "d:/hello.js";
        const pathToTS = "d:/hello.ts";
        const sourcemapPath = "d:/hello.js.map";
        const codeJS = fs.readFileSync(path.resolve(__dirname, "assets/hello.js"));
        const codeTS = fs.readFileSync(path.resolve(__dirname, "assets/hello.ts"));
        const sourcemap: RawSourceMap = {
            version: 3,
            sources: ["d:/hello.ts"],
            names: [],
            mappings:
                "AAAA,MAAM,MAAM;IACR,YAAY,CAAC,OAAO,GAAG,EAAE,MAAM,CAAC;IAChC;IACA,OAAO,QAAQ,CAAC,EAAE;QACd,OAAO,OAAO,EAAE,IAAI,CAAC,IAAI,EAAE,OAAO;IACtC;AACJ;;AAEA,MAAM,MAAM,EAAE,IAAI,KAAK,CAAC,gDAAgD,CAAC;;AAEzE,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC",
            file: "hello.js",
            sourceRoot: "",
        };

        setup(() => {
            fsReadFileStub = sinon.stub(fs, "readFileSync");
            fsReadFileStub.withArgs(pathToJS).returns(codeJS);
            fsReadFileStub.withArgs(pathToTS).returns(codeTS);
            fsReadFileStub.withArgs(sourcemapPath).returns(JSON.stringify(sourcemap));
        });

        teardown(() => {
            fsReadFileStub.restore();
        });

        test("convert sourcemap", function () {
            const expected = {
                version: 3,
                sources: ["d:/hello.ts"],
                names: <string[]>[],
                mappings:
                    "AAAA,IAAA,MAAM,EAAM,CAAA,SAAA,CAAA,EAAA;IACR,SAAA,KAAa,CAAA,GAAA,EAAO;QACpB,IAAA,CAAA,IAAA,EAAA,GAAA;IACA;SACI,CAAA,SAAO,CAAA,SAAc,EAAA,SAAM,CAAA,EAAO;QACtC,OAAA,OAAA,EAAA,IAAA,CAAA,IAAA,EAAA,OAAA;IACJ,CAAA;;AAEA,CAAA,CAAA,CAAA,CAAA;;AAEA,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC",
            };

            const rawBundleSourcemap: RawSourceMap = {
                version: 3,
                sources: ["d:/hello.js"],
                names: <string[]>[],
                mappings:
                    "AAAA,IAAI,MAAM,EAAE,CAAC,SAAS,CAAC,EAAE;IACrB,SAAS,KAAK,CAAC,GAAG,EAAE;QAChB,IAAI,CAAC,IAAI,EAAE,GAAG;IAClB;IACA,KAAK,CAAC,SAAS,CAAC,SAAS,EAAE,SAAS,CAAC,EAAE;QACnC,OAAO,OAAO,EAAE,IAAI,CAAC,IAAI,EAAE,OAAO;IACtC,CAAC;IACD,OAAO,KAAK;AAChB,CAAC,CAAC,CAAC,CAAC;AACJ,IAAI,MAAM,EAAE,IAAI,KAAK,CAAC,gDAAgD,CAAC;AACvE,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC",
                file: "hello.js",
                sourceRoot: "",
            };

            let sourceMapsCombinator = new SourceMapsCombinator();
            let result = sourceMapsCombinator.convert(rawBundleSourcemap);
            result.sources = result.sources.map(p => {
                return p.replace(/\\/g, "/");
            });
            assert.deepEqual(expected, result);
        });
    });
});
