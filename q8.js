"use strict";

var gl;
var text_ctx;
var running = false;
var shader;
var v_square;
var a_pos;

var mouse_pressed = false;
var grab_var = false;
var grab_func = null;
var mouse_x;
var mouse_y;
var selected_block = 0;

var board;
var pc = 0;
var sp = 0;
var reg = new Uint8Array(2);
var equal_flag = false;
var greater_flag = false;
var less_flag = false;
var zero_flag = false;
var error_flag = false;
var reg_updated = true;
var stack_enabled = false;

var board_updated = true;
var entry_buffer = "";
var packed = "";
var debug_string = "";
var op = true;
var op_id;
var challenge_list = ["#challenge0", "#challenge1", "#challenge2", "#challenge3", "#challenge4", "#challenge5", "#challenge6", "#challenge7", "#challenge8", "#challenge9"];
var cur_challenge = 0;
var challenge_mode = false;

var verts = [
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
];

function step() {
    board_updated = true;
    running = true;
    update_board();
    board_updated = true;
    running = false;
    update_board();
	update_debug();
}

function update_debug() {
	var byte_op = false;
	if (op) {
		var table = document.getElementById('op_table');
		var rows = table.getElementsByTagName('tr');

		var op_name;
		var op_desc;
		op_id = board[pc];
		if (op_id < rows.length - 1) {
			var entries = rows[op_id + 1].getElementsByTagName('td');
			op_name = entries[1].innerHTML;
			op_desc = entries[2].innerHTML;
		}

		if (op_desc.search("Only 1 block, no operand") > -1) {
			byte_op = true;
		}

		debug_string = "Reading instruction " + op_id + "<br><font color='#90A0A0'>" + op_name + ': "' + op_desc + '"</font><br><br>';
	}
	if (!op || byte_op) {
		var table = document.getElementById('simple_text');
		var rows = table.getElementsByTagName('tr');
		var simple_desc;
		if (op_id < rows.length) {
			var entries = rows[op_id].getElementsByTagName('td');
			simple_desc = entries[0].innerHTML;
		}

		debug_string = debug_string.slice(0, debug_string.length - 2);
		debug_string += "Reading operand " + board[pc] + "<br>";
		simple_desc = simple_desc.replace("@O", board[pc]);
		simple_desc = simple_desc.replace("@A", reg[0]);
		simple_desc = simple_desc.replace("@B", reg[1]);
		simple_desc = simple_desc.replace("@V", board[board[pc]]);
		debug_string += simple_desc + "";
		byte_op = false;
	}
	if (debug_string === null) {
		debug_string = "";
	}
	document.getElementById("debug").innerHTML = debug_string;
}

function pause() {
    running = !running;
	board_updated = true;
	if (running) {
		debug_string = "This debug box is only available while stepping!";
		document.getElementById("debug").innerHTML = debug_string;
	}
}

function clear_reg() {
	for (var i = 0; i < reg.length; i++) {
		reg[i] = 0;
	}
	zero_flag = false;
	less_flag = false;
	greater_flag = false;
	equal_flag = false;
	error_flag = false;
}

function clear_flags() {
	clear_reg();
	grab_func = null;
	grab_var = false;
	pc = 0;
	sp = 0;
	stack_enabled = false;
	reg_updated = true;
	board_updated = true;
	entry_buffer = "";
}

