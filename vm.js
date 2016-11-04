"use strict";

function op_jmp(board) {
    pc = board[pc];
}

function op_jz(board) {
    if (reg_a == 0) {
        pc = board[pc];
    }
}

function op_jg(board) {
	if (reg_a > board[pc]) {
		pc = board[pc];
	}
}

function op_jl(board) {
	if (reg_a < board[pc]) {
		pc = board[pc];
	}
}

function op_je(board) {
	if (reg_a == board[pc]) {
		pc = board[pc];
	}
}

function op_reljump(board) {
    pc = (board[pc] + pc) % 255;
}

function op_add(board) {
    reg_a += board[pc];
    if (reg_a > 255) { reg_a -= 256 }
	reg_updated = true;
    pc++;
}

function op_sub(board) {
    reg_a -= board[pc];
    if (reg_a < 0) { reg_a += 256 }
	reg_updated = true;
    pc++;
}

function op_load(board) {
    reg_a = board[pc];
	reg_updated = true;
    pc++;
}

function op_store(board) {
    board[board[pc]] = reg_a;
    pc++;
}
