/* jshint node: true */

'use strict';

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var pagespeed = require('psi');
var del = require('del');
// var i18n_replace = require('./gulp_scripts/i18n_replace');
var generateServiceWorker = require('./gulp_scripts/generate_service_worker');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync');
var opn = require('opn');
var merge = require('merge-stream');
var glob = require('glob');
var request = require('request-promise');

var APP_DIR = 'app';
var BACKEND_DIR = 'backend';
var EXPERIMENT_DIR = 'experiment';
var BACKEND_APP_YAML = BACKEND_DIR + '/app.yaml';

var DIST_STATIC_DIR = 'dist';
var DIST_EXPERIMENT_DIR = APP_DIR + '/experiment';

var STATIC_VERSION = 1; // Cache busting static assets.
var VERSION = argv.build || STATIC_VERSION;
var PROD_ORIGIN = 'https://events.google.com';
var URL_PREFIX = (argv.urlPrefix || '').replace(/\/+$/g, '') || '/io2015';
var EXPERIMENT_STATIC_URL = URL_PREFIX + '/experiment/';

// reload is a noop unless '--reload' cmd line arg is specified.
var reload = function() {
  return new require('stream').PassThrough({objectMode: true});
};

// openUrl is a noop unless '--open' cmd line arg is specified.
var openUrl = function() {};

// Scripts required for the data-fetching worker.
var dataWorkerScripts = [
  APP_DIR + '/bower_components/es6-promise-2.0.1.min/index.js',
  APP_DIR + '/scripts/helper/request.js',
  APP_DIR + '/scripts/helper/schedule.js',
  APP_DIR + '/data-worker.js'
];

if (argv.reload) {
  reload = browserSync.reload;
  openUrl = opn;
}

// Clears files cached by gulp-cache (e.g. anything using $.cache).
gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', ['clear'], function(cleanCallback) {
  del([
    DIST_STATIC_DIR,
    DIST_EXPERIMENT_DIR,
    APP_DIR + '/data-worker-scripts.js'
  ], cleanCallback);
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
    ])
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: APP_DIR + '/elements'
    }))
    // .pipe(i18n_replace({
    //   strict: !!argv.strict,
    //   path: '_messages',
    // }))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/elements/'));
});

// vulcanize embed gadget.
gulp.task('vulcanize-gadget-elements', ['sass'], function() {
  return gulp.src([
      APP_DIR + '/elements/embed-elements.html'
    ])
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: APP_DIR + '/elements'
    }))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/elements/'));
});

// vulcanize extended form elements separately.
gulp.task('vulcanize-extended-elements', ['sass'], function() {
  return gulp.src([
      APP_DIR + '/elements/io-extended-form.html'
    ])
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: APP_DIR + '/elements',
      excludes: {
        imports: [ // These are registered in the main site vulcanized bundle.
          'polymer.html$',
          'core-icon.html$',
          'core-iconset-svg.html$',
          'core-shared-lib.html$',
          'paper-button.html$'
        ]
      }
    }))
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
  var templates = [APP_DIR + '/templates/**/*.html'];
  if (argv.env == 'prod') {
    templates.push('!**/templates/debug/**');
  }

  var templateStream = gulp.src(templates, {base: './'})
    .pipe(assets)
    .pipe(assets.restore())
    .pipe($.useref());

  var otherAssetStream = gulp.src([
    APP_DIR + '/*.{html,txt,ico}',
    APP_DIR + '/manifest.json',
    APP_DIR + '/clear_cache.html',
    APP_DIR + '/embed.html',
    APP_DIR + '/sitemap.xml',
    APP_DIR + '/styles/**.css',
    APP_DIR + '/styles/pages/upgrade.css',
    APP_DIR + '/styles/pages/permissions.css',
    APP_DIR + '/styles/pages/error.css',
    APP_DIR + '/elements/**/images/*',
    APP_DIR + '/elements/webgl-globe/shaders/*.{frag,vert}',
    APP_DIR + '/elements/webgl-globe/textures/*.{jpg,png}',
    APP_DIR + '/bower_components/webcomponentsjs/webcomponents.min.js',
    APP_DIR + '/bower_components/es6-promise-2.0.1.min/index.js',
    APP_DIR + '/bower_components/elevator/demo/music/*',
    DIST_EXPERIMENT_DIR + '/**/*'
  ], {base: './'});

  return merge(templateStream, otherAssetStream)
    .pipe(gulp.dest(DIST_STATIC_DIR))
    .pipe($.size({title: 'copy-assets'}));
});

