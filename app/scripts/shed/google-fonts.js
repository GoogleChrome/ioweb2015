shed.router.get('/(.+)', shed.cacheFirst, {origin: /https?:\/\/fonts.+/});
