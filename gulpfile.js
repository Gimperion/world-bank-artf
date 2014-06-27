var gulp = require('gulp');

var autoprefix    = require('gulp-autoprefixer'),
    cssimport     = require('gulp-cssimport'),
    debug         = require('gulp-debug'),
    entityconvert = require('gulp-entity-convert'),
    livereload    = require('gulp-livereload'),
    minifyCSS     = require('gulp-minify-css'),
    sass          = require('gulp-sass');

gulp.task('css', function () {
  gulp.src('./stylesheets/styles.scss')
    .pipe(sass(), { errLogToConsole: true })
    .pipe(autoprefix('last 2 versions', 'Explorer > 7'))
    .pipe(cssimport())
    .pipe(entityconvert({ type: 'css' }))
    .pipe(minifyCSS({ keepSpecialComments: 0 }))
    .pipe(debug({ verbose: false }))
    .pipe(gulp.dest('./css'));
});

gulp.task('watch', function () {
  // Test: Watcher only exists in this task
  var watcher = gulp.watch('./stylesheets/**/*.scss', ['css']);
  watcher.on('change', function (event) {
    console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
  });
});