// Copy backend files.
gulp.task('copy-backend', function(done) {
  gulp.src([
    BACKEND_DIR + '/**/*.go',
    BACKEND_DIR + '/*.yaml',
    BACKEND_DIR + '/*.config'
  ], {base: './'})
  .pipe(gulp.dest(DIST_STATIC_DIR))
  .on('end', function() {
    var destBackend = [DIST_STATIC_DIR, BACKEND_DIR].join('/');
    // ../app <= dist/backend/app
    fs.symlinkSync('../' + APP_DIR, destBackend + '/' + APP_DIR);
    // create server config for the right env
    generateServerConfig(destBackend, URL_PREFIX, argv.env || 'prod');
    // create GAE config from backend/app.yaml.template
    generateGaeConfig(destBackend, URL_PREFIX, done);
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
gulp.task('concat-and-uglify-js', ['js', 'generate-page-metadata'], function() {
  // The ordering of the scripts in the gulp.src() array matter!
  // This order needs to match the order in templates/layout_full.html
  var siteScripts = [
    'main.js',
    'pages.js',
    '../bower_components/moment/moment.js',
    '../bower_components/moment-timezone/builds/moment-timezone-with-data.min.js',
    'helper/util.js',
    '../bower_components/es6-promise-2.0.1.min/index.js',
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
    return APP_DIR + '/scripts/' + script;
  });

  var siteScriptStream = gulp.src(siteScripts)
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('site-scripts.js'));

  // analytics.js is loaded separately and shouldn't be concatenated.
  var analyticsScriptStream = gulp.src([APP_DIR + '/scripts/analytics.js']);

  var serviceWorkerScriptStream = gulp.src([
    APP_DIR + '/bower_components/shed/shed.js',
    APP_DIR + '/scripts/helper/simple-db.js',
    APP_DIR + '/scripts/shed/*.js'
  ])
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('shed-scripts.js'));

  return merge(siteScriptStream, analyticsScriptStream).add(serviceWorkerScriptStream)
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/scripts'))
    .pipe($.size({title: 'concat-and-uglify-js'}));
});

// Concat scripts for the data-fetching worker.
gulp.task('generate-data-worker-dev', function() {
  return gulp.src(dataWorkerScripts)
    .pipe($.concat('data-worker-scripts.js'))
    .pipe(gulp.dest(APP_DIR))
    .pipe($.size({title: 'data-worker-dev'}));
});

// Concat and crush scripts for the data-fetching worker for dist.
gulp.task('generate-data-worker-dist', function() {
  return gulp.src(dataWorkerScripts)
    .pipe($.concat('data-worker-scripts.js'))
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR))
    .pipe($.size({title: 'data-worker-dist'}));
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
// App environment is 'dev' by default. Change with '--env=prod'.
gulp.task('serve', ['backend', 'backend:config', 'generate-page-metadata', 'generate-data-worker-dev', 'generate-service-worker-dev'], function() {
  var noWatch = argv.watch === false;
  var serverAddr = 'localhost:' + (noWatch ? '3000' : '8080');
  var start = spawn.bind(null, 'bin/server',
    ['-addr', serverAddr],
    {cwd: BACKEND_DIR, stdio: 'inherit'}
  );

  if (noWatch) {
    start();
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    openUrl(serverAddr + URL_PREFIX);
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
  browserSync({notify: false, proxy: serverAddr, startPath: URL_PREFIX, open: argv.open});

  watch();
  gulp.watch([BACKEND_DIR + '/**/*.go'], function() {
    console.log('Building backend');
    buildBackend(restart);
  });
});

// The same as 'serve' task but using GAE dev appserver.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve:gae', ['backend:config', 'generate-page-metadata', 'generate-data-worker-dev', 'generate-service-worker-dev'], function(callback) {
  var watchFiles = argv.watch !== false;
  generateGaeConfig(BACKEND_DIR, URL_PREFIX, function() {
    startGaeBackend(BACKEND_DIR, watchFiles, callback);
  });
});

