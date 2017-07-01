"use strict";

let num_x_tiles = 16;
let num_y_tiles = 16;

let grid_width;
let grid_height;

let tile_width;
let tile_height;

let mouse_x = 0;
let mouse_y = 0;
let opacity = 0.95;

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

function is_valid_digit_str(str) {
    let entry = parseInt(str);
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

function mouse_moved(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    mouse_x = event.clientX - rect.left;
    mouse_y = event.clientY - rect.top;
}

function mouse_pressed(vm, canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let tmp_x = event.clientX - rect.left;
    let tmp_y = event.clientY - rect.top;

    if (tmp_x > canvas.width || tmp_x < 0 || tmp_y > canvas.height || tmp_y < 0) {
		vm.selected_tile = -1;
    } else {
		let new_x = Math.floor(mouse_x / tile_width) - 1;
		let new_y = Math.floor(mouse_y / tile_height) - 1;
		vm.selected_tile = twod_to_oned(new_x, new_y, num_x_tiles);
		set_buffer(vm, vm.board[vm.selected_tile]);
		vm.row_updated = true;
    }

    vm.redraw = true;
}

function key_pressed(vm, event) {
    if (document.activeElement.tagName != "BODY" || vm.selected_tile == -1 || event.defaultPrevented) {
		return;
    }


    switch (event.key) {
		case "ArrowUp":
		case "ArrowDown":
		case "ArrowLeft":
		case "ArrowRight":
		case "Enter": {
			event.preventDefault();
		} break;
		default: {}
    }

    var hit_arrow = false;
    switch (event.key) {
		case "ArrowLeft": {
			vm.selected_tile -= 1;
			hit_arrow = true;
		} break;
		case "ArrowUp": {
			vm.selected_tile -= 16;
			hit_arrow = true;
		} break;
		case "ArrowRight": {
			vm.selected_tile += 1;
			hit_arrow = true;
		} break;
		case "ArrowDown": {
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
		vm.row_updated = true;
		vm.redraw = true;
    } else if (vm.running) {
		vm.reset();
    }
}

function key_released(vm, event) {
    if (document.activeElement.tagName != "BODY" || vm.selected_tile == -1 || event.defaultPrevented) {
		return;
    }

    switch (event.key) {
		case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight": {
		} break;
		case "Backspace": case "Delete": {
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
		case "0": case "1": case "2": case "3": case "4":
		case "5": case "6": case "7": case "8": case "9":
		case "a": case "b": case "c": case "d": case "e": case "f":
		case "A": case "B": case "C": case "D": case "E": case "F": {
			let tmp_buffer = vm.entry_buffer + event.key;
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
		default: { console.log(event.key); }
    }

    vm.row_updated = true;
	vm.redraw = true;

	event.preventDefault();
}

function hash_change(vm, evt) {
    vm.clear_state();
    vm.load_board(window.location.hash);
}

function compute_blend_color(vm, idx, base_color) {
	let r_highlight;
	let w_highlight;
	let r_decay;
	let w_decay;
	if (vm.io_filter) {
		if (vm.read_table[idx] != 0) {
			r_decay = vm.read_table[idx] / vm.effect_life;
			r_highlight = [0.93, 0.57, 0.13];
		}

		if (vm.write_table[idx] != 0) {
			w_decay = vm.write_table[idx] / vm.effect_life;
			w_highlight = [0.0, 0.8, 0.0];
		}
	}

	let r_tmp = blend_colors(opacity * r_decay, hex_to_color(base_color), r_highlight);
	let w_tmp = blend_colors(opacity * w_decay, hex_to_color(base_color), w_highlight);
	return color_to_hex(blend_colors(0.5, r_tmp, w_tmp));
}

function render_grid(dt, ctx, vm) {
    if (!vm.redraw) {
		return;
	}

	if (vm.base_updated) {
        update_guide_text(ctx, vm);
		vm.base_updated = false;
	}

	for (let x = 0; x < num_x_tiles; x++) {
		for (let y = 0; y < num_y_tiles; y++) {
			let real_x = tile_width * (x + 1);
			let real_y = tile_height * (y + 1);

			let idx = twod_to_oned(x, y, num_x_tiles);

			let base_color;
			if (vm.board[idx] != 0) {
				base_color = "#d3d3d3";
			} else {
				base_color = "#888888";
			}

			let draw_color;
			if (vm.selected_tile == idx) {
				let mix_color = "#28bb9c";
				draw_color = color_to_hex(blend_colors(opacity, hex_to_color(base_color), hex_to_color(mix_color)));
			} else if (idx == vm.pc) {
				let mix_color = "#bef6ea";
				draw_color = color_to_hex(blend_colors(opacity, hex_to_color(base_color), hex_to_color(mix_color)));
			} else {
				draw_color = compute_blend_color(vm, idx, base_color);
			}

			ctx.fillStyle = draw_color;
			ctx.fillRect(real_x, real_y, tile_width, tile_height);
		}
	}

	// Draw outlines and numbers (split into its own block to reduce state changes on the expensive text render)
	ctx.fillStyle = "black";
	for (let x = 0; x < num_x_tiles; x++) {
		for (let y = 0; y < num_y_tiles; y++) {
			let real_x = tile_width * (x + 1);
			let real_y = tile_height * (y + 1);
			let idx = twod_to_oned(x, y, num_x_tiles);

			if (vm.selected_tile == idx) {
				let text_buffer;
				if (vm.entry_buffer[0] == "0" && vm.entry_buffer[1] == "x") {
					text_buffer = vm.entry_buffer.slice(2, vm.entry_buffer.length);
				} else {
					text_buffer = vm.entry_buffer;
				}
				ctx.fillText(text_buffer, real_x + (tile_width / 2), real_y + (tile_height / 2));
			} else {
				ctx.fillText(fmt_base(vm, vm.board[idx]), real_x + (tile_width / 2), real_y + (tile_height / 2));
			}

			ctx.strokeRect(real_x, real_y, tile_width, tile_height);
		}
	}

	if (vm.reg_updated) {
		let base_color_a;
		if (vm.reg[0] != 0) {
			base_color_a = "#d3d3d3";
		} else {
			base_color_a = "#888888";
		}
		document.getElementById("reg_a").style.backgroundColor = compute_blend_color(vm, 256, base_color_a);
		document.getElementById("reg_a").innerHTML = fmt_base(vm, vm.reg[0]);

		let base_color_b;
		if (vm.reg[1] != 0) {
			base_color_b = "#d3d3d3";
		} else {
			base_color_b = "#888888";
		}
		document.getElementById("reg_b").style.backgroundColor = compute_blend_color(vm, 257, base_color_b);
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
			var id = vm.board[vm.selected_tile];
			for (var i = 0; i < vm.page_op_table.length; i++) {
				vm.page_op_table[i].classList.remove('selected');
			}

			if (id < vm.page_op_table.length - 1) {
				vm.page_op_table[id + 1].className += " selected";
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

	vm.redraw = false;
}

function update_guide_text(ctx, vm) {
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, grid_width, grid_height);

	ctx.fillStyle = "black";
	ctx.textBaseline = 'middle';
	for (let y = 0; y < num_y_tiles; y++) {
		let real_y = tile_height * (y + 1);
		ctx.fillText(fmt_base(vm, y * num_x_tiles), (tile_width / 2), real_y + (tile_height / 2));
	}

	ctx.textBaseline = 'hanging';
	for (let x = 0; x < num_x_tiles; x++) {
		let real_x = tile_width * (x + 1);
		ctx.fillText(fmt_base(vm, x), real_x + (tile_width / 2), (tile_height / 3));
	}
	ctx.textBaseline = 'middle';
}

function prepare_canvas(canvas_id, vm) {
	let canvas = document.getElementById(canvas_id);
	let ctx = canvas.getContext("2d");

	ctx.font = '14px sans-serif';
	ctx.textAlign = 'center';
	ctx.lineWidth = 0.25;

	grid_width = canvas.width;
	grid_height = canvas.height;

	tile_width = grid_width / (num_x_tiles + 2);
	tile_height = grid_height / (num_y_tiles + 2);

	update_guide_text(ctx, vm);
	return ctx;
}

function start_q8() {
	let vm = new VM();
	let ctx = prepare_canvas("canvas", vm);

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

	let ticks = 0;
	let last_time = Date.now();
	function update(step) {
	    let time_now = Date.now();
	    let dt = time_now - last_time;
	    last_time = time_now;

	    ticks += dt;
	    while (ticks > (1000 / vm.tps)) {
			vm.tick();
			ticks -= (1000 / vm.tps);
	    }

		render_grid(dt, ctx, vm);
	    window.requestAnimationFrame(update);
	}

	window.requestAnimationFrame(update);
}
