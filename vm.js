"use strict";

function array_to_hash(array) {
	var norm_str = '';
	for (var i = 0; i < array.length; i++) {
		var c_byte = (array[i]).toString(16);
		if (c_byte.length < 2) {
			c_byte = "0" + c_byte;
		}
		norm_str += c_byte;
	}

	var compressed_str = LZString.compressToBase64(norm_str);
	return compressed_str;
}

function hash_to_array(hash) {
	var packed = hash.slice(1);
	var str = LZString.decompressFromBase64(packed);

	var array = new Uint8Array(16 * 16);
	var arr_idx = 0;
	for (var i = 0; i < str.length; i += 2) {
		var val = parseInt(str.charAt(i) + "" + str.charAt(i + 1), 16);
		array[arr_idx] = val;
		arr_idx += 1;
	}
	return array;
}

class Instruction {
	constructor(name, type, long_desc, simple_desc, func, length, affects_grid, affects_regs) {
		this.name = name;
		this.type = type;
		this.long_desc = long_desc;
		this.simple_desc = simple_desc;
		this.func = func;
		this.length = length;
		this.affects_grid = affects_grid;
		this.affects_regs = affects_regs;
	}
}

class VM {
	constructor() {
		this.board = new Uint8Array(16 * 16);
		this.pc = 0;
		this.jsp = 0;
		this.reg = new Uint8Array(2);
		this.equal_flag = false;
		this.greater_flag = false;
		this.less_flag = false;
		this.zero_flag = false;
		this.error_flag = false;
		this.jsp_enabled = false;

		// TICK HELPERS
		this.cur_inst = null;
		this.cur_wait = 0;

		// EXTERNAL STATE
		this.running = false;
		this.tps = 20;
		this.selected_tile = 0;
		this.entry_buffer = "0";
		this.board_updated = true;
		this.reg_updated = true;
		this.step_updated = true;

		this.rendered_pc = -1;
		this.display_base = 10;
		this.pre_run = "";

		this.challenge_updated = false;
		this.cur_challenge = 0;
		this.challenge_list = ["#challenge0", "#challenge1", "#challenge2",
			"#challenge3", "#challenge4", "#challenge5",
			"#challenge6", "#challenge7", "#challenge8",
			"#challenge9"];

		this.read_table = new Float32Array(258);
		this.write_table = new Float32Array(258);
		this.effect_life = 5;
		this.decay_rate = 1;
		this.io_filter = true;

		var self = this;
		this.op_table = [
			new Instruction("NOP", "NONE", "Do nothing", "Do nothing", function() { return op_nop(); }, 1, false, false),
			new Instruction("LOAD A", "IO", "Load value at operand value address into register A", "Register A = [@IV]", function() { return op_load(self, 0); }, 2, false, true),
			new Instruction("LOAD B", "IO", "Load value at operand value address into register B", "Register B = [@IV]", function() { return op_load(self, 1); }, 2, false, true),
			new Instruction("LOADI A", "IO", "Load value at address stored at operand value address into register A", "Register A = [@IIV]", function() { return op_loadi(self, 0); }, 2, false, true),
			new Instruction("LOADI B", "IO", "Load value at address stored at operand value address into register B", "Register B = [@IIV]", function() { return op_loadi(self, 1); }, 2, false, true),
			new Instruction("STORE A", "IO", "Store register A value into operand value address", "[@IV] = Register A", function() { return op_store(self, 0); }, 2, true, true),
			new Instruction("STORE B", "IO", "Store register B value into operand value address", "[@IV] = Register B", function() { return op_store(self, 1); }, 2, true, true),
			new Instruction("STOREI A", "IO", "Store register A value into address at operand value address", "[@IIV] = Register A", function() { return op_storei(self, 0); }, 2, true, true),
			new Instruction("STOREI B", "IO", "Store register B value into address at operand value address", "[@IIV] = Register B", function() { return op_storei(self, 1); }, 2, true, true),
			new Instruction("SET A", "IO", "Load operand value into register A", "Register A = @V", function() { return op_set(self, 0); }, 2, false, true),
			new Instruction("SET B", "IO", "Load operand value into register B", "Register B = @V", function() { return op_set(self, 1); }, 2, false, true),
			new Instruction("ADD A B", "MATH", "Add register A and register B, store in register A", "Register A = Register A (@A) + Register B (@B)", function() { return op_add(self, 0, 1); }, 1, false, true),
			new Instruction("ADDI A", "MATH", "Add operand value to register A", "Register A = Register A (@A) + @V", function() { return op_addi(self, 0); }, 2, false, true),
			new Instruction("ADDI B", "MATH", "Add operand value to register B", "Register B = Register B (@B) + @V", function() { return op_addi(self, 1); }, 2, false, true),
			new Instruction("SUB A B", "MATH", "Subtract register A from register B, store in register A", "Register A = Register A (@A) - Register B (@B)", function() { return op_sub(self, 0, 1); }, 1, false, true),
			new Instruction("SUB B A", "MATH", "Subtract register B from register A, store in register A", "Register A = Register B (@B) - Register A (@A)", function() { return op_sub(self, 1, 0); }, 1, false, true),
			new Instruction("SUBI A", "MATH", "Subtract operand value from register A, store in register A", "Register A = Register A (@A) - @V", function() { return op_subi(self, 0); }, 2, false, true),
			new Instruction("SUBI B", "MATH", "Subtract operand value from register B, store in register B", "Register B = Register B (@B) - @V", function() { return op_subi(self, 1); }, 2, false, true),
			new Instruction("INC A", "MATH", "Increment register A", "Register A = Register A (@A) + 1", function() { return op_inc(self, 0); }, 1, false, true),
			new Instruction("INC B", "MATH", "Increment register B", "Register B = Register B (@B) + 1", function() { return op_inc(self, 1); }, 1, false, true),
			new Instruction("DEC A", "MATH", "Decrement register A", "Register A = Register A (@A) - 1", function() { return op_dec(self, 0); }, 1, false, true),
			new Instruction("DEC B", "MATH", "Decrement register B", "Register B = Register B (@B) - 1", function() { return op_dec(self, 1); }, 1, false, true),
			new Instruction("CMP A B", "COND", "clear flags; if A > B, set G; flag; if A < B, set L flag; if equal set E flag", "Compare Register A (@A) to Register B (@B)", function() { return op_cmp(self, 0, 1); }, 1, false, true),
			new Instruction("CMP B A", "COND", "clear flags; if A > B, set G; flag; if A < B, set L flag; if equal set E flag", "Compare Register B (@B) to Register A (@A)", function() { return op_cmp(self, 1, 0); }, 1, false, true),
			new Instruction("ISZERO A", "COND", "clear Z flag; if A == 0, set Z flag", "Check if Register A (@A) is zero", function() { return op_iszero(self, 0); }, 1, false, true),
			new Instruction("ISZERO B", "COND", "clear Z flag; if A == 0, set Z flag", "Check if Register B (@B) is zero", function() { return op_iszero(self, 1); }, 1, false, true),
			new Instruction("JMP", "JMP", "Move the program counter to operand value address", "pc = @V", function() { return op_jmp(self); }, 2, false, false),
			new Instruction("JMPI", "JMP", "Move the program counter to address contained at operand value address", "pc = @V", function() { return op_jmpi(self); }, 2, false, false),
			new Instruction("JZ", "JMP", "Move the program counter to operand value address if Z flag is true", "If Z flag = true, Move the pc to position @V", function() { return op_jz(self); }, 2, false, false),
			new Instruction("JZI", "JMP", "Move the program counter to address contained at operand value address if Z flag is true", "If Z flag = true, Move the pc to position @IV", function() { return op_jzi(self); }, 2, false, false),
			new Instruction("JG", "JMP", "Move the program counter to operand value address if G flag is true", "If G flag = true, Move the pc to position @V", function() { return op_jg(self); }, 2, false, false),
			new Instruction("JGI", "JMP", "Move the program counter to address contained at operand value address if G flag is true", "If G flag = true, Move the pc to position @IV", function() { return op_jgi(self); }, 2, false, false),
			new Instruction("JL", "JMP", "Move the program counter to operand value address if L flag is true", "If L flag = true, Move the pc to position @V", function() { return op_jl(self); }, 2, false, false),
			new Instruction("JLI", "JMP", "Move the program counter to address contained at operand value address if L flag is true", "If L flag = true, Move the pc to position @IV", function() { return op_jli(self); }, 2, false, false),
			new Instruction("JE", "JMP", "Move the program counter to operand value address if E flag is true", "If E flag = true, Move the pc to position @V", function() { return op_je(self); }, 2, false, false),
			new Instruction("JEI", "JMP", "Move the program counter to address contained at operand value address if E flag is true", "If E flag = true, Move the pc to position @IV", function() { return op_jei(self); }, 2, false, false),
			new Instruction("JNE", "JMP", "Move the program counter to operand value address if E flag is false", "If E flag = false, Move the pc to position @V", function() { return op_jne(self); }, 2, false, false),
			new Instruction("JNEI", "JMP", "Move the program counter to address contained at operand value address if E flag is false", "If E flag = false, Move the pc to position @IV", function() { return op_jnei(self); }, 2, false, false),
			new Instruction("JERR", "JMP", "Move the program counter to operand value address if Err flag is true", "If Err flag = true, Move the pc to position @V", function() { return op_jerr(self); }, 2, false, false),
			new Instruction("JERRI", "JMP", "Move the program counter to address contained at operand value address if Err flag is true", "If Err flag = true, Move the pc to position @IV", function() { return op_jerri(self); }, 2, false, false),
			new Instruction("RELJMP", "JMP", "Move the program counter to program counter plus the operand value", "pc = @P + @V", function() { return op_reljmp(self); }, 2, false, false),
			new Instruction("REGJMP A", "JMP", "Move the program counter to the value contained in register A", "pc = grid[Register A]", function() { return op_regjmp(self, 0); }, 1, false, false),
			new Instruction("REGJMP B", "JMP", "Move the program counter to the value contained in register B", "pc = grid[Register B]", function() { return op_regjmp(self, 1); }, 1, false, false),
			new Instruction("RET", "JMP", "Return to the last placed jumped from, decrement JSP", "pc = last jump position", function() { return op_ret(self); }, 1, false, true),
			new Instruction("SETSP", "JMP", "Enable the JSP stack, set the JSP start pointer", "Enable JSP, set it to @V", function() { return op_setsp(self); }, 2, false, true),
			new Instruction("DEREF A", "UTIL", "Set register A to the value at the address contained in Register A", "Register A = grid[Register A (@A)]", function() { return op_deref(self, 0); }, 1, false, true),
			new Instruction("DEREF B", "UTIL", "Set register B to the value at the address contained in Register B", "Register B = grid[Register B (@B)]", function() { return op_deref(self, 1); }, 1, false, true),
			new Instruction("SWAP A B", "UTIL", "Swap the values in register A and register B", "Register A (@A), Register B (@B) -> Register A (@B), Register B (@A)", function() { return op_swap(self, 0, 1); }, 1, false, true),
			new Instruction("NOT A", "BIT", "Bitwise not register A value into register A", "Register A = NOT Register A (@A)", function() { return op_not(self, 0); }, 1, false, true),
			new Instruction("NOT B", "BIT", "Bitwise not register B value into register B", "Register B = NOT Register B (@B)", function() { return op_not(self, 1); }, 1, false, true),
			new Instruction("AND A", "BIT", "Bitwise and register A value and operand value into register A", "Register A = @V AND Register A (@A)", function() { return op_and(self, 0); }, 1, false, true),
			new Instruction("AND B", "BIT", "Bitwise and register B value and operand value into register B", "Register B = @V AND Register B (@B)", function() { return op_and(self, 1); }, 1, false, true),
			new Instruction("OR A", "BIT", "Bitwise or register A value and operand value into register A", "Register A = @V OR Register A (@A)", function() { return op_or(self, 0); }, 1, false, true),
			new Instruction("OR B", "BIT", "Bitwise or register B value and operand value into register B", "Register B = @V OR Register B (@B)", function() { return op_or(self, 1); }, 1, false, true),
			new Instruction("XOR A", "BIT", "Bitwise xor register A value and operand value into register A", "Register A = @V XOR Register A (@A)", function() { return op_xor(self, 0); }, 1, false, true),
			new Instruction("XOR B", "BIT", "Bitwise xor register B value and operand value into register B", "Register B = @V XOR Register A (@B)", function() { return op_xor(self, 1); }, 1, false, true),
			new Instruction("SHL A", "BIT", "Shift register A value left 1 bit, operand value times", "Register A = Register A (@A) &#x226A @V", function() { return op_shl(self, 0); }, 1, false, true),
			new Instruction("SHL B", "BIT", "Shift register B value left 1 bit, operand value times", "Register B = Register B (@B) &#x226A @V", function() { return op_shl(self, 1); }, 1, false, true),
			new Instruction("SHR A", "BIT", "Shift register A value right 1 bit, operand value times, propagating 0", "Register A = Register A (@A) &#x226B @V", function() { return op_shr(self, 0); }, 1, false, true),
			new Instruction("SHR B", "BIT", "Shift register B value right 1 bit, operand value times, propagating 0", "Register B = Register B (@B) &#x226B @V", function() { return op_shr(self, 1); }, 1, false, true),
			new Instruction("HALT", "UTIL", "Halt the running program", "Stop the running program", function() { return op_halt(self); }, 1, false, true),
			new Instruction("ERROR", "UTIL", "Halt the running program, toss the error flag", "Stop the running program, toss error flag", function() { return op_error(self); }, 1, false, true),
			new Instruction("UNSETSP", "JMP", "Disable the JSP stack", "Disable the JSP", function() { return op_unsetsp(self); }, 1, false, true),
		];

		let rev_lookup = [];
		for (let i = 0; i < this.op_table.length; i++) {
			let op = this.op_table[i];
			rev_lookup[op.name] = i;
		}
		this.rev_lookup = rev_lookup;

		let table = document.getElementById("op_table_iso");
		if (table != undefined) {
			let head_id_cell = document.createElement('p');
			let head_name_cell = document.createElement('p');
			let head_desc_cell = document.createElement('p');
			let head_operand_cell = document.createElement('p');
			head_id_cell.innerHTML = "Value";
			head_name_cell.innerHTML = "Instruction";
			head_desc_cell.innerHTML = "Description";
			head_operand_cell.innerHTML = "Has Operand";

			head_desc_cell.style.cssText = "flex-grow: 6";
			head_id_cell.style.textAlign = "center";
			head_operand_cell.style.textAlign = "center";

			let head_op_div = document.createElement('div');
			head_op_div.className = "op_container";
			head_op_div.append(head_id_cell);
			head_op_div.append(head_name_cell);
			head_op_div.append(head_desc_cell);
			head_op_div.append(head_operand_cell);
			table.append(head_op_div);

			for (let i = 0; i < this.op_table.length; i++) {
				let id_cell = document.createElement('p');
				let name_cell = document.createElement('p');
				let desc_cell = document.createElement('p');
				let operand_cell = document.createElement('p');

				id_cell.innerHTML = (i).toString(this.display_base).toUpperCase();
				name_cell.innerHTML = this.op_table[i].name;
				desc_cell.innerHTML = this.op_table[i].long_desc;
				operand_cell.innerHTML = this.op_table[i].length > 1 ? "true" : "false";

				desc_cell.style.cssText = "flex-grow: 6";
				id_cell.style.textAlign = "center";
				operand_cell.style.textAlign = "center";

				let op_div = document.createElement('div');
				op_div.className = "op_container";
				op_div.append(id_cell);
				op_div.append(name_cell);
				op_div.append(desc_cell);
				op_div.append(operand_cell);
				table.append(op_div);
			}
		}

		this.page_op_table = document.getElementsByClassName("op_container");
		this.row_updated = true;
	}

