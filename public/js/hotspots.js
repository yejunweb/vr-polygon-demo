(function (global) {
  var IMAGE_URL = "/assets/hotspot-image.jpg";
  var MEDIA_ORIGIN_WIDTH = 5568;
  var MEDIA_ORIGIN_HEIGHT = 3712;
  var TYPE_IMAGE = 2;
  var TYPE_POLYGON = 5;
  var TYPE_POLYLINE = 6;

  function parseRgba(str, fallback) {
    var base = fallback || { hex: 0xffffff, alpha: 1, r: 255, g: 255, b: 255 };
    if (!str) return base;
    var parts = String(str).split(",").map(function (n) { return Number(n.trim()); });
    var r = parts[0] || 0;
    var g = parts[1] || 0;
    var b = parts[2] || 0;
    var a = parts.length > 3 && !isNaN(parts[3]) ? parts[3] : 1;
    return { hex: (r << 16) + (g << 8) + b, alpha: a, r: r, g: g, b: b, css: "rgba(" + r + "," + g + "," + b + "," + a + ")" };
  }

  function toHexString(hexNum) {
    return "#" + ("000000" + (hexNum >>> 0).toString(16)).slice(-6);
  }

  function rgbaToHex(str, fallback) {
    return toHexString(parseRgba(str, fallback).hex);
  }

  function hexToRgb(hex) {
    var raw = String(hex || "").replace("#", "");
    if (raw.length === 3) raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
    var n = parseInt(raw, 16);
    if (isNaN(n)) return { r: 255, g: 255, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function formatRgba(r, g, b, a) {
    var alpha = a == null ? 1 : a;
    return r + "," + g + "," + b + "," + Number(alpha).toFixed(2);
  }

  function replaceRgb(rgbaStr, hex, fallback) {
    var parsed = parseRgba(rgbaStr, fallback);
    var rgb = hexToRgb(hex);
    return formatRgba(rgb.r, rgb.g, rgb.b, parsed.alpha);
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

    if (hs.id !== "_draft") applyTitleHotspot(krpano, hs, options);
    return name;
  }

  function addImageHotspot(krpano, hs, options) {
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
    krpano.set(hsPath(name, "data_id"), hs.id);
    if (options && options.editable) {
      krpano.set(hsPath(name, "enabled"), true);
      krpano.set(hsPath(name, "onclick"), "js(onEditorSelectHotspot(" + quote(name) + "));");
    } else {
      krpano.set(hsPath(name, "enabled"), false);
    }
    return name;
  }

  function titleHotspotName(id) {
    return safeName(id) + "_title";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function defaultTitleSetting() {
    return {
      align: "center",
      edge: "bottom",
      ox: 0,
      oy: -22,
      font: {
        fontSize: 14,
        fontColor: "255,255,255,1",
        fontFaceType: 0
      },
      fontWeight: "normal",
      background: {
        type: 0,
        bgColor: "0,0,0,0.55",
        bgRoundedge: 4
      },
      zoom: true,
      fixedHV: 0,
      showWhenHoving: 0,
      stick: 0
    };
  }

  function ensureTitleSetting(hs) {
    if (!hs.titleSetting) hs.titleSetting = defaultTitleSetting();
    var ts = hs.titleSetting;
    if (ts.zoom == null) ts.zoom = true;
    if (ts.fixedHV == null) ts.fixedHV = 0;
    if (ts.showWhenHoving == null) ts.showWhenHoving = 0;
    if (hs.showTitle == null) hs.showTitle = 1;
    if (ts.ath == null && hs.icon) ts.ath = hs.icon.ath;
    if (ts.atv == null && hs.icon) ts.atv = hs.icon.atv;
    return ts;
  }

  function applyTitleHotspot(krpano, hs, options) {
    if (!krpano || !hs || !isPolyType(hs.icon && hs.icon.type)) return null;
    var ts = ensureTitleSetting(hs);
    var name = titleHotspotName(hs.id);
    var parent = safeName(hs.id);
    var font = ts.font || {};
    var fontColor = parseRgba(font.fontColor, { hex: 0xffffff, alpha: 1, r: 255, g: 255, b: 255, css: "rgba(255,255,255,1)" });
    var bg = parseRgba((ts.background || {}).bgColor, { hex: 0x000000, alpha: 0.55, r: 0, g: 0, b: 0, css: "rgba(0,0,0,0.55)" });
    var fontSize = font.fontSize || 14;
    var hoverOnly = ts.showWhenHoving === 1;
    var show = hs.showTitle !== 0;
    var visible = show && (options && options.editable ? true : !hoverOnly);
    var exists = krpano.get(hsPath(name, "name"));
    if (!exists) {
      krpano.call("addhotspot(" + quote(name) + ")");
      krpano.call("callwith(hotspot[" + quote(name) + "], loadstyle(title_hotspot));");
    }
    krpano.set(hsPath(name, "html"), escapeHtml(hs.title || ""));
    krpano.set(hsPath(name, "ath"), ts.ath != null ? ts.ath : hs.icon.ath);
    krpano.set(hsPath(name, "atv"), ts.atv != null ? ts.atv : hs.icon.atv);
    krpano.set(hsPath(name, "edge"), ts.edge || "bottom");
    krpano.set(hsPath(name, "oy"), ts.oy != null ? ts.oy : -22);
    krpano.set(hsPath(name, "ox"), ts.ox || 0);
    krpano.set(hsPath(name, "zoom"), ts.zoom === true || ts.zoom === 1);
    krpano.set(hsPath(name, "distorted"), ts.fixedHV !== 1);
    krpano.set(hsPath(name, "bgcolor"), bg.hex);
    krpano.set(hsPath(name, "bgalpha"), bg.alpha);
    krpano.set(hsPath(name, "bgroundedge"), (ts.background && ts.background.bgRoundedge) || 4);
    krpano.set(hsPath(name, "css"),
      "color:" + fontColor.css + ";font-family:PingFang SC,Microsoft YaHei,sans-serif;font-size:" +
      fontSize + "px;text-align:center;white-space:nowrap;line-height:1.4;"
    );
    krpano.set(hsPath(name, "visible"), visible);
    if (options && options.editable) {
      krpano.set(hsPath(name, "enabled"), true);
      krpano.set(hsPath(name, "capture"), true);
      krpano.set(hsPath(name, "handcursor"), true);
      krpano.set(hsPath(name, "zorder"), 40);
      krpano.set(hsPath(name, "ondown"), "drag_title();");
      krpano.set(hsPath(name, "onup"), "js(onTitleDragEnd());");
    } else {
      krpano.set(hsPath(name, "enabled"), false);
      krpano.set(hsPath(name, "capture"), false);
      krpano.set(hsPath(name, "ondown"), "");
      krpano.set(hsPath(name, "onup"), "");
    }
    krpano.set(hsPath(parent, "titlehs"), name);
    krpano.set(hsPath(parent, "hover_title"), !!(show && hoverOnly && !(options && options.editable)));
    return name;
  }

  function removeTitleHotspot(krpano, id) {
    removeHotspot(krpano, titleHotspotName(id));
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
      else if (type === TYPE_IMAGE) addImageHotspot(krpano, hs, options);
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

  function defaultPolyIcon(type) {
    var isLine = type === TYPE_POLYLINE;
    var icon = {
      type: type,
      borderWidth: 2,
      borderColor: isLine ? "231,231,231,1.00" : "40,110,250,1",
      overBorderWidth: 2,
      overBorderColor: "40,110,250,1",
      blink: 1
    };
    if (!isLine) {
      icon.fillColor = "15,15,15,0.50";
      icon.overFillColor = "255,255,255,0.50";
    }
    return icon;
  }

  function createHotspotRecord(type, points, zOrder, iconStyle) {
    var isLine = type === TYPE_POLYLINE;
    var center = centroid(points);
    var icon = defaultPolyIcon(type);
    if (iconStyle) {
      Object.keys(iconStyle).forEach(function (key) {
        icon[key] = iconStyle[key];
      });
    }
    icon.type = type;
    icon.ath = center.ath;
    icon.atv = center.atv;
    icon.points = points.slice();
    var titleSetting = defaultTitleSetting();
    titleSetting.ath = center.ath;
    titleSetting.atv = center.atv;
    return {
      id: "h_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36),
      zOrder: zOrder || 1,
      icon: icon,
      title: isLine ? "折线" : "多边形",
      showTitle: 1,
      titleSetting: titleSetting,
      visible: 1,
      locked: 0,
      data: { code: 9, title: "" }
    };
  }

  function refreshPolyStyle(krpano, hs, options) {
    if (!krpano || !hs || !hs.icon) return;
    var name = safeName(hs.id);
    var isLine = hs.icon.type === TYPE_POLYLINE;
    krpano.call("polygon_blink_disable(" + quote(name) + ");");
    setPolyAppearance(krpano, name, hs.icon, isLine);
    if (options && options.previewHover && hs.icon.blink !== 1) {
      krpano.set(hsPath(name, "fillcolor"), krpano.get(hsPath(name, "overfillcolor")));
      krpano.set(hsPath(name, "fillalpha"), krpano.get(hsPath(name, "overfillalpha")));
      krpano.set(hsPath(name, "bordercolor"), krpano.get(hsPath(name, "overbordercolor")));
      krpano.set(hsPath(name, "borderalpha"), krpano.get(hsPath(name, "overborderalpha")));
      krpano.set(hsPath(name, "borderwidth"), krpano.get(hsPath(name, "overborderwidth")));
    }
    if (hs.icon.blink === 1) {
      krpano.set(hsPath(name, "blink"), true);
      krpano.call("polygon_blink_enable(" + quote(name) + ");");
    }
  }

  function actionLabel(hs) {
    var code = hs && hs.data && hs.data.code;
    if (code === 9) return "场景切换";
    return typeLabel(hs && hs.icon && hs.icon.type);
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
    rgbaToHex: rgbaToHex,
    hexToRgb: hexToRgb,
    replaceRgb: replaceRgb,
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
    defaultPolyIcon: defaultPolyIcon,
    createHotspotRecord: createHotspotRecord,
    refreshPolyStyle: refreshPolyStyle,
    applyTitleHotspot: applyTitleHotspot,
    removeTitleHotspot: removeTitleHotspot,
    titleHotspotName: titleHotspotName,
    ensureTitleSetting: ensureTitleSetting,
    defaultTitleSetting: defaultTitleSetting,
    escapeHtml: escapeHtml,
    actionLabel: actionLabel,
    nextZOrder: nextZOrder,
    upsertHotspot: upsertHotspot,
    removeHotspotRecord: removeHotspotRecord,
    findHotspot: findHotspot,
    syncRecordPoints: syncRecordPoints,
    typeLabel: typeLabel
  };
})(window);
