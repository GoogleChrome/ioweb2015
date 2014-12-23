/* jshint node: true */

'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var pagespeed = require('psi');
var path = require('path');
var del = require('del');
var i18n_replace = require('./gulp_scripts/i18n_replace');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var bower = require('gulp-bower');
var chmod = require('gulp-chmod');
var inject = require('gulp-inject');
var rename = require('gulp-rename');

var APP_DIR = 'app';

var STATIC_VERSION = 1; // Cache busting static assets.
var VERSION = argv.build || STATIC_VERSION;

var SHED_CONFIG_FILE = 'shed-config.js';

// TODO(ericbidelman|bckenny): fill in with default static asset base URL
// var STATIC_BASE_URL = argv.baseurl ? argv.baseurl : '';
// var STATIC_URL = argv.pretty ? '' : (STATIC_BASE_URL + VERSION + '/');

var DIST_STATIC_DIR = 'dist';
// var PROD_DIR = APP_DIR + '/dist_prod';
// var STATIC_DIR = APP_DIR + '/dist_static';
// var PRETTY_DIR = APP_DIR + '/dist_pretty';

// path for files (mostly index_*.html) with short cache periods
// var DIST_PROD_DIR = argv.pretty ? PRETTY_DIR : PROD_DIR;

// path for static resources
// var DIST_STATIC_DIR = argv.pretty ? PRETTY_DIR : (STATIC_DIR + '/' + VERSION);

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', function(cleanCallback) {
  del([DIST_STATIC_DIR], cleanCallback);
});

gulp.task('sass', function() {
  return gulp.src([
      APP_DIR + '/{styles,elements}/**/*.scss'
    ])
    .pipe($.sass({outputStyle: 'compressed'}))
    .pipe($.changed(APP_DIR + '/{styles,elements}', {extension: '.scss'}))
    .pipe($.autoprefixer([
      'ie >= 10',
      'ie_mob >= 10',
      'ff >= 33',
      'chrome >= 38',
      'safari >= 7',
      'opera >= 26',
      'ios >= 7'
    ]))
    .pipe(gulp.dest(APP_DIR))
    .pipe($.size({title: 'styles'}));
});

// Copy Web Fonts To Dist
gulp.task('fonts', function () {
  return gulp.src([APP_DIR + '/fonts/**'])
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/fonts'))
    .pipe($.size({title: 'fonts'}));
});

// gulp.task('vulcanize-scenes', ['clean', 'sass', 'compile-scenes'], function() {
//   return gulp.src([
//       'scenes/*/*-scene*.html'
//     ], {base: './'})
//     // gulp-vulcanize doesn't currently handle multiple files in multiple
//     // directories well right now, so vulcanize them one at a time
//     .pipe($.foreach(function(stream, file) {
//       var dest = path.dirname(path.relative(__dirname, file.path));
//       return stream.pipe($.vulcanize({
//         excludes: {
//           // these are inlined in elements.html
//           imports: [
//             'jquery.html$',
//             'modernizr.html$',
//             'polymer.html$',
//             'base-scene.html$',
//             'i18n-msg.html$',
//             'core-a11y-keys.html$',
//             'core-shared-lib.html$',
//             'google-maps-api.html$',
//           ]
//         },
//         strip: !argv.pretty,
//         csp: true,
//         inline: true,
//         dest: dest
//       }))
//       .pipe(i18n_replace({
//         strict: !!argv.strict,
//         path: '_messages',
//       }))
//       .pipe(gulp.dest(path.join(DIST_STATIC_DIR, dest)));
//     }));
// });

// vulcanize main site elements separately.
gulp.task('vulcanize-elements', ['clean', 'sass'], function() {
  return gulp.src([
      APP_DIR + '/elements/elements.html'
    ], {base: './'})
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: 'elements/'
    }))
    // .pipe(i18n_replace({
    //   strict: !!argv.strict,
    //   path: '_messages',
    // }))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/elements/'));
});

// gulp.task('i18n_index', function() {
//   return gulp.src(['index.html', 'error.html', 'upgrade.html'])
//     .pipe(argv.pretty ? $.gutil.noop() : $.replace(/window\.DEV ?= ?true.*/, ''))
//     .pipe($.replace('<base href="">',
//         '<base href="' + STATIC_URL + '">'))
//     .pipe(i18n_replace({
//       strict: !!argv.strict,
//       path: '_messages',
//     }))
//     .pipe(gulp.dest(DIST_PROD_DIR));
// });

// copy needed assets (images, polymer elements, etc) to /dist directory
// gulp.task('copy-assets', ['clean', 'vulcanize', 'i18n_index'], function() {
gulp.task('copy-assets', ['copy-bower-dependencies'], function() {
  return gulp.src([
    APP_DIR + '/*.{html,txt,ico}',
    APP_DIR + '/app.yaml',
    APP_DIR + '/manifest.json',
    APP_DIR + '/styles/**.css',
    APP_DIR + '/elements/**/images/*',
    // The service worker script needs to be at the top-level of the site.
    APP_DIR + '/sw.js'
  ], {base: './'})
  .pipe(gulp.dest(DIST_STATIC_DIR))
  .pipe($.size({title: 'copy-assets'}));
});

