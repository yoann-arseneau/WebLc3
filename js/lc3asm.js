class SyntaxError extends Error {
	constructor(line, column, message) {
		if (line instanceof Stmt) line = line.lineNumber;
		if (column instanceof Token) column = column.offset;
		let target = "";
		if (line >= 1) target += line;
		if (column >= 1) target += ":" + column;
		if (target) target = ` at (${target})`;
		super(`syntax error${target}: ${message}`);
		this.name = "SyntaxError";
		this.line = line;
		this.column = column;
		this.originalMessage = message;
	}
	offset(line, column) {
		return new SyntaxError(
			this.line + (line ?? 1) - 1,
			this.column + (column ?? 1) - 1,
			this.originalMessage);
	}
}

const Identifiers = function() {
	const inst_meta = function() {
		const getOffset = function(arg, state, offset) {
			switch (arg.type) {
			case "int": return arg.value - offset - 1;
			case "id": return state.address_of(arg.value) - offset - 1;
			default: throw new Error("impossible condition?! (getOffset) " + arg.type);
			}
		};
		const arith = function(opcode, args, state, offset) {
			opcode |= (args[0].value << 9) & 0x0E00;
			opcode |= (args[1].value << 6) & 0x01C0;
			switch (args[2].type) {
			case "reg": opcode |= args[2].value & 0x7; break;
			case "int": opcode |= 0x0020 | (args[2].value & 0x1F); break;
			default: throw "impossible condition?! (arith) " + arg;
			}
			return opcode;
		};
		const label = function(opcode, args, state, offset) {
			opcode |= (args[0].value << 9) & 0x0E00;
			let off = getOffset(args[1], state, offset);
			if (off > 255 || off < -256) {
				throw new Error(`label ${args[1].text} is out of range: ` + off);
			}
			opcode |= off & 0x01FF;
			return opcode;
		};
		const rri = function(opcode, args, state, offset) {
			opcode |= (args[0].value << 9) & 0x0E00;
			opcode |= (args[1].value << 6) & 0x01C0;
			opcode |= args[2].value & 0x003F;
			return opcode;
		};
		const rr = function(opcode, args, state, offset) {
			opcode |= (args[0].value << 9) & 0x0E00;
			opcode |= (args[1].value << 6) & 0x01C0;
			return opcode;
		};
		const jmp = function(opcode, args, state, offset) {
			const arg = args[0];
			if (arg.type === "reg") {
				return opcode | (arg.value << 6) & 0x01C0;
			} else if (arg.type === "id") {
				let off = getOffset(arg, state, offset);
				if (off > 1023 || off < -1024) {
					throw new Error(`label ${arg.text} is out of range: ` + off);
				}
				return opcode | (off & 0x7FF);
			} else if (arg.type === "int") {
				let off = getOffset(arg, state, offset);
				if (off > 1023 || off < -1024) {
					throw new Error(`label ${arg.text} is out of range: ` + off);
				}
				return opcode | (off & 0x7FF);
			} else {
				throw new Error("impossible condition?! arg.type");
			}
		};
		const trap = function(opcode, args, state, offset) {
			return opcode | args[0].value & 0x00FF;
		};
		const lit = function(opcode) { return opcode; };
		const br = function(opcode, args, state, offset) {
			let off = getOffset(args[0], state, offset);
			if (off > 255 || off < -256) {
				throw new Error(`label ${args[0].text} is out of range: ` + off);
			}
			return opcode | (off & 0x1FF);
		};

		const l = [];
		register("br", 0x0E00, "l;i", br);
		alias("brnzp", "brnpz", "brznp", "brzpn", "brpnz", "brpzn");
		register("brnz", 0x0C00, "l;i", br);
		alias("brzn");
		register("brnp", 0x0A00, "l;i", br);
		alias("brpn");
		register("brn", 0x0800, "l;i", br);
		register("brzp", 0x0600, "l;i", br);
		alias("brpz");
		register("brz", 0x0400, "l;i", br);
		register("brp", 0x0200, "l;i", br);
		register("add", 0x1000, "rrr;rri", arith);
		register("and", 0x5000, "rrr;rri", arith);
		register("jmp", 0xC000, "r;l;i", jmp);
		register("jsr", 0x4800, "r;l;i", jmp);
		register("jsrr", 0x4000, "r", jmp);
		register("ld", 0x2000, "rl", label);
		register("ldi", 0xA000, "rl", label);
		register("ldr", 0x6000, "rri", rri);
		register("lea", 0xE000, "rl", label);
		register("not", 0x903F, "rr", rr);
		register("ret", 0xC1C0, "", lit);
		register("rti", 0x8000, "", lit);
		register("st", 0x3000, "rl", label);
		register("sti", 0xB000, "rl", label);
		register("str", 0x7000, "rri", rri);
		register("trap", 0xF000, "i", trap);
		register("getc", 0xF020, "", lit);
		register("out", 0xF021, "", lit);
		register("puts", 0xF022, "", lit);
		register("in", 0xF023, "", lit);
		register("putsp", 0xF024, "", lit);
		register("halt", 0xF025, "", lit);
		return l;

		function register(name, opcode, signatures, handler) {
			l.push([name, opcode, signatures, handler]);
		}
		function alias(...alias) {
			for (let i = 0; i < alias; ++i) {
				const last = l[l.length - 1];
				const entry = last.slice(1);
				entry.unshift(alias[i]);
				l.push(entry);
			}
		}
	} ();

	const Ident = class {
		constructor(type, mne) {
			this.type = type;
			this.mne = mne;
		}
		toString() {
			return this.mne;
		}
	};

	const newReg = function(mne, value) {
		const id = new Ident("reg", mne);
		id.value = value;
		return id;
	}
	const newInst = function(mne, opcode, sigs, toByte) {
		const id = new Ident("inst", mne);
		id.opcode = opcode;
		id.sigs = sigs.split(";");
		id.toByte = toByte;
		return id;
	}
	const newDir = function(mne, sigs) {
		const id = new Ident("dir", mne);
		id.sigs = sigs.split(";");
		return id;
	}

	const register = function(descriptor) {
		m.set(descriptor.mne, Object.freeze(descriptor));
	}

	const m = new Map();

	// registers
	register(newReg("r0", 0));
	register(newReg("r1", 1));
	register(newReg("r2", 2));
	register(newReg("r3", 3));
	register(newReg("r4", 4));
	register(newReg("r5", 5));
	register(newReg("r6", 6));
	register(newReg("r7", 7));

	// instructions
	const len = inst_meta.length;
	for (let i = 0; i < len; ++i) {
		const m = inst_meta[i];
		register(newInst(m[0], m[1], m[2], m[3]));
	}

	// directives
	register(newDir(".orig", "i"));
	register(newDir(".stringz", "s"));
	register(newDir(".fill", "i;l;c"));
	register(newDir(".blkw", "i"));
	register(newDir(".end", ""));

	return Object.freeze(m);
} ();

