var gulp = require('gulp')
var sourcemaps = require('gulp-sourcemaps')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var browserify = require('browserify')
var watchify = require('watchify')
var babel = require('babelify')
var nodemon = require('gulp-nodemon')
var uglify = require('gulp-uglify')
var cleanCSS = require('gulp-clean-css');
var concatCSS = require('gulp-concat-css');


gulp.task("browserify", function() {

    var browserified = browserify({
        entries: ["./public/app.js"],
        debug: true
    })
        .transform(babel, {presets: ["es2015"], plugins: ["transform-react-jsx" /* using '@jsx m' annotation */]})

    var watchified = watchify(browserified)

    function rebundle() {

        return watchified
            .bundle()
            .on('error', function(err) {
                console.error(err.toString())
                this.emit('end')
            })
            .on('end', function () {
                console.info("[gulp] js bundled")
            })
            .pipe(source('bundle.js'))
            .pipe(gulp.dest('./public/dist'))
    }

    watchified.on("update", function () {
        rebundle()
    })

    return rebundle()
});

gulp.task('nodemon', function (cb) {

    nodemon({
        script: 'app.js',
        ext: 'js',
        tasks: [],
        ignore: ['node_modules/', 'public']
    })
});

gulp.task('css', function() {
    gulp.src('./public/css/*.css')
        .pipe(concatCSS("bundle.css"))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(gulp.dest('./public/dist'))
        .on('end', function () {
            console.info("[gulp] css bundled")
        })
});

gulp.task('css-watch', function() {
    /* empty classes are not included */
    gulp.watch("./public/css/*.css", ["css"])
});

gulp.task("default", ["nodemon", "browserify", "css", "css-watch"]);