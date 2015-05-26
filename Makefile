TYPESCRIPT = $(wildcard *.ts test/*.ts)

DTS := \
	node/node \
	async/async \
	chalk/chalk \
	lodash/lodash \
	mocha/mocha \
	yargs/yargs

all: $(TYPESCRIPT:%.ts=%.js) type_declarations/DefinitelyTyped.d.ts
type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

%.js: %.ts type_declarations
	node_modules/.bin/tsc -m commonjs -t ES5 $<

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@

type_declarations/DefinitelyTyped.d.ts:
	for path in $(DTS:%=DefinitelyTyped/%.d.ts); do echo "/// <reference path=\"$$path\" />"; done > $@