	print_op_type(type) {
		let typed_ops = [];
		for (let i = 0; i < this.op_table.length; i++) {
			let op = this.op_table[i];
			if (op.type == type) {
				typed_ops.push(op);
			}
		}

		console.log(typed_ops);
	}

	switch_base() {
		if (this.display_base == 10) {
			this.display_base = 16;
		} else {
			this.display_base = 10;
		}

		this.reg_updated = true;
		this.step_updated = true;
		this.board_updated = true;

		let table = this.page_op_table;
		for (var i = 0; i < this.op_table.length; i++) {
			let items = table[i + 1].getElementsByTagName("p");
			items[0].innerHTML = (i).toString(this.display_base).toUpperCase();
		}
	}

	tick() {
		if (!this.running) {
			return;
		}

		let old_a_decay = this.read_table[256];
		let old_b_decay = this.read_table[257];
		for (let i = 0; i < this.read_table.length; i++) {
			if (this.read_table[i] > 0) {
				this.read_table[i] -= this.decay_rate;
			} else {
				this.read_table[i] = 0;
			}
		}

		if ((old_a_decay != this.read_table[256]) || (old_b_decay != this.read_table[257])) {
			this.reg_updated = true;
		}

		old_a_decay = this.write_table[256];
		old_b_decay = this.write_table[257];
		for (let i = -2; i < this.write_table.length; i++) {
			if (this.write_table[i] > 0) {
				this.write_table[i] -= this.decay_rate;
			} else {
				this.write_table[i] = 0;
			}
		}

		if ((old_a_decay != this.write_table[256]) || (old_b_decay != this.write_table[257])) {
			this.reg_updated = true;
		}

		if (this.cur_inst == null) {
			this.cur_inst = this.op_table[this.board[this.pc]];
			if (this.cur_inst === undefined) {
				this.cur_inst = this.op_table[0];
			}
			this.cur_wait = this.cur_inst.length - 1;
		}

		if (this.cur_wait > 0) {
			this.cur_wait -= 1;
		} else {
			this.cur_inst.func();
			if (this.cur_inst.affects_grid) {
				this.board_updated = true;
			}
			if (this.cur_inst.affects_regs) {
				this.reg_updated = true;
			}
			this.cur_inst = null;
		}

		this.pc = (this.pc + 1) % 256;
	}