// Serve build with GAE dev appserver. This is how it would look in production.
// There are no file watchers.
gulp.task('serve:dist', ['default'], function(callback) {
  var backendDir = DIST_STATIC_DIR + '/' + BACKEND_DIR;
  startGaeBackend(backendDir, false, callback);
});

gulp.task('vulcanize', [
  'vulcanize-elements',
  'vulcanize-extended-elements',
  'vulcanize-gadget-elements']
);

gulp.task('js', ['jshint', 'jscs']);

// Build experiment and place inside app.
gulp.task('build-experiment', buildExperiment);

// Copy experiment files.
gulp.task('copy-experiment-to-site', ['build-experiment'], function(cb) {
  gulp.src([
    EXPERIMENT_DIR + '/public/js/*.*',
    EXPERIMENT_DIR + '/public/*.mp3',
    EXPERIMENT_DIR + '/public/*.mp4'
  ], {base: EXPERIMENT_DIR + '/public/' })
  .pipe(gulp.dest(DIST_EXPERIMENT_DIR))
  .on('end', cb);
});

// Build self-sufficient backend server binary w/o GAE support.
gulp.task('backend', buildBackend);

// Create server config with defaults.
gulp.task('backend:config', function() {
  generateServerConfig();
});

// Run backend tests.
// To watch for changes and run tests in an infinite loop, add '--watch' arg.
// To test GAE version, add '--gae' arg.
gulp.task('backend:test', ['backend:config'], function(cb) {
  var start = function(cmd) {
    var runTests = testBackend.bind(null, cmd);
    var proc = runTests();
    if (argv.watch) {
      gulp.watch([BACKEND_DIR + '/**/*.go'], runTests);
      gulp.watch([APP_DIR + '/templates/*'], runTests);
      cb();
    } else {
      proc.on('close', cb);
    }
  };

  if (argv.gae) {
    gaeSdkDir(function(dir) {
      start(dir + '/goapp');
    });
  } else {
    start('go');
  }
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('copy-experiment-to-site', 'sass', 'vulcanize',
              ['concat-and-uglify-js', 'images', 'copy-assets', 'copy-backend'],
              'generate-data-worker-dist', 'generate-service-worker-dist',
              'sitemap', cb);
});

gulp.task('bower', function(cb) {
  var proc = spawn('../node_modules/bower/bin/bower', ['install'], {cwd: APP_DIR, stdio: 'inherit'});
  proc.on('close', cb);
});

gulp.task('addgithooks', function() {
  return gulp.src('util/pre-commit')
    .pipe($.chmod(755))
    .pipe(gulp.dest('.git/hooks'));
});

gulp.task('godeps', function() {
  // additional argument is required because it is imported in files
  // hidden by +appengine build tag and not visible to the standard "go get" command.
  var args = ['get', '-d', './' + BACKEND_DIR + '/...', 'google.golang.org/appengine'];
  spawn('go', args, {stdio: 'inherit'});
});

// decrypt backend/server.config.enc into backend/server.config.
// use --pass cmd line arg to provide a pass phrase.
gulp.task('decrypt', function(done) {
  var tarFile = BACKEND_DIR + '/config.tar';
  var args = ['aes-256-cbc', '-d', '-in', tarFile + '.enc', '-out', tarFile];
  if (argv.pass) {
    args.push('-pass', 'pass:' + argv.pass);
  }
  spawn('openssl', args, {stdio: 'inherit'}).on('exit', function(code) {
    if (code !== 0) {
      done(code);
      return;
    }
    spawn('tar', ['-x', '-f', tarFile, '-C', BACKEND_DIR], {stdio: 'inherit'}).
    on('exit', fs.unlink.bind(fs, tarFile, done));
  });
});

