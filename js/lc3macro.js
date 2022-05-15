const expectN = function(cmd, args, n) {
	if (args.length !== n) {
		throw new SyntaxError(1, cmd, `${cmd} macro expects ${n} arguments`);
	}
}
const expectType = function(args, n, type) {
	const arg = args[n];
	if (arg.type !== type) {
		throw new SyntaxError(1, arg, `argument ${n+1} must be ${type}`);
	}
	return arg;
}

const noSupport = function(cmd, args) {
	return new SyntaxError(
		1,
		cmd,
		`${cmd} doesn't support arguments ${args.map(v=>v.type).join(', ')}`);
}

/*
clr
mov xor eqv
inc dec
neg sub
test
call save restore push pop
*/

const builtin = {
	clr(lbl, cmd, args) {
		expectN(cmd, args, 1);
		if (!lbl) lbl = "";
		let d = expectType(args, 0, "reg");
		return `${lbl ?? ""} @and ${d}, ${d}, #0`;
	},
	neg(lbl, cmd, args) {
		expectN(cmd, args, 2);
		let d = expectType(args, 0, "reg");
		let s = expectType(args, 1, "reg");
		return [`${lbl ?? ""} @not ${d}, ${s}`, `@add ${d}, ${d}, #1`];
	},
	xor(lbl, cmd, args) {
		// only works on LC3 machines with extended NOT instruction
		expectN(cmd, args, 3);
		if (!lbl) lbl = "";
		let d = expectType(args, 0, "reg");
		let l = expectType(args, 1, "reg");
		let r = args[2];
		const b = (d.value << 9) | (l.value << 6);
		if (r.type === "int") {
			if (r.value > 15 || r.value < -16) {
				throw new SyntaxError(
					1,
					r,
					"immediate must be between [15 .. -16] but found " + r);
			}
			return `${lbl} .FILL x${toWord(0x9020 | b | (r.value & 0x1F))}`;
		} else if (r.type === "reg") {
			return `${lbl} .FILL x${toWord(0x9000 | b | r.value)}`;
		} else {
			throw new SyntaxError(
				1,
				r,
				"third argument must be register or integer but found: " + r);
		}
	},
	eqv(lbl, cmd, args) {
		expectN(cmd, args, 3);
		if (!lbl) lbl = "";
		let d = expectType(args, 0, "reg");
		let l = expectType(args, 1, "reg");
		let r = args[2];
		return [`${lbl} xor ${d}, ${l}, ${r}`, `@not ${d}, ${d}`];
	},
	inc(lbl, cmd, args) {
		expectN(cmd, args, 1);
		let d = expectType(args, 0, "ref");
		return `@add ${d}, ${d}, #1`;
	},
	dec(lbl, cmd, args) {
		expectN(cmd, args, 1);
		let d = expectType(args, 0, "ref");
		return `@add ${d}, ${d}, #-1`;
	},
	sub(lbl, cmd, args) {
		expectN(cmd, args, 3);
		if (!lbl) lbl = "";
		let d = expectType(args, 0, "reg");
		let l = expectType(args, 1, "reg");
		let r = args[2];
		if (r.type === "int") {
			return `${lbl} @add ${d}, ${l}, #${-r.value}`;
		} else if (r.type === "reg") {
			if (l.value === r.value) {
				return `${lbl} @and ${d}, ${d}, #0`;
			} else if (d.value !== l.value) {
				return [`${lbl} @not ${d}, ${r}`, `@add ${d}, ${d}, ${l}`, `@add ${d}, ${d}, #1`];
			} else {
				return [`${lbl} @not ${d}, ${l}`, `@add ${d}, ${d}, ${r}`, `@not ${d}, ${d}`];
			}
		} else {
			throw new SyntaxError(
				1,
				r,
				"sub macro expects third argument to be a register or an integer");
		}
	},
	mov(lbl, cmd, args) {
		expectN(cmd, args, 2);
		if (!lbl) lbl = "";
		let [d, s] = args;
		switch (d.type) {
		case "reg":
			switch (s.type) {
			case "reg":
				return `${lbl} @add ${d}, ${s}, #0`;
			case "int":
				return s.value === 0
					? `${lbl} @and ${d}, ${d}, #0`
					: [`${lbl} @and ${d}, ${d}, #0`, `@add ${d}, ${d}, ${s}`];
			case "id":
				return `${lbl} @ld ${d}, ${s}`;
			default:
				throw noSupport(cmd, args);
			}
			break;
		case "id":
			if (s.type === "reg") {
				return `${lbl} @st ${s}, ${d}`;
			} else {
				throw noSupport(cmd, args);
			}
			break;
		default:
			throw noSupport(cmd, args);
		}
		throw new Error("impossible condition?! switch-leak");
	},
	test(lbl, cmd, args) {
		expectN(cmd, args, 1);
		if (!lbl) lbl = "";
		let r = expectType(args, 0, "reg");
		if (r.type === "reg") {
			return `${lbl} @add ${r}, ${r}, #0`;
		} else {
			throw noSupport(cmd, args);
		}
	},
	save(lbl, cmd, args) {
		const len = args.length;
		let output = [];
		for (let i = 0; i < len; ++i) {
			let r = expectType(args, i, "reg");
			output.push(`str ${r}, r6, #${-(i+1)}`);
		}
		if (output.length > 0 || lbl) {
			output.push(`add r6, r6, #-${len}`);
			if (lbl) {
				output[0] = `${lbl} ${output[0]}`;
			}
			return output;
		} else {
			return null;
		}
	},
	restore(lbl, cmd, args) {
		const len = args.length;
		let output = [];
		for (let i = 0; i < len; ++i) {
			let r = expectType(args, i, "reg");
			output.push(`ldr ${r}, r6, #${i}`);
		}
		if (output.length > 0 || lbl) {
			output.push(`add r6, r6, #${len}`);
			if (lbl) {
				output[0] = `${lbl} ${output[0]}`;
			}
			return output;
		} else {
			return null;
		}
	},
	push(lbl, cmd, args) {
		const len = args.length;
		let output = [];
		for (let i = 0; i < len; ++i) {
			let arg = args[i];
			if (arg.type === "reg") {
				output.push(`str ${arg}, r6, #${-(i+1)}`);
			} else {
				throw noSupport(cmd, args);
			}
		}
		if (output.length > 0 || lbl) {
			output.push(`add r6, r6, #-${len}`);
			if (lbl) {
				output[0] = `${lbl} ${output[0]}`;
			}
			return output;
		} else {
			return null;
		}
	},
	pop(lbl, cmd, args) {
		const len = args.length;
		let output = [];
		for (let i = 0; i < len; ++i) {
			let arg = args[i];
			if (arg.type === "reg") {
				output.push(`ldr ${arg}, r6, #${i}`);
			} else {
				throw noSupport(cmd, args);
			}
		}
		if (output.length > 0 || lbl) {
			output.push(`add r6, r6, #${len}`);
			if (lbl) {
				output[0] = `${lbl} ${output[0]}`;
			}
			return output;
		} else {
			return null;
		}
	},
	call(lbl, cmd, args) {
		const len = args.length;
		if (len === 0) {
			throw new SyntaxError(1, cmd, "expecting at least a label");
		}
		const target = expectType(args, 0, "id");
		const stmt = `${lbl ?? ""} @jsr ${target}`;
		if (len === 1) {
			return stmt;
		} else if (len > 1) {
			return [
				`push ${args.slice(1).reverse().join(', ')}`,
				stmt,
				`@add r6, r6, #${len}`
			];
		} else {
			throw new Error("impossible condition?! len:${len}");
		}
	},
};

Lc3Macro = {
	load(asm) {
		for (let name in builtin) {
			asm.registerMacro(name, builtin[name])
		}
	}
}