const Token = class {
	constructor(text, offset, type) {
		this.text = text;
		this.offset = offset;
		this.type = type;
	}
	toString() {
		return this.text;
	}
}
const Stmt = class {
	toString() {
		const parts = [];
		if (this.label) parts.push(this.label.text);
		if (this.cmd) {
			parts.push(this.cmd);
			const len = this.args.length;
			for (let i = 0; i < len; ++i) {
				let arg = this.args[i].text;
				if (i < this.args.length - 1) arg += ",";
				parts.push(arg);
			}
		}
		if (this.cmnt) parts.push(this.cmnt.text);
		return parts.join(' ');
	}
}

const ParseState = function() {
	const ParseNode = class {
		constructor(name, end, capture, predicate) {
			this.name = name;
			this.end = end == true;
			capture = capture ?? "";
			if (capture.endsWith("[]")) {
				this.captureName = capture.substring(0, capture.length - 2);
				this.captureArray = true;
			} else if (capture.length > 0) {
				this.captureName = capture;
				this.captureArray = false;
			}
			if (predicate != null && typeof predicate !== "function") {
				throw new Error("predicate is not a function");
			}
			this.matches = predicate;
		}
		capture(token, state) {
			const name = this.captureName;
			if (name) {
				if (this.captureArray) {
					let entry = state[name];
					if (!entry) {
						state[name] = [token];
					} else {
						entry.push(token);
					}
				} else {
					state[name] = token;
				}
			}
		}
	};

	const fromText = function(name, end, text) {
		return new ParseNode(name, end, undefined, function(token) {
			return token.text === text;
		});
	}
	const fromType = function(name, end, capture, type) {
		return new ParseNode(name, end, capture, function(token) {
			return token.type === type;
		});
	}
	const fromTypes = function(name, end, capture, types) {
		types = types.split(",");
		return new ParseNode(name, end, capture, function(token) {
			return types.includes(token.type);
		});
	}

	const START     = new ParseNode("START", true);
	const LABEL     = fromType("LABEL", false, "label", "id");
	const COMMAND   = fromTypes("COMMAND", true, "command", "inst,dir,id");
	const ARGUMENT  = fromTypes("ARGUMENT", true, "args[]", "reg,id,int,str,chr");
	const SEPARATOR = fromText("SEPARATOR", false, ",");
	const COMMENT   = fromType("COMMENT", true, "cmnt", "cmnt");

	START.next     = [COMMAND, LABEL, COMMENT];
	LABEL.next     = [COMMAND, COMMENT];
	COMMAND.next   = [ARGUMENT, COMMENT];
	ARGUMENT.next  = [SEPARATOR, COMMENT];
	SEPARATOR.next = [ARGUMENT];
	COMMENT.next   = null;

	return class {
		parse(tokens, lineNumber) {
			const state = Object.create(null);
			this._tokens = tokens;
			this._state = state;
			if (!this._step(0, START)) {
				log_json({tokens, lineNumber});
				throw new Error();
				return false;
			}
			const { label, command, args } = state;
			const stmt = new Stmt();
			stmt.lineNumber = lineNumber;
			if (label) stmt.label = label;
			if (command) stmt.cmd = command;
			if (args) stmt.args = args.reverse();
			return stmt;
		}
		_step(index, node) {
			if (index === this._tokens.length) {
				return node.end;
			}
			const token = this._tokens[index];
			const transitions = node.next;
			const len = transitions?.length ?? 0;
			for (let i = 0; i < len; ++i) {
				const next = transitions[i];
				if (next.matches(token) && this._step(index + 1, next)) {
					next.capture(token, this._state);
					return true;
				}
			}
			return false;
		}
	}
} ();

