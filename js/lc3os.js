const serialized_os = "Lc3Asm;0;SUPER_STACK:20E;USER_PSR:210;USER_MAIN:20F;OS_KBR:211;OS_DR:212;OS_MCR:213;MASK_LO:214;DUMP_R0:215;DUMP_R1:216;DUMP_R2:217;DUMP_R3:218;DUMP_R4:219;DUMP_R5:21A;DUMP_R6:21B;DUMP_R7:21C;TRAP_GETC:21D;$loop:21F;TRAP_PUTC:226;$loop:229;TRAP_PUTS:22F;$qend:23F;$loop:236;TRAP_IN:241;$msg:248;TRAP_PUTSP:25D;$qend:277;$loop:267;$skip_lo:26A;RSHIFT8:27A;$skip_hi:26D;$mask_hi:290;$mask_shf8:28F;$start:281;$loop:280;$skip:288;TRAP_HALT:291;$msg:29E;$loop:29D;BAD_TRAP:2B1;$msg:2B7;BAD_TAIL:330;INT_PMV:2CA;$msg:2D0;INT_IOC:2F2;$msg:2F8;INT_KBD:311;BAD_INT:312;$msg:318;;sQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxAh0CJgIvAkECXQKRArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQLKAvICEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEQMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAxIDEgMSAw0sDiC/cQsgvnG+HSBQIFIgVCBWIFggWiBeAIAAMAAwB4AA/gT+/v//AK3e776t3u++rd7vvq3e776Ac/IjQGD+B0Jg8SMBUIBjwMGAc7916SNAZP4HQnCAY79lwMG/cwBiDQSAcb51vXfcJYBm/geCciEQAGL6C4BhvmW9Z4BjwMGAfwXg60/YT+BPgG/AwQoASQBuAHAAdQB0ACAAYQAgAGMAaABhAHIAYQBjAHQAZQByAD4AIAAAAL9zIBIAYBYEgHO+db13vH+7Ha0ng1ABBLxPD0gBBLlPYRJAYPcLpR2AYb9jv2W+Z71vwMFgEL9jwMGAc791EyICUBAiAQ5BEgFUBQQAkECUAlAAkGAS9wP2DwUiAVC/Y75lwMEBAQD/gzGDM4M1gzeDOYM7gz2DPwTglE8gUHax/w8KAC0ALQAtACAASABhAGwAdABpAG4AZwAuACAALQAtAC0ACgAAAL9xvn++HQLgeu54xwoALQAtAC0AIABCAGEAZAAgAFQAcgBhAHAAIAAtAC0ALQAKAAAAv3G+f74dAuBh7l/HCgAtAC0ALQAgAFAAcgBpAG8AcgBpAHQAeQAgAE0AbwBkAGUAIABWAGkAbwBsAGEAdABpAG8AbgAgAC0ALQAtAAoAAAC/cb5/vh0C4DnuN8cKAC0ALQAtACAASQBuAHYAYQBsAGkAZAAgAE8AcABjAG8AZABlACAALQAtAC0ACgAAAACAv3G+f74dAuAZ7hfHCgAtAC0ALQAgAEIAYQBkACAASQBuAHQAZQByAHIAdQBwAHQAIAAtAC0ALQAKAAAAoh2/Yb5vXcc=";

function LoadOS(vm) {
	try {
		vm.load(serialized_os);
		new AppendDisplayDevice("#console").register_to(vm);
		vm.set_trap_accelerator(Lc3Vm.OUT, function(vector, vm) {
			if (vm.probe(Lc3Vm.DSR) & 0x8000) {
				vm.write(Lc3Vm.DDR, vm.r0);
				return true;
			} else {
				return false;
			}
		});
		vm.set_trap_accelerator(Lc3Vm.PUTS, function(vector, vm) {
			if (vm.probe(Lc3Vm.DSR) & 0x8000) {
				const DDR = Lc3Vm.DDR;
				const r0 = vm.r0;
				let ptr = r0;
				let c = vm.read(ptr);
				while (c != 0) {
					vm.write(DDR, c);
					c = vm.read(++ptr);
				}
				vm.r0 = r0;
				return true;
			} else {
				return false;
			}
		});
	} catch (e) {
		if (typeof e === "object" && "stack" in e) {
			log(e.stack);
		} else {
			log(e);
		}
	}
}

class KeyboardBuffer {
	constructor() {
		const buf = [];
		this.status = function() { return buf.length > 0 ? 0x8000 : 0; }
		this.data = function(addr, value) {
			if (value === undefined && this.buf.length > 0) {
				return this.buf.unshift();
			} else {
				return 0;
			}
		};
		this.push = function(key) {
			if (typeof key === "string" && key.length == 1) {
				key = key.charCodeAt(0) & 0xFF;
			} else if (typeof key == "number") {
				key &= 0xFF;
			} else {
				throw new Error("expecting single-character string or number");
			}
			buf.push(key);
		};
	}
	register_to(vm) {
		vm.set_device_handler(KBSR, this.status);
		vm.set_device_handler(KBDR, this.data);
	}
}
class AppendDisplayDevice {
	constructor(id) {
		this.status = function() { return 0x8000; };
		this.data = function(addr, value) {
			if (value !== undefined) {
				$(id).append(String.fromCharCode(value & 0xFF));
			}
		}
	}
	register_to(vm) {
		vm.set_device_handler(DSR, this.status);
		vm.set_device_handler(DDR, this.data);
	}
}

