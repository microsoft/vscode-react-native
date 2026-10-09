const through = require("through2");

const directivePattern = /^(\s*)\/\/\s*@(?:(ifdef|ifndef)\s+([A-Za-z_$][\w$]*)|(else)|(endif))\s*$/;

function createLinePreservingPreprocessor(context) {
    return through.obj((file, _encoding, callback) => {
        if (file.isNull()) {
            callback(null, file);
            return;
        }

        if (file.isStream()) {
            callback(new Error("Streaming input is not supported"));
            return;
        }

        try {
            file.contents = Buffer.from(preprocessText(file.contents.toString("utf8"), context));
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
}

function preprocessText(source, context) {
    const lines = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
    const stack = [];

    if (lines.at(-1) === "") {
        lines.pop();
    }

    const output = lines.map(line => {
        const lineEnding = line.match(/(?:\r\n|\n|\r)$/)?.[0] || "";
        const content = line.slice(0, line.length - lineEnding.length);
        const directive = content.match(directivePattern);

        if (directive) {
            const [, , conditionType, conditionName, elseDirective, endifDirective] = directive;

            if (conditionType) {
                const parentActive = stack.every(frame => frame.active);
                const isDefined = Object.prototype.hasOwnProperty.call(context, conditionName);
                const condition = conditionType === "ifdef" ? isDefined : !isDefined;
                stack.push({ parentActive, condition, active: parentActive && condition });
            } else if (elseDirective) {
                const frame = stack.at(-1);
                if (!frame) {
                    throw new Error("Unexpected @else directive");
                }
                frame.active = frame.parentActive && !frame.condition;
            } else if (endifDirective) {
                if (!stack.pop()) {
                    throw new Error("Unexpected @endif directive");
                }
            }

            return blankLine(content, lineEnding);
        }

        return stack.every(frame => frame.active) ? line : blankLine(content, lineEnding);
    });

    if (stack.length) {
        throw new Error("Missing @endif directive");
    }

    return output.join("");
}

function blankLine(content, lineEnding) {
    return " ".repeat(content.length) + lineEnding;
}

module.exports = {
    createLinePreservingPreprocessor,
    preprocessText,
};
