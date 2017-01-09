"use strict";

var mouse_x = 0;
var mouse_y = 0;
var high_opacity = 0.95;
var debug_vm;
var tile_size;
var font_size;

String.prototype.replaceAll = function (find, replace) {
	var str = this;
	return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};

Array.prototype.remove = function (val) {
	var index = this.indexOf(val);
	if (index != -1) {
		this.splice(index, 1);
	}
};

function blend_colors(ratio, color1, color2) {
    if (color2 == undefined) {
		return color1;
	}

	var w1 = 1 - ratio;
	var w2 = ratio;

	var r = (color1[0] * w1) + (color2[0] * w2);
	var g = (color1[1] * w1) + (color2[1] * w2);
	var b = (color1[2] * w1) + (color2[2] * w2);

	return [r, g, b];
}

function color_to_hex(color) {
	var r = Math.round(255 * color[0]);
	var g = Math.round(255 * color[1]);
	var b = Math.round(255 * color[2]);

	return "#" + r.toString(16) + g.toString(16) + b.toString(16);
}

function oned_to_twod(idx, width) {
	return {
		x: idx % width,
		y: Math.floor(idx / width),
	};
}

function twod_to_oned(x, y, width) {
	return (y * width) + x;
}

function fmt_base(vm, val) {
	return (val).toString(vm.display_base).toUpperCase();
}

function set_buffer(vm, value) {
	if (vm.display_base == 16) {
		vm.entry_buffer = "0x" + fmt_base(vm, value);
	} else {
		vm.entry_buffer = fmt_base(vm, value);
	}
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
		var new_x = Math.floor(mouse_x / tile_size) - 1;
		var new_y = Math.floor(mouse_y / tile_size) - 1;
		vm.selected_tile = twod_to_oned(new_x, new_y, 16);
		set_buffer(vm, vm.board[vm.selected_tile]);
		vm.row_updated = true;
	}

	vm.board_updated = true;
}

function mouse_moved(canvas, event) {
	var rect = canvas.getBoundingClientRect();
	mouse_x = event.clientX - rect.left;
	mouse_y = event.clientY - rect.top;
}

function key_pressed(vm, event) {
	if (document.activeElement.tagName != "BODY") {
		return;
	}

	switch (event.keyCode) {
		case 32: case 37: case 38: case 39: case 40:
		case 13: {
			event.preventDefault();
		} break;
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
		set_buffer(vm, vm.board[vm.selected_tile]);
	}
	vm.row_updated = true;
}

function key_released(vm, event) {
	if (document.activeElement.tagName != "BODY") {
		return;
	}

	if (vm.running) {
		vm.reset();
	}

	switch (event.keyCode) {
		case 37: case 38: case 39: case 40: {
		} break;
		case 8: case 46: { // Backspace
			if (vm.entry_buffer.length == 3 && vm.display_base == 16) {
				vm.entry_buffer = "0x0";
			} else if (vm.entry_buffer.length > 1) {
				vm.entry_buffer = vm.entry_buffer.slice(0, vm.entry_buffer.length - 1);
			} else {
				vm.entry_buffer = "0";
			}
			vm.reset();
			vm.board[vm.selected_tile] = parseInt(vm.entry_buffer, vm.display_base);
			vm.save_board();
		} break;
		case 48: case 49: case 50: case 51: case 52:
		case 53: case 54: case 55: case 56: case 57:
		case 65: case 66: case 67: case 68: case 69:
		case 70: {
			var tmp_buffer = vm.entry_buffer + String.fromCharCode(event.keyCode);
			if (is_valid_digit_str(tmp_buffer)) {
				if (tmp_buffer[0] == "0" && tmp_buffer[1] != "x") {
					vm.entry_buffer = tmp_buffer.slice(1, tmp_buffer.length);
				} else {
					if (tmp_buffer != "0x0" && tmp_buffer[0] == "0" && tmp_buffer[1] == "x" && tmp_buffer[2] == "0") {
						vm.entry_buffer = tmp_buffer.slice(0, 2) + tmp_buffer.slice(3, tmp_buffer.length);
					} else {
						vm.entry_buffer = tmp_buffer;
					}
				}

				vm.reset();
				vm.board[vm.selected_tile] = parseInt(vm.entry_buffer, vm.display_base);
				vm.save_board();
			}
		} break;
		default: {}
	}

	vm.row_updated = true;
	vm.board_updated = true;
}

