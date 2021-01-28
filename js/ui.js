function Assemble(...args) {
	const asm = new Lc3Asm();
	Lc3Macro.load(asm);
	asm.assemble(...args);
	return asm;
}
function Disassemble(b, s, o) {
	return Lc3Disasm.disassemble(b, s, o);
}

function DropdownClick(b, e) {
	b.parentNode.classList.toggle("down");
}

DataFormatters = {
	General(el, vm, addr, data) {
		if (addr < 0x0200) {
			// trap addresses
			const label = vm.debug.label_for(data);
			el.textContent = label != null ? `(${label})` : "";
		} else if (addr < 0xFE00) {
			el.textContent = Disassemble(data, addr, vm.debug);
		} else {
			// TODO better device representation
			el.textContent = "-";
		}
	},
	Disasm(el, vm, addr, data) {
		el.textContent = Disassemble(data, addr, vm.debug);
	},
	Data: function(el, vm, addr, data) {
		function unsigned(data) {
			return (data & 0xFFFF).toString().padStart(5, "_") + "u";
		}
		function signed(data) {
			return sext(data, 16).toString().padStart(6, "_") + "i";
		}
		function character(data) {
			data &= 0x00FF;
			if (data < 32) {
				switch (data) {
				case 0: return "\\0";
				case 7: return "\\b";
				case 9: return "\\t";
				case 12: return "\\f";
				case 10: return "\\n";
				case 11: return "\\v";
				case 13: return "\\r";
				default: return `x${toByte(data)}`;
				}
			} else if (data === 127) {
				return "\\d";
			} else {
				return String.fromCharCode(data);
			}
		}
		return function (el, vm, addr, data) {
			el.textContent = `${signed(data)}  ${unsigned(data)}  '${character(data)}'`;
		}
	} ()
};

Visualizer = {
	_needsUpdate: false,
	_targetAddr: undefined,
	_oldPC: undefined,
	_watchTarget: [],
	_followPC: true,
	get followPC() { return this._followPC; },
	set followPC(value) {
		if (typeof value === "boolean") {
			const old = this._followPC;
			if (old != value) {
				$("#opt-follow-pc").prop("checked", value);
				this._followPC = value;
			}
		} else {
			throw new Error("expecting boolean");
		}
	},
	Goto(target) {
		this._targetAddr = Math.clamp(Simulator.Resolve(target), 0x0000, 0xFFF0);
		this.followPC = false;
		Visualizer.RequestUpdate();
	},
	Scroll(delta) {
		if (typeof delta !== "number") {
			throw new Error("delta should be a number");
		}
		this.Goto((this._targetAddr ?? Simulator.vm.pc) + delta);
	},
	RequestUpdate() {
		this._needsUpdate = true;
	},
	PerformUpdate() {
		const vm = Simulator.vm;

		// Update Registers
		this._UpdateRegisters(vm);

		// Update Memory
		let target = this._targetAddr;
		if (this.followPC) {
			const pc = vm.pc;
			if (pc !== this._oldPC) {
				this._oldPC = pc;
				const origin = target ?? pc;
				if (pc < origin || pc > origin + 15) {
					target = pc;
				} else if (pc == origin + 15) {
					target = origin + 1;
				} else {
					target = origin;
				}
				this._targetAddr = target;
			} else if (this._targetAddr == null) {
				this._targetAddr = target = pc;
			}
		} else if (target == null) {
			target = vm.pc;
		}
		this._targetAddr = target;
		this._UpdateMemory(vm, target);

		// Update Watchlist
		this._UpdateWatchlist(vm);

		this._needsUpdate = false;
	},
	GetUpdateCallback() {
		return function() {
			if (this._needsUpdate) {
				this.PerformUpdate();
			}
		}.bind(this);
	},
	AddWatch(target) {
		if (typeof target === "string" && target.includes(",")) {
			target.split(",").forEach(v => Visualizer.AddWatch(v));
			return;
		} else if (Array.isArray(target)) {
			target.foreach(v => Visualizer.AddWatch(v));
			return;
		}
		const addr = Simulator.Resolve(target);
		const classNames = ["indicator", "address", "symbol", "value", "disasm"];
		const divs = [];
		for (let i = 0; i < classNames.length; ++i) {
			const div = document.createElement("div");
			$(div).addClass(classNames[i]);
			divs[i] = div;
		}
		const $divs = $(divs);
		$divs.hover(
			() => $divs.addClass("hover"),
			() => $divs.removeClass("hover"));
		$("#watch-viewer").append($divs);
		this._watchTarget.push({ addr });
		Visualizer.RequestUpdate();
	},
	Init() {
		const $viewer = $("#mem-viewer");
		const $row = $viewer.children().slice(6);
		for (let i = 1; i < 16; ++i) {
			$viewer.append(
				$row.clone()
					.each((_, e) => e.classList.replace("mem-cell-0", `mem-cell-${i}`)));
		}
	},

	_UpdateRegisters: function() {
		const dec = ["r0", "r1", "r2", "r3", "r4", "r5"];
		const hex = ["r6", "r7", "pc", "ir", "psr"];
		return function(vm) {
			dec.forEach(r => $("#regs-" + r).text(vm[r].toString()));
			hex.forEach(r => $("#regs-" + r).text("x" + toWord(vm[r])));
			const psr = vm.psr;
			let text = [
				vm.halted ? "H" : "R",
				psr & 0x8000 ? "U" : "S",
				":",
				psr & 0x0004 ? "n" : "-",
				psr & 0x0002 ? "z" : "-",
				psr & 0x0001 ? "p" : "-",
			].join("");
			$("#psr-status").text(text);
		};
	} (),
	_UpdateMemory(vm, origin) {
		origin = Math.clamp(origin, 0, 0xFFF0) & 0xFFFF;
		const getAddr = function(row) { return origin + row; };
		const formatVisual = DataFormatters.General;
		this._UpdateMemoryLines("#mem-viewer", vm, getAddr, formatVisual);
	},
	_UpdateWatchlist(vm) {
		this._UpdateMemoryLines(
			"#watch-viewer",
			vm,
			row => this._watchTarget[row].addr,
			DataFormatters.Data);
	},

	_UpdateMemoryLines(id, vm, getAddr, formatVisual) {
		const elements = $(id).children().slice(6);
		const len = elements.length;
		const pc = vm.pc;
		let row = 0;
		let item;
		for (let i = 0; i < len; i += 6, ++row) {
			const addr = getAddr(row);
			const data = vm.probe(addr);
			const symbol = vm.debug.label_for(addr) ?? "";
			const bp = vm.debug.has_breakpoint(addr);
			const cur = addr === pc;
			update(elements[i + 0], null, bp, cur);
			update(elements[i + 1], null, bp, cur);
			update(elements[i + 2], `x${toWord(addr)}`, bp, cur);
			update(elements[i + 3], symbol, bp, cur);
			update(elements[i + 4], `x${toWord(data)}`, bp, cur);
			let content = elements[i + 5];
			update(content, null, bp, cur);
			formatVisual(content, vm, addr, data);
		}

		function update(el, text, bp, cur) {
			if (text != null) {
				el.textContent = text;
			}
			if (bp != null) {
				el.classList.toggle("breakpoint", bp);
			}
			if (cur != null) {
				el.classList.toggle("cursor", cur);
			}
		}
	},
};

