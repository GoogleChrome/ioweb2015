// Not currently used. Meant to be called from the SW's push handler, to ensure that the latest
// session information is loaded into IDB.
self.updateFirebaseCache = function(dataset) {
  return self.IOWA.Firebase.refUrlPromise(dataset).then(function(url) {
    if (url) {
      var jsonUrl = url + '.json';
      fetch(url).then(function(response) {
        return response.json();
      }).then(function(val) {
        return self.IOWA.Firebase.updateIDBCache(url, val);
      });
    }
  }).catch(function(error) {
    console.error('Could not update Firebase cache for', dataset, error);
  });
};
