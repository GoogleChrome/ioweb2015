/* jshint node: true */

/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var browserSync = require('browser-sync').create();
var del = require('del');
var merge = require('merge-stream');
var opn = require('opn');
var glob = require('glob');
var pagespeed = require('psi');

var generateServiceWorker = require('./gulp_scripts/service-worker');
var backend = require('./gulp_scripts/backend');

var argv = require('yargs').argv;
var IOWA = require('./package.json').iowa;
var DIST_EXPERIMENT_DIR = path.join(IOWA.appDir, IOWA.experimentDir);

var AUTOPREFIXER_BROWSERS = ['last 2 versions', 'ios 8', 'Safari 8'];

// reload is a noop unless '--reload' cmd line arg is specified.
// reload has no effect without '--watch'.
let reload = function() {
  return new require('stream').PassThrough({objectMode: true});
}
if (argv.reload) {
  reload = browserSync.reload;
  // reload doesn't make sense w/o watch
  argv.watch = true;
}

// openUrl is a noop unless '--open' cmd line arg is specified.
var openUrl = function() {};
if (argv.open) {
  openUrl = opn;
}

// Scripts required for the data-fetching worker.
var dataWorkerScripts = [
  IOWA.appDir + '/bower_components/es6-promise/dist/es6-promise.min.js',
  IOWA.appDir + '/scripts/helper/request.js',
  IOWA.appDir + '/scripts/helper/schedule.js',
  IOWA.appDir + '/data-worker.js'
];


function createReloadServer() {
  browserSync.init({
    notify: true,
    open: !!argv.open,
    //proxy: 'localhost:8080' // proxy serving through app engine.
  });
}

// Default task that builds everything.
// The output can be found in IOWA.distDir.
gulp.task('default', ['clean'], function(done) {
  runSequence(
    'copy-experiment-to-site', 'sass', 'vulcanize',
    ['concat-and-uglify-js', 'images', 'copy-assets', 'backend:dist'],
    'generate-data-worker-dist', 'generate-service-worker-dist',
    done
  );
});


// -----------------------------------------------------------------------------
// Setup tasks

// Set up local dev environment.
gulp.task('setup', function(cb) {
  runSequence(['bower', 'godeps', 'addgithooks', 'copy-experiment-to-site'], cb);
});

// Install/update bower components.
gulp.task('bower', function(cb) {
  var proc = spawn('../node_modules/bower/bin/bower', ['install'], {cwd: IOWA.appDir, stdio: 'inherit'});
  proc.on('close', cb);
});

// Install backend dependencies.
gulp.task('godeps', function(done) {
  backend.installDeps(done);
});

// Setup git hooks.
gulp.task('addgithooks', function() {
  return gulp.src('util/pre-commit')
    .pipe($.chmod(755))
    .pipe(gulp.dest('.git/hooks'));
});

// Clears files cached by gulp-cache (e.g. anything using $.cache).
gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', ['clear'], function() {
  return del([
    IOWA.distDir,
    IOWA.appDir + '/data-worker-scripts.js',
    `${IOWA.appDir}/{styles,elements}/**/*.css`,
    DIST_EXPERIMENT_DIR
  ]);
});


// -----------------------------------------------------------------------------
// Frontend prod build tasks

gulp.task('vulcanize', [
  'vulcanize-elements',
  'vulcanize-extended-elements',
  'vulcanize-gadget-elements']
);

// copy needed assets (images, polymer elements, etc) to /dist directory
gulp.task('copy-assets', function() {
  var assets = $.useref.assets();
  var templates = [
    IOWA.appDir + '/templates/**/*.html',
    IOWA.appDir + '/templates/**/*.json'
  ];
  if (argv.env == 'prod') {
    templates.push('!**/templates/debug/**');
  }

  var templateStream = gulp.src(templates, {base: './'})
    .pipe(assets)
    .pipe(assets.restore())
    .pipe($.useref());

  var otherAssetStream = gulp.src([
    IOWA.appDir + '/*.{html,txt,ico}',
    IOWA.appDir + '/clear_cache.html',
    IOWA.appDir + '/styles/**.css',
    IOWA.appDir + '/styles/pages/upgrade.css',
    IOWA.appDir + '/styles/pages/permissions.css',
    IOWA.appDir + '/styles/pages/error.css',
    IOWA.appDir + '/elements/**/images/*',
    IOWA.appDir + '/elements/webgl-globe/shaders/*.{frag,vert}',
    IOWA.appDir + '/elements/webgl-globe/textures/*.{jpg,png}',
    IOWA.appDir + '/bower_components/webcomponentsjs/webcomponents.min.js',
    IOWA.appDir + '/bower_components/es6-promise/dist/es6-promise.min.js',
    IOWA.appDir + '/bower_components/elevator/demo/music/*',
    DIST_EXPERIMENT_DIR + '/**/*'
  ], {base: './'});

  return merge(templateStream, otherAssetStream)
    .pipe(gulp.dest(IOWA.distDir))
    .pipe($.size({title: 'copy-assets'}));
});