	load_board(hash_str) {
		switch (hash_str) {
			case "": {
				this.board = new Uint8Array(16 * 16);
			} break;
			case this.challenge_list[0]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 0: Put a 9 in the 0 position, and a 1 in the 1 position";
				hash_str = "#Aw4RgDjBjAzBTMBDWtTo5r2e7/gwo4k0s8iyq6m2u+hxp4AZgBMXog==";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 0;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[1]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 1: Use the JE to avoid the Error Flag";
				hash_str = "#Aw0iMBsBM0GYFNwEM5zBzXs93/BhRxJpZ5FlV1Ntd9DjTAzACbMDGQA=";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 1;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[2]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 2: Compare tile 15 to an equal value to avoid the Error Flag";
				hash_str = "#AwRmDNi0DYCY7nCAhuAptL3gFYcGFHEmlnkWVXU2130ONPMutvvMDMAJpwMZA===";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 2;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[3]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 3: Fix the loop";
				hash_str = "#AwRmDMQDhBjdIBZgFYLA6AhuAppgtA4k0s8iyq6m2u+hxp5l1t9jzr7nugZgAmfWEA==";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 3;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[4]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 4: Call the function 5 times";
				hash_str = "#AwRmDMQDhBjcBsIAswCsFhdAQ0dgjA4k0srFLAJmTACN1UQdzW33SwqOfe/+BgocJGix4iZKnSClYCzogEVKuHBYAzABMNsIA===";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 4;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[5]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 5: Activate the jump stack (it doesn't matter where you put it, just try not to overwrite code)";
				hash_str = "#AwkRgFgJjAOMDGAzAbJYBWaYCGVhQpJK4GjkWVXXoERjABGmEBjux1X3PVD+GXkOEjRY8RMlTpM2XPkLFE2jiZgUUKJ2ABmACY6EQA==";
				this.board = hash_to_array(hash_str);
				this.cur_challenge = 5;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[6]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 6: Store two values in tiles and subtract them. Store the result in a seperate tile";
				this.board = new Uint8Array(16 * 16);
				this.cur_challenge = 6;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[7]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 7: Increment a value and store each new version in a different tile. Example: 208 [0][1][2][3][4]";
				this.board = new Uint8Array(16 * 16);
				this.cur_challenge = 7;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[8]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 8: Write a function to copy an array from one row to another";
				this.board = new Uint8Array(16 * 16);
				this.cur_challenge = 8;
				this.challenge_updated = true;
			} break;
			case this.challenge_list[9]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 9: Find the maximum value in an array";
				this.board = new Uint8Array(16 * 16);
				this.cur_challenge = 9;
				this.challenge_updated = true;
			} break;
			default: {
				this.board = hash_to_array(hash_str);
			}
		}
		this.pre_run = hash_str;
		this.board_updated = true;
	}

	save_board() {
		let str = "#" + array_to_hash(this.board);
		this.pre_run = str;
		location.replace(str);
	}

	update_iotables(read_idx, write_idx) {
		this.write_table[write_idx] = this.effect_life;
		this.read_table[read_idx] = this.effect_life;
	}

	clear_state() {
		this.running = false;

		this.pc = 0;
		this.jsp = 0;
		this.reg = new Uint8Array(2);
		this.equal_flag = false;
		this.greater_flag = false;
		this.less_flag = false;
		this.zero_flag = false;
		this.error_flag = false;
		this.jsp_enabled = false;

		this.cur_inst = null;
		this.cur_wait = 0;

		this.read_table = new Float32Array(258);
		this.write_table = new Float32Array(258);

		this.step_updated = true;
		this.row_updated = true;
		this.board_updated = true;
		this.reg_updated = true;
	}

	reset() {
		this.load_board(this.pre_run);
		this.clear_state();
	}

	next_challenge() {
		if (this.cur_challenge < this.challenge_list.length - 1) {
			this.cur_challenge++;
			location.replace(this.challenge_list[this.cur_challenge]);
		}
	}

	prev_challenge() {
		if (this.cur_challenge > 0) {
			this.cur_challenge--;
			location.replace(this.challenge_list[this.cur_challenge]);
		}
	}

	reset_challenge() {
		this.load_board(this.challenge_list[this.cur_challenge]);
	}

	load_asm(asm_str) {
		let asm_ret = assemble_program(this, asm_str);
		this.board = asm_ret[0];

		if (asm_ret[1].length > 0) {
			document.getElementById("asm_err").innerHTML = "";
			for (let i = 0; i < asm_ret[1].length; i++) {
				document.getElementById("asm_err").innerHTML += asm_ret[1][i] + "<br>";
			}
		} else {
			document.getElementById("asm_err").innerHTML = "<br>";
		}
		this.save_board();
		this.clear_state();
	}
}

