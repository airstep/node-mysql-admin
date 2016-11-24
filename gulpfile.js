var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var babel = require('babelify');
var nodemon = require('gulp-nodemon');

function compile(watch) {
    var bundler = watchify(
  		browserify({
  			entries: './public/app.js',
  			debug: true
  		})
  		.transform(babel, {presets: ["es2015"], plugins: ["mjsx"]})
	);

  function rebundle() {
    bundler.bundle()
      .on('error', function(err) { console.error(err); this.emit('end'); })
      .pipe(source('bundle.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./public/dist'));
  }

  if (watch) {
    gulp.run('server')
    bundler.on('update', function() {
      console.log('-> bundling...');
      rebundle();
    });
  }

  rebundle();
}

function watch() {
  return compile(true);
};

gulp.task('server', function() {

	nodemon({
		script: 'app.js',
		ext: 'js html',
		tasks: [],
		ignore: [
			'node_modules/'
		]
	})
})

gulp.task('build', function() { return compile(); });
gulp.task('watch', function() { return watch(); });

gulp.task('default', ['watch', 'server']);
