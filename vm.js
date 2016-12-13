"use strict";

function push(board, x) {
	if (stack_enabled) {
		board[sp] = x;
		sp++;
		reg_updated = true;
		board_updated = true;
	}
}

function op_jmp(board) {
	push(board, pc);
    pc = board[pc];
}

function op_jmpi(board) {
	push(board, pc);
    pc = board[board[pc]];
}

function op_jz(board) {
    if (zero_flag == true) {
		push(board, pc);
        pc = board[pc];
    } else {
		pc++;
	}
}

function op_jzi(board) {
    if (zero_flag == true) {
		push(board, pc);
        pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jg(board) {
	if (greater_flag == true) {
		push(board, pc);
		pc = board[pc];
	} else {
		pc++;
	}
}

function op_jgi(board) {
	if (greater_flag == true) {
		push(board, pc);
		pc = board[board[pc]];
	} else {
		pc++;
	}
}

function op_je(board) {
	if (equal_flag == true) {
		push(board, pc);
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jei(board) {
	if (equal_flag == true) {
		push(board, pc);
		pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jne(board) {
	if (equal_flag == false) {
		push(board, pc);
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jnei(board) {
	if (equal_flag == false) {
		push(board, pc);
		pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jl(board) {
	if (less_flag == true) {
		push(board, pc);
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jli(board) {
	if (less_flag == true) {
		push(board, pc);
		pc = board[board[pc]];
    } else {
		pc++;
	}
}

function op_jerr(board) {
	if (error_flag == true) {
		push(board, pc);
		pc = board[pc];
    } else {
		pc++;
	}
}

function op_jerri(board) {
	if (error_flag == true) {
		push(board, pc);
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

function op_reljmp(board) {
	push(board, pc);
    pc = (board[pc] + pc) % 256;
}

function op_regjmp(idx) {
	push(board, pc);
    pc = reg[idx];
}

function op_add(a_idx, b_idx) {
	var tmp = reg[a_idx] + reg[b_idx];
	if (tmp > 255) {
		error_flag = true;
	}
    reg[a_idx] = tmp;
	reg_updated = true;
}

function op_addi(board, idx) {
	var tmp = reg[idx] + board[pc];
	if (tmp > 255) {
		error_flag = true;
	}
    reg[idx] = tmp;
	reg_updated = true;
    pc++;
}

function op_sub(a_idx, b_idx) {
    var tmp = reg[a_idx] - reg[b_idx];
	if (tmp < 0) {
		error_flag = true;
	}
    reg[0] = tmp; // Store value in register A
	reg_updated = true;
}

function op_subi(board, idx) {
    var tmp = reg[idx] - board[pc];
	if (tmp < 0) {
		error_flag = true;
	}
    reg[idx] = tmp;
	reg_updated = true;
    pc++;
}

function op_inc(idx) {
	var tmp = reg[idx] + 1;
	if (tmp > 255) {
		error_flag = true;
	}
    reg[idx] = tmp;
	reg_updated = true;
}

function op_dec(idx) {
	var tmp = reg[idx] - 1;
	if (tmp < 0) {
		error_flag = true;
	}
    reg[idx] = tmp;
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
	var tmp = reg[idx] >>> board[pc];
	if (tmp < 0) {
		error_flag = true;
	}
    reg[idx] = tmp;
	reg_updated = true;
    pc++;
}

function op_shl(board, idx) {
	var tmp = reg[idx] << board[pc];
	if (tmp > 255) {
		error_flag = true;
	}
    reg[idx] = tmp;
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

function op_ret(board) {
	if (stack_enabled) {
		sp--;
		pc = board[sp];
	} else {
		error_flag = true;
	}
	reg_updated = true;
}

function op_setsp(board) {
	sp = board[pc];
	stack_enabled = true;
	reg_updated = true;
	pc++;
}
