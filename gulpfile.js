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

const libs = [
    "axios",
    "react",
    "react-dom",
    "react-router"
]

gulp.task("browserify-vendor", function() {

    var browserified = browserify({
        debug: true
    })

    libs.forEach(function (lib) {
        browserified.require(lib)
    })

    return browserified.bundle()
        .on('error', function(err) {
            console.error("[browserify-vendor] error: ", err.toString())
            this.emit('end')
        })
        .on('end', function () {
            console.info("[browserify-vendor] finished for ", libs.length, "libs")
        })
        .pipe(source('vendor.js'))
        //.pipe(buffer())
        //.pipe(uglify())
        .pipe(gulp.dest('./public/dist'))
});

gulp.task("browserify-app", function() {

    var browserified = browserify({
        entries: ["./public/Routes.js"],
        debug: true
    })
        .transform(babel, {presets: ["es2015"], plugins: ["transform-react-jsx"]})

    libs.forEach(function (lib) {
        browserified.exclude(lib)
    })

    var watchified = watchify(browserified)

    function rebundle() {

        console.time("[browserify-app]")

        return watchified
            .bundle()
            .on('error', function(err) {
                console.error("[browserify-app] error:", err.toString())
                this.emit('end')
            })
            .on('end', function () {
                console.timeEnd("[browserify-app]")
            })
            .pipe(source('bundle.js'))
            //.pipe(buffer())
            //.pipe(uglify())
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
            console.info("[css] bundled")
        })
});

gulp.task('css-watch', function() {
    /* empty classes are not included */
    gulp.watch("./public/css/*.css", ["css"])
});

gulp.task("default", ["nodemon", "browserify-app", "browserify-vendor", "css", "css-watch"]);