// Crush JS
gulp.task('concat-and-uglify-js', ['js', 'generate-page-metadata'], function() {
  // The ordering of the scripts in the gulp.src() array matter!
  // This order needs to match the order in templates/layout_full.html
  var siteScripts = [
    'main.js',
    'pages.js',
    '../bower_components/moment/moment.js',
    '../bower_components/moment-timezone/builds/moment-timezone-with-data.min.js',
    'helper/util.js',
    '../bower_components/es6-promise/dist/es6-promise.min.js',
    'helper/auth.js',
    'helper/page-animation.js',
    'helper/elements.js',
    'helper/a11y.js',
    'helper/service-worker-registration.js',
    'helper/router.js',
    'helper/request.js',
    'helper/picasa.js',
    'helper/simple-db.js',
    'helper/notifications.js',
    'helper/schedule.js',
    'bootstrap.js'
  ].map(function(script) {
    return IOWA.appDir + '/scripts/' + script;
  });

  var siteScriptStream = gulp.src(siteScripts)
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('site-scripts.js'));

  // analytics.js is loaded separately and shouldn't be concatenated.
  var analyticsScriptStream = gulp.src([IOWA.appDir + '/scripts/analytics.js']);

  var serviceWorkerScriptStream = gulp.src([
    IOWA.appDir + '/bower_components/shed/shed.js',
    IOWA.appDir + '/scripts/helper/simple-db.js',
    IOWA.appDir + '/scripts/shed/*.js'
  ])
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('shed-scripts.js'));

  return merge(siteScriptStream, analyticsScriptStream).add(serviceWorkerScriptStream)
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir + '/scripts'))
    .pipe($.size({title: 'concat-and-uglify-js'}));
});

// Concat and crush scripts for the data-fetching worker for dist.
gulp.task('generate-data-worker-dist', function() {
  return gulp.src(dataWorkerScripts)
    .pipe($.concat('data-worker-scripts.js'))
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir))
    .pipe($.size({title: 'data-worker-dist'}));
});

// Generate prod service worker.
gulp.task('generate-service-worker-dist', function(callback) {
  var distDir = path.join(IOWA.distDir, IOWA.appDir);
  del.sync([distDir + '/service-worker.js']);
  var importScripts = ['scripts/shed-scripts.js'];

  generateServiceWorker(distDir, true, importScripts, function(error, serviceWorkerFileContents) {
    if (error) {
      return callback(error);
    }
    fs.writeFile(distDir + '/service-worker.js', serviceWorkerFileContents, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
});

// Compile SASS files.
gulp.task('sass', function() {
  var sassOpts = {
    outputStyle: 'compressed'
  };

  return gulp.src([IOWA.appDir + '/{styles,elements}/**/*.scss'])
    .pipe($.sass(sassOpts))
    .pipe($.changed(IOWA.appDir + '/{styles,elements}', {extension: '.scss'}))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest(IOWA.appDir))
    .pipe($.size({title: 'styles'}));
});

// Optimize Images
gulp.task('images', function() {
  return gulp.src([
      IOWA.appDir + '/images/**/*'
    ])
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir + '/images'))
    .pipe($.size({title: 'images'}));
});

// vulcanize main site elements separately.
gulp.task('vulcanize-elements', ['sass'], function() {
  return gulp.src([
      IOWA.appDir + '/elements/elements.html'
    ])
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true,
      dest: IOWA.appDir + '/elements'
    }))
    .pipe($.crisper({scriptInHead: true}))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir + '/elements/'));
});

// vulcanize embed gadget.
gulp.task('vulcanize-gadget-elements', ['sass'], function() {
  return gulp.src([
      IOWA.appDir + '/elements/embed-elements.html'
    ])
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true,
      dest: IOWA.appDir + '/elements'
    }))
    .pipe($.crisper({scriptInHead: true}))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir + '/elements/'));
});

// vulcanize extended form elements separately.
gulp.task('vulcanize-extended-elements', ['sass'], function() {
  return gulp.src([
      IOWA.appDir + '/elements/io-extended-form.html'
    ])
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true,
      dest: IOWA.appDir + '/elements',
      excludes: [ // These are registered in the main site vulcanized bundle.
        'polymer.html$',
        'core-icon.html$',
        'core-iconset-svg.html$',
        'core-shared-lib.html$',
        'paper-button.html$'
      ]
    }))
    .pipe($.crisper({scriptInHead: true}))
    .pipe(gulp.dest(IOWA.distDir + '/' + IOWA.appDir + '/elements/'));
});

