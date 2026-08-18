(function (global) {
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

  global.TourAPI = {
    getTour: function () {
      return fetch("/api/tour", { cache: "no-store" }).then(function (res) {
        return parseJsonResponse(res, "无法读取热点数据");
      });
    },
    saveTour: function (data) {
      return fetch("/api/tour", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(function (res) {
        return parseJsonResponse(res, "保存失败");
      });
    }
  };
})(window);