AssembleDialog = {
	Show() {
		$("#modal-shadow, #assemble-dialog")
			.show();
		$("#assemble-source")
			.prop("disabled", false);
	},
	Hide() {
		$("#modal-shadow, #assemble-dialog, .assemble-toggle")
			.hide();
		$("#serialize-output")
			.text("")
			.hide();
	},
	Assemble() {
		const $textarea = $("#assemble-source");
		const src = $textarea.val();
		try {
			AssembleDialog.asm = Assemble(src);
			$textarea.prop("disabled", true);
			AssembleDialog.Success();
		} catch (e) {
			AssembleDialog.asm = null;
			if (e instanceof SyntaxError) {
				AssembleDialog.Failure(e.message);
			} else {
				AssembleDialog.Failure(e.stack, true);
			}
		}
	},
	Success(noWrap) {
		$(".assemble-toggle").show();
		$("#assemble-log-failure").hide();
	},
	Failure(message, noWrap) {
		$(".assemble-toggle").show();
		$("#assemble-log-success").hide();
		const failure = $("#assemble-log-failure");
		failure.css("white-space", noWrap ? "pre" : "normal");
		failure.text(message);
		
	},
	Serialize() {
		if (AssembleDialog.asm) {
			$("#serialize-output")
				.text(AssembleDialog.asm.serialize())
				.show();
		} else {
			$("#serialize-output")
				.text("something went wrong?")
				.show();
		}
	},
	Load() {
		if (AssembleDialog.asm) {
			Simulator.Load(AssembleDialog.asm);
			Visualizer.RequestUpdate();
			AssembleDialog.Hide();
		} else {
			alert("no asm?!");
		}
	},
	EditSource() {
		AssembleDialog.asm = null;
		$(".assemble-toggle, #serialize-output").hide();
		$("#assemble-source").prop("disabled", false);
	}
};

