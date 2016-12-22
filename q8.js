"use strict";

var mouse_x = 0;
var mouse_y = 0;
var entry_buffer = "";
var debug_vm;

function oned_to_twod(idx, width) {
	return {
		x: idx % width,
		y: Math.floor(idx / width),
	};
}

function twod_to_oned(x, y, width) {
	return (y * width) + x;
}

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

function mouse_pressed(vm, canvas, event) {
	var rect = canvas.getBoundingClientRect();
	var tmp_x = event.clientX - rect.left;
	var tmp_y = event.clientY - rect.top;

	if (tmp_x > canvas.width || tmp_x < 0 || tmp_y > canvas.height || tmp_y < 0) {
		vm.selected_tile = -1;
	} else {
		var new_x = Math.floor(mouse_x / 32) - 1;
		var new_y = Math.floor(mouse_y / 32) - 1;
		vm.selected_tile = twod_to_oned(new_x, new_y, 16);
		entry_buffer = "" + vm.board[vm.selected_tile];
	}

	vm.board_updated = true;
}

function mouse_moved(canvas, event) {
	var rect = canvas.getBoundingClientRect();
	mouse_x = event.clientX - rect.left;
	mouse_y = event.clientY - rect.top;
}

function key_pressed(vm, event) {
	switch (event.keyCode) {
		case 37: case 38: case 39: case 40:
		case 32: event.preventDefault(); break;
		case 13: event.preventDefault(); break;
		default: break;
	}

	var hit_arrow = false;
	switch (event.keyCode) {
		case 37: {
			vm.selected_tile -= 1;
			hit_arrow = true;
		} break;
		case 38: {
			vm.selected_tile -= 16;
			hit_arrow = true;
		} break;
		case 39: {
			vm.selected_tile += 1;
			hit_arrow = true;
		} break;
		case 40: {
			vm.selected_tile += 16;
			hit_arrow = true;
		} break;
	}

	if (hit_arrow) {
		if (vm.selected_tile < 0) {
			vm.selected_tile = (vm.selected_tile + 256) % 256;
		} else if (vm.selected_tile > 255) {
			vm.selected_tile = vm.selected_tile % 256;
		}
		entry_buffer = "" + vm.board[vm.selected_tile];
	}
}

function key_released(vm, event) {
	if (vm.running) {
		vm.reset();
	}

	switch (event.keyCode) {
		case 37: case 38: case 39: case 40: {
		} break;
		case 8: { // Backspace
			if (entry_buffer.length > 1) {
				entry_buffer = entry_buffer.slice(0, entry_buffer.length - 1);
			} else {
				entry_buffer = "0";
			}
			vm.clear_state();
			vm.board[vm.selected_tile] = parseInt(entry_buffer);
			vm.save_board();
		} break;
		default: {
			var tmp_buffer = entry_buffer + String.fromCharCode(event.keyCode);
			if (is_valid_digit_str(tmp_buffer)) {
				entry_buffer = tmp_buffer;
				vm.clear_state();
				vm.board[vm.selected_tile] = parseInt(entry_buffer);
				vm.save_board();
			}
		}
	}

	vm.board_updated = true;
}

function hash_change(vm, evt) {
	vm.clear_state();
	vm.load_board(window.location.hash);
}

