'use strict';
const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const install = require('gulp-install');
const zip = require('gulp-zip');
const strip = require('gulp-strip-comments');
const removeEmptyLines = require('gulp-remove-empty-lines');<% if (generateDocs) { %>
const apidoc = require('gulp-api-doc');<% } %>
const del = require('del');
const deptree = require('dependency-tree');
const pkg = require('./package.json');

const regex = new RegExp('node_modules/(.*?)/', 'g');

function clean(tree, module) {
	const result = {};

	Object.keys(tree).forEach(key => {
		if (key.indexOf(`node_modules/${module}`) === -1) {
			result[key] = clean(tree[key], module);
		}
	});

	return result;
}

function deps(tree, result) {
	result = result || {};

	Object.keys(tree).forEach(key => {
		let match = regex.exec(key);

		while (match) {
			result[match[1]] = (result[match[1]] || 0) + 1;

			match = regex.exec(key);
		}

		deps(tree[key], result);
	});

	return result;
}

const tree = deptree({filename: pkg.main, root: __dirname});
const cleaned = deps(clean(tree, 'aws-sdk'));
const cleanUpArray = Object.keys(deps(tree)).filter(key => cleaned[key] === undefined);

gulp.task('clean', ['zip'], () => del('.temp'));

gulp.task('cleanDeps', ['copyAndInstall'], () => {
	return del(cleanUpArray.map(x => `.temp/node_modules/{${x},${x}/**}`));
});

gulp.task('copyAndInstall', () => {
	let files = ['package.json'].concat(pkg.files);

	if (pkg.files === undefined) {
		files = ['./**', '!./**/*.md', '!gulpfile.js', '!./{dist,dist/**}', '!./{test,test/**}', '!./{node_modules,node_modules/**}'];
	} else {
		files = files.map(file => {
			try {
				if (fs.statSync(path.join(__dirname, file)).isDirectory()) {
					return path.join(file, '**/*');
				}
			} catch (err) {
				// do nothing
			}

			return file;
		});
	}

	return gulp.src(files, {base: '.'})
		.pipe(strip())
		.pipe(removeEmptyLines())
		.pipe(gulp.dest('.temp'))
		.pipe(install({production: true}));
});

gulp.task('zip', ['copyAndInstall', 'cleanDeps'], () => {
	return gulp.src('.temp/**')
		.pipe(zip('build.zip'))
		.pipe(gulp.dest('dist'));
});
<% if (generateDocs) { %>
gulp.task('docs', () => {
	return gulp.src('lib')
        .pipe(apidoc())
        .pipe(gulp.dest(`docs/${pkg.name}`));
});
<% } %>
gulp.task('build', ['copyAndInstall', 'cleanDeps', 'zip', 'clean'<% if (generateDocs) { %>, 'docs'<% } %>]);
gulp.task('default', ['build']);