const expecting = function(types, token) {
	types = types.split(";");
	let prefix;
	if (types.length === 1) {
		prefix = `expecting ${types[0]}`;
	} else if (types.length > 1) {
		prefix = `expecting one of (${types.join(", ")})`;
	} else {
		throw new Error("expecting at least one type?!");
	}
	return prefix + ` but found ${token.type}("${token.text}")`;
}

//{ Lc3Asm._validateStmt constants
const argTypeMap = new Map();
argTypeMap.set("reg", "r");
argTypeMap.set("int", "i");
argTypeMap.set("id", "l");
argTypeMap.set("str", "s");
argTypeMap.set("chr", "c");
const commandTypes = new Set();
commandTypes.add("inst");
commandTypes.add("dir");
//}

const Tokenizer = (function() {
	const TokenGroup = class {
		constructor(name, type, pattern) {
			this.name = name;
			this.type = type;
			this.pattern = new RegExp(pattern, 'y');
			Object.freeze(this);
		}
		consume(tokenizer) {
		}
	};

	const ws = new TokenGroup("whitespace", "ws", /\s+/);
	const escape_re = /\\(?:\d{1,3}|x[\da-fA-F]{2}|.)/g;

	const hexToInt = function(token) {
		let text = token.text;
		token.value = parseInt(text.substring(text[0] == '#' ? 2 : 1), 16);
	};
	const decToInt = function(token) {
		token.value = parseInt(token.text.substring(1), 10);
	};
	const unescapeString = function(token) {
		const text = token.text;
		token.value = text.substring(1, text.length - 1).replace(escape_re, escape_fn);
	};
	const classifyIdentifier = function(token) {
		if (token.text.charAt(0) === ".") {
			token.type = "dir";
		}
	};

	const tokenGroups = [
		new TokenGroup("hex integer", "int", /#?x[\da-fA-F]+(?!\w)/, hexToInt),
		new TokenGroup("identifier", "id", /(?!\d)[\.\$@]?\w+/, classifyIdentifier),
		new TokenGroup("symbols", "sym", /,/, decToInt),
		new TokenGroup("dec integer", "int", /#[-+]?\d+/),
		new TokenGroup("string", "str", new RegExp(`"(?:(?:${escape_re.source})|[^"])*"`), unescapeString),
		new TokenGroup("character", "chr", new RegExp(`'(?:(?:${escape_re.source})|[^'])'`), unescapeString),
		new TokenGroup("comment", "cmnt", /;.*/),
	];
	const tokenGroupCount = tokenGroups.length;

	return {
		tokenize(text) {
			const tokens = [];
			const len = line.length;
			let lastIndex = 0;
			while (last < len) {
				// skip whitespace
				const p = ws.pattern;
				p.lastIndex = lastIndex;
				const m = p.exec(state.text);
				if (m) {
					lastIndex = p.lastIndex;
				}
				// try to produce a token
				let i = 0;
				do {
					const tg = tokenGroups[i];
					const p = tg.pattern;
					p.lastIndex = lastIndex;
					const m = p.exec(text);
					if (m) {
						tokens.push(new Token(m[0], index, tg.type));
						break;
					}
				} while (++i < tokenGroupCount);
				if (i === tokenGroupCount) {
					// no match; throw error
					let next = line.substr(state.index, 10);
					throw new SyntaxError(1, state.index, `invalid character sequence`);
				}
			}
			return tokens;
		}
	};
}) ();

const tokenize = function(line) {
	const expr_re = new RegExp(
		"("
		+ [
			/[\.\$@]?(?!\d)\w+/,
			/,/,
			/#[-+]?\d+/,
			/;.*/,
			/"(?:\\(?:\d{1,3}|x[\da-fA-F]{2})|[^"])*"/,
			/'(?:\\(?:\d{1,3}|x[\da-fA-F]{2})|[^'])'/,
		].map(p=>p.source).join('|')
		+ ")?\\s*", "y");
	const chr_re = /\\(?:\d{1,3}|x[\da-fA-F]{2}|.)?/;
	const str_re = new RegExp(chr_re, 'g');
	const symbols = new Set("-+*(),");
	const ident = new Set("$.@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_abcdefghijklmnopqrstuvwxyz");
	const escapes = new Map([
		['b', '\b'],
		['f', '\f'],
		['n', '\n'],
		['0', '\0'],
		['r', '\r'],
		['t', '\t'],
		['v', '\v'],
		['\"', '\"'],
		['\'', '\''],
		['\\', '\\']
	]);
	const str_replace = function(m, o) {
		if (m.length == 1) throw new Error("trailing escape sequence");
		const c = m[1];
		if (c >= '0' && c <= '9') {
			return String.fromCharCode(parseInt(match.substring(1), 8));
		} else if (c === 'x') {
			return String.fromCharCode(parseInt(match.substring(2), 16));
		} else {
			const e = escapes.get(c);
			if (e === undefined) {
				throw new SyntaxError(1, o, "unrecognized escape character: " + c);
			}
			return e;
		}
	};

	return function(line) {
		const tokens = [];
		expr_re.lastIndex = 0;
		while (expr_re.lastIndex != line.length) {
			const last = expr_re.lastIndex;
			const m = expr_re.exec(line);
			if (m[0] === "") {
				// matched nothing
				throw new SyntaxError(
					1,
					last + 1,
					`unexpected symbol: ${line.substr(last, 10)}`);
			} else if (!m[1]) {
				// only matched on space
				continue;
			}
			const text = m[1];
			const offset = last + 1;
			const token = new Token(text, offset);
			const c = text[0];
			if (c === "#") {
				token.value = parseInt(text.substr(1), 10);
				token.type = "int";
			} else if (c === "\"") {
				token.type = "str";
				try {
					token.value = text.substring(1, text.length - 1)
						.replace(str_re, str_replace);
				} catch (e) {
					if (e instanceof SyntaxError) {
						throw e.offset(1, offset);
					} else {
						throw e;
					}
				}
			} else if (c === "'") {
				token.type = "chr";
				try {
					const chr = text.substring(1, text.length - 1)
						.replace(chr_re, str_replace);
					if (chr.length !== 1) {
						throw new SyntaxError(
							1,
							token,
							"char literal can only have a single character");
					}
					token.value = chr.charCodeAt(0);
				} catch (e) {
					if (e instanceof SyntaxError) {
						throw e.offset(1, offset);
					} else {
						throw e;
					}
				}
				token.type = "chr";
			} else if (symbols.has(text)) {
				token.type = "sym";
			} else if (ident.has(c)) {
				if (c === 'x' && /^x[\da-fA-F]+$/.test(text)) {
					token.type = "int";
					token.value = parseInt(text.substr(1), 16);
				} else if (text.charAt(0) === "@") {
					const mne = text.substring(1).toLowerCase();
					const meta = Identifiers.get(mne);
					if (!meta || !meta.type === "type") {
						throw new SyntaxError(
							1,
							token,
							`@ notation expects an instruction: ${text}`);
					}
					token.type = "inst";
					token.meta = meta;
				} else {
					const mne = text.toLowerCase();
					const meta = Identifiers.get(mne);
					if (meta) {
						token.type = meta.type;
						if (meta.value) {
							token.value = meta.value;
						} else {
							token.meta = meta;
						}
					} else {
						token.type = "id";
						token.mne = mne;
					}
				}
			} else if (text.startsWith(";")) {
				token.type = "cmnt";
			} else {
				throw new Error("don't know how to handle: " + JSON.stringify(token));
			}
			tokens.push(token);
		}
		return tokens;
	};
} ();

