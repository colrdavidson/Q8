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

var board;
var pc = 0;
var reg_a = 0;
var reg_updated = true;
var board_updated = true;

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

function reset() {
    pc = 0;
    reg_a = 0;
	board = base64ToArray(window.location.hash);
    document.getElementById("reg-a").innerHTML = "Register A: " + reg_a;
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
}

function twod_to_oned(x, y, width) {
	return (y * width) + x;
}

var k_table = {};

function key_pressed(event) {
    k_table[event.keyCode] = true;
}

function key_released(event) {
    k_table[event.keyCode] = false;
}

function mouse_clicked(event) {
    mouse_pressed = true;

	if (!running) {
		if (k_table[18] == true) {
			board[twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16)] += 16;
		} else if (k_table[88] == true) {
			board[twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16)] = 0;
		} else {
			board[twod_to_oned(Math.floor(mouse_x / 32), Math.floor(mouse_y / 32), 16)] += 1;
		}

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
            case 2: { grab_func = function() { op_load(board); }; } break;
            case 3: { grab_func = function() { op_store(board); }; } break;
            case 4: { grab_func = function() { op_add(board); }; } break;
            case 5: { grab_func = function() { op_sub(board); }; } break;
            case 6: { grab_func = function() { op_jz(board); }; } break;
            case 7: { grab_func = function() { op_jg(board); }; } break;
            case 8: { grab_func = function() { op_jl(board); }; } break;
            case 9: { grab_func = function() { op_je(board); }; } break;
            case 10: { grab_func = function() { op_reljump(board); }; } break;
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

    for (var x = 0; x < 16; x++) {
    	for (var y = 0; y < 16; y++) {
			var model = loadIdentity();
			model = modelTranslate(model, [(x * 32) + 1.0, (y * 32) + 1.0, 0.0]);
            model = modelScale(model, [30.0, 30.0, 1.0]);

			var u_color = gl.getUniformLocation(shader, "color");
            var u_persp = gl.getUniformLocation(shader, "perspective");
            var u_model = gl.getUniformLocation(shader, "model");

            var i = board[twod_to_oned(x, y, 16)];

            if (i < 8) {
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
        document.getElementById("reg-a").innerHTML = "Register A: " + reg_a;
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
	console.log(binary_string);
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
