"use strict";

function op_jmp(board) {
    pc = board[pc];
}

function op_jz(board, idx) {
    if (reg[idx] == 0) {
        pc = board[pc];
    }
}

function op_jg(board, a_idx, b_idx) {
	if (reg[a_idx] > reg[b_idx]) {
		pc = board[pc];
	}
}

function op_jl(board, a_idx, b_idx) {
	if (reg[a_idx] < reg[b_idx]) {
		pc = board[pc];
	}
}

function op_je(board, a_idx, b_idx) {
	if (reg[a_idx] == reg[b_idx]) {
		pc = board[pc];
	}
}

function op_reljump(board) {
    pc = (board[pc] + pc) % 255;
}

function op_add(a_idx, b_idx) {
    reg[idx] = a_idx + b_idx;
	reg_updated = true;
}

function op_addi(board, idx) {
    reg[idx] += board[pc];
	reg_updated = true;
    pc++;
}

function op_sub(a_idx, b_idx) {
    reg[idx] = a_idx - b_idx;
	reg_updated = true;
}

function op_subi(board, idx) {
    reg[idx] -= board[pc];
	reg_updated = true;
    pc++;
}

function op_inc(idx) {
    reg[idx] += 1;
	reg_updated = true;
}

function op_dec(idx) {
    reg[idx] -= 1;
	reg_updated = true;
}

function op_load(board, idx) {
    reg[idx] = board[pc];
	reg_updated = true;
    pc++;
}

function op_load_ind(board, idx) {
    reg[idx] = board[board[pc]];
	reg_updated = true;
    pc++;
}

function op_store(board, idx) {
    board[board[pc]] = reg[idx];
	board_updated = true;
    pc++;
}

function op_and(board, idx) {
    reg[idx] = reg[idx] & board[pc];
	reg_updated = true;
    pc++;
}

function op_or(board, idx) {
    reg[idx] = reg[idx] | board[pc];
	reg_updated = true;
    pc++;
}

function op_xor(board, idx) {
    reg[idx] = reg[idx] ^ board[pc];
	reg_updated = true;
    pc++;
}

function op_shr(board, idx) {
    reg[idx] = reg[idx] >>> board[pc];
	reg_updated = true;
    pc++;
}

function op_shl(board, idx) {
    reg[idx] = reg[idx] << board[pc];
	reg_updated = true;
    pc++;
}

function op_not(idx) {
	reg[idx] = ~reg[idx];
	reg_updated = true;
}

function op_swap(a_idx, b_idx) {
    var tmp = reg[a_idx];
	reg[a_idx] = reg[b_idx];
	reg[b_idx] = tmp;
	reg_updated = true;
}