class Lc3Asm {
	constructor() {
		Object.defineProperties(this, {
			table: { value: new Map(), enumerable: true },
			lookup: { value: new Map(), enumerable: true },
			origin: { writable: true, enumerable: true },
			chunk: { writable: true, enumerable: true },
			macros: { value: new Map(), enumerable: true },
			_parser: { value: new ParseState(), enumerable: false }
		});
	}
	assemble(text, chunkName) {
		// collect statements from text
		const statements = this._processChunk(
			text,
			[chunkName ?? "<unamed chunk>"]);
		// first pass (label processing and verification)
		const end = this._firstPass(statements);
		if (end >= 0xFE00) {
			throw new Error("program exceeds allowed size (beyond 0xFE00)");
		}
		this.chunk = new Int16Array(end - this.origin);
		// second pass (create binary)
		this._secondPass(statements);
	}
	_processChunk(text, scope) {
		try {
			if (scope.length >= 128) {
				throw new Error(`maximum recursion reached!\n${scope.join('\n')}`);
			}
			const statements = [];
			const len = text.length;
			let last = 0;
			const parseState = new ParseState();
			for (let lineNumber = 1; last < len; ++lineNumber) {
				let next = text.indexOf('\n', last);
				if (next < 0) {
					next = text.length;
				}
				const line = text.substring(last, next);
				let tokens;
				try {
					tokens = tokenize(line);
				} catch (e) {
					if (e instanceof SyntaxError) {
						throw e.offset(lineNumber, 1);
					} else {
						throw e;
					}
				}
				if (tokens.length > 0) {
					const stmt = parseState.parse(tokens, lineNumber);
					if (!stmt) {
						let msg = [`could not parse: ${tokens.join(' ')}`, ...scope];
						throw new SyntaxError(lineNumber, 0, msg.join('\n    from: '));
					}
					const cmd = stmt.cmd;
					const macro = this.macros.get(cmd?.mne);
					if (macro) {
						let lines
						try {
							lines = macro(stmt.label, cmd, stmt.args ?? []);
						}
						catch (e) {
							if (e instanceof SyntaxError) {
								throw e.offset(stmt.lineNumber, cmd.offset);
							}
							else {
								throw new SyntaxError(stmt, cmd, `error in macro: ${e.message}`);
							}
						}
						if (Array.isArray(lines)) {
							lines = lines.join("\n");
						} else if (lines == null) {
							lines = "";
						} else if (typeof lines !== "string") {
							throw new Error("expecting array or string from macro");
						}
						const generated = this._processChunk(lines, [stmt, ...scope]);
						const len = generated?.length;
						for (let i = 0; i < len; ++i) {
							statements.push(generated[i]);
						}
					} else {
						statements.push(stmt);
					}
				}
				last = next + 1;
			}
			return statements;
		}
		catch (e) {
			console.log(scope);
			console.log(e);
			throw e;
		}
	}
	_firstPass(statements) {
		const table = this.table;
		const lookup = this.lookup;
		table.clear();
		lookup.clear();
		let offset = undefined;
		this.origin = undefined;
		const len = statements.length;
		let i = 0;
		// scan for .orig
		for (; i < len; ++i) {
			const stmt = statements[i]
			if (stmt.label) {
				throw new Error("expecting .orig but found label");
			}
			if (stmt.cmd) {
				if (stmt.cmd.text.toLowerCase() !== ".orig") {
					throw new Error("expecting .orig but found " + stmt.cmd.text);
				}
				if (!stmt.args || stmt.args.length !== 1) {
					throw new Error("expecting exactly one argument for .orig");
				}
				const arg = stmt.args[0];
				if (arg.type !== "int") {
					throw "expecting program offset as an unsigned integer between 0 and xFE00";
				}
				const value = arg.value;
				if (value < 0 || value >= 0xFE00) {
					throw "expecting an unsigned integer between 0 and xFE00";
				}
				this.origin = offset = value & 0xFFFF;
				i += 1;
				stmt.cmd.value = Identifiers.get(stmt.cmd.text.toLowerCase());
				break;
			}
		}
		if (this.origin === undefined) {
			throw new Error("expecting .orig directive");
		}
		// process remaining statements
		let lastLabel = "";
		for (; i < len; ++i) {
			let stmt = statements[i];
			const label = stmt.label;
			if (label) {
				const entry = { offset, label };
				let text = label.text;
				const isLocal = text.startsWith("$");
				if (isLocal) {
					text = lastLabel + text;
				}
				label.value = text;
				if (!table.get(text)) {
					table.set(text, entry);
					lookup.set(offset, text);
				} else {
					log_json(stmt);
					throw new Error(`${label.value} defined multiple times`);
				}
				if (!isLocal) {
					lastLabel = text;
				}
			}
			if (stmt.cmd) {
				this._validateStmt(stmt);
				const cmd = stmt.cmd;
				const meta = cmd.value;
				const args = stmt.args;
				if (meta.type === "inst") {
					offset += 1;
					if (args) {
						args.forEach(a => {
							if (a.type === "id") {
								let text = a.text;
								if (text.startsWith("$")) {
									text = lastLabel + text;
								}
								a.value = text;
								if (!table.has(text)) {
									//log("undefined label: " + text);
									table.set(text, false);
								}
							}
						});
					}
				} else if (meta.type === "dir") {
					let value;
					switch (meta.mne) {
					case ".fill": {
						const arg = args[0];
						if (arg.type === "int" || arg.type === "chr") {
							value = arg.value;
							if (value < -32767 || value > 0xFFFF) {
								throw new SyntaxError(stmt, arg, "number out of range");
							}
						} else if (arg.type === "id") {
							let text = arg.text;
							if (text.startsWith("$")) {
								text = lastLabel + text;
							}
							arg.value = text;
						} else {
							throw new Error("impossible condition?! bad verification");
						}
						offset += 1;
					} break;
					case ".blkw":
						value = stmt.args[0].value;
						if (value < 0) throw new Error("negative size for blkw");
						offset += value;
						break;
					case ".stringz":
						offset += stmt.args[0].value.length + 1;
						break;
					case ".end":
						break;
					case ".orig":
						throw new Error("unexpected second orig");
					default:
						throw new Error("impossible condition?! (cmd) " + meta.mne);
					}
				} else {
					throw new Error("unknown statement type: " + cmd.type);
				}
				if (offset >= 0xFE00) {
					throw new Error("program overflowed into device registers");
				}
			}
		}
		const late_link = [];
		const missing = [];
		table.forEach(function (label, symbol) {
			if (!label) {
				if (symbol.startsWith("$")) {
					missing.push(symbol);
				} else {
					late_link.push(symbol);
				}
			}
		});
		if (missing.length > 0) {
			log_json(table);
			throw new Error("missing symbols: " + missing.join(", "));
		}
		if (late_link.length > 0) {
			log_json({late_link});
			throw new Error("late linking not supported yet, missing symbols: " + late_link.join(", "));
		}
		return offset;
	}
	_validateStmt(stmt) {
		const cmd = stmt.cmd;
		const meta = cmd.meta;
		if (!meta || !commandTypes.has(meta.type)) {
			throw new SyntaxError(
				stmt,
				cmd,
				"expecting instruction or directive but found " + cmd.text);
		}
		const sigs = meta.sigs;
		const args = stmt.args;
		for (let j = 0; j < sigs.length; ++j) {
			const sig = sigs[j];
			const len = sig.length;
			if ((args?.length ?? 0) !== len) {
				continue;
			}
			let success = true;
			for (let i = 0; i < len; ++i) {
				if (argTypeMap.get(args[i].type) !== sig[i]) {
					success = false;
					break;
				}
			}
			if (success) {
				cmd.value = meta;
				return true;
			}
		}
		if (sigs.length === 1) {
			log_json({sigs, stmt});
			throw new SyntaxError(stmt, cmd, `expecting ${sigs[0]}`);
		} else {
			log_json({sigs, stmt});
			throw new SyntaxError(stmt, cmd, `expecting one of ${sigs.join()}`);
		}
	}
	_secondPass(statements) {
		const chunk = this.chunk;
		const origin = this.origin;
		let offset = origin;
		const len = statements.length;
		const table = this.table;
		for (let i = 0; i < len; ++i) {
			const stmt = statements[i];
			if (stmt.cmd) {
				const cmd = stmt.cmd;
				const args = stmt.args;
				const meta = cmd.value;
				if (meta.type == "dir") {
					switch (meta.mne) {
					case ".fill":
						switch (args[0].type) {
						case "int":
						case "chr":
							emit(args[0].value);
							break;
						case "id":
							emit(table.get(args[0].value).offset);
							break;
						default:
							throw new Error("impossible condition?! (fill) " + args[0].text);
						}
						break;
					case ".blkw":
						offset += args[0].value;
						break;
					case ".string":
					case ".stringz":
						const value = args[0].value;
						for (let i = 0; i < value.length; ++i) {
							let c = value.charCodeAt(i);
							if (c < 0 || c > 0x7F) {
								throw new Error("only supports ascii characters");
							}
							emit(c);
						}
						if (meta.mne.endsWith("z")) {
							emit(0);
						}
						break;
					case ".end":
					case ".orig":
						break;
					default:
						throw "impossible condition?! (dir) " + cmd;
					}
				} else if (meta.type === "inst") {
					try {
						emit(meta.toByte(meta.opcode, args, this, offset));
					} catch (e) {
						throw e;
					}
				} else {
					throw new Error("impossible condition?! ");
				}
			}
		}
		function emit(value) {
			chunk[offset++ - origin] = value;
		}
	}

