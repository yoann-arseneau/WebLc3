const reg_names = [0, 1, 2, 3, 4, 5, "SP", "RA", "PC", "PSR", "IR", "SSP", "USP"];
const SP = 6, RA = 7, PC = 8, PSR = 9, IR = 10, SSP = 11, USP = 12;
const num_regs = reg_names.length;

const KBSR = 0xFE00;
const KBDR = 0xFE02;
const DSR  = 0xFE04;
const DDR  = 0xFE06;
const MCR  = 0xFFFE;
class Lc3Vm {
	static KBSR = KBSR;
	static KBDR = KBDR;
	static DSR = DSR;
	static DDR = DDR;
	static MCR = MCR;

	static GETC = 0x20;
	static OUT = 0x21;
	static PUTS = 0x22;
	static IN = 0x23;
	static PUTSP = 0x24;
	static HALT = 0x25;

	static register_names() { return reg_names.slice(0); }

	constructor() {
		// registers
		let debug = new Lc3Debug();
		let reg = new Int16Array(num_regs);
		let mem = new Int16Array(0xFE00);
		let halt = false;
		let int_vec = undefined;
		let int_pri = 0;

		// Device handlers and accelerators
		const dev_handlers = new Map();
		// default device handlers
		dev_handlers.set(KBSR, () => 0);
		dev_handlers.set(DSR, () => 0);
		dev_handlers.set(MCR, (addr, val) => {
			if (val === undefined) {
				return halt ? 0 : -32768;
			} else {
				halt = (val & 0x8000) === 0;
			}
		});
		const trap_accelerators = new Map();

		// make private variables visible
		Object.defineProperties(this, {
			memory: { value: mem, writable: false },
			registers: { value: reg, writable: false },
			debug: { value: debug, writable: false },
			halted: {
				get: () => halt == true,
				set: value => halt = value === true
			}
		});

		const read = function(addr) {
			addr &= 0xFFFF;
			if (addr < 0xFE00) {
				return mem[addr & 0xFFFF];
			} else {
				return dev_handlers.get(addr)?.call(this, addr) ?? 0;
			}
		}
		const write = function(addr, value) {
			addr &= 0xFFFF;
			if (addr < 0xFE00) {
				mem[addr] = value;
			} else {
				dev_handlers.get(addr)?.call(this, addr, value);
			}
		}
		this.read = read;
		this.write = write;
		this.probe = function(addr) {
			if (addr < 0xFE00) {
				return mem[addr & 0xFFFF];
			} else {
				const handler = dev_handlers.get(addr);
				return handler ? handler.call(this, addr, undefined, true) : 0;
			}
		};

		this.step = function() {
			// deal with HALT
			if (halt) {
				return false;
			}

			// deal with interrupts
			if (int_vec !== undefined) {
				// TODO deal with priority level
				const vec = (int_vec & 0xFF) + 0x0100;
				int_vec = undefined;
				const psr = reg[PSR];
				let sp;
				if (psr & 0x8000) {
					// change to super mode
					reg[USP] = reg[SP];
					sp = reg[SP] = reg[SSP];
				} else {
					sp = reg[SP];
				}
				reg[PSR] |= 0x7FFF;
				write(sp - 1, psr);
				write(sp - 2, reg[PC]);
				reg[SP] = sp - 2;
				reg[PC] = read(vec);
				return true;
			}

			// execute instruction
			const inst = read(reg[PC]++) & 0xFFFF;
			if ((inst & 0xF1FF) === 0x01FF && ((inst >> 9) & reg[PSR] & 7) !== 0) {
				// infinite loop optimization
				reg[IR] = inst;
				--reg[PC];
				return true;
			} else {
				const result = this.exec(inst);
				// deal with breakpoints
				return !debug.test_breakpoint(reg[PC] & 0xFFFF, this) && result;
			}
		}
		this.exec = function(inst) {
			reg[IR] = inst;
			switch (inst >>> 12) {
			case 0b0000: // BR
				if ((reg[PSR] & (inst >>> 9) & 7) !== 0) {
					reg[PC] += sext(inst, 9);
				}
				return true;
			case 0b0100: // JSR
				reg[RA] = reg[PC];
				if ((inst & 0x0800) != 0) {
					reg[PC] += sext(inst, 11);
				} else {
					reg[PC] = get_lhs(inst);
				}
				return true;
			case 0b1000: // RTI
				if (reg[PSR] & 0x8000) {
					log("bad RTI");
					int_vec = 0x00;
				} else {
					const sp = reg[SP];
					reg[PC] = read(sp);
					const psr = reg[PSR] = read(sp + 1);
					reg[SP] += 2;
					if (psr & 0x8000) {
						// change to user mode
						reg[SSP] = reg[SP];
						reg[SP] = reg[USP];
					}
				}
				return true;
			case 0b1100: // JMP
				if ((inst & 0x0800) != 0) {
					reg[PC] += sext(inst, 11);
				} else {
					reg[PC] = get_lhs(inst);
				}
				return true;

			case 0b0001: // ADD
				set_dr(inst, get_lhs(inst) + get_rhs(inst));
				return true;
			case 0b0101: // AND
				set_dr(inst, get_lhs(inst) & get_rhs(inst));
				return true;
			case 0b1001: // NOT
				set_dr(inst, get_lhs(inst) ^ get_rhs(inst));
				return true;
			case 0b1101: // undef
				int_vec = 0x00;
				return true;

			case 0b0010: // LD
				set_dr(inst, read(reg[PC] + sext(inst, 9)));
				return true;
			case 0b0110: // LDR
				set_dr(inst, read(get_lhs(inst) + sext(inst, 6)));
				return true;
			case 0b1010: // LDI
				set_dr(inst, read(read(reg[PC] + sext(inst, 9))));
				return true;
			case 0b1110: // LEA
				set_dr(inst, reg[PC] + sext(inst, 9));
				return true;

			case 0b0011: // ST
				write(reg[PC] + sext(inst, 9), get_dr(inst));
				return true;
			case 0b0111: // STR
				write(get_lhs(inst) + sext(inst, 6), get_dr(inst));
				return true;
			case 0b1011: // STI
				write(read(reg[PC] + sext(inst, 9)), get_dr(inst));
				return true;
			case 0b1111: // TRAP
				const vector = inst & 0xFF;
				reg[RA] = reg[PC];
				const handler = trap_accelerators.get(vector);
				if (handler === undefined || !handler(vector, this)) {
					reg[PC] = mem[inst & 0x00FF];
				}
				return true;

			default:
				throw "bad instruction?! " + inst;
			}
			return true;
		}

		this.set_device_handler = function(addr, handler) {
			if (typeof addr !== "number" || addr < 0xFE00 || addr > 0xFFFF) {
				throw new Error("addr needs to be integer in range [0xFE00 .. 0xFFFF]");
			} else if (handler != null && typeof handler != "function") {
				throw new Error("handler needs to be a function or null");
			}
			addr &= 0xFFFF;
			const old = dev_handlers.get(addr);
			dev_handlers.set(addr, handler);
			return old;
		}
		this.set_trap_accelerator = function(vector, handler) {
			if (typeof vector !== "number" || vector < 0 || vector > 0xFF) {
				throw new Error("vector needs to be integer in range [0x00 .. 0xFF]");
			} else if (handler != null && typeof handler != "function") {
				throw new Error("handler needs to be a function or null");
			}
			vector &= 0xFF;
			const old = trap_accelerators.get(vector);
			trap_accelerators.set(vector, handler);
			return old;
		}

		this.reset();

		function get_dr(inst) {
			return reg[(inst >>> 9) & 7];
		}
		function get_lhs(inst) {
			return reg[(inst >>> 6) & 7];
		}
		function get_rhs(inst) {
			if ((inst & 0x20) != 0) {
				return sext(inst, 5);
			} else {
				return reg[inst & 7];
			}
		}

		function set_dr(inst, value) {
			value = sext(value, 16);
			reg[(inst >>> 9) & 7] = value;
			let psr = reg[PSR] & 0xFFF8;
			if (value > 0) {
				reg[PSR] = psr | 1;
			} else if (value == 0) {
				reg[PSR] = psr | 2;
			} else {
				reg[PSR] = psr | 4;
			}
		}
	}