Simulator = {
	_running: false,
	num_steps: 0,
	get running() {
		return this._running;
	},
	set running(value) {
		this._running = value;
		$("#run-button i").toggleClass("fa-pause", value);
		$("#run-button i").toggleClass("fa-play", !value);
	},
	Init() {
		const vm = new Lc3Vm();
		this.vm = vm;
		LoadOS(vm);
		vm.debug.set_breakpoint(0x3000);
		Visualizer.RequestUpdate();
		return vm;
	},
	Reset() {
		this.vm.reset();
		Visualizer.RequestUpdate();
	},
	Load(...asm) {
		Visualizer.RequestUpdate();
		this.vm.load(...asm);
	},
	Step() {
		this.running = false;
		const vm = this.vm;
		if (!vm.halted) {
			Visualizer.RequestUpdate();
			return vm.step();
		} else {
			log("halted");
			return false;
		}
	},
	StepOver() {
		const vm = this.vm;
		if (!vm.halted) {
			this.Run();
			const bp = new Lc3Breakpoint();
			bp.predicate = function(addr, vm) { return vm.sp <= this.target_sp; };
			bp.isTemporary = true;
			bp.target_sp = vm.sp;
			vm.debug.set_breakpoint(vm.pc + 1, bp);
		}
	},
	Run() {
		if (!this.running) {
			const vm = this.vm;
			if (!vm.halted) {
				const time_slice = function() {
					if (this.running && !vm.halted) {
						Visualizer.RequestUpdate();
						const result = vm.run_atmost(16384);
						if (result.result) {
							setTimeout(time_slice, 0);
						} else {
							$("#running").text("paused");
							this.running = false;
						}
						this.num_steps += result.num_steps;
					}
				}.bind(this);
				this.running = true;
				setTimeout(time_slice, 0);
			}
		}
	},
	Stop() {
		this.running = false;
	},
	ToggleRun() {
		if (this.running) {
			this.Stop();
		} else {
			this.Run();
		}
	},
	Unhalt() {
		this.vm.halted = false;
		Visualizer.RequestUpdate();
	},
	Resolve(target) {
		const type = typeof target;
		let addr;
		if (type === "number") {
			// TODO maybe handle NaN and out-of-range
			addr = target;
		} else if (type === "string") {
			target.trim();
			if (/^#\d+$/.test(target)) {
				addr = parseInt(target.substring(1), 10);
			} else if (/^x[\da-f]{1,4}$/i.test(target)) {
				addr = parseInt(target.substring(1), 16);
			} else if (/^\$?[a-zA-Z_]\w*$/.test(target)) {
				addr = Simulator.vm.debug.address_of(target);
				if (addr == null) {
					throw new Error("label not found");
				}
			} else {
				addr = parseInt(target);
				if (isNaN(addr)) {
					throw new Error("label not found: " + stringify(target));
				}
			}
			if (isNaN(addr)) {
				throw new Error("invalid number: " + target);
			}
		} else {
			throw new Error(`expecting number or label, but found ${type} ${stringify(target)}`);
		}
		if (isNaN(addr)) {
			throw new Error("invalid target");
		}
		return Math.clamp(addr, 0x0000, 0xFFFF) & 0xFFFF;
	}
};

function MemViewScroll(delta) {
	target = $("#mem-viewer").data("origin") + delta;
	if (target < 0) target = 0;
	else if (target > 0xFFFF) target = 0xFFFF;
	Visualizer.RequestUpdate();
}

Screen = {
	x: 0,
	y: 0,
	dx: 0,
	dy: 0,
	SetX(x) {
		Screen.x = x;
	},
	SetY(y) {
		Screen.y = y;
	},
	SetDx(dx) {
		Screen.dx = dx;
	},
	SetDy(dy) {
		Screen.dy = dy;
	},
	DrawPixel(c) {
		// color format:
		//   mrrr rrgg gggb bbbb
		// m: mask (1 to draw, 0 to skip)
		// rgb: color component [0 -- 31]
		const x = Screen.x;
		const y = Screen.y;
		c &= 0xFFFF;
		if (c & 0x8000) {
			const ctx = Screen.ctx;
			const r = ((c >> 10) & 0x1F) / 31;
			const g = ((c >> 5) & 0x1F) / 31;
			const b = (c & 0x1F) / 31;
			const color = `rgb(${r*255},${g*255},${b*255},1)`;
			log_json({ r, g, b, color });
			ctx.fillStyle = color;
			ctx.fillRect(x, y, 1, 1);
		}
		Screen.x = x + Screen.dx;
		Screen.y = y + Screen.dy;
	},
	Clear(c) {
		const canvas = Screen.canvas;
		const ctx = Screen.ctx;
		let color;
		if (typeof value === "number") {
			const r = ((c >> 10) & 0x1F) / 31;
			const g = ((c >> 5) & 0x1F) / 31;
			const b = (c & 0x1F) / 31;
			color = `rgb(${r*255},${g*255},${b*255},1)`;
		} else if (typeof value === "string") {
			color = c;
		} else {
			color = "black";
		}
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	},
	RegisterTo(vm) {
		vm.set_device_handler(0xFF00, (addr, value) => {
			if (value !== undefined) {
				Screen.x = value;
			} else {
				return Screen.x;
			}
		});
		vm.set_device_handler(0xFF02, (addr, value) => {
			if (value !== undefined) {
				Screen.y = value;
			} else {
				return Screen.y;
			}
		});
		vm.set_device_handler(0xFF04, (addr, value) => {
			if (value !== undefined) {
				Screen.dx = value;
			} else {
				return Screen.dx;
			}
		});
		vm.set_device_handler(0xFF06, (addr, value) => {
			if (value !== undefined) {
				Screen.dy = value;
			} else {
				return Screen.dy;
			}
		});
		vm.set_device_handler(0xFF08, (addr, value) => {
			if (value !== undefined) {
				Screen.DrawPixel(value);
			}
		});
		vm.set_device_handler(0xFF0A, (addr, value) => {
			if (value !== undefined) {
				Screen.Clear(value);
			}
		});
	}
};

