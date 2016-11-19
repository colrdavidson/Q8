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
var input_mode = false;

var board;
var pc = 0;
var reg = new Uint8Array(2);
var reg_updated = true;
var board_updated = true;
var entry_buffer = "";
var packed = "";

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
}

function pause() {
    running = !running;
	board_updated = true;
}

function clear_reg() {
	for (var i = 0; i < reg.length; i++) {
		reg[i] = 0;
	}
}

function clear_flags() {
	clear_reg();
	grab_func = null;
	grab_var = false;
	pc = 0;
	reg_updated = true;
	board_updated = true;
	input_mode = false;
	entry_buffer = "";
}

function reset() {
	board = b64_to_array(window.location.hash);
	running = false;
	clear_flags();
}

function clear_board() {
    for (var i = 0; i < 16 * 16; i++) {
        board[i] = 0;
    }
	window.location.hash = array_to_b64(board);
	clear_flags();
	highlight_row(board[selected_block]);
}

function twod_to_oned(x, y, width) {
	return (y * width) + x;
}

var k_table = {};

function valid_entry_buffer() {
	var entry = parseInt(entry_buffer);
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
		default: break;
	}

	var hit_arrow = false;
	if (event.keyCode == 37) {
		selected_block -= 1;
		hit_arrow = true;
	} else if (event.keyCode == 38) {
		selected_block -= 16;
		hit_arrow = true;
	} else if (event.keyCode == 40) {
		selected_block += 16;
		hit_arrow = true;
	} else if (event.keyCode == 39) {
		selected_block += 1;
		hit_arrow = true;
	}

	if (hit_arrow) {
		if (selected_block < 0) {
			selected_block = 0;
		} else if (selected_block > 255) {
			selected_block = 255;
		}
		entry_buffer = "";
		highlight_row(board[selected_block]);
	}

	board_updated = true;
}

function key_released(event) {
    k_table[event.keyCode] = false;

	if (input_mode == true) {
		if (event.keyCode == 13) { // Enter
			entry_buffer = "";
			input_mode = false;
		} if (event.keyCode == 8) { // Backspace
			if (entry_buffer.length > 1) {
				entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
			} else {
				entry_buffer = "";
			}
			board[selected_block] = parseInt(entry_buffer);
			window.location.hash = array_to_b64(board);
			board_updated = true;
		} else {
			entry_buffer += String.fromCharCode(event.keyCode);
			if (valid_entry_buffer()) {
				board[selected_block] = parseInt(entry_buffer);
				window.location.hash = array_to_b64(board);
				board_updated = true;
			} else {
				if (entry_buffer.length > 1) {
					entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
				} else {
					entry_buffer = "";
				}
				board_updated = true;
			}
		}
		highlight_row(board[selected_block]);
	} else {
		if (event.keyCode == 13) {
			input_mode = true;
			entry_buffer = "";
			board_updated = true;
		}
	}
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

function mouse_clicked(event) {
    mouse_pressed = true;

	if (!running) {
        var board_pos = twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16);
		entry_buffer = "";
		if (selected_block == board_pos) {
			input_mode = true;
		} else {
			selected_block = board_pos;
			highlight_row(board[selected_block]);
		}

		board_updated = true;
	}
}

function mouse_released(event) {
    mouse_pressed = false;
}

function mouse_moved(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    mouse_x = evt.clientX - rect.left;
    mouse_y = evt.clientY - rect.top;
}

