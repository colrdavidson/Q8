"use strict";

function op_jmp(board) {
    pc = board[pc];
}

function op_jmpi(board) {
    pc = board[board[pc]];
}

function op_jz(board) {
    if (zero_flag == true) {
        pc = board[pc];
    } else {
		pc++;
	}
}

function op_jzi(board) {
    if (zero_flag == true) {
        pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jg(board) {
	if (greater_flag == true) {
		pc = board[pc];
	} else {
		pc++;
	}
}

function op_jgi(board) {
	if (greater_flag == true) {
		pc = board[board[pc]];
	} else {
		pc++;
	}
}

function op_je(board) {
	if (equal_flag == true) {
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jei(board) {
	if (equal_flag == true) {
		pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jl(board) {
	if (less_flag == true) {
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jli(board) {
	if (less_flag == true) {
		pc = board[board[pc]];
    } else {
		pc++;
	}
}


function op_cmp(a_idx, b_idx) {
	less_flag = false;
	equal_flag = false;
	zero_flag = false;
	greater_flag = false;

	if (reg[a_idx] > reg[b_idx]) {
		greater_flag = true;
	} else if (reg[a_idx] == reg[b_idx]) {
		equal_flag = true;
	} else {
		less_flag = true;
	}
	reg_updated = true;
}

function op_iszero(idx) {
	zero_flag = false;
	if (reg[idx] == 0) {
		zero_flag = true;
	}
	reg_updated = true;
}

function op_reljump(board) {
    pc = (board[pc] + pc) % 255;
}

function op_add(a_idx, b_idx) {
    reg[a_idx] = reg[a_idx] + reg[b_idx];
	reg_updated = true;
}

function op_addi(board, idx) {
    reg[idx] += board[pc];
	reg_updated = true;
    pc++;
}

function op_sub(a_idx, b_idx) {
    reg[a_idx] = reg[a_idx] - reg[b_idx];
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

function op_load_2(board, idx) {
    reg[idx] = board[board[board[pc]]];
	reg_updated = true;
    pc++;
}

function op_store(board, idx) {
    board[board[pc]] = reg[idx];
	board_updated = true;
    pc++;
}

function op_store_2(board, idx) {
    board[board[board[pc]]] = reg[idx];
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

function op_deref(idx) {
    reg[idx] = board[reg[idx]];
	reg_updated = true;
}