Preloaded = {
	programs: {
		hello_world: "Lc3Asm;3000;user_stack:3004;message:3005;;AywD4CLwJfAA/kgAZQBsAGwAbwAgAFcAbwByAGwAZAAhAAAA",
	},
	Load(key) {
		const program = this.programs[key];
		if (program) {
			Simulator.Load(program);
			Simulator.Reset();
		} else {
			alert("program not found: " + key);
		}
	}
};

window.addEventListener('load', (e) => {
	// setup mem viewer
	Visualizer.Init();

	// setup behaviours
	$("#watch-addr-button").click(function() {
		Visualizer.AddWatch($("#watch-addr-text").val());
	});
	$("#goto-addr-button").click(function() {
		Visualizer.Goto($("#goto-addr-text").val());
	});
	$("#goto-addr-text").keypress(function(e) {
		if (e.which === 13) {
			Visualizer.Goto($(this).val());
		}
	});
	$("#opt-follow-pc").change(function() {
		Visualizer.followPC = this.checked;
	});
	$("#console").keydown(function(e) {
		if (e.ctrlKey) {
			let target, vm;
			switch (e.which) {
			case 37: // left
			case 33: // page up
				Visualizer.Scroll(-16);
				break;
			case 39: // right
			case 34: // page down
				Visualizer.Scroll(16);
				break;
			case 38: // up
				Visualizer.Scroll(-1);
				break;
			case 40: // down
				Visualizer.Scroll(1);
				break;
			case 82: // reset
				Simulator.Reset();
				e.preventDefault();
				return false;
			case 83: // s
				if (e.shiftKey) {
					Simulator.Run();
				} else {
					Simulator.Step();
				}
				e.preventDefault();
				return false;
			case 17: // ctrl
				break;
			default:
				//alert("key: " + e.which);
			}
			if (target !== undefined) {
				if (target < 0) target = 0;
				else if (target > 0xFFFF) target = 0xFFFF;
				Visualizer.UpdateMemory(target);
				e.preventDefault();
				return false;
			}
		}
	});
	// add collapse button to all panels
	$(".panel>.header").each((_, e) => {
		const i = document.createElement("i");
		$(i).addClass("fas").addClass("fa-plus");
		e.append(i);
		$(e).click(function(event) {
			const $this = $(this);
			const $parent = $this.parent();
			const isCollapsed = $parent.hasClass("collapsed");
			$parent.toggleClass("collapsed", !isCollapsed);
			$this.children("i").toggleClass("fa-plus", isCollapsed);
			$this.children("i").toggleClass("fa-minus", !isCollapsed);
		});
	});
	// setup VM
	const vm = Simulator.Init();
	Screen.RegisterTo(vm);
	// setup styles
	for (let i = 0; i < 16; ++i) {
		let row = $("#mem-viewer > .mem-cell-" + i);
		row.hover(
			() => row.addClass("hover"),
			() => row.removeClass("hover"));
	}
	$("#mem-viewer > .symbol, #mem-viewer > .disasm").mouseenter(e => {
		if (isEllipsisActive($(e.target))) {
			e.target.title = e.target.innerText;
		} else {
			e.target.title = "";
		}
	});
	/*/ setup screen
	const canvas = $("#screen").get(0);
	Screen.canvas = canvas;
	Screen.ctx = canvas.getContext("2d", { alpha: false });
	//*/
	// visual update loop
	let last_step = undefined;
	const update = Visualizer.GetUpdateCallback();
	(function updateVisuals() {
		const next_step = Simulator.num_steps;
		if (last_step !== next_step) {
			$("#num_steps").text(Simulator.num_steps);
			last_step = next_step;
		}
		update();
		requestAnimationFrame(updateVisuals);
	}) ();
});

