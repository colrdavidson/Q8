"use strict";

function init_webgl(canvas) {
	var gl = null;

	if (canvas == null) {
		alert("Can't find glcanvas!");
		return gl;
	}

	try {
		gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
	} catch (e) { }

	if (!gl) {
		alert("Unable to init WebGL. Not Support!");
		gl = null;
	}

	return gl;
}

function getShader(gl, type, src) {
	var shader = gl.createShader(type);

	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert("An error compiling shaders: " + gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function init_shader(gl, v_shader, f_shader) {
	var vert_shader = getShader(gl, gl.VERTEX_SHADER, v_shader);
	var frag_shader = getShader(gl, gl.FRAGMENT_SHADER, f_shader);

	var shader_program = gl.createProgram();

	gl.attachShader(shader_program, vert_shader);
	gl.attachShader(shader_program, frag_shader);
	gl.linkProgram(shader_program);

	if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
		alert("Unable to init shader program: " + gl.getProgramInfoLog(shader_program));
	}

	return shader_program;
}

Matrix.Translation = function (v)
{
  if (v.elements.length == 2) {
    var r = Matrix.I(3);
    r.elements[2][0] = v.elements[0];
    r.elements[2][1] = v.elements[1];
    return r;
  }

  if (v.elements.length == 3) {
    var r = Matrix.I(4);
    r.elements[0][3] = v.elements[0];
    r.elements[1][3] = v.elements[1];
    r.elements[2][3] = v.elements[2];
    return r;
  }

  throw "Invalid length for Translation";
}

Matrix.Scale = function (v)
{
  if (v.elements.length == 2) {
    var r = Matrix.I(3);
    r.elements[0][0] = v.elements[0];
    r.elements[1][1] = v.elements[1];
    return r;
  }

  if (v.elements.length == 3) {
    var r = Matrix.I(4);
    r.elements[0][0] = v.elements[0];
    r.elements[1][1] = v.elements[1];
    r.elements[2][2] = v.elements[2];
    return r;
  }

  throw "Invalid length for Translation";
}

Matrix.prototype.flatten = function ()
{
    var result = [];
    if (this.elements.length == 0)
        return [];


    for (var j = 0; j < this.elements[0].length; j++)
        for (var i = 0; i < this.elements.length; i++)
            result.push(this.elements[i][j]);
    return result;
}

Matrix.prototype.ensure4x4 = function()
{
    if (this.elements.length == 4 &&
        this.elements[0].length == 4)
        return this;

    if (this.elements.length > 4 ||
        this.elements[0].length > 4)
        return null;

    for (var i = 0; i < this.elements.length; i++) {
        for (var j = this.elements[i].length; j < 4; j++) {
            if (i == j)
                this.elements[i].push(1);
            else
                this.elements[i].push(0);
        }
    }

    for (var i = this.elements.length; i < 4; i++) {
        if (i == 0)
            this.elements.push([1, 0, 0, 0]);
        else if (i == 1)
            this.elements.push([0, 1, 0, 0]);
        else if (i == 2)
            this.elements.push([0, 0, 1, 0]);
        else if (i == 3)
            this.elements.push([0, 0, 0, 1]);
    }

    return this;
};

function makeOrtho(left, right, bottom, top, znear, zfar)
{
    var tx = - (right + left) / (right - left);
    var ty = - (top + bottom) / (top - bottom);
    var tz = - (zfar + znear) / (zfar - znear);

    return $M([[2 / (right - left), 0, 0, tx],
           [0, 2 / (top - bottom), 0, ty],
           [0, 0, -2 / (zfar - znear), tz],
           [0, 0, 0, 1]]);
}

function loadIdentity() {
    return Matrix.I(4);
}

function modelTranslate(mat, v) {
    return mat.x(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function modelScale(mat, v) {
    return mat.x(Matrix.Scale($V([v[0], v[1], v[2]])).ensure4x4());
}
