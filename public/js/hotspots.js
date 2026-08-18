(function (global) {
  var IMAGE_URL = "/assets/hotspot-image.jpg";
  var MEDIA_ORIGIN_WIDTH = 5568;
  var MEDIA_ORIGIN_HEIGHT = 3712;
  var TYPE_IMAGE = 2;
  var TYPE_POLYGON = 5;
  var TYPE_POLYLINE = 6;

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

  function centroid(points) {
    if (!points || !points.length) return { ath: 0, atv: 0 };
    var ath = 0;
    var atv = 0;
    for (var i = 0; i < points.length; i++) {
      ath += Number(points[i].ath) || 0;
      atv += Number(points[i].atv) || 0;
    }
    return { ath: ath / points.length, atv: atv / points.length };
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

  function addPolyHotspot(krpano, hs, isLine, options) {
    var name = safeName(hs.id);
    var icon = hs.icon || {};
    var points = unwrapPoints(icon.points);
    if (points.length < 2) return null;

    krpano.call("addhotspot(" + quote(name) + ")");
    krpano.call("callwith(hotspot[" + quote(name) + "], loadstyle(" + (isLine ? "polygon_line" : "polygon_fill") + "));");
    krpano.set(hsPath(name, "type"), "poly");
    krpano.set(hsPath(name, "polyline"), isLine);
    krpano.set(hsPath(name, "zorder"), hs.zOrder || (isLine ? 1 : 0));
    krpano.set(hsPath(name, "visible"), hs.visible !== 0);
    krpano.set(hsPath(name, "enabled"), true);
    krpano.set(hsPath(name, "hittest"), true);
    krpano.set(hsPath(name, "capture"), false);
    krpano.set(hsPath(name, "data_id"), hs.id);
    setPolyAppearance(krpano, name, icon, isLine);

    if (options && options.editable) {
      krpano.set(hsPath(name, "onover"), "");
      krpano.set(hsPath(name, "onout"), "");
      krpano.set(hsPath(name, "ondown"), "");
      krpano.set(hsPath(name, "onup"), "");
      krpano.set(hsPath(name, "onclick"), "js(onEditorSelectHotspot(" + quote(name) + "));");
      krpano.set(hsPath(name, "blink"), false);
    } else {
      krpano.set(hsPath(name, "onover"), "on_polygon_over();");
      krpano.set(hsPath(name, "onout"), "on_polygon_out();");
      krpano.set(hsPath(name, "ondown"), "if(device.touch, on_polygon_over(););");
      krpano.set(hsPath(name, "onup"), "if(device.touch, on_polygon_out(););");
    }

    for (var i = 0; i < points.length; i++) {
      krpano.set(hsPath(name, "point[" + i + "].ath"), points[i].ath);
      krpano.set(hsPath(name, "point[" + i + "].atv"), points[i].atv);
    }

    if (!options || !options.editable) {
      if (icon.blink === 1) {
        krpano.call("polygon_blink_enable(" + quote(name) + ");");
      }
    }

    return name;
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
    krpano.set(hsPath(name, "enabled"), false);
    return name;
  }

  function getScene(data) {
    return data && data.scenes && data.scenes[0] ? data.scenes[0] : null;
  }

  function getHotspots(data) {
    var scene = getScene(data);
    if (!scene) return [];
    if (!Array.isArray(scene.hotspot)) scene.hotspot = [];
    return scene.hotspot;
  }

  function isPolyType(type) {
    return type === TYPE_POLYGON || type === TYPE_POLYLINE;
  }

  function applyHotspots(krpano, data, options) {
    if (!krpano || !data) return;
    var scene = getScene(data);
    if (!scene) return;
    (scene.hotspot || []).forEach(function (hs) {
      var type = hs.icon && hs.icon.type;
      if (type === TYPE_POLYGON) addPolyHotspot(krpano, hs, false, options);
      else if (type === TYPE_POLYLINE) addPolyHotspot(krpano, hs, true, options);
      else if (type === TYPE_IMAGE) addImageHotspot(krpano, hs);
    });
  }

  function removeHotspot(krpano, name) {
    if (!krpano || !name) return;
    krpano.call("removehotspot(" + quote(name) + ")");
  }

  function readPoints(krpano, name) {
    var count = Number(krpano.get(hsPath(name, "point.count"))) || 0;
    var points = [];
    for (var i = 0; i < count; i++) {
      points.push({
        ath: Number(krpano.get(hsPath(name, "point[" + i + "].ath"))),
        atv: Number(krpano.get(hsPath(name, "point[" + i + "].atv")))
      });
    }
    return points;
  }

  function setPoints(krpano, name, points) {
    krpano.set(hsPath(name, "point.count"), points.length);
    for (var i = 0; i < points.length; i++) {
      krpano.set(hsPath(name, "point[" + i + "].ath"), points[i].ath);
      krpano.set(hsPath(name, "point[" + i + "].atv"), points[i].atv);
    }
  }

  function createHotspotRecord(type, points, zOrder) {
    var isLine = type === TYPE_POLYLINE;
    var center = centroid(points);
    var icon = {
      type: type,
      ath: center.ath,
      atv: center.atv,
      points: points.slice(),
      borderWidth: 2,
      borderColor: isLine ? "231,231,231,1.00" : "40,110,250,1",
      overBorderWidth: 2,
      overBorderColor: "40,110,250,1",
      blink: 1
    };
    if (!isLine) {
      icon.fillColor = "15,15,15,0.50";
      icon.overFillColor = "255,255,255,0.5";
    }
    return {
      id: "h_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36),
      zOrder: zOrder || 1,
      icon: icon,
      title: isLine ? "折线" : "色块",
      showTitle: 0,
      visible: 1,
      locked: 0
    };
  }

  function nextZOrder(data) {
    var max = 0;
    getHotspots(data).forEach(function (hs) {
      if (hs.zOrder > max) max = hs.zOrder;
    });
    return max + 1;
  }

  function upsertHotspot(data, record) {
    var list = getHotspots(data);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === record.id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    return record;
  }

  function removeHotspotRecord(data, id) {
    var list = getHotspots(data);
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].id === id) list.splice(i, 1);
    }
  }

  function findHotspot(data, id) {
    var list = getHotspots(data);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function syncRecordPoints(record, points) {
    if (!record.icon) record.icon = {};
    record.icon.points = points.slice();
    var center = centroid(points);
    record.icon.ath = center.ath;
    record.icon.atv = center.atv;
    return record;
  }

  function typeLabel(type) {
    if (type === TYPE_POLYGON) return "多边形";
    if (type === TYPE_POLYLINE) return "折线";
    if (type === TYPE_IMAGE) return "图片";
    return "热点";
  }

  global.TourHotspots = {
    TYPE_IMAGE: TYPE_IMAGE,
    TYPE_POLYGON: TYPE_POLYGON,
    TYPE_POLYLINE: TYPE_POLYLINE,
    parseRgba: parseRgba,
    unwrapPoints: unwrapPoints,
    safeName: safeName,
    quote: quote,
    hsPath: hsPath,
    centroid: centroid,
    getScene: getScene,
    getHotspots: getHotspots,
    isPolyType: isPolyType,
    applyHotspots: applyHotspots,
    addPolyHotspot: addPolyHotspot,
    removeHotspot: removeHotspot,
    readPoints: readPoints,
    setPoints: setPoints,
    createHotspotRecord: createHotspotRecord,
    nextZOrder: nextZOrder,
    upsertHotspot: upsertHotspot,
    removeHotspotRecord: removeHotspotRecord,
    findHotspot: findHotspot,
    syncRecordPoints: syncRecordPoints,
    typeLabel: typeLabel
  };
})(window);
