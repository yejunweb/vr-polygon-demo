(function () {
  var tourData = null;
  var loaded = false;

  function applyWhenReady() {
    var krpano = window.krpano;
    if (!krpano || !krpano.get("xml.scene") || !tourData || loaded) return;
    loaded = true;
    TourHotspots.applyHotspots(krpano, tourData, { editable: false });
  }

  window.onPanoLoaded = function () {
    applyWhenReady();
  };

  TourAPI.getTour()
    .then(function (data) {
      tourData = data;
      var titleEl = document.getElementById("tour-title");
      if (titleEl) {
        titleEl.textContent = data.name && data.name !== "0"
          ? data.name
          : (data.scenes && data.scenes[0] && data.scenes[0].name) || "热点预览";
      }
      applyWhenReady();
    })
    .catch(function (err) {
      console.error(err);
      var titleEl = document.getElementById("tour-title");
      if (titleEl) titleEl.textContent = err.message || "数据加载失败";
    });
})();