function lookup_board() {
	var hash = window.location.hash;
	if (hash.includes("#")) {
		board_updated = true;
		challenge_mode = true;
		switch (hash) {
			case challenge_list[0]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 0: Put a 9 in the 0 position, and a 1 in the 1 position";
				cur_challenge = 0;
				return b64_to_array("#3|A|1|Y|1|H|1|P|1|4|1|a|1|/|1|w|329|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[1]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 1: Use the JE to avoid the Error Flag";
				cur_challenge = 1;
				return b64_to_array("#5|A|1|B|1|Y|1|i|1|/|1|h|1|r|1|/|327|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[2]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 2: Compare tile 15 to an equal value to avoid the Error Flag";
				cur_challenge = 2;
				return b64_to_array("#1|A|1|Q|1|8|2|A|1|B|1|Y|1|i|1|/|1|x|1|r|1|+|8|A|1|B|1|Q|317|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[3]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 3: Fix the loop";
				cur_challenge = 3;
				return b64_to_array("#1|A|1|Q|1|8|1|Y|1|H|1|P|1|8|1|U|1|B|1|Q|1|8|2|A|1|B|1|r|1|+|4|A|1|B|1|Q|317|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[4]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 4: Call the function 5 times";
				cur_challenge = 4;
				return b64_to_array("#1|A|1|Q|1|8|1|Y|1|H|1|P|1|Y|1|U|1|B|1|Q|1|8|2|A|1|B|1|r|1|2|4|A|1|B|1|Q|21|A|1|B|1|Q|1|A|1|J|1|B|1|C|1|w|1|V|1|A|1|G|1|g|32|A|1|E|1|C|241|A|1|U|1|A|1|K|1|C|1|x|1|Y|1|i|1|/|1|w|1|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[5]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 5: Activate the jump stack (it doesn't matter where you put it, just try not to overwrite code)";
				cur_challenge = 5;
				return b64_to_array("#3|A|1|B|1|Q|1|h|1|g|1|c|1|9|1|h|1|Q|1|F|1|Q|1|h|1|o|1|g|1|J|1|v|1|8|1|a|1|A|1|g|21|A|1|B|1|Q|1|A|1|J|1|B|1|C|1|w|1|V|1|A|1|K|1|x|1|r|1|/|30|A|1|E|1|C|1|B|1|Q|239|A|1|U|1|A|1|K|1|C|1|x|1|Y|1|i|1|/|1|w|1|A|1|9|1|P|1|A|2|=|");
			} break;
			case challenge_list[6]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 6: Store two values in tiles and subtract them. Store the result in a seperate tile";
				cur_challenge = 6;
 				return new Uint8Array(16 * 16);
			} break;
			case challenge_list[7]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 7: Increment a value and store each new version in a different tile. Example: 208 [0][1][2][3][4]";
				cur_challenge = 7;
 				return new Uint8Array(16 * 16);
			} break;
			case challenge_list[8]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 8: Write a function to copy an array from one row to another";
				cur_challenge = 8;
 				return new Uint8Array(16 * 16);
			} break;
			case challenge_list[9]: {
				document.getElementById('challenge_desc').innerHTML = "Challenge 9: Find the maximum value in an array";
				cur_challenge = 9;
 				return new Uint8Array(16 * 16);
			} break;
			default: {
				challenge_mode = false;
				return b64_to_array(hash);
			}
		}
	} else {
		board_updated = true;
 		return new Uint8Array(16 * 16);
	}
}

function reset() {
	board = lookup_board();
	running = false;
	clear_flags();
	op = true;
	update_debug();
}

function change_hash_val(str) {
	location.replace(str);
}

function reset_challenge() {
	change_hash_val(challenge_list[cur_challenge]);
	reset();
}

function next_challenge() {
	if (cur_challenge < challenge_list.length - 1) {
		cur_challenge++;
		change_hash_val(challenge_list[cur_challenge]);
	}
}

function prev_challenge() {
	if (cur_challenge > 0) {
		cur_challenge--;
		change_hash_val(challenge_list[cur_challenge]);
	}
}

function clear_board() {
	change_hash_val("#");
	clear_flags();
	highlight_row(board[selected_block]);
	op = true;
	update_debug();
}

function twod_to_oned(x, y, width) {
	return (y * width) + x;
}

var k_table = {};

function is_valid_digit_str(str) {
	var entry = parseInt(str);
	if (entry != NaN) {
		if (entry > 0 && entry < 256) {
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

function key_pressed(event) {
    k_table[event.keyCode] = true;

	switch (event.keyCode) {
		case 37: case 38: case 39: case 40: // Arrow keys
		case 32: event.preventDefault(); break; // Space
		case 13: event.preventDefault(); break; // Enter
		default: break;
	}

	var hit_arrow = false;
	switch (event.keyCode) {
		case 37: {
			selected_block -= 1;
			hit_arrow = true;
		} break;
		case 38: {
			selected_block -= 16;
			hit_arrow = true;
		} break;
		case 40: {
			selected_block += 16;
			hit_arrow = true;
		} break;
		case 39: {
			selected_block += 1;
			hit_arrow = true;
		} break;
	}

	if (hit_arrow) {
		if (selected_block < 0) {
			selected_block = (selected_block + 256) % 256;
		} else if (selected_block > 255) {
			selected_block = selected_block % 256;
		}
		entry_buffer = "" + board[selected_block];
		highlight_row(board[selected_block]);
	}

	board_updated = true;
}

function key_released(event) {
    k_table[event.keyCode] = false;
	switch (event.keyCode) {
		case 37: case 38: case 39: case 40: {
		} break; // Arrow keys
		case 8: {
			if (entry_buffer.length > 1) {
				entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
			} else {
				entry_buffer = "0";
			}
			board[selected_block] = parseInt(entry_buffer);
			change_hash_val("#" + array_to_b64(board));
		} break;
		default: {
			var tmp_buffer = entry_buffer + String.fromCharCode(event.keyCode);
			if (is_valid_digit_str(tmp_buffer)) {
				entry_buffer = tmp_buffer;
				board[selected_block] = parseInt(entry_buffer);
				change_hash_val("#" + array_to_b64(board));
			}
		} break;
	}

	board_updated = true;
	highlight_row(board[selected_block]);
}

function clear_highlights(table, rows) {
    var table = document.getElementById('op_table');
	var rows = table.getElementsByTagName('tr');

    for (var i = 0; i < rows.length; i++) {
		rows[i].classList.remove('selected');
	}
}

function highlight_row(id) {
    var table = document.getElementById('op_table');
	var rows = table.getElementsByTagName('tr');

	clear_highlights();

	if (id < rows.length - 1) {
		rows[id + 1].className += " selected";
	}
}

function mouse_clicked(canvas, event) {
    mouse_pressed = true;
    var rect = canvas.getBoundingClientRect();
	var tmp_x = event.clientX - rect.left;
	var tmp_y = event.clientY - rect.top;

	if (tmp_x > canvas.width || tmp_x < 0 || tmp_y > canvas.height || tmp_y < 0) {
		selected_block = -1;
	} else {
		selected_block = twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16);
		entry_buffer = "" + board[selected_block];
		highlight_row(board[selected_block]);
	}
	board_updated = true;
}

function mouse_released(event) {
    mouse_pressed = false;
}

function mouse_moved(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    mouse_x = event.clientX - rect.left;
    mouse_y = event.clientY - rect.top;
}

function hash_change() {
	if (challenge_mode) {
		document.getElementById('challenge_box').removeAttribute("hidden");
	}
	board = lookup_board();
}

function tick() {
    if (grab_var) {
        grab_var = false;
		op = true;
        grab_func(board);
    } else {
        grab_var = true;
        switch (board[pc]) {
			case 0: { grab_var = false; } break; //NOP
            case 1: { grab_func = function() { op_load(board, 0); }; } break;
            case 2: { grab_func = function() { op_load(board, 1); }; } break;
            case 3: { grab_func = function() { op_load_ind(board, 0); }; } break;
            case 4: { grab_func = function() { op_load_ind(board, 1); }; } break;
            case 5: { grab_func = function() { op_store(board, 0); }; } break;
            case 6: { grab_func = function() { op_store(board, 1); }; } break;
            case 7: { grab_func = function() { op_store_ind(board, 0); }; } break;
            case 8: { grab_func = function() { op_store_ind(board, 1); }; } break;
            case 9: { grab_func = function() { op_set(board, 0); }; } break;
            case 10: { grab_func = function() { op_set(board, 1); }; } break;
            case 11: { op_add(0, 1); grab_var = false; } break;
            case 12: { grab_func = function() { op_addi(board, 0); }; } break;
            case 13: { grab_func = function() { op_addi(board, 1); }; } break;
            case 14: { op_sub(0, 1); grab_var = false; } break;
            case 15: { op_sub(1, 0); grab_var = false; } break;
            case 16: { grab_func = function() { op_subi(board, 0); }; } break;
            case 17: { grab_func = function() { op_subi(board, 1); }; } break;
            case 18: { op_inc(0); grab_var = false; } break;
            case 19: { op_inc(1); grab_var = false; } break;
            case 20: { op_dec(0); grab_var = false; } break;
            case 21: { op_dec(1); grab_var = false; } break;
            case 22: { op_cmp(0, 1); grab_var = false; } break;
            case 23: { op_cmp(1, 0); grab_var = false; } break;
            case 24: { op_iszero(0); grab_var = false; } break;
            case 25: { op_iszero(1); grab_var = false; } break;
            case 26: { grab_func = function() { op_jmp(board); }; } break;
            case 27: { grab_func = function() { op_jmpi(board); }; } break;
            case 28: { grab_func = function() { op_jz(board); }; } break;
            case 29: { grab_func = function() { op_jzi(board); }; } break;
            case 30: { grab_func = function() { op_jg(board); }; } break;
            case 31: { grab_func = function() { op_jgi(board); }; } break;
            case 32: { grab_func = function() { op_jl(board); }; } break;
            case 33: { grab_func = function() { op_jli(board); }; } break;
            case 34: { grab_func = function() { op_je(board); }; } break;
            case 35: { grab_func = function() { op_jei(board); }; } break;
            case 36: { grab_func = function() { op_jne(board); }; } break;
            case 37: { grab_func = function() { op_jnei(board); }; } break;
            case 38: { grab_func = function() { op_jerr(board); }; } break;
            case 39: { grab_func = function() { op_jerri(board); }; } break;
            case 40: { grab_func = function() { op_reljmp(board); }; } break;
            case 41: { op_regjmp(0); grab_var = false; pc--; } break;
            case 42: { op_regjmp(1); grab_var = false; pc--; } break;
            case 43: { op_ret(board); grab_var = false; } break;
            case 44: { grab_func = function() { op_setsp(board); }; } break;
            case 45: { op_deref(0); grab_var = false; } break;
            case 46: { op_deref(1); grab_var = false; } break;
            case 47: { op_swap(0, 1); grab_var = false; } break;
            case 48: { op_not(0); grab_var = false; } break;
            case 49: { op_not(1); grab_var = false; } break;
            case 50: { grab_func = function() { op_and(board, 0); }; } break;
            case 51: { grab_func = function() { op_and(board, 1); }; } break;
            case 52: { grab_func = function() { op_or(board, 0); }; } break;
            case 53: { grab_func = function() { op_or(board, 1); }; } break;
            case 54: { grab_func = function() { op_xor(board, 0); }; } break;
            case 55: { grab_func = function() { op_xor(board, 1); }; } break;
            case 56: { grab_func = function() { op_shl(board, 0); }; } break;
            case 57: { grab_func = function() { op_shl(board, 1); }; } break;
            case 58: { grab_func = function() { op_shr(board, 0); }; } break;
            case 59: { grab_func = function() { op_shr(board, 1); }; } break;
			case 60: { running = false; grab_var = false; pc--; } break; //Halt op
			case 61: { running = false; grab_var = false; pc--; error_flag = true; reg_updated = true; } break; //Error op
            default: { grab_var = false; }
        }
		if (grab_var == false) {
			op = true;
		} else {
			op = false;
		}
		pc++;
    }
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(shader);

    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, v_square);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    var persp = makeOrtho(0.0, 512.0, 512.0, 0.0, 0.0, 1.0);

	// Draw program counter
    var model = loadIdentity();
    model = modelTranslate(model, [(pc % 16) * 32, (Math.floor(pc / 16)) * 32, 0.0]);
    model = modelScale(model, [33.0, 33.0, 1.0]);

    var u_color = gl.getUniformLocation(shader, "color");
    var u_persp = gl.getUniformLocation(shader, "perspective");
    var u_model = gl.getUniformLocation(shader, "model");

	gl.uniform3f(u_color, 0.745, 0.965, 0.918);
    gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
    gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw edit selector
	model = loadIdentity();
	model = modelTranslate(model, [(selected_block % 16) * 32, (Math.floor(selected_block / 16)) * 32, 0.0]);
	model = modelScale(model, [33.0, 33.0, 1.0]);

    gl.uniform3f(u_color, 0.157, 0.733, 0.612);
	gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
	gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw grid
    for (var x = 0; x < 16; x++) {
    	for (var y = 0; y < 16; y++) {
			model = loadIdentity();
			model = modelTranslate(model, [(x * 32) + 2.0, (y * 32) + 2.0, 0.0]);
            model = modelScale(model, [29.0, 29.0, 1.0]);

			var u_color = gl.getUniformLocation(shader, "color");
            var u_persp = gl.getUniformLocation(shader, "perspective");
            var u_model = gl.getUniformLocation(shader, "model");

			var pos = twod_to_oned(x, y, 16);
            var i = board[pos];

			if (selected_block == pos) {
    			gl.uniform3f(u_color, 0.157, 0.733, 0.612);
            } else if (i != 0) {
                gl.uniform3f(u_color, 0.8, 0.8, 0.8);
            } else {
                gl.uniform3f(u_color, 0.5, 0.5, 0.5);
            }

            gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
            gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}

}

function update_board() {
    if (running) {
		render();
		tick();
		if (pc > 255) {
			pc = 0;
		}
	}

	if (board_updated) {
		text_ctx.clearRect(0, 0, text_ctx.canvas.width, text_ctx.canvas.height);
		text_ctx.font = "16px sans-serif";
		text_ctx.fillStyle = 'rgba(0, 0, 0, 255)';
		text_ctx.textAlign = "center";
		for (var x = 0; x < 16; x++) {
			for (var y = 0; y < 16; y++) {
				text_ctx.fillText(board[twod_to_oned(x, y, 16)], ((x + 1) * 32) + 17.0, (y * 32) + 46.0);
			}
		}

		text_ctx.font = "16px sans-serif";
		text_ctx.fillStyle = 'rgba(0, 0, 0, 255)';
		text_ctx.textAlign = "middle";
		for (var y = 0; y < 16; y++) {
			text_ctx.fillText((y * 16).toString(10), 14, (y * 32) + 48);
		}
		for (var x = 0; x < 16; x++) {
			text_ctx.fillText((x).toString(10), (x * 32) + 49, 18);
		}

		if (!running) {
			render();
		}
		board_updated = false;
	}
    if (reg_updated) {
        document.getElementById("reg_a").innerHTML = reg[0];
        document.getElementById("reg_b").innerHTML = reg[1];
        document.getElementById("f_zero").innerHTML = zero_flag;
        document.getElementById("f_eq").innerHTML = equal_flag;
        document.getElementById("f_less").innerHTML = less_flag;
        document.getElementById("f_great").innerHTML = greater_flag;
        document.getElementById("f_stack_enabled").innerHTML = stack_enabled;
        document.getElementById("f_sp").innerHTML = sp;
		if (stack_enabled == true) {
			document.getElementById("f_stack_enabled").className = "selected";
		} else {
			document.getElementById("f_stack_enabled").classList.remove('selected');
		}
		if (error_flag == true) {
			document.getElementById("f_err").className = "selected";
		} else {
			document.getElementById("f_err").classList.remove('selected');
		}
        document.getElementById("f_err").innerHTML = error_flag;
        reg_updated = false;
    }
}

function update(step) {
    update_board();
    window.requestAnimationFrame(update);
}

function is_number(c) {
	  return !isNaN(parseFloat(c)) && isFinite(c);
}

function pack_string(str) {
	str += ";";

	var rle_str = '';
	var occurance_counter = 0;
	var cur_char = str.charAt(i);
	for (var i = 0; i < str.length; i++) {
		if (cur_char != str.charAt(i)) {
			rle_str += occurance_counter + "|" + cur_char + "|";
			occurance_counter = 1;
			cur_char = str.charAt(i);
		} else {
			occurance_counter++;
		}
	}

	return rle_str;
}

function unpack_string(rle_str) {
	var real_str = "";
	for (var i = 0; i < rle_str.length; i++) {
		var occurance_str = "";
		var j = i;
		for (; rle_str.charAt(j) != '|'; j++) {
			occurance_str += rle_str.charAt(j);
		}
		i = j + 1;
		var repeat_len = parseInt(occurance_str);
		for (j = 0; j < repeat_len; j++) {
			real_str += rle_str.charAt(i);
		}
		i += 1;
	}

	return real_str;
}

function array_to_b64(array) {
	var binary = '';

	for (var i = 0; i < array.byteLength; i++) {
		binary += String.fromCharCode(array[i]);
	}

	var b64_str = window.btoa(binary);
	var packed = pack_string(b64_str);
	return packed;
}

function b64_to_array(hash) {
	var packed = hash.slice(1);
	var b64_str = unpack_string(packed);
	var binary = window.atob(b64_str);

	var len = binary.length;
	var bytes = new Uint8Array(16 * 16);

	for (var i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function start_q8() {
    var canvas = document.getElementById("glcanvas");
	var text_canvas = document.getElementById("text");

    gl = initWebGL(canvas);
	text_ctx = text_canvas.getContext("2d");

    if (gl && text_ctx) {
		text_ctx.font = "16px sans-serif";
		text_ctx.textBaseline = "middle";
		text_ctx.textAlign = "center";
		text_ctx.fillStyle = 'rgba(0, 0, 0, 255)';

        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        shader = init_shader("shader-vs", "shader-fs");

        a_pos = gl.getAttribLocation(shader, "my_pos");

        v_square = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, v_square);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

		board = lookup_board();
		if (challenge_mode) {
    		document.getElementById('challenge_box').removeAttribute("hidden");
		}

        document.onmouseup = mouse_released;
        document.onkeyup = key_released;
        document.onkeydown = key_pressed;

        canvas.addEventListener("mousemove", function(evt) { mouse_moved(canvas, evt); }, false);
        document.addEventListener("mousedown", function(evt) { mouse_clicked(canvas, evt); }, false);
		window.addEventListener("hashchange", function() { hash_change(); }, false);
		window.addEventListener("onpopstate", function() { pop_state(); }, false);
		highlight_row(board[selected_block]);

		update_debug();
        window.requestAnimationFrame(update);
    }
}
