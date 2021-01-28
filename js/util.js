function sext(value, bits) {
	if (bits <= 0 || bits > 32) {
		throw "bad bit size: " + bits;
	}
	const mask = ~0 << bits;
	const bit = 1 << (bits - 1);
	if ((value & bit) != 0) {
		return value | mask;
	} else {
		return value & ~mask;
	}
}
function toByte(num) {
	return (num & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}
function toWord(num) {
	return (num & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

const mapToObj = function(map) {
	const obj = Object.create(null);
	for (let [k,v] of map) {
		obj[k] = v;
	}
	return obj;
}
function log(text) {
	const log = document.querySelector("#log");
	if (!log) {
		alert("#log not found?!");
		return;
	}
	const item = document.createElement("div");
	item.append(text);
	log.append(item);
}
function log_json(value) {
	const div = document.createElement("div");
	div.classList.add("json-highlight");
	if (value instanceof Map) {
		value = mapToObj(value);
	}
	const src = JSON.stringify(value, undefined, 2)
		.replace(/(}|]),\s+({|\[)/g, '$1, $2');
	div.innerHTML = highlight(src);
	// prevent double border
	div.style.margin = "-6px";
	log(div);
}

function highlight(src) {
	const html_ent = new Map([
		["&", "&amp;"],
		["<", "&lt;"],
		[">", "&gt;"]
	]);
	src = src.replace(/[&<>]/g, m => html_ent.get(m));
	const re = /\b(?:true|false|null)\b|"(?:[^"\\]|\\.)*"|-?[0-9][-+0-9\.e]*/gi;
	src = src.replace(re, function(m, i, s) {
		let type;
		if (m === "true" || m === "false" || m === "null") {
			// literal
			return `<span class="keyword">${m}</span>`;
		} else if (m[0] === '"') {
			// string
			const re = /\s*:/y;
			re.lastIndex = i + m.length;
			const className = re.exec(s) ? "key" : "string";
			const open = `<span class="${className}">`;
			const close = "</span>";
			// correct for multiline strings
			return open + m.replace(/\n/g, `${close}${open}`) + close;
		} else {
			// number
			return `<span class="number">${m}</span>`;
		}
	});
	const lineNum = "<span class=\"line-number\"></span>";
	src = `${lineNum}<code>${src.replace(/\n/g, "</code>" + lineNum + "<code>")}</code>`;
	return src;
}

function stringify(value) {
	switch (typeof value) {
	case "undefined":
		return typeof value;
	case "boolean":
	case "number":
	case "bigint":
	case "function":
		return value.toString();
	case "object":
		// TODO handle better
		return "" + value;
	case "string":
		return "\"" + value.replace(/[\x00-\x1F\\"]/g, function(m) {
			if (m.charCodeAt(0) < 0x1F) {
				return "\\x" + m.charCodeAt(0).toString(16).padLeft(2, '0');
			} else {
				return "\\" + value;
			}
		}) + "\"";
		break;
	default:
		throw new Error("didn't account for type " + typeof value);
	}
}
if (!Math.clamp) {
	Math.clamp = function(x, min, max) {
		return Math.min(Math.max(x, min), max);
	}
}
function chunk(array, size) {
	throw new Error("not implemented");
	size |= 0;
	if (size <= 0) {
		throw new Error("expecting positive size");
	} else if (size === 1) {
		return [...array];
	} else {
		const result = [];
		const len = array.length;
		for (let i = 0; i < len; i += size) {
			
		}
	}
}

function always() { return true; }
function never() { return false; }

function isEllipsisActive($jQueryObject) {
	return ($jQueryObject.outerWidth() < $jQueryObject[0].scrollWidth);
}

const base64_enc = new Map();
const base64_dec = new Map();
(function() {
	const base64_map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	for (let i = 0; i < base64_map.length; ++i) {
		base64_enc.set(i, base64_map.charAt(i));
		base64_dec.set(base64_map.charCodeAt(i), i);
	}
	base64_dec.set("=".charCodeAt(0), false);
})();

function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(ArrayBuffer.isView(buffer) ? buffer.buffer : buffer);
	const parts = [];
	const remainder = bytes.length % 3;
	const length = bytes.length - remainder;
	let chunk, a, b, c, d;
	// full-size chunks
	for (let i = 0; i < length; i += 3) {
		chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
		d = base64_enc.get(chunk & 0x3F);
		c = base64_enc.get((chunk >> 6) & 0x3F);
		b = base64_enc.get((chunk >> 12) & 0x3F);
		a = base64_enc.get((chunk >> 18) & 0x3F);
		parts.push(a + b + c + d);
	}
	// handle remainder
	if (remainder == 1) {
		chunk = bytes[length];
		b = base64_enc.get((chunk << 4) & 0x3F);
		a = base64_enc.get((chunk >> 2) & 0x3F);
		parts.push(a + b + "==");
	} else if (remainder == 2) {
		chunk = (bytes[length] << 8) | bytes[length + 1];
		c = base64_enc.get((chunk << 2) & 0x3F);
		b = base64_enc.get((chunk >> 4) & 0x3F);
		a = base64_enc.get((chunk >> 10) & 0x3F);
		parts.push(a + b + c + "=");
	}
	// join into a single string
	let result = parts.join("");
	return result;
}
function base64ToArrayBuffer(text) {
	if (text.length == 0) {
		return new ArrayBuffer(0);
	}
	const parts = [];
	let chunk, a, b, c, d;
	const length = text.length + text.length % 4 - 4;
	// handle everything but the tail
	for (let i = 0; i < length; i += 4) {
		a = base64_dec.get(text.charCodeAt(i));
		b = base64_dec.get(text.charCodeAt(i + 1));
		c = base64_dec.get(text.charCodeAt(i + 2));
		d = base64_dec.get(text.charCodeAt(i + 3));
		if (typeof a !== "number") {
			throw new Error("bad character in base64 string at offset " + (i * 4));
		}
		if (typeof b !== "number") {
			throw new Error("bad character in base64 string at offset " + (i * 4 + 1));
		}
		if (typeof c !== "number") {
			throw new Error("bad character in base64 string at offset " + (i * 4 + 2));
		}
		if (typeof d !== "number") {
			throw new Error("bad character in base64 string at offset " + (i * 4 + 3));
		}
		parts.push(((a << 2) | (b >> 4)) & 0xFF);
		parts.push(((b << 4) | (c >> 2)) & 0xFF);
		parts.push(((c << 6) | d) & 0xFF);
	}
	// handle the tail
	a = base64_dec.get(text.charCodeAt(length));
	b = base64_dec.get(text.charCodeAt(length + 1));
	c = base64_dec.get(text.charCodeAt(length + 2) ?? '=');
	d = base64_dec.get(text.charCodeAt(length + 3) ?? '=');
	if (
		typeof a !== "number"
		|| typeof b !== "number"
		|| c === undefined || d === undefined
	) {
		throw new Error("bad tail in base64 string");
	}
	parts.push(((a << 2) | (b >> 4)) & 0xFF);
	if (c !== false) {
		parts.push(((b << 4) | (c >> 2)) & 0xFF);
		if (d !== false) {
			parts.push(((c << 6) | d) & 0xFF);
		}
	} else if (d !== false) {
		throw new Error("bad tail in base64 string");
	}
	return Uint8Array.from(parts).buffer;
}

