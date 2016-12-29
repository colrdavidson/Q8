"use strict";

var labels = [];

function clean_str(str) {
	var tmp_buffer = str.trim().split(/\t|\n/);
	var buffer = [];
	for (var i = 0; i < tmp_buffer.length; i++) {
		if (tmp_buffer[i] != "") {
			buffer.push(tmp_buffer[i]);
		}
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
		if (line[i] == ";") {
			line = line.slice(0, i);
			break;
		}
	}

	for (var i = 0; i < line.length; i++) {
		if (line[i] == ":") {
			var label = line.slice(0, i);
			labels.push(label);
			break;
		}
	}
}

function parse_line(vm, line_no, asm_buffer) {
	var line = asm_buffer[line_no];

	// Handle comments on their own line
	if (line[0] == ';') {
		return;
	}

	// Handle data declaration
	var is_data = false;
	if (line[0] == '$') {
		is_data = true;
	}

	var bits = [];

	// Split into instruction and operand pieces
	if (!is_data) {
		for (var i = 0; i < line.length; i++) {
			if (line[i] == ';') { // If there's a comment before the first digit
				bits[0] = line.slice(0, i - 1);
				break;
			} else if (is_digit(line[i])) {
				bits[0] = line.slice(0, i - 1);
				bits[1] = line.slice(i);
				break;
			}
		}
	}

	if (bits.length == 0) {
		bits[0] = line;
	}

	// Remove inline comments
	if (bits.length > 1) {
		var operand = bits[1];
		for (var i = 0; i < operand.length; i++) {
			if (operand[i] == ';') {
				bits[1] = operand.slice(0, i).trim();
				break;
			}
		}
	} else {
		var bit = bits[0];
		for (var i = 0; i < bit.length; i++) {
			if (bit[i] == ';') {
				bits[0] = bit.slice(0, i).trim();
				break;
			}
		}
	}

	if (is_data) {
		var data_line = bits[0].split(" ");
		var pos = data_line[0].slice(1);
		var data = [];
		for (var i = 1; i < data_line.length; i++) {
			data.push(data_line[i]);
		}

		return ['D', pos, data];
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

		return ['L', label_idx];
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
		alert("line " + line_no + ': "' + asm_buffer[line_no] + '" is not a valid instruction!');
		return;
	}

	var inst = vm.op_table[inst_no];
	if (inst.length != bits.length) {
		alert("line " + line_no + ': "' + asm_buffer[line_no] + '" has an invalid number of arguments!');
		return;
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
		} else if (asm_table[i][0] == 'L') { // Label packet
			label_pos[asm_table[i][1]] = current_pos;
		}
	}

	var board_pos = 0;
	var board = new Uint8Array(16 * 16);
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
			var data_pos = parseInt(asm_table[i][1]);
			var data = asm_table[i][2];

			for (var j = 0; j < data.length; j++) {
				board[data_pos + j] = parseInt(data[j]);
			}
		}
	}

	return board;
}

function assemble_program(vm, program) {
	var asm_buffer = clean_str(program);
    var board = parse_file(vm, asm_buffer);
	return board;
}