// encrypt backend/server.config into backend/server.config.enc.
// use --pass cmd line arg to provide a pass phrase.
gulp.task('encrypt', function(done) {
  var tarFile = BACKEND_DIR + '/config.tar';
  var tarArgs = ['-c', '-f', tarFile, '-C', BACKEND_DIR,
    'server.config.dev',
    'server.config.stage',
    'server.config.prod'
  ];

  spawn('tar', tarArgs, {stdio: 'inherit'}).on('exit', function(code) {
    if (code !== 0) {
      done(code);
      return;
    }
    var args = ['aes-256-cbc', '-in', tarFile, '-out', tarFile + '.enc'];
    if (argv.pass) {
      args.push('-pass', 'pass:' + argv.pass);
    }
    spawn('openssl', args, {stdio: 'inherit'}).
    on('exit', fs.unlink.bind(fs, tarFile, done));
  });
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
  gulp.watch(dataWorkerScripts, ['generate-data-worker-dev']);
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

// Run backend tests using commmand cmd.
// cmd is usually either 'go' or 'goapp'.
function testBackend(cmd) {
  return spawn(cmd, ['test'], {cwd: BACKEND_DIR, stdio: 'inherit'});
}

// Find GAE SDK root dir
function gaeSdkDir(callback) {
  var out = '';
  var proc = spawn('gcloud', ['info', '--format' ,'json'], {
    timeout: 3,
    stdio: [process.stdin, 'pipe', process.stderr]
  });

  proc.stdout.on('data', function(chunk) {
    out += chunk;
  });

  proc.stdout.on('end', function() {
    var info = JSON.parse(out);
    callback(info.config.paths.sdk_root + '/platform/google_appengine');
  });
}

// Start GAE-based backend server with backendDir as the app root directory.
// Also, enable live-reload if watchFiles === true.
// appEnv is either 'stage', 'prod' or anything else. The latter defaults to
// dev env.
function startGaeBackend(backendDir, watchFiles, callback) {
  var serverAddr = 'localhost:' + (watchFiles ? '8080' : '3000');
  var args = [
    'preview', 'app', 'run', backendDir,
    '--host', serverAddr,
    '--datastore-path', BACKEND_DIR + '/.gae_datastore'
  ];

  var backend = spawn('gcloud', args, {stdio: 'inherit'});
  if (!watchFiles) {
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    // give GAE server some time to start
    setTimeout(openUrl.bind(null, serverAddr + URL_PREFIX, null, null), 2000);
    return;
  }

  // give GAE server some time to start
  setTimeout(browserSync.bind(null, {
    notify: false,
    proxy: serverAddr,
    startPath: URL_PREFIX,
    open: argv.open
  }), 2000);
  watch();
}

// Create app.yaml from a template in dest directory.
// prefix is the app root URL prefix. Defaults to '/io2015'.
function generateGaeConfig(dest, prefix, callback) {
  var files = [
    BACKEND_DIR + '/app.yaml.template',
    BACKEND_DIR + '/cron.yaml.template'
  ];
  gulp.src(files, {base: BACKEND_DIR})
    .pipe($.replace(/\$PREFIX\$/g, prefix))
    .pipe($.rename({extname: ''}))
    .pipe(gulp.dest(dest))
    .on('end', callback);
}

// Create server config, needed to start the server.
// dest and prefix default to BACKEND_DIR and URL_PREFIX respectively.
// env defaults to '--env' cmd line arg or 'dev' if none given.
function generateServerConfig(dest, prefix, env) {
  dest = (dest || BACKEND_DIR) + '/server.config';
  prefix = prefix || URL_PREFIX;
  env = env || argv.env || 'dev';

  var files = [
    BACKEND_DIR + '/server.config',
    BACKEND_DIR + '/server.config.dev',
    BACKEND_DIR + '/server.config.template'
  ];
  var src;
  for (var i = 0, f; f = files[i]; i++) {
    if (fs.existsSync(f)) {
      src = f;
      break;
    }
  }
  if (!src) {
    throw new Error('generateServerConfig: unable to find config template');
  }

  var cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
  cfg.env = env;
  cfg.prefix = prefix;
  fs.writeFileSync(dest, JSON.stringify(cfg, null, 2));
}

// generate pages.js out of templates.
gulp.task('generate-page-metadata', function(done) {
  var pagesjs = fs.openSync(APP_DIR + '/scripts/pages.js', 'w');
  var proc = spawn('go', ['run', 'util/gen-pages.go'], {stdio: ['ignore', pagesjs, process.stderr]});
  proc.on('exit', done);
});

gulp.task('generate-service-worker-dev', ['sass'], function(callback) {
  del.sync([APP_DIR + '/service-worker.js']);
  var importScripts = glob.sync('scripts/shed/*.js', {cwd: APP_DIR});
  importScripts.unshift('scripts/helper/simple-db.js');
  importScripts.unshift('bower_components/shed/shed.js');

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

// Usage: gulp screenshots [--compareTo=branchOrCommit] [--pages=page1,page2,...]
//                       [widths=width1,width2,...] [height=height]
// The task performs a `git stash` prior to the checkout and then a `git stash pop` after the
// completion, but on the off chance the task ends unexpectedly, you can manually switch back to
// your current branch and run `git stash pop` to restore.
gulp.task('screenshots', ['backend'], function(callback) {
  var seleniumScreenshots = require('./gulp_scripts/selenium-screenshots');
  // We don't want the service worker to served cached content when taking screenshots.
  del.sync(APP_DIR + '/service-worker.js');

  var styleWatcher = gulp.watch([APP_DIR + '/{elements,styles}/**/*.{scss,css}'], ['sass']);
  var callbackWrapper = function(error) {
    styleWatcher.end();
    callback(error);
  };

  var allPages = glob.sync(APP_DIR + '/templates/!(layout_).html').map(function(templateFile) {
    return path.basename(templateFile).replace('.html', '');
  });

  var branchOrCommit = argv.compareTo || 'master';
  var pages = argv.pages ? argv.pages.split(',') : allPages;
  var widths = argv.widths ?
    // widths is coerced into a Number unless there's a comma, and only strings can be split().
    (argv.widths.split ? argv.widths.split(',').map(Number) : [argv.widths]) :
    [400, 900, 1200];
  var height = argv.height || 9999;
  seleniumScreenshots(branchOrCommit, APP_DIR, 'http://localhost:9999' + URL_PREFIX + '/',
    pages, widths, height, callbackWrapper);
});

gulp.task('sitemap', function() {

  var sessionDeepLinks = [];
  var siteUrl = PROD_ORIGIN + URL_PREFIX;

  // Fetch the latest schedule information to add the deep schedule links to
  // the sitemap.
  request(siteUrl + '/api/v1/schedule').then(function(body) {
    var sessions = JSON.parse(body).sessions || [];
    if (sessions.length) {
      sessionDeepLinks = sessions.map(function(s) {
        return siteUrl + '/schedule?sid=' + s.id;
      });
    }
  }).finally(function() {
    gulp.src([APP_DIR + '/templates/!(layout_|error).html'], {read: false})
      .pipe($.rename(function(path) {
        if (path.basename === 'home') {
          path.basename = '/'; // homepage is served from root.
        }
        path.extname = ''; // remove .html from URLs.
      }))
      .pipe($.sitemap({
        siteUrl: siteUrl,
        changefreq: 'weekly',
        spacing: '  ',
        mappings: [{
          pages: [''], // homepage should be more frequent
          changefreq: 'daily'
        }]
      }))
      .pipe($.insert.transform(function(contents) {
        var entries = '';
        var now = (new Date()).toISOString();
        sessionDeepLinks.forEach(function(url) {
          entries += '\
  <url>\n\
    <loc>' + url + '</loc>\n\
    <lastmod>' + now + '</lastmod>\n\
    <changefreq>daily</changefreq>\n\
  </url>\n';
        });

        var END_TOKEN = '</urlset>';

        return contents.replace(END_TOKEN, '') + entries  + END_TOKEN;
      }))
      .pipe(gulp.dest(APP_DIR));
  });

});
