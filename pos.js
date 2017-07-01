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
