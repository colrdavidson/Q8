var q8_vert = `
	attribute vec2 my_pos;

	uniform mat4 persp;
	uniform mat4 model;
	uniform vec3 color;

	varying highp vec3 f_color;

	void main() {
		gl_Position = persp * model * vec4(my_pos, 0.0, 1.0);
		f_color = color;
	}
`;

var q8_frag = `
	varying highp vec3 f_color;

	void main() {
		gl_FragColor = vec4(f_color, 1.0);
	}
`;