function push(vm, x) {
	if (vm.jsp_enabled) {
		vm.board[vm.jsp] = x;
		vm.jsp = (vm.jsp + 1) % 256;
		vm.board_updated = true;
	}
}


function op_nop() { }

function op_load(vm, idx) {
	vm.reg[idx] = vm.board[vm.board[vm.pc]];
	vm.update_iotables(vm.board[vm.pc], (idx + 256));
}

function op_loadi(vm, idx) {
	vm.reg[idx] = vm.board[vm.board[vm.board[vm.pc]]];
	vm.update_iotables(vm.board[vm.board[vm.pc]], (idx + 256));
}

function op_store(vm, idx) {
	vm.board[vm.board[vm.pc]] = vm.reg[idx];
	vm.update_iotables(idx + 256, vm.board[vm.pc]);
}

function op_storei(vm, idx) {
	vm.board[vm.board[vm.board[vm.pc]]] = vm.reg[idx];
	vm.update_iotables(idx + 256, vm.board[vm.board[vm.pc]]);
}

function op_set(vm, idx) {
	vm.reg[idx] = vm.board[vm.pc];
	vm.update_iotables(idx + 256, vm.pc);
}

function op_add(vm, a_idx, b_idx) {
	var tmp = vm.reg[a_idx] + vm.reg[b_idx];
	if (tmp > 255) {
		vm.error_flag = true;
	}
	vm.reg[a_idx] = tmp;
}

