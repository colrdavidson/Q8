"use strict";

var labels;

function clean_str(str) {
	var tmp_buffer = str.trim().split(/\t|\n/);
	var buffer = [];
	for (var i = 0; i < tmp_buffer.length; i++) {
		buffer.push(tmp_buffer[i]);
	}

	return buffer;
}

function pretty_print_buffer(asm_buffer) {
	var out_str = "";
	for (var i = 0; i < asm_buffer.length; i++) {
		out_str += asm_buffer[i] + "\n";
	}
	return out_str;
}

function is_digit(n) {
	var a = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
	return !!a[n];
}

function fill_labels(line_no, asm_buffer) {
	var line = asm_buffer[line_no];
	for (var i = 0; i < line.length; i++) {
		if (line[i] == ":") {
			var label = line.slice(0, i);
			labels.push(label);
			break;
		}
	}
}

function clean_comments(asm_buffer) {
	for (var i = 0; i < asm_buffer.length; i++) {
		var line = asm_buffer[i];

		var comment_start = line.indexOf(";");
		if (comment_start != -1) {
			asm_buffer[i] = line.slice(0, comment_start).trim();
		} else {
			asm_buffer[i] = line.trim();
		}
	}

	return asm_buffer;
}

function verify_value(val, type, type_str, line_no) {
	if (val.length > 0) {
		var data = parseInt(val);
		if (isNaN(data) || data > 0xFF || data < 0) {
			return ['E', type_str + " on line " + line_no + " has invalid value: " + val];
		} else {
			return [type, data];
		}
	} else {
		return ['E', type_str + " on line " + line_no + " needs a value"];
	}
}

function parse_line(vm, line_no, asm_buffer) {
	var line = asm_buffer[line_no];

	if (line == "") {
		return;
	}

	var bits = [];
	bits[0] = line;

	// Handle data declaration
	if (line[0] == '$' || line[0] == '>') {
		if (bits[0][0] == '$') { // Define a byte
			var chunk = bits[0].slice(1);
			return verify_value(chunk, 'D', "Byte declaration", line_no);
		} else if (bits[0][0] == '>') { // Move the assembler value plop position
			var chunk = bits[0].slice(1);
			return verify_value(chunk, 'P', "Position Skip", line_no);
		}
	}

	// Check for label declaration
	var label_decl = false;
	for (var i = 0; i < bits[0].length; i++) {
		if (bits[0][i] == ":") {
			label_decl = true;
			break;
		}
	}

	// Package and return label declaration id
	if (label_decl) {
		var bit = bits[0].slice(0, bits[0].length - 1);
		var label_idx;
		for (var i = 0; i < labels.length; i++) {
			if (bit == labels[i]) {
				label_idx = i;
				break;
			}
		}

		// Look for LDs
		for (var i = 0; i < line.length; i++) {
			if (line[i] == '$') {
				bits[0] = line.slice(0, i - 1);
				bits[1] = line.slice(i);
				break;
			}
		}
		if (bits.length > 1) {
			if (bits[1][0] == '$') {
				var type_pack = verify_value(bits[1].slice(1), 'LD', "Labelled Data", line_no);
				if (type_pack[0] == 'LD') {
					return ['LD', label_idx, type_pack[1]];
				} else {
					return type_pack;
				}
			}
		} else {
			return ['L', label_idx];
		}
	}

	// Split into instruction and operand pieces
	for (var i = 0; i < line.length; i++) {
		if (is_digit(line[i])) {
			bits[0] = line.slice(0, i - 1);
			bits[1] = line.slice(i);
			break;
		}
	}

	// Split out label from instruction
	var label_idx = -1;
	for (var i = 0; i < labels.length; i++) {
		var label_pos = bits[0].search(labels[i]);
		if (label_pos != -1) {
			var label = bits[0].slice(label_pos);
			if (label == labels[i]) {
				bits[1] = label;
				bits[0] = bits[0].slice(0, label_pos - 1);
				label_idx = i;
				break;
			}
		}
	}

	var inst_no = vm.rev_lookup[bits[0]];
    if (inst_no == undefined) {
		return ['E', "line " + line_no + ': "' + asm_buffer[line_no] + '" is not a valid instruction!'];
	}

	var inst = vm.op_table[inst_no];
	if (inst.length != bits.length) {
		return ['E', "line " + line_no + ': "' + asm_buffer[line_no] + '" has an invalid number of arguments!'];
	}

	if (inst.length == 2) {
		if (label_idx != -1) {
			return ['I', inst, bits[1], label_idx];
		} else {
			return ['I', inst, bits[1]];
		}
	} else if (inst.length == 1) {
		return ['I', inst];
	}
}

function parse_file(vm, asm_buffer) {
    asm_buffer = clean_comments(asm_buffer);

	for (var i = 0; i < asm_buffer.length; i++) {
		fill_labels(i, asm_buffer);
	}

	var asm_table = [];
	for (var i = 0; i < asm_buffer.length; i++) {
		var inst_pack = parse_line(vm, i, asm_buffer);
		if (inst_pack != undefined) {
			asm_table.push(inst_pack);
		}
	}

	var label_pos = [];
	var current_pos = 0;
	for (var i = 0; i < asm_table.length; i++) {
		if (asm_table[i][0] == 'I') { // Instruction packet
			var op = asm_table[i][1];
			current_pos += op.length;
		} else if (asm_table[i][0] == 'P') {
			current_pos = parseInt(asm_table[i][1]);
		} else if (asm_table[i][0] == 'D') {
            current_pos += 1;
		} else if (asm_table[i][0] == 'L') { // Label packet
			label_pos[asm_table[i][1]] = current_pos;
		} else if (asm_table[i][0] == 'LD') { // Labelled Data packet
			label_pos[asm_table[i][1]] = current_pos;
			current_pos += 1;
		}
	}

	var board_pos = 0;
	var board = new Uint8Array(16 * 16);
	var error_stack = [];
	for (var i = 0; i < asm_table.length; i++) {
		if (asm_table[i][0] == 'I') { // Instruction packet
			var op = asm_table[i][1];
			var operand = asm_table[i][2];
			var label_idx = asm_table[i][3];

			if (label_idx != undefined) {
			 //   console.log(op.name + " " + labels[label_idx]);
				board[board_pos] = vm.rev_lookup[op.name];
				board[board_pos + 1] = label_pos[label_idx];
			} else {
				if (op.length > 1) {
				 //   console.log(op.name + " " + operand);
					board[board_pos] = vm.rev_lookup[op.name];
					board[board_pos + 1] = parseInt(operand);
				} else {
				//	console.log(op.name);
					board[board_pos] = vm.rev_lookup[op.name];
				}
			}
			board_pos += op.length;
		} else if (asm_table[i][0] == 'D') { // Data packet
			var data = asm_table[i][1];
			board[board_pos] = data;
			board_pos += 1;
		} else if (asm_table[i][0] == 'LD') { // Labelled Data packet
			var data = asm_table[i][2];
			board[board_pos] = data;
			board_pos += 1;
		} else if (asm_table[i][0] == 'P') { // Position packet
			var pos = asm_table[i][1];
			board_pos = pos;
		} else if (asm_table[i][0] == 'E') { // Error packet
			error_stack.push(asm_table[i][1]);
		}
	}

	return [board, error_stack];
}

function assemble_program(vm, program) {
	labels = [];
	var asm_buffer = clean_str(program);
    var asm_ret = parse_file(vm, asm_buffer);
	return asm_ret;
}
