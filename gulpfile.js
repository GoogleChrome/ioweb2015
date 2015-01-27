/* jshint node: true */

'use strict';

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var pagespeed = require('psi');
var del = require('del');
var i18n_replace = require('./gulp_scripts/i18n_replace');
var generateServiceWorker = require('./gulp_scripts/generate_service_worker');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var opn = require('opn');
var merge = require('merge-stream');
var glob = require('glob');
var sprintf = require("sprintf-js").sprintf;
var webdriver = require('selenium-webdriver');
var BlinkDiff = require('blink-diff');
require('es6-promise').polyfill();

var APP_DIR = 'app';
var BACKEND_DIR = 'backend';
var EXPERIMENT_DIR = 'experiment';
var SCREENSHOTS_DIR = 'screenshots';
var BACKEND_APP_YAML = BACKEND_DIR + '/app.yaml';

var DIST_STATIC_DIR = 'dist';
var DIST_EXPERIMENT_DIR = APP_DIR + '/experiment';

var STATIC_VERSION = 1; // Cache busting static assets.
var VERSION = argv.build || STATIC_VERSION;
var URL_PREFIX = (argv.urlPrefix || '').replace(/\/+$/g, '') || '/io2015';
var EXPERIMENT_STATIC_URL = URL_PREFIX + '/experiment/';

// Clears files cached by gulp-cache (e.g. anything using $.cache).
gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', ['clear'], function(cleanCallback) {
  del([DIST_STATIC_DIR, DIST_EXPERIMENT_DIR], cleanCallback);
});

