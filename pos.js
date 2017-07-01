"use strict";

function oned_to_twod(idx, width) {
    return {
		x: idx % width,
		y: Math.floor(idx / width)
	};
}

function twod_to_oned(x, y, width) {
    return (y * width) + x;
}

function blend_colors(ratio, color1, color2) {
    if (color2 == undefined) {
		return color1;
    }

    let w1 = 1 - ratio;
    let w2 = ratio;

    let r = (color1[0] * w1) + (color2[0] * w2);
    let g = (color1[1] * w1) + (color2[1] * w2);
    let b = (color1[2] * w1) + (color2[2] * w2);

    return [r, g, b];
}

function color_to_hex(color) {
    let r = Math.round(255 * color[0]);
    let g = Math.round(255 * color[1]);
    let b = Math.round(255 * color[2]);

    return "#" + r.toString(16) + g.toString(16) + b.toString(16);
}

function hex_to_color(hex_str) {
	let fmt_hex_str = hex_str.slice(1, hex_str.length);
	let full_int = parseInt(fmt_hex_str, 16);
	let r = ((full_int >> 16) & 255) / 255;
	let g = ((full_int >> 8) & 255) / 255;
	let b = (full_int & 255) / 255;

	return [r, g, b];
}
