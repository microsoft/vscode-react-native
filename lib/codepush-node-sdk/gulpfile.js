const gulp = require('gulp');
const ts = require('gulp-typescript');
const rmdir = require('rmdir');
const path = require("path");
const install = require("gulp-install");
const gulpSequence = require('gulp-sequence');
const tslint = require("gulp-tslint");

const srcPath = "./dist";
const tsFilesPath = "./src/**/*.ts";


gulp.task("clean", function() {
  return rmdir(srcPath);
})

gulp.task("install", function(done) {
  var package = path.join(__dirname, "package.json");
  return gulp.src(package).pipe(install());
})

gulp.task("tslint", function() {
  return gulp.src(tsFilesPath).pipe(tslint({
    configuration: "./tslint.json", formatter: "verbose"
  })).pipe(tslint.report());
})

gulp.task('build', function () {
  const tsProject = ts.createProject('tsconfig.json');
  return gulp.src('src/**/*.ts')
    .pipe(tsProject())
    .pipe(gulp.dest('./dist'));
});

gulp.task('content', function() {
    return gulp.src([
      "{script}/**/*.{css,ejs,html,js,json,png,xml}",
      "*.{public,private}",
      "package.json",
      ".npmignore",
      "README.md"
  ])
  .pipe(gulp.dest("dist"));
});

gulp.task('prepublish', gulpSequence('clean', 'tslint', 'build', 'content'));

gulp.task("default", ["build"]);