function tick() {
    if (grab_var) {
        grab_var = false;
        grab_func(board);
    } else {
        grab_var = true;
        switch (board[pc]) {
            case 1: { grab_func = function() { op_jmp(board); }; } break;
            case 2: { grab_func = function() { op_load(board, 0); }; } break;
            case 3: { grab_func = function() { op_load(board, 1); }; } break;
            case 4: { grab_func = function() { op_store(board, 0); }; } break;
            case 5: { grab_func = function() { op_store(board, 1); }; } break;
            case 6: { grab_func = function() { op_addi(board, 0); }; } break;
            case 7: { grab_func = function() { op_addi(board, 1); }; } break;
            case 8: { grab_func = function() { op_subi(board, 0); }; } break;
            case 9: { grab_func = function() { op_subi(board, 1); }; } break;
            case 10: { grab_func = function() { op_jz(board, 0); }; } break;
            case 11: { grab_func = function() { op_jz(board, 1); }; } break;
            case 12: { grab_func = function() { op_jg(board, 0, 1); }; } break;
            case 13: { grab_func = function() { op_jg(board, 1, 0); }; } break;
            case 14: { grab_func = function() { op_jl(board, 0, 1); }; } break;
            case 15: { grab_func = function() { op_jl(board, 1, 0); }; } break;
            case 16: { grab_func = function() { op_je(board, 0, 1); }; } break;
            case 17: { grab_func = function() { op_reljump(board); }; } break;
            case 18: { op_not(0); grab_var = false; } break;
            case 19: { op_not(1); grab_var = false; } break;
            case 20: { grab_func = function() { op_and(board, 0); }; } break;
            case 21: { grab_func = function() { op_and(board, 1); }; } break;
            case 22: { grab_func = function() { op_or(board, 0); }; } break;
            case 23: { grab_func = function() { op_or(board, 1); }; } break;
            case 24: { grab_func = function() { op_xor(board, 0); }; } break;
            case 25: { grab_func = function() { op_xor(board, 1); }; } break;
            case 26: { grab_func = function() { op_shl(board, 0); }; } break;
            case 27: { grab_func = function() { op_shl(board, 1); }; } break;
            case 28: { grab_func = function() { op_shr(board, 0); }; } break;
            case 29: { grab_func = function() { op_shr(board, 1); }; } break;
            case 30: { op_swap(0, 1); grab_var = false; } break;
            case 31: { grab_func = function() { op_load_ind(board, 0); }; } break;
            case 32: { grab_func = function() { op_load_ind(board, 1); }; } break;
            case 33: { grab_func = function() { op_add(board, 0, 1); }; } break;
            case 34: { grab_func = function() { op_sub(board, 0, 1); }; } break;
            case 35: { grab_func = function() { op_sub(board, 1, 0); }; } break;
            case 36: { op_inc(0); grab_var = false; } break;
            case 37: { op_inc(1); grab_var = false; } break;
            case 38: { op_dec(0); grab_var = false; } break;
            case 39: { op_dec(1); grab_var = false; } break;
			case 40: { running = false; grab_var = false; } break; //Halt op
            default: { grab_var = false; }
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
    model = modelScale(model, [32.0, 32.0, 1.0]);

    var u_color = gl.getUniformLocation(shader, "color");
    var u_persp = gl.getUniformLocation(shader, "perspective");
    var u_model = gl.getUniformLocation(shader, "model");

    gl.uniform3f(u_color, 1.0, 1.0, 1.0);
    gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
    gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw edit selector
	model = loadIdentity();
	model = modelTranslate(model, [(selected_block % 16) * 32, (Math.floor(selected_block / 16)) * 32, 0.0]);
	model = modelScale(model, [32.0, 32.0, 1.0]);

	gl.uniform3f(u_color, 1.0, 0.0, 0.0);
	gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
	gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw grid
    for (var x = 0; x < 16; x++) {
    	for (var y = 0; y < 16; y++) {
			model = loadIdentity();
			model = modelTranslate(model, [(x * 32) + 1.0, (y * 32) + 1.0, 0.0]);
            model = modelScale(model, [30.0, 30.0, 1.0]);

			var u_color = gl.getUniformLocation(shader, "color");
            var u_persp = gl.getUniformLocation(shader, "perspective");
            var u_model = gl.getUniformLocation(shader, "model");

			var pos = twod_to_oned(x, y, 16);
            var i = board[pos];

			if (selected_block == pos && input_mode == true) {
                gl.uniform3f(u_color, 1.0, 1.0, 1.0);
			} else if (i < 7) {
                var color = color_table[i];
                var r = (color >> 16) & 255;
                var g = (color >> 8) & 255;
                var b = color & 255;

    			gl.uniform3f(u_color, r / 256.0, g / 256.0, b / 256.0);
            } else {
                gl.uniform3f(u_color, 0.3, 0.3, 0.3);
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
		for (var x = 0; x < 16; x++) {
			for (var y = 0; y < 16; y++) {
				text_ctx.fillText(board[twod_to_oned(x, y, 16)], (x * 32) + 18.0, (y * 32) + 14.0);
			}
		}

		if (!running) {
			render();
		}
		board_updated = false;
	}
    if (reg_updated) {
        document.getElementById("reg").innerHTML = "Register A: " + reg[0] + " Register B: " + reg[1];
        reg_updated = false;
    }
}

function update(step) {
    update_board();
    window.requestAnimationFrame(update);
}

function pack_string(str) {
	var rle_str = '';
	var occurance_counter = 0;
	for (var i = 0; i < str.length; i++) {
		if (i > 0) {
			if ((str.charAt(i) == str.charAt(i - 1))) {
				occurance_counter++;
			} else {
				occurance_counter++;
				rle_str += occurance_counter + "" + str.charAt(i - 1);
				occurance_counter = 0;
			}
		}
	}

	return rle_str;
}

function is_alpha(c) {
	return c.toLowerCase() != c.toUpperCase();
}

function unpack_string(rle_str) {
	rle_str = rle_str.slice(1);
	var real_str = "";
	for (var i = 0; i < rle_str.length; i++) {
		var occurance_str = "";
		var j = i;
		for (; is_alpha(rle_str.charAt(j)) == false; j++) {
			occurance_str += rle_str.charAt(j);
		}
		i = j;
		var repeat_len = parseInt(occurance_str);
		for (j = 0; j < repeat_len; j++) {
			real_str += rle_str.charAt(i);
		}
	}

	real_str += "==";
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

function b64_to_array(b64_str) {
	var unpacked = unpack_string(b64_str);

	var binary_string = window.atob(unpacked);
	var len = binary_string.length;
	var bytes = new Uint8Array(16 * 16);

	for (var i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes;
}

function start_memvm() {
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

        board = new Uint8Array(16 * 16);
		if (window.location.hash.includes("#")) {
			board = b64_to_array(window.location.hash);
		}

        canvas.onmousedown = mouse_clicked;
        document.onmouseup = mouse_released;
        document.onkeyup = key_released;
        document.onkeydown = key_pressed;
        canvas.addEventListener('mousemove', function(evt) { mouse_moved(canvas, evt); }, false);
		highlight_row(board[selected_block]);

        window.requestAnimationFrame(update);
    }
}