gulp.task('sass', function() {
  return gulp.src([APP_DIR + '/{styles,elements}/**/*.scss'])
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

// vulcanize main site elements separately.
gulp.task('vulcanize-elements', ['sass'], function() {
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
gulp.task('copy-assets', function() {
  var assets = $.useref.assets();

  var templateStream = gulp.src([APP_DIR + '/templates/*.html'], {base: './'})
    .pipe(assets)
    .pipe(assets.restore())
    .pipe($.useref());

  var otherAssetStream = gulp.src([
    APP_DIR + '/*.{html,txt,ico}',
    APP_DIR + '/manifest.json',
    APP_DIR + '/clear_cache.html',
    APP_DIR + '/styles/**.css',
    APP_DIR + '/styles/pages/upgrade.css',
    APP_DIR + '/elements/**/images/*',
    APP_DIR + '/elements/webgl-globe/shaders/*.{frag,vert}',
    APP_DIR + '/elements/webgl-globe/textures/*.{jpg,png}',
    APP_DIR + '/bower_components/webcomponentsjs/webcomponents.min.js',
    APP_DIR + '/bower_components/es6-promise-2.0.1.min/index.js',
    DIST_EXPERIMENT_DIR + '/**/*'
  ], {base: './'});

  return merge(templateStream, otherAssetStream)
    .pipe(gulp.dest(DIST_STATIC_DIR))
    .pipe($.size({title: 'copy-assets'}));
});

// Copy backend files.
gulp.task('copy-backend', function(cb) {
  gulp.src([
    BACKEND_DIR + '/**/*.go',
    BACKEND_DIR + '/*.yaml',
    BACKEND_DIR + '/*.pem',
    BACKEND_DIR + '/whitelist'
  ], {base: './'})
  // server_gae.go
  .pipe($.replace(/(httpPrefix = ")[^"]*/g, '$1' + URL_PREFIX))
  .pipe(gulp.dest(DIST_STATIC_DIR))
  .on('end', function() {
    var destBackend = [DIST_STATIC_DIR, BACKEND_DIR].join('/');
    // ../app <= dist/backend/app
    fs.symlinkSync('../' + APP_DIR, destBackend + '/' + APP_DIR);
    // create dist/backend/app.yaml from backend/app.yaml.template
    generateAppYaml(destBackend, URL_PREFIX, cb);
  });
});

// Lint JavaScript
gulp.task('jshint', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Check JS style
gulp.task('jscs', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jscs());
});

// Crush JS
gulp.task('concat-and-uglify-js', ['js'], function() {
  // The ordering of the scripts in the gulp.src() array matter!
  // This order needs to match the order in templates/layout_full.html
  var siteScripts = [
    'main.js',
    'helper/util.js',
    'helper/page-animation.js',
    'helper/elements.js',
    'helper/history.js',
    'helper/router.js',
    'helper/request.js',
    'bootstrap.js'
  ].map(function(script) {
    return APP_DIR + '/scripts/' + script;
  });

  var siteScriptStream = gulp.src(siteScripts)
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('site-scripts.js'));

  // analytics.js is loaded separately and shouldn't be concatenated.
  var analyticsScriptStream = gulp.src([APP_DIR + '/scripts/analytics.js']);

  var serviceWorkerScriptStream = gulp.src([
    APP_DIR + '/bower_components/shed/dist/shed.js',
    APP_DIR + '/scripts/shed/*.js'
  ])
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('shed-scripts.js'));

  return merge(siteScriptStream, analyticsScriptStream).add(serviceWorkerScriptStream)
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/scripts'))
    .pipe($.size({title: 'concat-and-uglify-js'}));
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

// Start a standalone server (no GAE SDK needed) serving both front-end and backend,
// watch for file changes and live-reload when needed.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve', ['backend', 'generate-service-worker-dev'], function() {
  var noWatch = argv.watch === false;
  var serverAddr = 'localhost:' + (noWatch ? '3000' : '8080');
  var startArgs = ['-d', APP_DIR, '-listen', serverAddr, '-prefix', URL_PREFIX];
  var start = spawn.bind(null, 'bin/server', startArgs, {cwd: BACKEND_DIR, stdio: 'inherit'});

  if (noWatch) {
    start();
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    opn(serverAddr);
    return;
  }

  var backend;
  var run = function() {
    backend = start();
    backend.on('close', run);
  };
  var restart = function() {
    console.log('Restarting backend');
    backend.kill();
  };

  browserSync.emitter.on('service:exit', function() {
    backend.kill('SIGKILL');
  });

  run();
  browserSync({notify: false, proxy: serverAddr});

  watch();
  gulp.watch([BACKEND_DIR + '/**/*.go'], function() {
    console.log('Building backend');
    buildBackend(restart);
  });
});

// The same as 'serve' task but using GAE dev appserver.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve:gae', ['generate-service-worker-dev'], function(callback) {
  var appEnv = process.env.APP_ENV || 'dev';
  var watchFiles = argv.watch !== false;
  var run = startGaeBackend.bind(null, BACKEND_DIR, appEnv, watchFiles, callback);
  generateAppYaml(BACKEND_DIR, URL_PREFIX, run);
});

// Serve build with GAE dev appserver. This is how it would look in production.
// There are no file watchers.
gulp.task('serve:dist', ['default'], function(callback) {
  var appEnv = process.env.APP_ENV || 'prod';
  var backendDir = DIST_STATIC_DIR + '/' + BACKEND_DIR;
  startGaeBackend(backendDir, appEnv, false, callback);
});

gulp.task('vulcanize', ['vulcanize-elements']);

gulp.task('js', ['jshint', 'jscs']);

// Build experiment and place inside app.
gulp.task('build-experiment', buildExperiment);

// Copy experiment files.
gulp.task('copy-experiment-to-site', ['build-experiment'], function(cb) {
  gulp.src([
    EXPERIMENT_DIR + '/public/js/*.*',
    EXPERIMENT_DIR + '/public/cataudiosprite.mp3',
    EXPERIMENT_DIR + '/public/normalaudiosprite.mp3',
  ], {base: EXPERIMENT_DIR + '/public/' })
  .pipe(gulp.dest(DIST_EXPERIMENT_DIR))
  .on('end', cb);
});

