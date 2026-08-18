(function (global) {
  var STORAGE_KEY = "vr-polygon-demo-tour";

  function withBase(path) {
    if (typeof global.withBase === "function") return global.withBase(path);
    return path;
  }

  function parseJsonResponse(res, fallbackError) {
    return res.json().catch(function () {
      return {};
    }).then(function (body) {
      if (!res.ok) {
        throw new Error(body.error || fallbackError + "：" + res.status);
      }
      return body;
    });
  }

  function readLocalTour() {
    try {
      var cached = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      return null;
    }
  }

  function writeLocalTour(data) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true, local: true };
    } catch (err) {
      throw new Error("保存失败：当前环境无法写入");
    }
  }

  function loadStaticTour() {
    return fetch(withBase("/data/tour.json"), { cache: "no-store" }).then(function (res) {
      return parseJsonResponse(res, "无法读取热点数据");
    });
  }

  global.TourAPI = {
    getTour: function () {
      var local = readLocalTour();
      if (local) return Promise.resolve(local);
      return fetch(withBase("/api/tour"), { cache: "no-store" }).then(function (res) {
        if (res.ok) return parseJsonResponse(res, "无法读取热点数据");
        return loadStaticTour();
      }).catch(function () {
        return loadStaticTour();
      });
    },
    saveTour: function (data) {
      return fetch(withBase("/api/tour"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (res.ok) return parseJsonResponse(res, "保存失败");
        return writeLocalTour(data);
      }).catch(function () {
        return writeLocalTour(data);
      });
    }
  };
})(window);
