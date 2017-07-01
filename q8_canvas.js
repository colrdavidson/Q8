"use strict";

let grid_width;
let grid_height;
let num_x_tiles = 16;
let num_y_tiles = 16;
let tile_width;
let tile_height;

function render_grid(dt, ctx, vm) {
    if (vm.rendered_pc == vm.pc) {
		return;
	}

	ctx.fillStyle = "#888888";
	ctx.fillRect(tile_width, tile_height, grid_width - (tile_width * 2), grid_height - (tile_height * 2));

	ctx.fillStyle = "black";
	for (let x = 0; x < num_x_tiles; x++) {
		for (let y = 0; y < num_y_tiles; y++) {
			let real_x = tile_width * (x + 1);
			let real_y = tile_height * (y + 1);

			let idx = twod_to_oned(x, y, num_x_tiles);
			if (idx == vm.pc) {
				ctx.fillStyle = "#bef6ea";
				ctx.fillRect(real_x, real_y, tile_width, tile_height);
			} else if (vm.board[idx] != 0) {
				ctx.fillStyle = "lightgrey";
				ctx.fillRect(real_x, real_y, tile_width, tile_height);
			}

			ctx.fillStyle = "black";
			ctx.strokeRect(real_x, real_y, tile_width, tile_height);

			ctx.fillText(vm.board[idx], real_x + (tile_width / 2), real_y + (tile_height / 2));
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

	ctx.font = '16px sans-serif';
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