function hash_change(vm, evt) {
	vm.clear_state();
	vm.load_board(window.location.hash);
}

function render(gl, text_ctx, shader, a_pos, v_tile, u_color, u_persp, u_model, persp, vm) {
	if (vm.rendered_pc != vm.pc || vm.board_updated) {
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(shader);

		gl.enableVertexAttribArray(a_pos);
		gl.bindBuffer(gl.ARRAY_BUFFER, v_tile);
		gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

		var pos_scale = tile_size * 0.942;
		var sub_scale = tile_size * 0.906;
		var scale_off = (pos_scale - sub_scale) / 2;
		var model;

		gl.uniform3f(u_color, 1.0, 1.0, 1.0);
		for (var x = 0; x < 17; x++) {
			model = loadIdentity();
			model = modelTranslate(model, [x  * pos_scale, 0, 0]);
			model = modelScale(model, [pos_scale, pos_scale, 1]);

			gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
			gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}

		for (var y = 0; y < 17; y++) {
			model = loadIdentity();
			model = modelTranslate(model, [0, y * pos_scale, 0]);
			model = modelScale(model, [pos_scale, pos_scale, 1]);

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

				var r_highlight = undefined;
				var w_highlight = undefined;
				var r_decay = 0;
				var w_decay = 0;
				if (vm.io_filter) {
					if (vm.read_table[pos] != 0) {
						r_decay = vm.read_table[pos] / vm.effect_life;
						r_highlight = [0.93, 0.57, 0.13];
					} else if (vm.write_table[pos] != 0) {
						w_decay = vm.write_table[pos] / vm.effect_life;
						w_highlight = [0.0, 0.8, 0.0];
					}
				}

				if (vm.board[pos] != 0) {
					var color = [0.8, 0.8, 0.8];
					var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
					var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
					var res = blend_colors(0.5, tmp1, tmp2);
					gl.uniform3f(u_color, res[0], res[1], res[2]);
				} else {
					var color = [0.5, 0.5, 0.5];
					var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
					var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
					var res = blend_colors(0.5, tmp1, tmp2);
					gl.uniform3f(u_color, res[0], res[1], res[2]);
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

		var highlight = [0.745, 0.965, 0.918];
		if (vm.board[vm.pc] != 0) {
			var color = [0.8, 0.8, 0.8];
			var tmp = blend_colors(high_opacity, color, highlight);
			gl.uniform3f(u_color, tmp[0], tmp[1], tmp[2]);
		} else {
			var color = [0.5, 0.5, 0.5];
			var tmp = blend_colors(high_opacity, color, highlight);
			gl.uniform3f(u_color, tmp[0], tmp[1], tmp[2]);
		}

		gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
		gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		vm.rendered_pc = vm.pc;

		// Draw Edit Selector
		if (vm.selected_tile >= 0) {
			point = oned_to_twod(vm.selected_tile, 16);
			model = loadIdentity();
			model = modelTranslate(model, [((point.x + 1) * pos_scale) + scale_off, ((point.y + 1) * pos_scale) + scale_off, 0]);
			model = modelScale(model, [sub_scale, sub_scale, 1]);

			var highlight = [0.157, 0.733, 0.612];
			if (vm.board[vm.selected_tile] != 0) {
				var color = [0.8, 0.8, 0.8];
				var tmp = blend_colors(high_opacity, color, highlight);
				gl.uniform3f(u_color, tmp[0], tmp[1], tmp[2]);
			} else {
				var color = [0.5, 0.5, 0.5];
				var tmp = blend_colors(high_opacity, color, highlight);
				gl.uniform3f(u_color, tmp[0], tmp[1], tmp[2]);
			}

			gl.uniformMatrix4fv(u_persp, false, new Float32Array(persp.flatten()));
			gl.uniformMatrix4fv(u_model, false, new Float32Array(model.flatten()));
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}

	if (vm.board_updated) {
		text_ctx.clearRect(0, 0, text_ctx.canvas.width, text_ctx.canvas.height);
		var scale = text_ctx.canvas.width / 17;
		var tile_off = (tile_size / 2) + 1;
		for (var x = 0; x < 16; x++) {
			for (var y = 0; y < 16; y++) {
				var pos = twod_to_oned(x, y, 16);
				if (pos == vm.selected_tile) {
					var tmp_buffer = "";
					if (vm.entry_buffer[0] == "0" && vm.entry_buffer[1] == "x") {
						tmp_buffer = vm.entry_buffer.slice(2, vm.entry_buffer.length);
					} else {
						tmp_buffer = vm.entry_buffer;
					}
					text_ctx.fillText(tmp_buffer, ((x + 1) * scale) + tile_off - 1, ((y + 1) * scale) + tile_off + 1);
				} else {
					text_ctx.fillText(fmt_base(vm, vm.board[pos]), ((x + 1) * scale) + tile_off - 1, ((y + 1) * scale) + tile_off + 1);
				}
			}
		}

		// TOP TEXT
		for (var x = 0; x < 16; x++) {
			text_ctx.fillText(fmt_base(vm, x), ((x + 1) * scale) + tile_off - 1, tile_size * 0.625);
		}
		// SIDE TEXT
		for (var y = 0; y < 16; y++) {
			text_ctx.fillText(fmt_base(vm, y * 16), tile_size * 0.439, ((y + 1) * scale) + tile_off);
		}

		vm.board_updated = false;
	}

	if (vm.reg_updated) {
		{
			var r_highlight = undefined;
			var w_highlight = undefined;
			var r_decay = 0;
			var w_decay = 0;

			if (vm.io_filter) {
				if (vm.read_table[256] != 0) {
					r_decay = vm.read_table[256] / vm.effect_life;
					r_highlight = [0.93, 0.57, 0.13];
				} else if (vm.write_table[256] != 0) {
					w_decay = vm.write_table[256] / vm.effect_life;
					w_highlight = [0.0, 0.8, 0.0];
				}
			}

			if (vm.reg[0] != 0) {
				var color = [0.8, 0.8, 0.8];
				var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
				var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
				var res = blend_colors(0.5, tmp1, tmp2);
				document.getElementById("reg_a").style.backgroundColor = color_to_hex(res);
			} else {
				var color = [0.5, 0.5, 0.5];
				var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
				var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
				var res = blend_colors(0.5, tmp1, tmp2);
				document.getElementById("reg_a").style.backgroundColor = color_to_hex(res);
			}
		}
		{
			var r_highlight = undefined;
			var w_highlight = undefined;
			var r_decay = 0;
			var w_decay = 0;

            if (vm.io_filter) {
				if (vm.read_table[257] != 0) {
					r_decay = vm.read_table[257] / vm.effect_life;
					r_highlight = [0.93, 0.57, 0.13];
				} else if (vm.write_table[257] != 0) {
					w_decay = vm.write_table[257] / vm.effect_life;
					w_highlight = [0.0, 0.8, 0.0];
				}
			}

			if (vm.reg[1] != 0) {
				var color = [0.8, 0.8, 0.8];
				var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
				var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
				var res = blend_colors(0.5, tmp1, tmp2);
				document.getElementById("reg_b").style.backgroundColor = color_to_hex(res);
			} else {
				var color = [0.5, 0.5, 0.5];
				var tmp1 = blend_colors(high_opacity * r_decay, color, r_highlight);
				var tmp2 = blend_colors(high_opacity * w_decay, color, w_highlight);
				var res = blend_colors(0.5, tmp1, tmp2);
				document.getElementById("reg_b").style.backgroundColor = color_to_hex(res);
			}
		}

		document.getElementById("reg_a").innerHTML = fmt_base(vm, vm.reg[0]);
		document.getElementById("reg_b").innerHTML = fmt_base(vm, vm.reg[1]);
		document.getElementById("f_zero").innerHTML = vm.zero_flag;
		document.getElementById("f_eq").innerHTML = vm.equal_flag;
		document.getElementById("f_less").innerHTML = vm.less_flag;
		document.getElementById("f_great").innerHTML = vm.greater_flag;
		document.getElementById("f_err").innerHTML = vm.error_flag;
		document.getElementById("f_stack_enabled").innerHTML = vm.jsp_enabled;
		document.getElementById("f_jsp").innerHTML = fmt_base(vm, vm.jsp);
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
		document.getElementById('back').href = "basics.html";
		document.getElementById('next').href = "mult.html";
		vm.challenge_updated = false;
	}

	if (vm.row_updated) {
		if (vm.page_op_table != undefined) {
			var rows = vm.page_op_table.getElementsByTagName('tr');

			var id = vm.board[vm.selected_tile];
			for (var i = 0; i < rows.length; i++) {
				rows[i].classList.remove('selected');
			}

			if (id < rows.length - 1) {
				rows[id + 1].className += " selected";
			}
		}
		vm.row_updated = false;
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
			step_string += "Reading invalid instruction " + fmt_base(vm, vm.board[vm.pc]) + "<br>"
			document.getElementById("debug").innerHTML = step_string;
			vm.step_updated = false;
			return;
		}

		step_string += "Reading instruction " + fmt_base(vm, op_start) + "<br>"
		step_string += "<font color='90A0A0'>[" + op.name + " | " + op.long_desc + "]</font><br>";

		// Only triggers if the operand is available
		if (vm.cur_inst != null && op.length > 1) {
			step_string += "Reading operand " + fmt_base(vm, vm.board[vm.pc]) + "<br>";
		} else if (op.length == 1) {
			step_string += "No operand<br>";
		}

		// Triggers when the operand is finished
		if (op.length == 1 || vm.cur_inst != null) {
			var simple_desc = op.simple_desc;

			simple_desc = simple_desc.replaceAll("@A", fmt_base(vm, vm.reg[0]));
			simple_desc = simple_desc.replaceAll("@B", fmt_base(vm, vm.reg[1]));
			simple_desc = simple_desc.replaceAll("@IIV", fmt_base(vm, vm.board[vm.board[vm.board[vm.pc]]]));
			simple_desc = simple_desc.replaceAll("@IV", fmt_base(vm, vm.board[vm.board[vm.pc]]));
			simple_desc = simple_desc.replaceAll("@V", fmt_base(vm, vm.board[vm.pc]));
			step_string += simple_desc;
		}

		document.getElementById("debug").innerHTML = step_string;

		vm.step_updated = false;
	}
}

function vm_main() {
	var canvas = document.getElementById("gl_canvas");
	var text_canvas = document.getElementById("text_canvas");

	if (window.innerWidth < 544) {
		var new_size = 272;
		canvas.width = new_size;
		canvas.height = new_size;
		text_canvas.width = new_size;
		text_canvas.height = new_size;
	}

	var gl = init_webgl(canvas);
	var text_ctx = text_canvas.getContext('2d');

	if (gl && text_ctx) {
		tile_size = canvas.width / 17;
		console.log(canvas.width);
		if (canvas.width < 544) {
			font_size = "10px";
			document.getElementById("text_div").style.marginTop = "-51.3%";
		} else {
			font_size = "16px";
			document.getElementById("text_div").style.marginTop = "-101%";
		}

		text_ctx.font = font_size + " sans-serif";
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

		var persp = makeOrtho(0.0, canvas.width - tile_size, canvas.height - tile_size, 0.0, 0.0, 1.0);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);

		var vm = new VM();
		debug_vm = vm;

		vm.load_board(window.location.hash);

		set_buffer(vm, vm.board[vm.selected_tile]);

		canvas.addEventListener("mousemove", function(evt) { mouse_moved(canvas, evt); }, false);
		document.addEventListener("mousedown", function(evt) { mouse_pressed(vm, canvas, evt); }, false);
		document.addEventListener("keydown", function(evt) { key_pressed(vm, evt); }, false);
		document.addEventListener("keyup", function(evt) { key_released(vm, evt); }, false);
		window.addEventListener("hashchange", function(evt) { hash_change(vm, evt); }, false);

		document.getElementById("step").addEventListener("click", function(evt) { vm.running = true; vm.tick(); vm.running = false; vm.step_updated = true; }, false);
		document.getElementById("start").addEventListener("click", function(evt) { vm.running = !vm.running; if (vm.running == false) { vm.step_updated = true; } }, false);
		document.getElementById("reset").addEventListener("click", function(evt) { vm.reset(); }, false);
		document.getElementById("clear").addEventListener("click", function(evt) { vm.board = new Uint8Array(16 * 16); vm.clear_state(); vm.save_board(); }, false);
		document.getElementById("tps_slow").addEventListener("click", function(evt) { vm.tps = 3; }, false);
		document.getElementById("tps_norm").addEventListener("click", function(evt) { vm.tps = 21; }, false);
		document.getElementById("tps_full").addEventListener("click", function(evt) { vm.tps = 240; }, false);
		document.getElementById("switch_base").addEventListener("click", function(evt) { vm.switch_base(); }, false);
		document.getElementById("io_filter").addEventListener("click", function(evt) { vm.io_filter = !vm.io_filter; }, false);

		if (document.getElementById("asm_in") != null) {
			document.getElementById("asm_in").addEventListener("input", function(evt) { var asm = document.getElementById("asm_in").value; vm.load_asm(asm); }, false);
		}

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