	reset() {
		this.psr = 0x0007;
		this.pc = 0x0200;
		this.halted = false;
	}
	load(origin, buffer, symbols) {
		if (typeof origin === "string") {
			if (!origin.startsWith("Lc3Asm;")) {
				throw new Error("not a valid serialized chunk");
			}
			const parts = origin.split(";");
			if (parts.length < 4) {
				throw new Error("not a valid serialized chunk");
			}
			origin = parseInt(parts[1], 16);
			buffer = base64ToArrayBuffer(parts[parts.length - 1]);
			if (parts.length > 4) {
				symbols = new Map();
				for (let i = 2; i < parts.length - 2; ++i) {
					const [symbol, offset] = parts[i].split(":");
					symbols.set(parseInt(offset, 16), symbol);
				}
			} else {
				symbols = undefined;
			}
		} else if (origin instanceof Lc3Asm) {
			const asm = origin;
			origin = asm.origin;
			buffer = asm.chunk;
			symbols = asm.lookup;
		}
		if (typeof origin !== "number" || origin < 0 || origin >= 0xFE00) {
			throw new Error(`origin should be number between [x0000 .. xFE00]; found ${origin}`);
		}
		origin &= 0xFFFF;
		buffer = new Int16Array(buffer);
		if (origin + buffer.length > 0xFE00) {
			throw new Error("cannot load outside of [x0000 .. xFE00]");
		}
		for (let i = 0; i < buffer.length; ++i) {
			this.write(origin++, buffer[i]);
		}
		if (symbols) {
			const debug = this.debug;
			symbols.forEach(function(symbol, origin) {
				debug.set_symbol(symbol, origin);
			});
		}
	}
	run_atmost(stop) {
		if (this.halted) {
			return { result: false, num_steps: 0 };
		}
		let num_steps = 0;
		let result = true;
		const step = this.step.bind(this);
		let cond;
		if (typeof stop === "number") {
			for (; stop > 0; --stop) {
				num_steps += 1;
				if (!step()) {
					result = false;
					break;
				}
			}
		} else if (typeof stop === "function") {
			while (!stop()) {
				num_steps += 1;
				if (!step()) {
					result = false;
					break;
				}
			}
		} else {
			throw new Error("expecting stop to be a number or function");
		}
		return { result, num_steps };
	}
}
// define register shorthands
for (let i = 0; i < reg_names.length; ++i) {
	const idx = i;
	const desc = Object.create(null);
	desc.get = function() { return this.registers[idx]; };
	desc.set = function(value) { this.registers[idx] = value; };
	if (i < 8) Object.defineProperty(Lc3Vm.prototype, `r${i}`, desc);
	const name = reg_names[i];
	if (typeof name === "string") {
		Lc3Vm[name] = i;
		Object.defineProperty(Lc3Vm.prototype, name.toLowerCase(), desc);
	}
}

