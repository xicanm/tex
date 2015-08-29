var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/// <reference path="type_declarations/index.d.ts" />
var lexing = require('lexing');
var Rule = lexing.MachineRule;
var models_1 = require('./models');
var dom_1 = require('./dom');
// all the classes below extend the lexing.MachineState base class,
// and are roughly in order of inheritance / usage
var StringCaptureState = (function (_super) {
    __extends(StringCaptureState, _super);
    function StringCaptureState() {
        _super.apply(this, arguments);
        this.value = [];
    }
    StringCaptureState.prototype.captureMatch = function (matchValue) {
        this.value.push(matchValue[0]);
        return undefined;
    };
    return StringCaptureState;
})(lexing.MachineState);
exports.StringCaptureState = StringCaptureState;
var STRING = (function (_super) {
    __extends(STRING, _super);
    function STRING() {
        _super.apply(this, arguments);
        this.rules = [
            Rule(/^\\"/, this.captureMatch),
            Rule(/^"/, this.pop),
            Rule(/^(.|\r|\n)/, this.captureMatch),
        ];
    }
    STRING.prototype.pop = function () {
        return this.value.join('');
    };
    return STRING;
})(StringCaptureState);
exports.STRING = STRING;
var LITERAL = (function (_super) {
    __extends(LITERAL, _super);
    function LITERAL() {
        _super.apply(this, arguments);
        this.rules = [
            // accept a contiguous string of anything but whitespace and commas
            Rule(/^[^,\s]+/, this.captureMatch),
            Rule(/^/, this.pop),
        ];
    }
    return LITERAL;
})(STRING);
exports.LITERAL = LITERAL;
/**
TeX's special characters:

    # $ % & \ ^ _ { }
*/
var TEX = (function (_super) {
    __extends(TEX, _super);
    function TEX() {
        _super.apply(this, arguments);
        this.value = new dom_1.ParentNode();
        this.rules = [
            Rule(/^\\([#$%&\\^_{} ])/, this.captureText),
            Rule(/^\\([`'^"~=.-]|[A-Za-z]+)/, this.captureMacro),
            Rule(/^\{/, this.captureParent),
            Rule(/^\}/, this.pop),
            Rule(/^([^\\{}%]+)/, this.captureText),
        ];
    }
    TEX.prototype.pop = function () {
        // combine macros with their children, if any
        // is there a better way / place to do this?
        var children = this.value.children;
        for (var i = 0, node; (node = children[i]); i++) {
            if (node instanceof dom_1.MacroNode) {
                var nextNode = children[i + 1];
                if (nextNode instanceof dom_1.ParentNode) {
                    node.children = nextNode.children;
                    // dispose of the next child
                    children.splice(i + 1, 1);
                }
                else if (nextNode instanceof dom_1.TextNode) {
                    node.children = [new dom_1.TextNode(nextNode.value[0])];
                    nextNode.value = nextNode.value.slice(1);
                }
            }
        }
        return this.value;
    };
    TEX.prototype.captureText = function (matchValue) {
        var textNode = new dom_1.TextNode(matchValue[1]);
        this.value.children.push(textNode);
        return undefined;
    };
    TEX.prototype.captureMacro = function (matchValue) {
        var macroNode = new dom_1.MacroNode(matchValue[1], []);
        this.value.children.push(macroNode);
        return undefined;
    };
    TEX.prototype.captureParent = function () {
        var parentNode = this.attachState(TEX).read();
        this.value.children.push(parentNode);
        return undefined;
    };
    return TEX;
})(lexing.MachineState);
exports.TEX = TEX;
var BIBTEX_STRING = (function (_super) {
    __extends(BIBTEX_STRING, _super);
    function BIBTEX_STRING() {
        _super.apply(this, arguments);
        // this is a pass-through state, so no need to initialize anything
        this.rules = [
            Rule(/^\s+/, this.ignore),
            Rule(/^"/, this.readSTRING),
            Rule(/^\{/, this.readTEX),
            Rule(/^/, this.readLITERAL),
        ];
    }
    BIBTEX_STRING.prototype.readSTRING = function () {
        return this.attachState(STRING).read();
    };
    BIBTEX_STRING.prototype.readTEX = function () {
        return this.attachState(TEX).read().toString();
    };
    BIBTEX_STRING.prototype.readLITERAL = function () {
        return this.attachState(LITERAL).read();
    };
    return BIBTEX_STRING;
})(lexing.MachineState);
exports.BIBTEX_STRING = BIBTEX_STRING;
var FIELD = (function (_super) {
    __extends(FIELD, _super);
    function FIELD() {
        _super.apply(this, arguments);
        this.rules = [
            Rule(/^\s+/, this.ignore),
            // could be a citekey:
            Rule(/^,/, this.popCiteKey),
            // otherwise, it's a field (key + value):
            Rule(/^=/, this.popField),
            Rule(/^./, this.captureMatch),
        ];
    }
    FIELD.prototype.popCiteKey = function () {
        return [this.value.join(''), null];
    };
    FIELD.prototype.popField = function () {
        var bibtexString = this.attachState(BIBTEX_STRING).read();
        var normalizedString = bibtexString.replace(/\s+/g, ' ');
        // TODO: other normalizations?
        return [this.value.join(''), normalizedString];
    };
    return FIELD;
})(StringCaptureState);
exports.FIELD = FIELD;
var FIELDS = (function (_super) {
    __extends(FIELDS, _super);
    function FIELDS() {
        _super.apply(this, arguments);
        this.value = new models_1.BibTeXEntry(null, null);
        this.rules = [
            Rule(/^\}/, this.pop),
            Rule(/^$/, this.pop),
            Rule(/^(\s+|,)/, this.ignore),
            Rule(/^/, this.pushFIELD),
        ];
    }
    FIELDS.prototype.pushFIELD = function () {
        var fieldValue = this.attachState(FIELD).read();
        if (fieldValue[1] === null) {
            // set citekey
            this.value.citekey = fieldValue[0];
        }
        else {
            // add field
            this.value.fields[fieldValue[0]] = fieldValue[1];
        }
        return undefined;
    };
    return FIELDS;
})(lexing.MachineState);
exports.FIELDS = FIELDS;
var BIBTEX_ENTRY = (function (_super) {
    __extends(BIBTEX_ENTRY, _super);
    function BIBTEX_ENTRY() {
        _super.apply(this, arguments);
        // this.value is the pubtype string
        this.rules = [
            Rule(/^\{/, this.popFIELDS),
            Rule(/^(.|\s)/, this.captureMatch),
        ];
    }
    BIBTEX_ENTRY.prototype.popFIELDS = function () {
        var fieldsValue = this.attachState(FIELDS).read();
        return new models_1.BibTeXEntry(this.value.join(''), fieldsValue.citekey, fieldsValue.fields);
    };
    return BIBTEX_ENTRY;
})(StringCaptureState);
exports.BIBTEX_ENTRY = BIBTEX_ENTRY;
var BibTeXEntryCaptureState = (function (_super) {
    __extends(BibTeXEntryCaptureState, _super);
    function BibTeXEntryCaptureState() {
        _super.apply(this, arguments);
        this.value = [];
        this.rules = [
            // EOF
            Rule(/^$/, this.pop),
            // special entry types
            Rule(/^@preamble\{/i, this.pushPreamble),
            // reference
            Rule(/^@/, this.pushBibTeXEntry),
            // whitespace
            Rule(/^(.|\s)/, this.ignore),
        ];
    }
    BibTeXEntryCaptureState.prototype.pushPreamble = function () {
        var tex = this.attachState(TEX).read();
        // simply discard it
        return undefined;
    };
    BibTeXEntryCaptureState.prototype.pushBibTeXEntry = function () {
        throw new Error('Cannot call abstract method');
        return undefined;
    };
    return BibTeXEntryCaptureState;
})(lexing.MachineState);
exports.BibTeXEntryCaptureState = BibTeXEntryCaptureState;
var BIBFILE = (function (_super) {
    __extends(BIBFILE, _super);
    function BIBFILE() {
        _super.apply(this, arguments);
    }
    BIBFILE.prototype.pushBibTeXEntry = function () {
        var reference = this.attachState(BIBTEX_ENTRY).read();
        this.value.push(reference);
        return undefined;
    };
    return BIBFILE;
})(BibTeXEntryCaptureState);
exports.BIBFILE = BIBFILE;
var BIBFILE_FIRST = (function (_super) {
    __extends(BIBFILE_FIRST, _super);
    function BIBFILE_FIRST() {
        _super.apply(this, arguments);
    }
    BIBFILE_FIRST.prototype.pushBibTeXEntry = function () {
        return this.attachState(BIBTEX_ENTRY).read();
    };
    return BIBFILE_FIRST;
})(BibTeXEntryCaptureState);
exports.BIBFILE_FIRST = BIBFILE_FIRST;