function op_addi(vm, idx) {
	let tmp = vm.reg[idx] + vm.board[vm.pc];
	if (tmp > 255) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_sub(vm, a_idx, b_idx) {
	let tmp = vm.reg[a_idx] - vm.reg[b_idx];
	if (tmp < 0) {
		vm.error_flag = true;
	}
	vm.reg[a_idx] = tmp;
}

function op_subi(vm, idx) {
	let tmp = vm.reg[idx] - vm.board[vm.pc];
	if (tmp < 0) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_inc(vm, idx) {
	let tmp = vm.reg[idx] + 1;
	if (tmp > 255) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_dec(vm, idx) {
	let tmp = vm.reg[idx] - 1;
	if (tmp < 0) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_cmp(vm, a_idx, b_idx) {
	vm.less_flag = false;
	vm.equal_flag = false;
	vm.zero_flag = false;
	vm.greater_flag = false;

	if (vm.reg[a_idx] > vm.reg[b_idx]) {
		vm.greater_flag = true;
	} else if (vm.reg[a_idx] == vm.reg[b_idx]) {
		vm.equal_flag = true;
	} else {
		vm.less_flag = true;
	}
}

function op_iszero(vm, idx) {
	vm.zero_flag = false;
	if (vm.reg[idx] == 0) {
		vm.zero_flag = true;
	}
}

function op_jmp(vm) {
	push(vm, vm.pc);
	vm.pc = vm.board[vm.pc] - 1;
}

function op_jmpi(vm) {
	push(vm, vm.pc);
	vm.pc = vm.board[vm.board[vm.pc]] - 1;
}

function op_jz(vm) {
	if (vm.zero_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jzi(vm) {
	if (vm.zero_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_jg(vm) {
	if (vm.greater_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jgi(vm) {
	if (vm.greater_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_je(vm) {
	if (vm.equal_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jei(vm) {
	if (vm.equal_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_jne(vm) {
	if (vm.equal_flag == false) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jnei(vm) {
	if (vm.equal_flag == false) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_jl(vm) {
	if (vm.less_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jli(vm) {
	if (vm.less_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_jerr(vm) {
	if (vm.error_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.pc] - 1;
	}
}

function op_jerri(vm) {
	if (vm.error_flag == true) {
		push(vm, vm.pc);
		vm.pc = vm.board[vm.board[vm.pc]] - 1;
	}
}

function op_reljmp(vm, idx) {
	push(vm, vm.pc);
	vm.pc = ((vm.board[vm.pc] + vm.pc) % 256) - 1;
}

function op_regjmp(vm, idx) {
	push(vm, vm.pc);
	vm.pc = vm.reg[idx] - 1;
}

function op_ret(vm) {
	if (vm.jsp_enabled) {
		vm.jsp--;
		vm.pc = vm.board[vm.jsp];
	} else {
		vm.error_flag = true;
	}
}

function op_setsp(vm) {
	vm.jsp = vm.board[vm.pc];
	vm.jsp_enabled = true;
}

function op_unsetsp(vm) {
	vm.jsp_enabled = false;
}

function op_deref(vm, idx) {
	vm.reg[idx] = vm.board[vm.reg[idx]];
}

function op_swap(vm, a_idx, b_idx) {
	let tmp = vm.reg[a_idx];
	vm.reg[a_idx] = vm.reg[b_idx];
	vm.reg[b_idx] = tmp;
}

function op_not(vm, idx) {
	vm.reg[idx] = ~vm.reg[idx];
}

function op_and(vm, idx) {
	vm.reg[idx] = vm.reg[idx] & vm.board[vm.pc];
}

function op_or(vm, idx) {
	vm.reg[idx] = vm.reg[idx] | vm.board[vm.pc];
}

function op_xor(vm, idx) {
	vm.reg[idx] = vm.reg[idx] ^ vm.board[vm.pc];
}

function op_shr(vm, idx) {
	let tmp = vm.reg[idx] >>> vm.board[vm.pc];
	if (tmp < 0) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_shl(vm, idx) {
	let tmp = vm.reg[idx] << vm.board[vm.pc];
	if (tmp > 255) {
		vm.error_flag = true;
	}
	vm.reg[idx] = tmp;
}

function op_halt(vm) {
	vm.running = false;
	vm.read_table = new Float32Array(258);
	vm.write_table = new Float32Array(258);
	vm.pc--;
}

function op_error(vm) {
	vm.running = false;
	vm.error_flag = true;
	vm.read_table = new Float32Array(258);
	vm.write_table = new Float32Array(258);
	vm.pc--;
}