// Copy over third-party bower dependencies that we need to DIST_STATIC_DIR.
// This will include some bower metadata-cruft, but since we won't actually
// reference that cruft from anywhere, it presumably shouldn't incur overhead.
gulp.task('copy-bower-dependencies', function() {
  var bowerPackagesToCopy = [
    'js-signals',
    'shed',
    'webcomponentsjs'
  ];
  var directoryPaths = bowerPackagesToCopy.map(function(bowerPackageToCopy) {
    return APP_DIR + '/bower_components/' + bowerPackageToCopy + '/**';
  });

  return gulp.src(directoryPaths, {base: './'})
    .pipe(gulp.dest(DIST_STATIC_DIR));
});

// Lint JavaScript
gulp.task('jshint', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js', APP_DIR + '/sw.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Check JS style
gulp.task('jscs', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js', APP_DIR + '/sw.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jscs());
});

// Crush JS
// TODO: sw.js isn't being uglified. It needs to be copied into the top-level
// directory of the site, which is currently being done in the copy-assets task.
gulp.task('uglify', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js', '!**/' + SHED_CONFIG_FILE])
    .pipe(reload({stream: true, once: true}))
    .pipe($.uglify({preserveComments: 'some'}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/scripts'))
    .pipe($.size({title: 'uglify'}));
});

// Optimize Images
gulp.task('images', function() {
  return gulp.src([
      APP_DIR + '/images/**/*'
    ])
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/images'))
    .pipe($.size({title: 'images'}));
});

// Run PageSpeed Insights
// Update `url` below to the public URL for your site
gulp.task('pagespeed', pagespeed.bind(null, {
  // By default, we use the PageSpeed Insights
  // free (no API key) tier. You can use a Google
  // Developer API key if you have one. See
  // http://goo.gl/RkN0vE for info key: 'YOUR_API_KEY'
  url: 'https://example.com',
  strategy: 'mobile'
}));

// Watch Files For Changes & Reload
gulp.task('serve', ['sass'], function() {
  // By default, if you're running 'serve', you probably don't want shed to add anything to the
  // service worker cache. (Local changes won't be picked up if there's a cached version.)
  // You can manually run the 'generate-shed-config-dev' task after running 'serve' if you
  // want to get the pre-caching behavior.
  del([APP_DIR + '/**/' + SHED_CONFIG_FILE]);

  browserSync({
    notify: false,
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: [APP_DIR]
  });

  gulp.watch([APP_DIR + '/**/*.html'], reload);
  gulp.watch([APP_DIR + '/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch([APP_DIR + '/scripts/**/*.js'], ['jshint']);
  gulp.watch([APP_DIR + '/images/**/*'], reload);
  gulp.watch([APP_DIR + '/bower.json'], ['bower']);
});

gulp.task('vulcanize', ['vulcanize-elements']);

gulp.task('js', ['jshint', 'jscs', 'uglify']);

gulp.task('default', ['clean'], function(cb) {
  runSequence(
    'sass',
    'vulcanize',
    ['js', 'images', 'fonts'],
    'copy-assets',
    'generate-shed-config-dist',
    cb
  );
});

gulp.task('bower', function() {
  return bower({cwd: APP_DIR});
});

gulp.task('addgithooks', function() {
  return gulp.src('.git-hooks/*')
    .pipe(chmod(755))
    .pipe(gulp.dest('.git/hooks'));
});

gulp.task('setup', function(cb) {
  runSequence('bower', 'addgithooks', 'default', cb);
});

// Load custom tasks from the `tasks` directory
try { require('require-dir')('tasks'); } catch (err) {}

function generateShedConfig(baseDirectory) {
  var shedConfigDirectory = baseDirectory + '/scripts/auto_generated/';

  // TODO (jeffposnick): This list can definitely be pared down.
  var filesToPrecache = gulp.src([
    baseDirectory + '/**.html',
    baseDirectory + '/fonts/**/*',
    baseDirectory + '/styles/**.css',
    baseDirectory + '/scripts/**.js',
    baseDirectory + '/elements/**/*.{js,html,css}',
    baseDirectory + '/bower_components/**/*.{js,html,css}',
    baseDirectory + '/images/**/*.{svg,png,jpg,ico,gif}'
  ], {read: false});

  return gulp.src(shedConfigDirectory + 'shed-config-template.js')
    .pipe(inject(filesToPrecache, {
      starttag: 'filesToPrecache: [',
      endtag: ']',
      transform: function (filePath, file, i, length) {
        // TODO (jeffposnick): There's probably a better way of modifying the path?
        // Setting {base:} in the gulp.src() didn't seem to help, though.
        var filePathRelativeToServerRoot = filePath.replace('/' + baseDirectory + '/', '');
        return JSON.stringify(filePathRelativeToServerRoot) + (i + 1 < length ? ',' : '');
      }
    }))
    // Run jshint on the generated file to double-check that we're writing out valid JS.
    .pipe($.jshint())
    .pipe($.jshint.reporter('fail'))
    .pipe(rename(SHED_CONFIG_FILE))
    .pipe(gulp.dest(shedConfigDirectory));
}

// There are a different set of files that need to be cached in the dev and dist environments,
// so we can't just use the same shed configuration from dev to dist.
// E.g., in the dist environment, we want to cache the vulanized Polymer elements, not the
// individual components.
gulp.task('generate-shed-config-dev', function() {
  return generateShedConfig(APP_DIR);
});

gulp.task('generate-shed-config-dist', function() {
  return generateShedConfig(DIST_STATIC_DIR + '/' + APP_DIR);
});