function render(gl, text_ctx, shader, a_pos, v_tile, u_color, u_persp, u_model, persp, vm) {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.useProgram(shader);

	gl.enableVertexAttribArray(a_pos);
	gl.bindBuffer(gl.ARRAY_BUFFER, v_tile);
	gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

	var pos_scale = 30.118;
	var sub_scale = 29;
	var scale_off = (pos_scale - sub_scale) / 2;
	var model;

	for (var x = 0; x < 17; x++) {
		model = loadIdentity();
		model = modelTranslate(model, [x  * pos_scale, 0, 0]);
		model = modelScale(model, [pos_scale, pos_scale, 1]);

		gl.uniform3f(u_color, 1.0, 1.0, 1.0);
		gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
		gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	for (var y = 0; y < 17; y++) {
		model = loadIdentity();
		model = modelTranslate(model, [0, y * pos_scale, 0]);
		model = modelScale(model, [pos_scale, pos_scale, 1]);

		gl.uniform3f(u_color, 1.0, 1.0, 1.0);
		gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
		gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	for (var x = 0; x < 16; x++) {
		for (var y = 0; y < 16; y++) {
			model = loadIdentity();
			model = modelTranslate(model, [((x + 1) * pos_scale) + scale_off, ((y + 1) * pos_scale) + scale_off, 0]);
			model = modelScale(model, [sub_scale, sub_scale, 1]);

			var pos = twod_to_oned(x, y, 16);

			if (vm.selected_tile == pos) {
				gl.uniform3f(u_color, 0.157, 0.733, 0.612);
			} else if (vm.board[pos] != 0) {
				gl.uniform3f(u_color, 0.8, 0.8, 0.8);
			} else {
				gl.uniform3f(u_color, 0.5, 0.5, 0.5);
			}

			gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
			gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}

	// Draw Program Counter
	var point = oned_to_twod(vm.pc, 16);
	point.x += 1;
	point.y += 1;
	model = loadIdentity();
	model = modelTranslate(model, [(point.x * pos_scale) + scale_off, (point.y * pos_scale) + scale_off, 0]);
	model = modelScale(model, [sub_scale, sub_scale, 1]);

	gl.uniform3f(u_color, 0.745, 0.965, 0.918);
	gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
	gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw Edit Selector
	if (vm.selected_tile != -1) {
		point = oned_to_twod(vm.selected_tile, 16);
		point.x += 1;
		point.y += 1;
		model = loadIdentity();
		model = modelTranslate(model, [(point.x * pos_scale) + scale_off, (point.y * pos_scale) + scale_off, 0]);
		model = modelScale(model, [sub_scale, sub_scale, 1]);

		gl.uniform3f(u_color, 0.157, 0.733, 0.612);
		gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
		gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	if (vm.board_updated) {
		text_ctx.clearRect(0, 0, text_ctx.canvas.width, text_ctx.canvas.height);
		var scale = text_ctx.canvas.width / 17;
		for (var x = 0; x < 16; x++) {
			for (var y = 0; y < 16; y++) {
				var pos = twod_to_oned(x, y, 16);
				text_ctx.fillText((vm.board[pos]).toString(vm.display_base).toUpperCase(), ((x + 1) * scale) + 17, ((y + 1) * scale) + 17);
			}
		}

		// TOP TEXT
		for (var x = 0; x < 16; x++) {
			text_ctx.fillText((x).toString(vm.display_base).toUpperCase(), ((x + 1) * scale) + 16, 20);
		}
		// SIDE TEXT
		for (var y = 0; y < 16; y++) {
			text_ctx.fillText((y * 16).toString(vm.display_base).toUpperCase(), 14, ((y + 1) * scale) + 17);
		}

		vm.board_updated = false;
	}

	if (vm.reg_updated) {
		document.getElementById("reg_a").innerHTML = vm.reg[0];
		document.getElementById("reg_b").innerHTML = vm.reg[1];
		document.getElementById("f_zero").innerHTML = vm.zero_flag;
		document.getElementById("f_eq").innerHTML = vm.equal_flag;
		document.getElementById("f_less").innerHTML = vm.less_flag;
		document.getElementById("f_great").innerHTML = vm.greater_flag;
		document.getElementById("f_err").innerHTML = vm.error_flag;
		document.getElementById("f_stack_enabled").innerHTML = vm.jsp_enabled;
		document.getElementById("f_jsp").innerHTML = vm.jsp;
		if (vm.jsp_enabled == true) {
			document.getElementById("f_stack_enabled").className = "selected";
		} else {
			document.getElementById("f_stack_enabled").classList.remove('selected');
		}
		if (vm.error_flag == true) {
			document.getElementById("f_err").className = "selected";
		} else {
			document.getElementById("f_err").classList.remove('selected');
		}

		vm.reg_updated = false;
	}

	if (vm.challenge_updated) {
		document.getElementById('challenge_box').removeAttribute("hidden");
		vm.challenge_updated = false;
	}

	if (vm.step_updated) {
		var step_string = "";

		var op_start;
		var op;

		// Grabs the current instruction
		if (vm.cur_inst == null) {
			op_start = vm.board[vm.pc];
			op = vm.op_table[op_start];
		} else {
			op = vm.cur_inst;
			op_start = vm.rev_lookup[op.name];
		}

		if (op == null) {
			step_string += "Reading invalid instruction " + vm.board[vm.pc] + "<br>"
			document.getElementById("debug").innerHTML = step_string;
			vm.step_updated = false;
			return;
		}

		step_string += "Reading instruction " + op_start + "<br>"
		step_string += "<font color='90A0A0'>[" + op.name + " | " + op.long_desc + "]</font><br>";

		// Only triggers if the operand is available
		if (vm.cur_inst != null && op.length > 1) {
			step_string += "Reading operand " + vm.board[vm.pc] + "<br>";
		} else if (op.length == 1) {
			step_string += "No operand<br>";
		}

		// Triggers when the operand is finished
		if (op.length == 1 || vm.cur_inst != null) {
			var simple_desc = op.simple_desc;

			simple_desc = simple_desc.replace("@A", vm.reg[0]);
			simple_desc = simple_desc.replace("@B", vm.reg[1]);
			simple_desc = simple_desc.replace("@IIV", vm.board[vm.board[vm.board[vm.pc]]]);
			simple_desc = simple_desc.replace("@IV", vm.board[vm.board[vm.pc]]);
			simple_desc = simple_desc.replace("@V", vm.board[vm.pc]);
			step_string += simple_desc;
		}

		document.getElementById("debug").innerHTML = step_string;

		vm.step_updated = false;
	}
}

function vm_main() {
	var canvas = document.getElementById("gl_canvas");
	var text_canvas = document.getElementById("text_canvas");
	var gl = init_webgl(canvas);
	var text_ctx = text_canvas.getContext('2d');

	if (gl && text_ctx) {

		text_ctx.font = "16px sans-serif";
		text_ctx.textBaseline = "middle";
		text_ctx.textAlign = "center";

		var verts = [
			0.0, 0.0,
			1.0, 0.0,
			0.0, 1.0,
			1.0, 1.0,
		];

		var shader = init_shader(gl, q8_vert, q8_frag);

		var a_pos = gl.getAttribLocation(shader, "my_pos");

		var v_tile = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, v_tile);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

		var u_color = gl.getUniformLocation(shader, "color");
		var u_persp = gl.getUniformLocation(shader, "persp");
		var u_model = gl.getUniformLocation(shader, "model");

		var persp = makeOrtho(0.0, 512.0, 512.0, 0.0, 0.0, 1.0);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);

		var vm = new VM();
		debug_vm = vm;
		vm.load_board(window.location.hash);

		canvas.addEventListener("mousemove", function(evt) { mouse_moved(canvas, evt); }, false);
		document.addEventListener("mousedown", function(evt) { mouse_pressed(vm, canvas, evt); }, false);
		document.addEventListener("keydown", function(evt) { key_pressed(vm, evt); }, false);
		document.addEventListener("keyup", function(evt) { key_released(vm, evt); }, false);
		window.addEventListener("hashchange", function(evt) { hash_change(vm, evt); }, false);

		document.getElementById("step").addEventListener("click", function(evt) { vm.running = true; vm.tick(); vm.running = false; vm.step_updated = true; }, false);
		document.getElementById("start").addEventListener("click", function(evt) { vm.running = !vm.running; }, false);
		document.getElementById("reset").addEventListener("click", function(evt) { vm.reset(); }, false);
		document.getElementById("clear").addEventListener("click", function(evt) { vm.load_board(""); vm.clear_state(); }, false);
		document.getElementById("tps_1").addEventListener("click", function(evt) { vm.tps = 3; }, false);
		document.getElementById("tps_10").addEventListener("click", function(evt) { vm.tps = 30; }, false);
		document.getElementById("tps_norm").addEventListener("click", function(evt) { vm.tps = 60; }, false);
		document.getElementById("tps_100").addEventListener("click", function(evt) { vm.tps = 240; }, false);

		document.getElementById("prev_challenge").addEventListener("click", function(evt) { vm.prev_challenge(); }, false);
		document.getElementById("reset_challenge").addEventListener("click", function(evt) { vm.reset_challenge(); }, false);
		document.getElementById("next_challenge").addEventListener("click", function(evt) { vm.next_challenge(); }, false);

		var ticks = 0;
		var last_time = Date.now();
		function update(step) {
			var time_now = Date.now();
			var dt = time_now - last_time;
			last_time = time_now;

			ticks += dt;
			while (ticks > (1000 / vm.tps)) {
				vm.tick();
				ticks -= (1000 / vm.tps);
			}

			render(gl, text_ctx, shader, a_pos, v_tile, u_color, u_persp, u_model, persp, vm);
			window.requestAnimationFrame(update);
		}

		window.requestAnimationFrame(update);
	}
}
