ParseState = function() {
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

	const START    = new ParseNode("START", true);
	const LABEL    = fromType("LABEL", false, "label", "id");
	const COMMAND  = fromType("COMMAND", true, "command", "id");
	const ARGUMENT = fromTypes("ARGUMENT", true, "args[]", "id,int,str,chr");
	const SEP      = fromText("SEPARATOR", false, ",");
	const CMNT     = fromType("COMMENT", true, "cmnt", "cmnt");

	START.next    = [COMMAND, LABEL, CMNT];
	LABEL.next    = [COMMAND, CMNT];
	COMMAND.next  = [ARGUMENT, CMNT];
	ARGUMENT.next = [SEP, CMNT];
	SEP.next      = [ARGUMENT];
	CMNT.next     = [];

	return class {
		parse(tokens) {
			this._tokens = tokens;
			this._length = tokens.length;
			this._state = {};
			this._step(0, START);
		}
		_step(index, node) {
			if (index === this._tokens.length) {
				return node.end;
			}
			const token = this._tokens[index];
			const transitions = node.next;
			const len = transitions.length;
			for (let i = 0; i < len; ++i) {
				const next = transitions[i];
				if (next.matches(token) && this.step(index + 1, next)) {
					next.capture(token, state);
					return true;
				}
			}
			return false;
		}
	}

} ();

