(function (global) {
  global.APP_BASE = global.APP_BASE || "";
  global.withBase = function (path) {
    var base = global.APP_BASE || "";
    var p = String(path || "");
    if (!p) return base || "/";
    if (p.charAt(0) !== "/") p = "/" + p;
    return base + p;
  };
})(window);
