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

function reset() {
    pc = 0;
	clear_reg();
	board = base64ToArray(window.location.hash);
    document.getElementById("reg").innerHTML = "Register A: " + reg[0] + " Register B: " + reg[1];
	reg_updated = true;
	board_updated = true;
	running = false;
	grab_var = false;
	grab_func = null;
}

function clear_board() {
    for (var i = 0; i < 16 * 16; i++) {
        board[i] = 0;
    }
	window.location.hash = arrayToBase64(board);
	board_updated = true;
	grab_var = false;
	grab_func = null;
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
}

function key_released(event) {
    k_table[event.keyCode] = false;

	if (input_mode == true) {
		if (event.keyCode == 13) { // Enter
			entry_buffer = "";
			input_mode = false;
		} if (event.keyCode == 8) { // Backspace
			entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
			board[selected_block] = parseInt(entry_buffer);
			board_updated = true;
		} else {
			entry_buffer += String.fromCharCode(event.keyCode);
			if (valid_entry_buffer()) {
				board[selected_block] = parseInt(entry_buffer);
				board_updated = true;
			} else {
				entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
				board_updated = true;
			}
		}
		highlight_row(board[selected_block]);
	}
}

function highlight_row(id) {
    var table = document.getElementById('op_table');
	var rows = table.getElementsByTagName('tr');

    for (var i = 0; i < rows.length; i++) {
		rows[i].classList.remove('selected');
	}

	if (id < rows.length - 1) {
		rows[id + 1].className += " selected";
	}
}

function mouse_clicked(event) {
    mouse_pressed = true;

	if (!running) {
        var board_pos = twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16);
		if (selected_block == board_pos) {
			input_mode = true;
		} else {
			selected_block = board_pos;
			highlight_row(board[selected_block]);
		}
		entry_buffer = "";

		window.location.hash = arrayToBase64(board);
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
            case 6: { grab_func = function() { op_add(board, 0); }; } break;
            case 7: { grab_func = function() { op_add(board, 1); }; } break;
            case 8: { grab_func = function() { op_sub(board, 0); }; } break;
            case 9: { grab_func = function() { op_sub(board, 1); }; } break;
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
			} else if (i < 8) {
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

function arrayToBase64(array) {
	var binary = '';
	for (var i = 0; i < array.byteLength; i++) {
		binary += String.fromCharCode(array[i]);
	}
	return window.btoa(binary);
}

function base64ToArray(b64_str) {
	var binary_string = window.atob(b64_str.substring(1, b64_str.length));
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
		text_ctx.font = "16px serif";
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
			board = base64ToArray(window.location.hash);
		}

        canvas.onmousedown = mouse_clicked;
        document.onmouseup = mouse_released;
        document.onkeyup = key_released;
        document.onkeydown = key_pressed;
        canvas.addEventListener('mousemove', function(evt) { mouse_moved(canvas, evt); }, false);

        window.requestAnimationFrame(update);
    }
}