class Lc3Breakpoint {
	constructor(predicate) {
		// private properties (set to default)
		Object.defineProperties(this, {
			// false prevents triggering
			_isActive: { value: true, writable: true },
			// function called to determine if triggered
			_predicate: { value: always, writable: true },
			// whether this bp should be removed after being triggered
			_isTemporary: { value: false, writable: true },
			// internal field for chaining
			_next: { value: null, writable: true },
		});
		// public properties (enumerable and with validating setters)
		Object.defineProperties(this, {
			isActive: {
				get: function() { return this._isActive; },
				set: function(value) { this._isActive = value == true; },
				enumerable: true
			},
			predicate: {
				get: function() { return this._predicate; },
				set: function(value) {
					if (value == null || value === true) {
						// nullish interpreted as "no condition"
						value = always;
					} else if (value === false) {
						value = never;
					} else if (typeof value === "function") {
						value = value;
					} else {
						throw new Error(
							"predicate expecting nullish, boolean, or function; found " + value);
					}
					this._predicate = value;
				},
				enumerable: true
			},
			isTemporary: {
				get: function() { return this._isTemporary; },
				set: function(value) { this._isTemporary = value == true; },
				enumerable: true
			},
		});
		// update object using validating setters
		this.predicate = predicate;
	}
	toString() {
		const props = ["isActive","isTemporary","predicate"].map(t => `${t}: ${t.toString()}`);
		return `Breakpoint(${props.join(', ')})`;
	}
}

class Lc3Debug {
	constructor() {
		const breakpoints = new Map();
		Object.defineProperties(this, {
			symbols: { value: new Map(), writable: false },
			offsets: { value: new Map(), writable: false },
			breakpoints: { value: breakpoints, writable: false }
		});
		this.test_breakpoint = function(addr, vm) {
			let prev = null;
			let next = breakpoints.get(addr);
			while (next) {
				if (next._isActive && next._predicate(addr, vm)) {
					if (next.isTemporary) {
						// remove after triggering; used for automatic breakpoints
						if (prev == null) {
							prev = next;
							next = next._next;
							if (next) {
								breakpoints.set(addr, next);
							} else {
								breakpoints.delete(addr);
							}
						} else {
							prev._next = next._next;
						}
					}
					return true;
				}
				prev = next;
				next = next._next;
			}
			return false;
		}
	}
	set_symbol(symbol, offset) {
		if (typeof symbol !== "string") {
			throw new Error("symbol must be a string");
		}
		offset &= 0xFFFF;
		this.symbols.set(symbol, offset);
		this.offsets.set(offset, symbol);
	}
	address_of(symbol) {
		return this.symbols.get(symbol);
	}
	label_for(offset) {
		return this.offsets.get(offset & 0xFFFF);
	}

	set_breakpoint(addr, condition) {
		addr &= 0xFFFF;
		if (typeof addr !== "number") {
			throw new Error(`addr must be a number`);
		}
		let bp = undefined;
		if (condition instanceof Lc3Breakpoint) {
			bp = condition;
		} else if (typeof condition === "object" && condition != null) {
			let { predicate, isActive, isTemporary } = condition;
			bp = new Lc3Breakpoint(predicate, isActive, isTemporary);
		} else {
			bp = new Lc3Breakpoint(condition);
		}
		const current = this.breakpoints.get(addr);
		if (current) {
			current._next = bp;
		} else {
			this.breakpoints.set(addr, bp);
		}
	}
	has_breakpoint(addr) {
		return this.breakpoints.has(addr & 0xFFFF);
	}
}

