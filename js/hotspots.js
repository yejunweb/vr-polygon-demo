(function (global) {
  var DATA_URL = "./data/format.7a0jepsmru4.json";
  var MEDIA_ORIGIN_WIDTH = 5568;
  var MEDIA_ORIGIN_HEIGHT = 3712;
  var IMAGE_URL = "../assets/hotspot-image.jpg";
  var tourData = null;
  var loaded = false;

  function getKrpano() {
    return global.krpano || null;
  }

  function parseRgba(str, fallback) {
    var base = fallback || { hex: 0xffffff, alpha: 1 };
    if (!str) return base;
    var parts = String(str).split(",").map(function (n) { return Number(n.trim()); });
    var r = parts[0] || 0;
    var g = parts[1] || 0;
    var b = parts[2] || 0;
    var a = parts.length > 3 && !isNaN(parts[3]) ? parts[3] : 1;
    return { hex: (r << 16) + (g << 8) + b, alpha: a };
  }

  function unwrapPoints(points) {
    if (!points || !points.length) return [];
    var out = [{ ath: Number(points[0].ath), atv: Number(points[0].atv) }];
    for (var i = 1; i < points.length; i++) {
      var ath = Number(points[i].ath);
      var prev = out[i - 1].ath;
      while (ath - prev > 180) ath -= 360;
      while (ath - prev < -180) ath += 360;
      out.push({ ath: ath, atv: Number(points[i].atv) });
    }
    return out;
  }

  function safeName(id) {
    return String(id).replace(/[^A-Za-z0-9_]/g, "_");
  }

  function quote(name) {
    return "'" + String(name).replace(/'/g, "\\'") + "'";
  }

  function hsPath(name, key) {
    return "hotspot[" + quote(name) + "]." + key;
  }

  function setPolyAppearance(krpano, name, icon, isLine) {
    var fill = parseRgba(icon.fillColor, isLine ? { hex: 0x000000, alpha: 0 } : { hex: 0x0f0f0f, alpha: 0.5 });
    var border = parseRgba(icon.borderColor, { hex: 0x286efa, alpha: 1 });
    var overFill = parseRgba(icon.overFillColor, isLine ? fill : { hex: 0xffffff, alpha: 0.5 });
    var overBorder = parseRgba(icon.overBorderColor, { hex: 0x286efa, alpha: 1 });
    var borderWidth = icon.borderWidth != null ? icon.borderWidth : 2;
    var overBorderWidth = icon.overBorderWidth != null ? icon.overBorderWidth : borderWidth;

    krpano.set(hsPath(name, "fillcolor"), fill.hex);
    krpano.set(hsPath(name, "fillalpha"), isLine ? 0 : fill.alpha);
    krpano.set(hsPath(name, "borderwidth"), borderWidth);
    krpano.set(hsPath(name, "bordercolor"), border.hex);
    krpano.set(hsPath(name, "borderalpha"), border.alpha);
    krpano.set(hsPath(name, "normalfillcolor"), fill.hex);
    krpano.set(hsPath(name, "normalfillalpha"), isLine ? 0 : fill.alpha);
    krpano.set(hsPath(name, "normalborderwidth"), borderWidth);
    krpano.set(hsPath(name, "normalbordercolor"), border.hex);
    krpano.set(hsPath(name, "normalborderalpha"), border.alpha);
    krpano.set(hsPath(name, "overfillcolor"), overFill.hex);
    krpano.set(hsPath(name, "overfillalpha"), isLine ? 0 : overFill.alpha);
    krpano.set(hsPath(name, "overborderwidth"), overBorderWidth);
    krpano.set(hsPath(name, "overbordercolor"), overBorder.hex);
    krpano.set(hsPath(name, "overborderalpha"), overBorder.alpha);
    krpano.set(hsPath(name, "blink"), icon.blink === 1);
    krpano.set(hsPath(name, "blink_duration"), 4);
  }

  function addPolyHotspot(krpano, hs, isLine) {
    var name = safeName(hs.id);
    var icon = hs.icon || {};
    var points = unwrapPoints(icon.points);
    if (points.length < 2) return;

    krpano.call("addhotspot(" + quote(name) + ")");
    krpano.call("callwith(hotspot[" + quote(name) + "], loadstyle(" + (isLine ? "polygon_line" : "polygon_fill") + "));");
    krpano.set(hsPath(name, "type"), "poly");
    krpano.set(hsPath(name, "polyline"), isLine);
    krpano.set(hsPath(name, "zorder"), hs.zOrder || (isLine ? 1 : 0));
    krpano.set(hsPath(name, "visible"), hs.visible !== 0);
    krpano.set(hsPath(name, "enabled"), true);
    krpano.set(hsPath(name, "hittest"), true);
    krpano.set(hsPath(name, "capture"), false);
    setPolyAppearance(krpano, name, icon, isLine);
    krpano.set(hsPath(name, "onover"), "on_polygon_over();");
    krpano.set(hsPath(name, "onout"), "on_polygon_out();");
    krpano.set(hsPath(name, "ondown"), "if(device.touch, on_polygon_over(););");
    krpano.set(hsPath(name, "onup"), "if(device.touch, on_polygon_out(););");

    for (var i = 0; i < points.length; i++) {
      krpano.set(hsPath(name, "point[" + i + "].ath"), points[i].ath);
      krpano.set(hsPath(name, "point[" + i + "].atv"), points[i].atv);
    }

    if (icon.blink === 1) {
      krpano.call("polygon_blink_enable(" + quote(name) + ");");
    }
  }

  function addImageHotspot(krpano, hs) {
    var name = safeName(hs.id);
    var icon = hs.icon || {};
    var scaleX = icon.scaleX != null ? Number(icon.scaleX) : 1;
    var scaleY = icon.scaleY != null ? Number(icon.scaleY) : scaleX;

    krpano.call("addhotspot(" + quote(name) + ")");
    krpano.call("callwith(hotspot[" + quote(name) + "], loadstyle(image_hotspot));");
    krpano.set(hsPath(name, "url"), IMAGE_URL);
    krpano.set(hsPath(name, "ath"), icon.ath);
    krpano.set(hsPath(name, "atv"), icon.atv);
    krpano.set(hsPath(name, "edge"), icon.edge || "center");
    krpano.set(hsPath(name, "distorted"), icon.stick === 1);
    krpano.set(hsPath(name, "zoom"), !!icon.zoom);
    krpano.set(hsPath(name, "rx"), icon.rx || 0);
    krpano.set(hsPath(name, "ry"), icon.ry || 0);
    krpano.set(hsPath(name, "rz"), icon.rz || 0);
    krpano.set(hsPath(name, "rotate"), icon.rotate || 0);
    krpano.set(hsPath(name, "zorder"), hs.zOrder != null ? hs.zOrder : 10);
    krpano.set(hsPath(name, "width"), MEDIA_ORIGIN_WIDTH * scaleX);
    krpano.set(hsPath(name, "height"), MEDIA_ORIGIN_HEIGHT * scaleY);
    krpano.set(hsPath(name, "scale"), 1);
    krpano.set(hsPath(name, "visible"), hs.visible !== 0);
    krpano.set(hsPath(name, "capture"), false);
  }

  function applyHotspots(data) {
    var krpano = getKrpano();
    if (!krpano || !data) return;

    var scene = (data.scenes || [])[0];
    if (!scene) return;

    (scene.hotspot || []).forEach(function (hs) {
      var type = hs.icon && hs.icon.type;
      if (type === 5) addPolyHotspot(krpano, hs, false);
      else if (type === 6) addPolyHotspot(krpano, hs, true);
      else if (type === 2) addImageHotspot(krpano, hs);
    });
  }

  function loadData() {
    return fetch(DATA_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("无法读取热点数据：" + res.status);
        return res.json();
      })
      .then(function (data) {
        tourData = data;
        var titleEl = document.getElementById("tour-title");
        if (titleEl) titleEl.textContent = data.name && data.name !== "0" ? data.name : (data.scenes && data.scenes[0] && data.scenes[0].name) || "热点示例";
        return data;
      });
  }

  global.onPanoLoaded = function () {
    var krpano = getKrpano();
    if (!krpano || !krpano.get("xml.scene")) return;
    if (loaded) return;
    loaded = true;
    var ready = tourData ? Promise.resolve(tourData) : loadData();
    ready.then(applyHotspots).catch(function (err) {
      console.error(err);
    });
  };

  loadData().catch(function () {});
})(window);
