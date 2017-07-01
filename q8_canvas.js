"use strict";

let num_x_tiles = 16;
let num_y_tiles = 16;

let grid_width;
let grid_height;

let tile_width;
let tile_height;

let opacity = 0.95;

function render_grid(dt, ctx, vm) {
	// Skip frame if PC hasn't changed and it's not in post-run decay phase
    if (vm.rendered_pc == vm.pc && !(vm.has_decay && !vm.running)) {
		return;
	}

	for (let x = 0; x < num_x_tiles; x++) {
		for (let y = 0; y < num_y_tiles; y++) {
			let real_x = tile_width * (x + 1);
			let real_y = tile_height * (y + 1);

			let idx = twod_to_oned(x, y, num_x_tiles);

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

			let base_color;
			if (vm.board[idx] != 0) {
				base_color = "#d3d3d3";
			} else {
				base_color = "#888888";
			}

			let draw_color;
			if (idx == vm.pc) {
				let mix_color = "#bef6ea";
				draw_color = color_to_hex(blend_colors(opacity, hex_to_color(base_color), hex_to_color(mix_color)));
			} else {
				let r_tmp = blend_colors(opacity * r_decay, hex_to_color(base_color), r_highlight);
				let w_tmp = blend_colors(opacity * w_decay, hex_to_color(base_color), w_highlight);
				draw_color = color_to_hex(blend_colors(0.5, r_tmp, w_tmp));
			}

			ctx.fillStyle = draw_color;
			ctx.fillRect(real_x, real_y, tile_width, tile_height);

			ctx.fillStyle = "black";
			ctx.strokeRect(real_x, real_y, tile_width, tile_height);

			if (vm.board[idx] != undefined) {
				ctx.fillText(vm.board[idx], real_x + (tile_width / 2), real_y + (tile_height / 2));
			}
		}
	}

	vm.rendered_pc = vm.pc;
}

function update_text(ctx) {
	ctx.textBaseline = 'middle';
	for (let y = 0; y < num_y_tiles; y++) {
		let real_y = tile_height * (y + 1);
		ctx.fillText(y * num_x_tiles, (tile_width / 2), real_y + (tile_height / 2));
	}

	ctx.textBaseline = 'hanging';
	for (let x = 0; x < num_x_tiles; x++) {
		let real_x = tile_width * (x + 1);
		ctx.fillText(x, real_x + (tile_width / 2), (tile_height / 3));
	}
	ctx.textBaseline = 'middle';
}

function prepare_canvas(canvas_id) {
	let canvas = document.getElementById(canvas_id);
	let ctx = canvas.getContext("2d");

	ctx.font = '14px sans-serif';
	ctx.textAlign = 'center';
	ctx.lineWidth = 0.25;

	grid_width = canvas.width;
	grid_height = canvas.height;

	tile_width = grid_width / (num_x_tiles + 2);
	tile_height = grid_height / (num_y_tiles + 2);

	update_text(ctx);
	return ctx;
}

function start_q8() {
	let ctx = prepare_canvas("canvas");
	let vm = new VM();
	vm.load_board(window.location.hash);

	vm.running = true;

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
