class SyntaxError extends Error {
	constructor(line, column, message) {
		super(`syntax error at (${line}:${column}): ${message}`);
		this.name = "SyntaxError";
		this.line = line;
		this.column = column;
		this.originalMessage = message;
	}
	offset(line, column) {
		return new SyntaxError(
			this.line + line - 1,
			this.column + column - 1,
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
			} else {
				let off = getOffset(args[0], state, offset);
				if (off > 1023 || off < -1024) {
					throw new Error(`label ${args[0].text} is out of range: ` + off);
				}
				return opcode | (off & 0x7FF);
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
		register("br", 0x0E00, "l", br);
		alias("brnzp", "brnpz", "brznp", "brzpn", "brpnz", "brpzn");
		register("brnz", 0x0C00, "l", br);
		alias("brzn");
		register("brnp", 0x0A00, "l", br);
		alias("brpn");
		register("brn", 0x0800, "l", br);
		register("brzp", 0x0600, "l", br);
		alias("brpz");
		register("brz", 0x0400, "l", br);
		register("brp", 0x0200, "l", br);
		register("add", 0x1000, "rrr;rri", arith);
		register("and", 0x5000, "rrr;rri", arith);
		register("jmp", 0xC000, "r;l", jmp);
		register("jsr", 0x4800, "r;l", jmp);
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
		constructor(type, mnemonic) {
			if (typeof type !== "string") {
				throw new Error("bad type: " + type);
			}
			if (typeof mnemonic !== "string") {
				throw new Error("bad mnemonic: " + mnemonic);
			}
			this.type = type;
			this.mne = mnemonic;
		}
		toString() {
			return this.mne;
		}
	}
	const Dir = class extends Ident {
		constructor(mnemonic, signatures) {
			super("dir", mnemonic);
			this.sigs = signatures.split(";");
		}
	}
	const Inst = class extends Ident {
		constructor(mnemonic, opcode, signatures, handler) {
			super("inst", mnemonic);
			this.opcode = opcode;
			this.sigs = signatures.split(";");
			this.toByte = handler;
		}
	}
	const Reg = class extends Ident {
		constructor(mnemonic, value) {
			super("reg", mnemonic);
			this.value = value;
		}
	}
	const Macro = class extends Ident {
		constructor(mnemonic, handler) {
			super("macro", mnemonic);
			this.handler = handler;
		}
	};

	const register = function(descriptor) {
		m.set(descriptor.mne, descriptor);
	}

	const m = new Map();

	// registers
	register(new Reg("r0", 0));
	register(new Reg("r1", 1));
	register(new Reg("r2", 2));
	register(new Reg("r3", 3));
	register(new Reg("r4", 4));
	register(new Reg("r5", 5));
	register(new Reg("r6", 6));
	register(new Reg("r7", 7));

	// instructions
	const len = inst_meta.length;
	for (let i = 0; i < len; ++i) {
		const m = inst_meta[i];
		register(new Inst(m[0], m[1], m[2], m[3]));
	}

	// directives
	register(new Dir(".orig", "i"));
	register(new Dir(".stringz", "s"));
	register(new Dir(".fill", "i;l"));
	register(new Dir(".blkw", "i"));
	register(new Dir(".end", ""));

	return m;
}();

const Token = class {
	constructor(text, offset) {
		this.text = text;
		this.offset = offset;
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

const Tokenize = function() {
	const expr_re = /((?!\d)[\.\$]?[\w_]+|#[-+]?\d+|"(?:[^\\"]|\\.)*"|,|;.*)?\s*/y;
	const str_re = /\\(?:\d{1,3}|x[\da-fA-F]{2}|.)?/g;
	const symbols = new Set("-+*(),");
	const ident = new Set("$.ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_abcdefghijklmnopqrstuvwxyz");
	const escapes = function() {
		const from = "bfn0rtv\"'\\";
		const to = "\b\f\n\0\r\t\v\"'\\";
		const m = new Map();
		for (let i = 0; i < 10; ++i) m.set(from[i], to[i]);
		return m;
	}();
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
	}

	return function(line, lineNumber) {
		const tokens = [];
		expr_re.lastIndex = 0;
		while (expr_re.lastIndex != line.length) {
			const last = expr_re.lastIndex;
			const m = expr_re.exec(line);
			if (m[0] === "") {
				const ln = lineNumber;
				const part = line.substr(last, 10);
				throw new Error(`unexpected symbol(${ln}:${last}): "${part}"`);
			} else if (!m[1]) {
				continue;
			}
			const text = m[1];
			const offset = expr_re.lastIndex - text.length + 1;
			const token = new Token(text, offset);
			const c = text[0];
			if (c === "#") {
				token.value = parseInt(text.substr(1), 10);
				token.type = "int";
			} else if (c === "\"") {
				try {
					token.value = text.substring(1, text.length - 1)
						.replace(str_re, str_replace);
				} catch (e) {
					if (e instanceof SyntaxError) {
						throw e.offset(lineNumber, offset);
					} else {
						throw e;
					}
				}
				token.type = "str";
			} else if (symbols.has(text)) {
				token.type = "sym";
			} else if (ident.has(c)) {
				if (c === 'x' && /^x[\da-f]+$/i.test(text)) {
					token.value = parseInt(text.substr(1), 16);
					token.type = "int";
				} else {
					const meta = Identifiers.get(text.toLowerCase());
					if (meta) {
						token.value = meta.type === "reg" ? meta.value : meta;
						token.type = meta.type;
					} else if (!text.startsWith(".")) {
						token.type = "id";
					} else {
						throw "unrecognized directive: " + token;
					}
				}
			} else if (text.startsWith(";")) {
				token.type = "cmnt";
			} else {
				throw "don't know how to handle: " + JSON.stringify(token);
			}
			tokens.push(token);
		}
		return tokens;
	};
}();
const Parse = function() {
	const Mode = class {
		constructor(label) { this.label = label; }
		toString() { return this.label; }
	};
	// state machine (defined in reverse order to simplify chaining)
	const CMNT = new Mode("end");
	const SEP = new Mode("sep");
	const ARG = new Mode("arg");
	const CMD = new Mode("cmd");
	const LABEL = new Mode("label");
	const INIT = new Mode("init");

	// TODO add expression stuff
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

	return function(tokens, lineNumber) {
		const len = tokens.length;
		if (len === 0) return null;
		const stmt = new Stmt();
		stmt.line = lineNumber;
		let mode = INIT;
		let t;
		for (let i = 0; i < len; ++i) {
			t = tokens[i];
			switch (mode) {
			case INIT:
				switch (t.type) {
				case "id":
					stmt.label = t;
					t.line = lineNumber;
					mode = LABEL;
					break;
				case "inst":
				case "dir":
					stmt.cmd = t;
					stmt.args = [];
					mode = CMD;
					break;
				case "cmnt":
					stmt.cmnt = t;
					mode = CMNT;
					break;
				default:
					throw new SyntaxError(
						lineNumber,
						t.offset,
						expecting("label;directive;instruction;end of line", t));
				}
				break;
			case LABEL:
				switch (t.type) {
				case "inst":
				case "dir":
					stmt.cmd = t;
					stmt.args = [];
					mode = CMD;
					break;
				case "cmnt":
					stmt.cmnt = t;
					mode = CMNT;
					break;
				default:
					throw new SyntaxError(
						lineNumber,
						t.offset,
						expecting("directive;instruction;end of line", t));
				}
				break;
			case CMD:
				switch (t.type) {
				case "reg":
				case "id":
				case "int":
				case "str":
					stmt.args.push(t);
					mode = ARG;
					break;
				case "cmnt":
					stmt.cmnt = t;
					mode = CMNT;
					break;
				default:
					throw new SyntaxError(
						lineNumber,
						t.offset,
						expecting("register;identifier;integer", t));
				}
				break;
			case ARG:
				if (t.text === ",") {
					mode = SEP;
				} else if (t.type === "cmnt") {
					stmt.cmnt = t;
					mode = CMNT;
				} else {
					throw new SyntaxError(
						lineNumber,
						t.offset,
						expecting("separator;end of line", t));
				}
				break;
			case SEP:
				switch (t.type) {
				case "reg":
				case "id":
				case "int":
					stmt.args.push(t);
					mode = ARG;
					break;
				default:
					throw new SyntaxError(
						lineNumber,
						t.offset,
						expecting("register;identifier;integer", t));
				}
				break;
			case CMNT:
				throw new Error("token after comment?! " + t);
			default:
				throw new Error("unrecognized state?! " + mode);
			}
		}
		// end of stream
		if (mode === SEP) {
			throw new SyntaxError(
				lineNumber,
				t.offset,
				expecting("register;identifier;integer", t));
		}
		return stmt;
	};
}();

const match_sig = function(arg, sig) {
	switch (arg.type) {
	case "reg": return sig === "r";
	case "int": return sig === "i";
	case "id": return sig === "l";
	case "str": return sig === "s";
	default: throw new Error("impossible considtion?! (arg type) " + arg);
	}
}
const validate_cmd = function(stmt) {
	const cmd = stmt.cmd;
	if (cmd) {
		const sigs = cmd.value.sigs;
		const args = stmt.args;
		for (let j = 0; j < sigs.length; ++j) {
			const sig = sigs[j];
			const len = sig.length;
			if (args.length !== len) {
				continue;
			}
			let success = true;
			for (let i = 0; i < len; ++i) {
				if (!match_sig(args[i], sig[i])) {
					success = false;
					break;
				}
			}
			if (success) {
				return true;
			}
		}

		if (sigs.length > 0) {
			throw new SyntaxError(
				stmt.line,
				stmt.cmd.offset,
				`expecting ${sigs[0]}`);
		} else {
			throw new SyntaxError(
				stmt.line,
				stmt.cmd.offset,
				`expecting one of ${sigs.join()}`);
		}
	}
}

class Lc3Asm {
	assemble(text) {
		// collect statements from text
		const statements = [];
		const len = text.length;
		let last = 0;
		for (let lineNumber = 1; last < len; ++lineNumber) {
			let next = text.indexOf('\n', last);
			if (next < 0) next = text.length;
			const line = text.substring(last, next);
			const tokens = Tokenize(line, lineNumber);
			if (tokens.length > 0) {
				statements.push(Parse(tokens, lineNumber));
			}
			last = next + 1;
		}
		// first pass (label processing and verification)
		const end = this.first_pass(statements);
		if (end >= 0xFE00) {
			throw new Error("program exceeds allowed size (beyond 0xFE00)");
		}
		this.chunk = new Int16Array(end - this.origin);
		// second pass (create binary)
		this.second_pass(statements);
	}
	first_pass(statements) {
		const table = this.table = new Map();
		const lookup = this.lookup = new Map();
		let offset = undefined;
		this.origin = undefined;
		const len = statements.length;
		let i = 0;
		// scan for .orig
		for (; i < len; ++i) {
			const stmt = statements[i]
			if (stmt.label) {
				throw expecting(stmt, stmt.cmd, ".orig");
			}
			if (stmt.cmd) {
				if (stmt.cmd.text.toLowerCase() !== ".orig") {
					throw expecting(stmt, stmt.cmd, ".orig");
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
			if (stmt.label) {
				const label = stmt.label;
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
					throw new Error(`${label.text} defined multiple times`);
				}
				if (!isLocal) {
					lastLabel = text;
				}
			}
			validate_cmd(stmt);
			if (stmt.cmd) {
				const cmd = stmt.cmd;
				const meta = cmd.value;
				if (cmd.type === "inst") {
					offset += 1;
					if (stmt.args) {
						stmt.args.forEach(a => {
							if (a.type === "id") {
								let text = a.text;
								if (text.startsWith("$")) {
									text = lastLabel + text;
								}
								a.value = text;
								if (!table.has(text)) {
									table.set(text, false);
								}
							}
						});
					}
				} else if (cmd.type === "dir") {
					let value;
					switch (meta.mne) {
					case ".fill":
						if (stmt.args[0].type === "int") {
							value = stmt.args[0].value;
							if (value < -32767 || value > 0xFFFF) {
								throw "number out of range";
							}
						} else if (stmt.args[0].type === "id") {
							let text = stmt.args[0].text;
							if (text.startsWith("$")) {
								text = lastLabel + text;
							}
							stmt.args[0].value = text;
						}
						offset += 1;
						break;
					case ".blkw":
						value = stmt.args[0].value;
						if (value < 0) throw "negative size for blkw";
						offset += value;
						break;
					case ".stringz":
						offset += stmt.args[0].value.length + 1;
						break;
					case ".end":
						break;
					case ".orig":
						throw "unexpected second orig";
					default:
						throw "impossible condition?! (cmd) " + meta.mne;
					}
				} else {
					throw new Error("unknown statement type: " + cmd.type);
				}
				if (offset >= 0xFE00) {
					throw "program overflowed into device registers";
				}
			}
		}
		const missing = [];
		table.forEach(function (label, symbol) {
			if (!label) missing.push(symbol);
		});
		if (missing.length > 0) {
			throw new Error("missing symbols: " + missing.join(", "));
		}
		return offset;
	}
	second_pass(statements) {
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
				if (cmd.type == "dir") {
					switch (meta.mne) {
					case ".fill":
						switch (args[0].type) {
						case "int":
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
				} else if (cmd.type === "inst") {
					try {
						emit(meta.toByte(meta.opcode, args, this, offset));
					} catch (e) {
						log_json({ cmd, args });
						throw e;
					}
				} else {
					throw "impossible condition?!";
				}
			}
		}
		function emit(value) {
			chunk[offset++ - origin] = value;
		}
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
			const idx = k.indexOf("$");
			if (idx >= 0) {
				k = k.substring(idx);
			}
			parts.push(k + ":" + v.offset.toString(16).toUpperCase());
		});
		parts.push("");
		parts.push(arrayBufferToBase64(this.chunk));
		return parts.join(";");
	}
}

Lc3Disasm = function() {
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
			return `offset(#${Math.abs(sext(b, n))})`;
		}
	};
	const Arith = function(b) {
		if (b & 0x0020) {
			return `${this.mne} r${dr(b)}, r${lr(b)}, #${sext(b, 5)}`;
		} else {
			if (b & 0x0018) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `${this.mne} r${dr(b)} r${lr(b)}, r${rr(b)}`;
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
			return `JSR r${dr(b)}, ${target(b, s, o, 11)}`;
		} else {
			if (b & 0x063F) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `JSRR r${lr(b)}`;
			}
		}
	});
	const And = new Opcode("AND", 5, function(b) {
		if (b & 0x0020) {
			return `${this.mne} r${lr(b)}, #${sext(b, 5)}`;
		} else {
			if (b & 0x0018) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `${this.mne} r${lr(b)}, r${rr(b)}`;
			}
		}
	});
	const Ldr = new Opcode("LDR", 6, AddrRRI);
	const Str = new Opcode("STR", 7, AddrRRI);
	const Rti = new Opcode("RTI", 8, function(b) {
		return b === 0x8000 ? "RTI" : `.FILL x${toWord(b)}`;
	});
	const Not = new Opcode("NOT", 9, function(b) {
		if (b & 0x0020) {
			if (b & 0x001F) {
				return `NOT r${dr(b)}, r${lr(b)}`;
			} else {
				return `${this.mne} r${dr(b)}, r${lr(b)}, #${sext(b, 5)}`;
			}
		} else {
			if (b & 0x0018) {
				return `.FILL x${toWord(b)}`;
			} else {
				return `${this.mne} r${dr(b)}, r${lr(b)}, r${rr(b)}`;
			}
		}
	});
	const Ldi = new Opcode("LDI", 10, AddrOff);
	const Sti = new Opcode("STI", 11, AddrOff);
	const Jmp = new Opcode("JMP", 12, function(b, s, o) {
		if (b === 0xC1C0) {
			return "RET";
		} else if (b & 0x0800) {
			return `JMP r${dr(b)}, ${target(b, s, o, 11)}`;
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

	const translate = [
		Branch,  Add, Ld,  St,
		Jsr,     And, Ldr, Str,
		Rti,     Not, Ldi, Sti,
		Jmp, Invalid, Lea, Trap
	];

	for (let i = 0; i < translate.length; ++i) {
		Object.freeze(translate[i]);
	}

	return Object.freeze({
		disassemble(b, s, o) {
			return translate[(b >> 12) & 15].disassemble(b, s, o);
		}
	});
} ();

