// Use a cache for the Picasa API response for the Google I/O 2014 album.
shed.router.get('/data/feed/api/user/111395306401981598462/albumid/6029456067262589905(.*)', shed.cacheFirst, {origin: /https?:\/\/picasaweb.google.com/});
// Use a cache for the actual image files as well.
shed.router.get('/(.+)', shed.cacheFirst, {origin: /https?:\/\/lh\d*.googleusercontent.com/});