	registerLabel(label, address) {
		if (typeof label !== "label") {
			throw new Error("label must be string");
		}
		if (typeof address !== "number") {
			throw new Error("address must be a number");
		}
		address |= 0;
		if (address < 0 || address > 0xFFFF) {
			throw new Error("address must be within [x0000 .. xFFFF] but found " + address);
		}
		if (table.has(label)) {
			throw new Error();
		}
		table.set(address, label);
		lookup.set(address, label);
	}
	registerMacro(mnemonic, translator) {
		if (!/^(?!\d)[\w_]+$/.test(mnemonic)) {
			throw new Error(`${stringify(mnemonic)} is not a valid macro name`);
		}
		if (Identifiers.has(mnemonic)) {
			throw new Error(`${mnemonic} is a reserved name`);
		}
		if (this.macros.has(mnemonic)) {
			throw new Error(`macro with name ${mnemonic} is already registered`);
		}
		this.macros.set(mnemonic.toLowerCase(), translator);
	}

	address_of(label) {
		return this.table.get(label)?.offset;
	}
	label_for(offset) {
		return this.lookup.get(offset);
	}
	disassemble(word, offset) {
		word = word & 0xFFFF;
		return OpCodes[word >> 12](word, this, offset);
	}

	serialize() {
		const parts = ["Lc3Asm", this.origin.toString(16).toUpperCase()];
		this.table.forEach((v, k) => {
			if (!k.includes("$")) {
				parts.push(k + ":" + v.offset.toString(16).toUpperCase());
			}
		});
		parts.push("");
		parts.push(arrayBufferToBase64(this.chunk));
		return parts.join(";");
	}
}