// Build self-sufficient backend server binary w/o GAE support.
gulp.task('backend', buildBackend);

// Backend TDD: watch for changes and run tests in an infinite loop.
gulp.task('backend:test', function(cb) {
  var watchOpt = process.argv.indexOf('--watch') >= 0;
  var t = testBackend();
  if (watchOpt) {
    gulp.watch([BACKEND_DIR + '/**/*.go'], testBackend);
    gulp.watch([APP_DIR + '/templates/*'], testBackend);
    cb();
  } else {
    t.on('close', cb);
  }
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('copy-experiment-to-site', 'sass', 'vulcanize',
              ['concat-and-uglify-js', 'images', 'copy-assets', 'copy-backend'],
              'generate-service-worker-dist', cb);
});

gulp.task('bower', function(cb) {
  var proc = spawn('../node_modules/bower/bin/bower', ['install'], {cwd: APP_DIR, stdio: 'inherit'});
  proc.on('close', cb);
});

gulp.task('addgithooks', function() {
  return gulp.src('.git-hooks/*')
    .pipe($.chmod(755))
    .pipe(gulp.dest('.git/hooks'));
});

gulp.task('godeps', function() {
  spawn('go', ['get', '-d', './' + BACKEND_DIR + '/...'], {stdio: 'inherit'});
});

gulp.task('decrypt', function() {
  var key = BACKEND_DIR + '/service-account.pem';
  var args = ['aes-256-cbc', '-d', '-in', key + '.enc', '-out', key];
  spawn('openssl', args, {stdio: 'inherit'});
});

gulp.task('setup', function(cb) {
  runSequence('bower', 'godeps', 'addgithooks', 'default', cb);
});

// -----------------------------------------------------------------------------

// Watch file changes and reload running server
// or rebuild stuff.
function watch() {
  gulp.watch([APP_DIR + '/**/*.html'], reload);
  gulp.watch([APP_DIR + '/{elements,styles}/**/*.{scss,css}'], ['sass', reload]);
  gulp.watch([APP_DIR + '/scripts/**/*.js'], ['jshint']);
  gulp.watch([APP_DIR + '/images/**/*'], reload);
  gulp.watch([APP_DIR + '/bower.json'], ['bower']);
}

// Build experiment and place inside app.
function buildExperiment(cb) {
  var args = [EXPERIMENT_STATIC_URL];
  var build = spawn('./bin/build', args, {cwd: EXPERIMENT_DIR, stdio: 'inherit'});
  build.on('close', cb);
}

// Build standalone backend server
function buildBackend(cb) {
  var args = ['build', '-o', 'bin/server'];
  var build = spawn('go', args, {cwd: BACKEND_DIR, stdio: 'inherit'});
  build.on('close', cb);
}

// Run backend tests
function testBackend() {
  var args = ['test', '-v'];
  return spawn('go', args, {cwd: BACKEND_DIR, stdio: 'inherit'});
}

// Start GAE-based backend server with backendDir as the app root directory.
// Also, enable live-reload if watchFiles === true.
// appEnv is either 'stage', 'prod' or anything else. The latter defaults to
// dev env.
function startGaeBackend(backendDir, appEnv, watchFiles, callback) {
  var restoreAppYaml = changeAppYamlVersion('v-' + appEnv, backendDir + '/app.yaml');
  var onExit = function() {
    restoreAppYaml();
    callback();
  };

  var serverAddr = 'localhost:' + (watchFiles ? '8080' : '3000');
  var args = ['preview', 'app', 'run', backendDir, '--host', serverAddr];

  var backend = spawn('gcloud', args, {stdio: 'inherit'});
  if (!watchFiles) {
    process.on('exit', onExit);
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    // give GAE server some time to start
    setTimeout(opn.bind(null, serverAddr, null, null), 2000);
    return;
  }

  browserSync.emitter.on('service:exit', onExit);
  // give GAE server some time to start
  setTimeout(browserSync.bind(null, {notify: false, proxy: serverAddr}), 2000);
  watch();
}