// Copy experiment files.
gulp.task('copy-experiment-to-site', ['build-experiment'], function(cb) {
  gulp.src([
    IOWA.experimentDir + '/public/js/*.*',
    IOWA.experimentDir + '/public/*.mp3',
    IOWA.experimentDir + '/public/*.mp4'
  ], {base: IOWA.experimentDir + '/public/' })
  .pipe(gulp.dest(DIST_EXPERIMENT_DIR))
  .on('end', cb);
});


// -----------------------------------------------------------------------------
// Frontend dev tasks

// JS linting ans style.
gulp.task('js', ['jshint', 'jscs']);

// Build experiment and place inside app.
gulp.task('build-experiment', buildExperiment);

// Lint JavaScript
gulp.task('jshint', function() {
  return gulp.src([IOWA.appDir + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    // .pipe($.jshint.extract()) // Extract JS from .html files
    .pipe($.jshint({esnext: true}))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Check JS style
gulp.task('jscs', function() {
  return gulp.src([IOWA.appDir + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jscs());
});

// Concat scripts for the data-fetching worker.
gulp.task('generate-data-worker-dev', function() {
  return gulp.src(dataWorkerScripts)
    .pipe($.concat('data-worker-scripts.js'))
    .pipe(gulp.dest(IOWA.appDir))
    .pipe($.size({title: 'data-worker-dev'}));
});

// Generate serve-worker.js for local dev env.
gulp.task('generate-service-worker-dev', ['sass'], function(callback) {
  del.sync([IOWA.appDir + '/service-worker.js']);
  var importScripts = glob.sync('scripts/shed/*.js', {cwd: IOWA.appDir});
  importScripts.unshift('scripts/helper/simple-db.js');
  importScripts.unshift('bower_components/shed/shed.js');

  // Run with --fetch-dev to generate a service-worker.js that will handle fetch events.
  // By default, the generated service-worker.js will precache resources, but not actually serve
  // them. This is preferable for dev, since things like live reload will work as expected.
  generateServiceWorker(IOWA.appDir, !!argv['fetch-dev'], importScripts, function(error, serviceWorkerFileContents) {
    if (error) {
      return callback(error);
    }
    fs.writeFile(IOWA.appDir + '/service-worker.js', serviceWorkerFileContents, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
});

// generate pages.js out of templates.
gulp.task('generate-page-metadata', function(done) {
  var pagesjs = fs.openSync(IOWA.appDir + '/scripts/pages.js', 'w');
  var proc = spawn('go', ['run', 'util/gen-pages.go'], {stdio: ['ignore', pagesjs, process.stderr]});
  proc.on('exit', done);
});

// Build experiment and place inside app.
function buildExperiment(cb) {
  var args = [IOWA.urlPrefix + IOWA.experimentUrl];
  var build = spawn('./bin/build', args, {cwd: IOWA.experimentDir, stdio: 'inherit'});
  build.on('close', cb);
}


// -----------------------------------------------------------------------------
// Backend stuff

// Run backend tests.
// To watch for changes and run tests in an infinite loop, add '--watch' arg.
// To test GAE version, add '--gae' arg.
// To run specific tests provide '--test TestMethodPattern'.
gulp.task('backend:test', ['backend:config'], function(done) {
  var opts = {gae: argv.gae, watch: argv.watch, test: argv.test};
  backend.test(opts, done);
});

// Build self-sufficient backend server binary w/o GAE support.
gulp.task('backend:build', backend.build);

// Copy backend files to dist.
gulp.task('backend:dist', function(done) {
  backend.copy(argv.env || 'prod', done);
});

// Create server config with defaults.
gulp.task('backend:config', function() {
  backend.generateServerConfig(IOWA.backendDir, argv.env || 'dev');
});

// Create GAE config files.
gulp.task('backend:gaeconfig', function(done) {
  backend.generateGAEConfig(IOWA.backendDir, done);
});

// decrypt backend/server.config.enc into backend/server.config.
// use --pass cmd line arg to provide a pass phrase.
gulp.task('decrypt', function(done) {
  backend.decrypt(argv.pass, done);
});

// encrypt backend/server.config into backend/server.config.enc.
// use --pass cmd line arg to provide a pass phrase.
gulp.task('encrypt', function(done) {
  backend.encrypt(argv.pass, done);
});

// Start a standalone server (no GAE SDK needed) serving both front-end and backend,
// watch for file changes and live-reload when needed.
// If you don't want file watchers and live-reload, use '--no-watch' option.
// App environment is 'dev' by default. Change with '--env=prod'.
gulp.task('serve', ['backend:build', 'backend:config', 'sass', 'generate-page-metadata', 'generate-data-worker-dev', 'generate-service-worker-dev'], function(done) {
  var opts = {dir: IOWA.backendDir, watch: argv.watch !== false, reload: argv.reload};
  var url = backend.serve(opts, done);
  openUrl(url);
  if (argv.watch) {
    watch();
  }
});

// The same as 'serve' task but using GAE dev appserver.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve:gae', ['backend:config', 'backend:gaeconfig', 'sass', 'generate-page-metadata', 'generate-data-worker-dev', 'generate-service-worker-dev'], function(done) {
  var url = backend.serveGAE({dir: IOWA.backendDir, reload: argv.reload}, done);
  // give GAE server some time to start
  setTimeout(openUrl.bind(null, url, null, null), 1000);
  if (argv.watch !== false) {
    watch();
  }
});

// Serve build with GAE dev appserver. This is how it would look in production.
// There are no file watchers.
gulp.task('serve:dist', ['default'], function(done) {
  var backendDir = path.join(IOWA.distDir, IOWA.backendDir);
  var url = backend.serveGAE({dir: backendDir}, done);
  // give GAE server some time to start
  setTimeout(openUrl.bind(null, url, null, null), 1000);
});


// -----------------------------------------------------------------------------
// Utils

// Watch file changes and reload running server or rebuild stuff.
function watch() {
  createReloadServer();
  gulp.watch([IOWA.appDir + '/**/*.html'], reload);
  gulp.watch([IOWA.appDir + '/{elements,styles}/**/*.{scss,css}'], ['sass', reload]);
  gulp.watch([IOWA.appDir + '/scripts/**/*.js'], ['jshint']);
  gulp.watch([IOWA.appDir + '/images/**/*'], reload);
  gulp.watch([IOWA.appDir + '/bower.json'], ['bower']);
  gulp.watch(dataWorkerScripts, ['generate-data-worker-dev']);
}


// -----------------------------------------------------------------------------
// Other fun stuff

// Usage: gulp screenshots [--compareTo=branchOrCommit] [--pages=page1,page2,...]
//                       [widths=width1,width2,...] [height=height]
// The task performs a `git stash` prior to the checkout and then a `git stash pop` after the
// completion, but on the off chance the task ends unexpectedly, you can manually switch back to
// your current branch and run `git stash pop` to restore.
gulp.task('screenshots', ['backend:build'], function(callback) {
  var seleniumScreenshots = require('./gulp_scripts/screenshots');
  // We don't want the service worker to served cached content when taking screenshots.
  del.sync([IOWA.appDir + '/service-worker.js']);

  var styleWatcher = gulp.watch([IOWA.appDir + '/{elements,styles}/**/*.{scss,css}'], ['sass']);
  var callbackWrapper = function(error) {
    styleWatcher.end();
    callback(error);
  };

  var allPages = glob.sync(IOWA.appDir + '/templates/!(layout_).html').map(function(templateFile) {
    return path.basename(templateFile).replace('.html', '');
  });

  var branchOrCommit = argv.compareTo || 'master';
  var pages = argv.pages ? argv.pages.split(',') : allPages;
  var widths = argv.widths ?
    // widths is coerced into a Number unless there's a comma, and only strings can be split().
    (argv.widths.split ? argv.widths.split(',').map(Number) : [argv.widths]) :
    [400, 900, 1200];
  var height = argv.height || 9999;
  seleniumScreenshots(branchOrCommit, IOWA.appDir, 'http://localhost:9999' + IOWA.urlPrefix + '/',
    pages, widths, height, callbackWrapper);
});

// Generate sitemap.xml. Not currently used as we're generating one dynamically on the backend.
gulp.task('sitemap', function() {
  gulp.src(IOWA.appDir + '/templates/!(layout_|error).html', {read: false})
    .pipe($.rename(function(path) {
      if (path.basename === 'home') {
        path.basename = '/'; // homepage is served from root.
      }
      path.extname = ''; // remove .html from URLs.
    }))
    .pipe($.sitemap({
      siteUrl: IOWA.originProd + IOWA.urlPrefix,
      changefreq: 'weekly',
      spacing: '  ',
      mappings: [{
        pages: [''], // homepage should be more frequent
        changefreq: 'daily'
      }]
    }))
    .pipe(gulp.dest(IOWA.appDir));
});

// Run PageSpeed Insights
// Update `url` below to the public URL for your site
gulp.task('pagespeed', pagespeed.bind(null, {
  // By default, we use the PageSpeed Insights
  // free (no API key) tier. You can use a Google
  // Developer API key if you have one. See
  // http://goo.gl/RkN0vE for info key: 'YOUR_API_KEY'
  url: IOWA.originProd + IOWA.urlPrefix,
  strategy: 'mobile'
}));