Lc3Disasm = function(word, state, offset) {
	const cc_labels = [null, "p", "z", "zp", "n", "np", "nz", ""];
	const trap_labels = new Map();
	trap_labels.set(0x20, "GETC");
	trap_labels.set(0x21, "OUT");
	trap_labels.set(0x22, "PUTS");
	trap_labels.set(0x23, "IN");
	trap_labels.set(0x24, "PUTSP");
	trap_labels.set(0x25, "HALT");

	const dr = b => (b >> 9) & 7;
	const lr = b => (b >> 6) & 7;
	const rr = b => b & 7;

	class Opcode {
		constructor(mnemonic, opcode, disassemble) {
			this.mne = mnemonic;
			this.opcode = opcode;
			this.disassemble = disassemble;
			Object.freeze(this);
		}
		toString() {
			return this.mne;
		}
	};

	const target = (b, s, o, n) => {
		if (s && typeof o === "number") {
			const target = o + 1 + sext(b, n);
			const label = s?.label_for(target);
			if (label) {
				return `x${toWord(target)} (${label})`;
			} else {
				return `x${toWord(target)}`;
			}
		} else {
			return `offset(#${sext(b, n)})`;
		}
	};
	const Arith = function(b) {
		if (b & 0x0020) {
			return `${this.mne} r${dr(b)}, r${lr(b)}, #${sext(b, 5)}`;
		} else {
			if (b & 0x0018) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `${this.mne} r${dr(b)}, r${lr(b)}, r${rr(b)}`;
			}
		}
	};
	const AddrOff = function(b, s, o) {
		return `${this.mne} r${dr(b)}, ${target(b, s, o, 9)}`;
	};
	const AddrRRI = function(b) {
		return `${this.mne} r${dr(b)}, r${lr(b)}, #${sext(b, 6)}`;
	};

	const Branch = new Opcode("BR", 0, function(b, s, o) {
		const mask = cc_labels[dr(b)];
		if (mask === null) {
			return `NOP (#${b})`;
		} else {
			return `BR${mask} ${target(b, s, o, 9)}`;
		}
	});
	const Add = new Opcode("ADD", 1, Arith);
	const Ld = new Opcode("LD", 2, AddrOff);
	const St = new Opcode("ST", 3, AddrOff);
	const Jsr = new Opcode("JSR", 4, function(b, s, o) {
		if (b & 0x0800) {
			return `JSR ${target(b, s, o, 11)}`;
		} else {
			if (b & 0x063F) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `JSRR r${lr(b)}`;
			}
		}
	});
	const And = new Opcode("AND", 5, Arith);
	const Ldr = new Opcode("LDR", 6, AddrRRI);
	const Str = new Opcode("STR", 7, AddrRRI);
	const Rti = new Opcode("RTI", 8, function(b) {
		return b === 0x8000 ? "RTI" : `.FILL x${toWord(b)}`;
	});
	const Not = new Opcode("NOT", 9, function(b) {
		if (b & 0x0020) {
			if ((b & 0x001F) == 0x001F) {
				return `NOT r${dr(b)}, r${lr(b)}`;
			} else {
				return `XOR r${dr(b)}, r${lr(b)}, #${sext(b, 5)}`;
			}
		} else {
			if (b & 0x0018) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `XOR r${dr(b)}, r${lr(b)}, r${rr(b)}`;
			}
		}
	});
	const Ldi = new Opcode("LDI", 10, AddrOff);
	const Sti = new Opcode("STI", 11, AddrOff);
	const Jmp = new Opcode("JMP", 12, function(b, s, o) {
		if (b === 0xC1C0) {
			return "RET";
		} else if (b & 0x0800) {
			return `JMP ${target(b, s, o, 11)}`;
		} else {
			if (b & 0x063F) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `JMP r${lr(b)}`;
			}
		}
	});
	const Invalid = new Opcode(null, 13, function(b) {
		return `.FILL x${toWord(b)}`;
	});
	const Lea = new Opcode("LEA", 14, function(b, s, o) {
		return `LEA r${dr(b)}, ${target(b, s, o, 9)}`;
	});
	const Trap = new Opcode("TRAP", 15, function(b) {
		return  b & 0x0F00 ? `.FILL x${toWord(b)}` : `TRAP x${toByte(b)}`;
	});

	const translate = Object.freeze([
		Branch,  Add, Ld,  St,
		Jsr,     And, Ldr, Str,
		Rti,     Not, Ldi, Sti,
		Jmp, Invalid, Lea, Trap
	]);

	return Object.freeze({
		disassemble(b, s, o) {
			return translate[(b >> 12) & 15].disassemble(b & 0xFFFF, s, o);
		}
	});
} ();