// Create app.yaml from a template in dest directory.
// prefix is the app root URL prefix. Defaults to '/io2015'.
function generateAppYaml(dest, prefix, callback) {
  gulp.src(BACKEND_DIR + '/app.yaml.template', {base: BACKEND_DIR})
    .pipe($.replace(/\$PREFIX\$/g, prefix))
    .pipe($.rename('app.yaml'))
    .pipe(gulp.dest(dest))
    .on('end', callback);
}

// Replace current app.yaml with the modified 'version' property.
// appYamlPath arg is optional and defaults to BACKEND_APP_YAML.
// Returns a function that restores original app.yaml content.
function changeAppYamlVersion(version, appYamlPath) {
  appYamlPath = appYamlPath || BACKEND_APP_YAML;
  var appYaml = fs.readFileSync(appYamlPath);
  fs.writeFileSync(appYamlPath, 'version: ' + version + '\n' + appYaml);
  return fs.writeFileSync.bind(fs, appYamlPath, appYaml, null);
}

gulp.task('generate-service-worker-dev', ['sass'], function(callback) {
  del([APP_DIR + '/service-worker.js']);
  var importScripts = glob.sync('scripts/shed/*.js', {cwd: APP_DIR});
  importScripts.unshift('bower_components/shed/dist/shed.js');

  // Run with --fetch-dev to generate a service-worker.js that will handle fetch events.
  // By default, the generated service-worker.js will precache resources, but not actually serve
  // them. This is preferable for dev, since things like live reload will work as expected.
  generateServiceWorker(APP_DIR, !!argv['fetch-dev'], importScripts, function(error, serviceWorkerFileContents) {
    if (error) {
      return callback(error);
    }
    fs.writeFile(APP_DIR + '/service-worker.js', serviceWorkerFileContents, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
});

gulp.task('generate-service-worker-dist', function(callback) {
  var distDir = DIST_STATIC_DIR + '/' + APP_DIR;
  del([distDir + '/service-worker.js']);
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

gulp.task('selenium-install', function(callback) {
  var seleniumPath = path.join('node_modules', 'selenium-standalone', '.selenium', 'chromedriver');
  fs.exists(seleniumPath, function(exists) {
    if (exists) {
      $.util.log(seleniumPath, 'already exists.');
      callback();
    } else {
      require('selenium-standalone').install({
        logger: $.util.log
      }, callback);
    }
  });
});

gulp.task('selenium', ['backend', 'selenium-install'], function(callback) {
  var hostAndPort = 'localhost:9999';
  var startArgs = ['-d', APP_DIR, '-listen', hostAndPort];
  var webServer = spawn('bin/server', startArgs, {cwd: BACKEND_DIR, stdio: 'ignore'});

  var chromeWebDriver = require('selenium-webdriver/chrome');
  var chromeDriverBinary = glob.sync('node_modules/selenium-standalone/.selenium/chromedriver/*chromedriver*')[0];
  var driverService = new chromeWebDriver.ServiceBuilder(chromeDriverBinary).build();
  var driver = new chromeWebDriver.Driver(null, driverService);

  var killServers = function() {
    webServer.kill();
    driver.quit();
    callback();
  };

  var pages = ['about', 'home', 'offsite', 'onsite', 'registration', 'schedule'];
  var widths = [400, 900, 1200];
  var height = 9999;

  $.git.revParse({args: '--abbrev-ref HEAD'}, function(error, branch) {
    var directory = path.join(SCREENSHOTS_DIR, branch);
    fs.mkdirSync(directory);
    var takeScreenshotPromises = pages.map(function(page) {
      return takeScreenshot(driver, page, widths, height, directory);
    });

    webdriver.promise.all(takeScreenshotPromises).then(
      killServers,
      function(e) {
        $.util.log(e);
        killServers();
      }
    );
  });
});

function saveScreenshot(screenshotPath, base64Data) {
  var defered = webdriver.promise.defer();

  fs.writeFile(screenshotPath, base64Data, 'base64', function(error) {
    if (error) {
      $.util.log('Unable to save screenshot:', error);
      defered.reject(error);
    } else {
      $.util.log('Saved screenshot to', screenshotPath);
      defered.fulfill();
    }
  });

  return defered.promise;
}

function takeScreenshot(driver, page, widths, height, directory) {
  return driver.get('http://localhost:9999/io2015/' + page).then(function() {
    return driver.manage().timeouts().setScriptTimeout(30000);
  }).then(function() {
    var script = 'document.addEventListener("page-transition-done", arguments[arguments.length - 1]);';
    return driver.executeAsyncScript(script);
  }).then(function() {
    var saveScreenshotPromises = widths.map(function(width) {
      return driver.manage().window().setSize(width, height).then(function() {
        return driver.sleep(750);
      }).then(function() {
        return driver.takeScreenshot();
      }).then(function(data) {
        var screenshotPath = sprintf('%s/%s-%dx%d.png', directory, page, width, height);
        var base64Data = data.replace(/^data:image\/png;base64,/, '');
        return saveScreenshot(screenshotPath, base64Data);
      });
    });
    return webdriver.promise.all(saveScreenshotPromises);
  });
}

gulp.task('checkout-master', function(callback) {
  $.git.checkout('master', function(error) {
    callback(error);
  });
});

var currentBranch;
gulp.task('restore-current-branch', function(callback) {
  $.git.checkout(currentBranch, function(error) {
    callback(error);
  });
});

gulp.task('compare-screenshots', function(callback) {
  del.sync(SCREENSHOTS_DIR);
  fs.mkdirSync(SCREENSHOTS_DIR);

  $.git.revParse({args: '--abbrev-ref HEAD'}, function(error, branch) {
    if (error) {
      callback(error);
    } else {
      currentBranch = branch;
      runSequence('checkout-master', 'selenium', 'restore-current-branch', 'selenium', callback);
    }
  });
});

gulp.task('create-image-diffs', function(callback) {
  var diffsDirectory = path.join(SCREENSHOTS_DIR, 'diffs');
  del.sync(diffsDirectory);
  fs.mkdirSync(diffsDirectory);

  var filePaths = glob.sync(SCREENSHOTS_DIR + '/**/*.png');
  var fileNameToPaths = {};
  filePaths.forEach(function(filePath) {
    var fileName = path.basename(filePath);
    if (fileName in fileNameToPaths) {
      fileNameToPaths[fileName].push(filePath);
    } else {
      fileNameToPaths[fileName] = [filePath];
    }
  });

  var diffPromises = Object.keys(fileNameToPaths).map(function(fileName) {
    return new Promise(function(resolve, reject) {
      var paths = fileNameToPaths[fileName];
      if (paths.length == 2) {
        var diff = new BlinkDiff({
          imageAPath: paths[0],
          imageBPath: paths[1],
          imageOutputPath: path.join(diffsDirectory, path.basename(paths[0])),
          imageOutputLimit: BlinkDiff.OUTPUT_DIFFERENT
        });
        diff.run(function(error) {
          if (error) {
            $.util.log('Error while checking', fileName, error);
            reject(error);
          } else {
            $.util.log('Completed checking', fileName);
            resolve();
          }
        });
      }
    });
  });

  Promise.all(diffPromises).then(
    function() {
      var diffFiles = glob.sync(diffsDirectory + '/*.png');
      if (diffFiles) {
        $.util.log('Differences were found in:', diffFiles);
      } else {
        $.util.log('No differences were found.');
      }
      callback();
    },
    callback
  );
});
