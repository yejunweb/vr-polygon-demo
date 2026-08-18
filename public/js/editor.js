(function () {
  var HS = TourHotspots;
  var DRAFT_NAME = "_draft";
  var MAX_HOTSPOTS = 500;
  var tourData = null;
  var loaded = false;
  var selectedId = null;
  var drawing = false;
  var draft = null;
  var vertexNames = [];
  var vertexMap = {};
  var lastClickAt = 0;
  var styleTab = "normal";
  var searchText = "";
  var panel = "list";
  var imageAdvTab = "detail";
  var pickingColor = false;
  var savedUserControl = null;
  var colorPickerOpen = false;
  var cpState = { h: 0, s: 0, v: 0.5 };
  var cpDrag = null;
  var DEFAULT_MATTING_THRESHOLD = 0.33;
  var DEFAULT_MATTING_SMOOTHING = 0.1;
  var CP_PRESETS = [
    "#d0021b", "#f5a623", "#f8e71c", "#8b572a", "#7ed321", "#417505", "#bd10e0", "#9013fe",
    "#4a90e2", "#50e3c2", "#b8e986", "#000000", "#4a4a4a", "#9b9b9b", "#d8d8d8", "#ffffff"
  ];

  var els = {
    listPanel: document.getElementById("panel-list"),
    pickerPanel: document.getElementById("panel-picker"),
    settingsPanel: document.getElementById("panel-settings"),
    list: document.getElementById("hotspot-list"),
    count: document.getElementById("hotspot-count"),
    search: document.getElementById("hotspot-search"),
    status: document.getElementById("status"),
    add: document.getElementById("btn-add"),
    pickerBack: document.getElementById("btn-picker-back"),
    settingsBack: document.getElementById("btn-settings-back"),
    pickPoly: document.getElementById("pick-poly"),
    pickLine: document.getElementById("pick-line"),
    pickImage: document.getElementById("pick-image"),
    finish: document.getElementById("btn-finish"),
    undo: document.getElementById("btn-undo"),
    remove: document.getElementById("btn-delete"),
    save: document.getElementById("btn-save"),
    drawActions: document.getElementById("draw-actions"),
    settingsTitle: document.getElementById("settings-title"),
    title: document.getElementById("input-title"),
    polySettings: document.getElementById("poly-settings"),
    imageSettings: document.getElementById("image-settings"),
    fillField: document.getElementById("fill-field"),
    tabs: document.getElementById("style-tabs"),
    borderColor: document.getElementById("input-border-color"),
    borderHex: document.getElementById("input-border-hex"),
    fillColor: document.getElementById("input-fill-color"),
    fillHex: document.getElementById("input-fill-hex"),
    borderWidth: document.getElementById("input-border-width"),
    widthValue: document.getElementById("width-value"),
    blink: document.getElementById("input-blink"),
    resetBorder: document.getElementById("reset-border"),
    resetFill: document.getElementById("reset-fill"),
    nameField: document.getElementById("name-field"),
    titleText: document.getElementById("input-title-text"),
    titleCount: document.getElementById("title-count"),
    showTitle: document.getElementById("input-show-title"),
    titleZoom: document.getElementById("input-title-zoom"),
    titleFixed: document.getElementById("input-title-fixed"),
    titleHover: document.getElementById("input-title-hover"),
    titleToggle: document.getElementById("btn-title-toggle"),
    titleAccordion: document.getElementById("title-settings"),
    imageZoom: document.getElementById("input-image-zoom"),
    imageFixed: document.getElementById("input-image-fixed"),
    imageLock: document.getElementById("input-image-lock"),
    imageEdge: document.getElementById("input-image-edge"),
    imageNudge: document.getElementById("image-nudge"),
    imageScaleX: document.getElementById("input-image-scalex"),
    imageScaleY: document.getElementById("input-image-scaley"),
    imageScaleXValue: document.getElementById("image-scalex-value"),
    imageScaleYValue: document.getElementById("image-scaley-value"),
    imageRx: document.getElementById("input-image-rx"),
    imageRy: document.getElementById("input-image-ry"),
    imageRz: document.getElementById("input-image-rz"),
    imageRxValue: document.getElementById("image-rx-value"),
    imageRyValue: document.getElementById("image-ry-value"),
    imageRzValue: document.getElementById("image-rz-value"),
    imageAdvTabs: document.getElementById("image-adv-tabs"),
    imageAdvDetail: document.getElementById("image-adv-detail"),
    imageAdvMatting: document.getElementById("image-adv-matting"),
    imageAdvToggle: document.getElementById("btn-image-adv-toggle"),
    imageAdvanced: document.getElementById("image-advanced"),
    imageReset: document.getElementById("btn-image-reset"),
    mattingColorBtn: document.getElementById("btn-matting-color"),
    mattingSwatch: document.getElementById("matting-swatch"),
    mattingHex: document.getElementById("matting-hex"),
    mattingEyedropper: document.getElementById("btn-matting-eyedropper"),
    mattingOpacity: document.getElementById("input-matting-opacity"),
    mattingOpacityValue: document.getElementById("matting-opacity-value"),
    mattingSmooth: document.getElementById("input-matting-smooth"),
    mattingSmoothValue: document.getElementById("matting-smooth-value"),
    colorPicker: document.getElementById("color-picker"),
    cpSv: document.getElementById("cp-sv"),
    cpSvCursor: document.getElementById("cp-sv-cursor"),
    cpHue: document.getElementById("cp-hue"),
    cpHueCursor: document.getElementById("cp-hue-cursor"),
    cpHex: document.getElementById("cp-hex"),
    cpR: document.getElementById("cp-r"),
    cpG: document.getElementById("cp-g"),
    cpB: document.getElementById("cp-b"),
    cpSwatches: document.getElementById("cp-swatches")
  };

  var ignorePanoClick = false;
  var VERTEX_BLUE = "#286EFA";
  var VERTEX_RED = "#E23C3C";
  var ACT_OK = "vtx_act_ok";
  var ACT_DEL = "vtx_act_del";
  var ACT_EDIT = "vtx_act_edit";

  function krpano() {
    return window.krpano || null;
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = "status" + (kind ? " " + kind : "");
  }

  function showPanel(name) {
    panel = name;
    els.listPanel.hidden = name !== "list";
    els.pickerPanel.hidden = name !== "picker";
    els.settingsPanel.hidden = name !== "settings";
  }

  function allRecords() {
    return HS.getHotspots(tourData);
  }

  function polyRecords() {
    return allRecords().filter(function (hs) {
      return HS.isPolyType(hs.icon && hs.icon.type);
    });
  }

  function imageRecords() {
    return allRecords().filter(function (hs) {
      return HS.isImageType(hs.icon && hs.icon.type);
    });
  }

  function currentRecord() {
    if (drawing && draft) {
      draft.id = DRAFT_NAME;
      return draft;
    }
    return selectedId ? HS.findHotspot(tourData, selectedId) : null;
  }

  function iconClass(type) {
    if (type === HS.TYPE_POLYGON) return "poly";
    if (type === HS.TYPE_POLYLINE) return "line";
    return "image";
  }

  function updateDrawButtons() {
    var pointCount = draft ? draft.points.length : 0;
    var minPoints = draft && draft.type === HS.TYPE_POLYGON ? 3 : 2;
    els.drawActions.hidden = !drawing;
    els.finish.disabled = !drawing || pointCount < minPoints;
    els.undo.disabled = !drawing || pointCount < 1;
    els.remove.disabled = drawing || !selectedId;
  }

  function renderList() {
    var records = allRecords();
    els.count.textContent = records.length + "/" + MAX_HOTSPOTS;
    els.list.innerHTML = "";
    var keyword = searchText.trim().toLowerCase();
    var shown = records.filter(function (hs) {
      if (!keyword) return true;
      var title = String(hs.title || "").toLowerCase();
      var type = HS.typeLabel(hs.icon && hs.icon.type).toLowerCase();
      return title.indexOf(keyword) >= 0 || type.indexOf(keyword) >= 0;
    });
    shown.forEach(function (hs) {
      var type = hs.icon && hs.icon.type;
      var li = document.createElement("li");
      li.dataset.id = hs.id;
      if (hs.id === selectedId && panel === "settings") li.className = "selected";
      li.innerHTML = "<span class=\"hs-icon " + iconClass(type) + "\"></span>" +
        "<span class=\"item-body\"><strong></strong><span class=\"meta\"></span></span>";
      li.querySelector("strong").textContent = hs.title || HS.typeLabel(type);
      li.querySelector(".meta").textContent = HS.actionLabel(hs);
      li.addEventListener("click", function () {
        if (drawing) return;
        openSettings(hs.id);
      });
      els.list.appendChild(li);
    });
    if (!shown.length) {
      var empty = document.createElement("li");
      empty.textContent = records.length ? "没有匹配的热点" : "暂无热点";
      empty.style.cursor = "default";
      els.list.appendChild(empty);
    }
  }

  function clearVertices() {
    var pano = krpano();
    if (!pano) return;
    vertexNames.forEach(function (name) {
      HS.removeHotspot(pano, name);
    });
    vertexNames = [];
    vertexMap = {};
  }

  function vertexHtml(color) {
    return "<div style=\"width:18px;height:18px;border-radius:50%;background:" + color +
      ";display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(255,255,255,.25);\">" +
      "<div style=\"width:7px;height:7px;border-radius:50%;background:#fff;\"></div></div>";
  }

  function actionHtml(kind) {
    var icon;
    if (kind === "ok") {
      icon = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>";
    } else if (kind === "edit") {
      icon = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z\"/></svg>";
    } else {
      icon = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6l-1 14H6L5 6\"/><path d=\"M10 11v6M14 11v6\"/><path d=\"M9 6V4h6v2\"/></svg>";
    }
    return "<div style=\"width:32px;height:32px;border-radius:6px;background:rgba(20,22,26,.78);display:flex;align-items:center;justify-content:center;\">" + icon + "</div>";
  }

  function addVertex(targetName, index, point, isDraft, isLatest, interactive) {
    var pano = krpano();
    var name = "vtx_" + index;
    pano.call("addhotspot(" + HS.quote(name) + ")");
    pano.call("callwith(hotspot[" + HS.quote(name) + "], loadstyle(poly_vertex));");
    pano.set(HS.hsPath(name, "ath"), point.ath);
    pano.set(HS.hsPath(name, "atv"), point.atv);
    pano.set(HS.hsPath(name, "html"), vertexHtml(isLatest ? VERTEX_RED : VERTEX_BLUE));
    if (interactive === false) {
      pano.set(HS.hsPath(name, "ondown"), "");
      pano.set(HS.hsPath(name, "onup"), "");
      pano.set(HS.hsPath(name, "enabled"), false);
      pano.set(HS.hsPath(name, "capture"), false);
    }
    vertexNames.push(name);
    vertexMap[name] = { targetName: targetName, index: index, isDraft: !!isDraft };
  }

  function addActionButton(name, point, ox, kind) {
    var pano = krpano();
    pano.call("addhotspot(" + HS.quote(name) + ")");
    pano.call("callwith(hotspot[" + HS.quote(name) + "], loadstyle(poly_act_btn));");
    pano.set(HS.hsPath(name, "ath"), point.ath);
    pano.set(HS.hsPath(name, "atv"), point.atv);
    pano.set(HS.hsPath(name, "ox"), ox);
    pano.set(HS.hsPath(name, "html"), actionHtml(kind));
    pano.set(HS.hsPath(name, "onclick"), kind === "ok"
      ? "js(onDrawFinishClick());"
      : kind === "edit"
        ? "js(onStartEditClick());"
        : "js(onDrawDeleteClick());");
    vertexNames.push(name);
  }

  function syncActionButtons(point) {
    var pano = krpano();
    if (!pano || !point) return;
    [ACT_OK, ACT_DEL, ACT_EDIT].forEach(function (name) {
      if (pano.get(HS.hsPath(name, "name"))) {
        pano.set(HS.hsPath(name, "ath"), point.ath);
        pano.set(HS.hsPath(name, "atv"), point.atv);
      }
    });
  }

  function renderVertices(targetName, points, isDraft) {
    clearVertices();
    for (var i = 0; i < points.length; i++) {
      addVertex(targetName, i, points[i], isDraft, i === points.length - 1);
    }
    if (points.length) {
      var last = points[points.length - 1];
      addActionButton(ACT_OK, last, -20, "ok");
      addActionButton(ACT_DEL, last, 20, "del");
    }
  }

  function setDrawEvents(enabled) {
    var pano = krpano();
    if (!pano) return;
    pano.set("events[editor_draw_events].enabled", !!enabled);
  }

  function setPolyHotspotsEnabled(enabled) {
    var pano = krpano();
    if (!pano) return;
    polyRecords().forEach(function (hs) {
      pano.set(HS.hsPath(HS.safeName(hs.id), "enabled"), enabled);
    });
    imageRecords().forEach(function (hs) {
      pano.set(HS.hsPath(HS.safeName(hs.id), "enabled"), enabled);
    });
  }

  function applyLiveStyle() {
    var pano = krpano();
    var record = currentRecord();
    if (!pano || !record || !HS.isPolyType(record.icon && record.icon.type)) return;
    if (drawing && (!draft || draft.points.length < 2)) return;
    HS.refreshPolyStyle(pano, record, {
      previewHover: styleTab === "hover"
    });
  }

  function fillForm(record) {
    if (!record) return;
    var icon = record.icon || {};
    var isPoly = HS.isPolyType(icon.type);
    var isImage = HS.isImageType(icon.type);
    els.title.value = record.title || "";
    els.settingsTitle.textContent = HS.typeLabel(icon.type) + "设置";
    els.polySettings.hidden = !isPoly;
    els.imageSettings.hidden = !isImage;
    els.nameField.hidden = isPoly || isImage;
    if (els.titleAccordion) els.titleAccordion.hidden = !isPoly && !isImage;
    els.fillField.hidden = icon.type !== HS.TYPE_POLYGON;
    if (isImage) fillImageForm(record);
    if (isPoly || isImage) fillTitleForm(record);
    if (!isPoly) return;
    var border = styleTab === "hover" ? icon.overBorderColor : icon.borderColor;
    var fill = styleTab === "hover" ? icon.overFillColor : icon.fillColor;
    var width = styleTab === "hover"
      ? (icon.overBorderWidth != null ? icon.overBorderWidth : icon.borderWidth)
      : icon.borderWidth;
    var borderHex = HS.rgbaToHex(border, { hex: 0x286efa, alpha: 1 });
    var fillHex = HS.rgbaToHex(fill, { hex: 0x0f0f0f, alpha: 0.5 });
    els.borderHex.value = borderHex;
    els.borderColor.value = borderHex;
    els.fillHex.value = fillHex;
    els.fillColor.value = fillHex;
    els.borderWidth.value = width != null ? width : 2;
    els.widthValue.textContent = els.borderWidth.value + "px";
    els.blink.checked = icon.blink === 1;
    Array.prototype.forEach.call(els.tabs.querySelectorAll(".tab"), function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-state") === styleTab);
    });
  }

  function writeFormToIcon() {
    var record = currentRecord();
    if (!record || !record.icon) return null;
    if (HS.isImageType(record.icon.type)) {
      writeImageForm(record);
      writeTitleForm(record);
      return record;
    }
    if (!HS.isPolyType(record.icon.type)) return null;
    var icon = record.icon;
    var fallbackBorder = { hex: 0x286efa, alpha: 1, r: 40, g: 110, b: 250 };
    var fallbackFill = { hex: 0x0f0f0f, alpha: 0.5, r: 15, g: 15, b: 15 };
    var width = Number(els.borderWidth.value) || 2;
    if (styleTab === "hover") {
      icon.overBorderColor = HS.replaceRgb(icon.overBorderColor, els.borderHex.value, fallbackBorder);
      icon.overBorderWidth = width;
      if (icon.type === HS.TYPE_POLYGON) {
        icon.overFillColor = HS.replaceRgb(icon.overFillColor, els.fillHex.value, fallbackFill);
      }
    } else {
      icon.borderColor = HS.replaceRgb(icon.borderColor, els.borderHex.value, fallbackBorder);
      icon.borderWidth = width;
      if (icon.type === HS.TYPE_POLYGON) {
        icon.fillColor = HS.replaceRgb(icon.fillColor, els.fillHex.value, fallbackFill);
      }
    }
    icon.blink = els.blink.checked ? 1 : 0;
    writeTitleForm(record);
    return record;
  }

  function pctFromScale(scale) {
    var n = Number(scale);
    if (isNaN(n)) n = 0.037;
    return Math.max(1, Math.min(200, n * 100));
  }

  function formatPct(value) {
    return Number(value).toFixed(1) + "%";
  }

  function formatDeg(value) {
    return Number(value).toFixed(1) + "°";
  }

  function fillImageForm(record) {
    var icon = record.icon || {};
    var scaleX = pctFromScale(icon.scaleX);
    var scaleY = pctFromScale(icon.scaleY != null ? icon.scaleY : icon.scaleX);
    els.imageZoom.checked = icon.zoom === true || icon.zoom === 1;
    els.imageFixed.checked = icon.stick !== 1;
    els.imageLock.checked = icon.scaleLock === 1;
    els.imageEdge.value = icon.edge || "center";
    els.imageScaleX.value = scaleX;
    els.imageScaleY.value = scaleY;
    els.imageScaleXValue.textContent = formatPct(scaleX);
    els.imageScaleYValue.textContent = formatPct(scaleY);
    els.imageRx.value = icon.rx || 0;
    els.imageRy.value = icon.ry || 0;
    els.imageRz.value = icon.rz != null ? icon.rz : (icon.rotate || 0);
    els.imageRxValue.textContent = formatDeg(els.imageRx.value);
    els.imageRyValue.textContent = formatDeg(els.imageRy.value);
    els.imageRzValue.textContent = formatDeg(els.imageRz.value);
    fillMattingForm(record);
    setImageAdvTab(imageAdvTab);
  }

  function writeImageForm(record) {
    if (!record || !record.icon) return;
    var icon = record.icon;
    icon.zoom = els.imageZoom.checked;
    icon.stick = els.imageFixed.checked ? 0 : 1;
    icon.scaleLock = els.imageLock.checked ? 1 : 0;
    icon.edge = els.imageEdge.value || "center";
    icon.scaleX = Number(els.imageScaleX.value) / 100;
    icon.scaleY = Number(els.imageScaleY.value) / 100;
    icon.rx = Number(els.imageRx.value) || 0;
    icon.ry = Number(els.imageRy.value) || 0;
    icon.rz = Number(els.imageRz.value) || 0;
    icon.rotate = icon.rz;
    writeMattingForm(record);
  }

  function formatMattingValue(value) {
    var n = Number(value);
    if (isNaN(n)) n = 0;
    n = Math.max(0, Math.min(1, n));
    return Number(n.toFixed(2));
  }

  function clampChannel(value) {
    var n = Math.round(Number(value));
    if (isNaN(n)) n = 0;
    return Math.max(0, Math.min(255, n));
  }

  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;
    var s = max === 0 ? 0 : d / max;
    var v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s, v: v };
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r = 0;
    var g = 0;
    var b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function hexFromRgb(rgb) {
    return HS.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function setImageAdvTab(tab) {
    imageAdvTab = tab || "detail";
    if (!els.imageAdvTabs) return;
    Array.prototype.forEach.call(els.imageAdvTabs.querySelectorAll(".tab"), function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === imageAdvTab);
    });
    els.imageAdvDetail.hidden = imageAdvTab !== "detail";
    els.imageAdvMatting.hidden = imageAdvTab !== "matting";
    if (els.imageReset) els.imageReset.textContent = imageAdvTab === "matting" ? "清除设置" : "重置设置";
    if (imageAdvTab !== "matting") hideColorPicker();
  }

  function fillMattingForm(record) {
    var icon = (record && record.icon) || {};
    var hex = HS.normalizeHex(icon.chromaColor);
    var opacity = icon.chromaThreshold != null ? formatMattingValue(icon.chromaThreshold) : DEFAULT_MATTING_THRESHOLD;
    var smooth = icon.chromaSmoothing != null ? formatMattingValue(icon.chromaSmoothing) : DEFAULT_MATTING_SMOOTHING;
    els.mattingOpacity.value = opacity;
    els.mattingSmooth.value = smooth;
    els.mattingOpacityValue.textContent = String(opacity);
    els.mattingSmoothValue.textContent = String(smooth);
    renderMattingColor(hex);
  }

  function writeMattingForm(record) {
    if (!record || !record.icon) return;
    var hex = HS.normalizeHex(els.mattingHex.textContent);
    if (hex) {
      record.icon.chromaColor = hex;
      record.icon.chromaThreshold = formatMattingValue(els.mattingOpacity.value);
      record.icon.chromaSmoothing = formatMattingValue(els.mattingSmooth.value);
    } else {
      delete record.icon.chromaColor;
      delete record.icon.chromaThreshold;
      delete record.icon.chromaSmoothing;
    }
  }

  function renderMattingColor(hex) {
    hex = HS.normalizeHex(hex);
    els.mattingHex.textContent = hex;
    els.mattingSwatch.style.background = hex || "";
  }

  function applyMattingColor(hex) {
    hex = HS.normalizeHex(hex);
    if (!hex) return;
    renderMattingColor(hex);
    applyLiveImage();
    if (colorPickerOpen) syncColorPicker(hex, false);
  }

  function hideColorPicker() {
    if (!els.colorPicker) return;
    els.colorPicker.hidden = true;
    colorPickerOpen = false;
    if (els.mattingColorBtn) els.mattingColorBtn.classList.remove("open");
  }

  function positionColorPicker() {
    if (!els.colorPicker || !els.mattingColorBtn) return;
    var rect = els.mattingColorBtn.getBoundingClientRect();
    var width = els.colorPicker.offsetWidth || 232;
    var height = els.colorPicker.offsetHeight || 280;
    var left = rect.right + 10;
    var top = rect.top;
    if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left);
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
    els.colorPicker.style.left = left + "px";
    els.colorPicker.style.top = top + "px";
  }

  function syncColorPicker(hex, apply) {
    hex = HS.normalizeHex(hex) || "#808080";
    var rgb = HS.hexToRgb(hex);
    cpState = rgbToHsv(rgb.r, rgb.g, rgb.b);
    els.cpSv.style.background = "hsl(" + cpState.h + ", 100%, 50%)";
    els.cpSvCursor.style.left = (cpState.s * 100) + "%";
    els.cpSvCursor.style.top = ((1 - cpState.v) * 100) + "%";
    els.cpHueCursor.style.left = ((cpState.h / 360) * 100) + "%";
    els.cpHex.value = hex.replace("#", "").toUpperCase();
    els.cpR.value = rgb.r;
    els.cpG.value = rgb.g;
    els.cpB.value = rgb.b;
    if (apply) applyMattingColor(hex);
  }

  function colorFromCpState() {
    return hexFromRgb(hsvToRgb(cpState.h, cpState.s, cpState.v));
  }

  function showColorPicker() {
    if (!els.colorPicker) return;
    stopScenePick();
    var hex = HS.normalizeHex(els.mattingHex.textContent) || "#808080";
    els.colorPicker.hidden = false;
    colorPickerOpen = true;
    els.mattingColorBtn.classList.add("open");
    syncColorPicker(hex, false);
    positionColorPicker();
  }

  function toggleColorPicker() {
    if (colorPickerOpen) hideColorPicker();
    else showColorPicker();
  }

  function updateCpFromPointer(kind, ev) {
    var node = kind === "hue" ? els.cpHue : els.cpSv;
    var rect = node.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width;
    var y = (ev.clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    if (kind === "hue") cpState.h = x * 360;
    else {
      cpState.s = x;
      cpState.v = 1 - y;
    }
    syncColorPicker(colorFromCpState(), true);
  }

  function initColorPicker() {
    if (!els.cpSwatches) return;
    CP_PRESETS.forEach(function (color) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-color", color);
      btn.style.background = color;
      els.cpSwatches.appendChild(btn);
    });
    els.cpSwatches.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-color]");
      if (!btn) return;
      syncColorPicker(btn.getAttribute("data-color"), true);
    });
    function bindDrag(node, kind) {
      node.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        cpDrag = kind;
        updateCpFromPointer(kind, ev);
      });
    }
    bindDrag(els.cpSv, "sv");
    bindDrag(els.cpHue, "hue");
    document.addEventListener("mousemove", function (ev) {
      if (!cpDrag) return;
      updateCpFromPointer(cpDrag, ev);
    });
    document.addEventListener("mouseup", function () {
      cpDrag = null;
    });
    els.cpHex.addEventListener("change", function () {
      var hex = HS.normalizeHex(els.cpHex.value);
      if (hex) syncColorPicker(hex, true);
      else syncColorPicker(colorFromCpState(), false);
    });
    function onRgbChange() {
      var hex = hexFromRgb({
        r: clampChannel(els.cpR.value),
        g: clampChannel(els.cpG.value),
        b: clampChannel(els.cpB.value)
      });
      syncColorPicker(hex, true);
    }
    [els.cpR, els.cpG, els.cpB].forEach(function (input) {
      input.addEventListener("change", onRgbChange);
    });
    document.addEventListener("mousedown", function (ev) {
      if (!colorPickerOpen) return;
      if (els.colorPicker.contains(ev.target) || els.mattingColorBtn.contains(ev.target)) return;
      hideColorPicker();
    });
  }

  function getPanoCanvas() {
    return document.querySelector("#pano canvas");
  }

  function sampleScreenshotColor(pano) {
    if (!pano || !pano.webGL || typeof pano.webGL.makeScreenshot !== "function") return "";
    var shot = pano.webGL.makeScreenshot(0, 0, true, "canvas");
    if (!shot) return "";
    var mx = Math.round(Number(pano.get("mouse.stagex")));
    var my = Math.round(Number(pano.get("mouse.stagey")));
    if (isNaN(mx) || isNaN(my) || mx < 0 || my < 0 || mx >= shot.width || my >= shot.height) return "";
    try {
      var pix = shot.getContext("2d").getImageData(mx, my, 1, 1).data;
      if (pix[3] > 0 || pix[0] || pix[1] || pix[2]) {
        return hexFromRgb({ r: pix[0], g: pix[1], b: pix[2] });
      }
    } catch (err) {}
    return "";
  }

  function sampleCanvasColor(clientX, clientY) {
    var canvas = getPanoCanvas();
    if (!canvas) return "";
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = Math.round((clientX - rect.left) * scaleX);
    var y = Math.round((clientY - rect.top) * scaleY);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return "";
    try {
      var tmp = document.createElement("canvas");
      tmp.width = 1;
      tmp.height = 1;
      var ctx = tmp.getContext("2d");
      ctx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
      var data = ctx.getImageData(0, 0, 1, 1).data;
      if (data[3] > 0 || data[0] || data[1] || data[2]) {
        return hexFromRgb({ r: data[0], g: data[1], b: data[2] });
      }
    } catch (err) {}
    return "";
  }

  function stopScenePick() {
    if (!pickingColor) return;
    pickingColor = false;
    document.body.classList.remove("picking-scene-color");
    if (els.mattingEyedropper) els.mattingEyedropper.classList.remove("active");
    document.getElementById("pano").removeEventListener("click", onScenePickClick, true);
    document.getElementById("pano").removeEventListener("mousemove", onScenePickMove, true);
    var pano = krpano();
    if (pano && savedUserControl != null) {
      pano.set("control.usercontrol", savedUserControl);
      savedUserControl = null;
    }
  }

  function onScenePickMove(ev) {
    if (!pickingColor) return;
    ev.preventDefault();
  }

  function onScenePickClick(ev) {
    if (!pickingColor) return;
    ev.preventDefault();
    ev.stopPropagation();
    var pano = krpano();
    var record = currentRecord();
    var name = record && HS.isImageType(record.icon && record.icon.type) ? HS.safeName(record.id) : null;
    var backup = null;
    if (pano && name) {
      backup = pano.get(HS.hsPath(name, "chromakey"));
      pano.set(HS.hsPath(name, "chromakey"), null);
    }
    var hex = sampleScreenshotColor(pano);
    if (!hex) hex = sampleCanvasColor(ev.clientX, ev.clientY);
    if (pano && name && backup) pano.set(HS.hsPath(name, "chromakey"), backup);
    stopScenePick();
    if (hex) {
      applyMattingColor(hex);
      setStatus("已选取抠像颜色 " + hex, "ok");
    } else {
      setStatus("未能读取该点颜色，请改用调色盘", "error");
    }
  }

  function startScenePick() {
    hideColorPicker();
    if (pickingColor) {
      stopScenePick();
      return;
    }
    var pano = krpano();
    pickingColor = true;
    document.body.classList.add("picking-scene-color");
    els.mattingEyedropper.classList.add("active");
    document.getElementById("pano").addEventListener("click", onScenePickClick, true);
    document.getElementById("pano").addEventListener("mousemove", onScenePickMove, true);
    if (pano) {
      savedUserControl = pano.get("control.usercontrol");
      pano.set("control.usercontrol", "off");
    }
    setStatus("点击场景选取要去除的颜色，Esc 取消");
  }

  function startEyedropper() {
    hideColorPicker();
    if (window.EyeDropper) {
      var dropper = new EyeDropper();
      els.mattingEyedropper.classList.add("active");
      dropper.open().then(function (result) {
        applyMattingColor(result.sRGBHex);
        setStatus("已选取抠像颜色 " + HS.normalizeHex(result.sRGBHex), "ok");
      }).catch(function () {
        setStatus("已取消取色");
      }).then(function () {
        els.mattingEyedropper.classList.remove("active");
      });
      return;
    }
    startScenePick();
  }

  function onMattingSliderInput() {
    els.mattingOpacityValue.textContent = String(formatMattingValue(els.mattingOpacity.value));
    els.mattingSmoothValue.textContent = String(formatMattingValue(els.mattingSmooth.value));
    applyLiveImage();
  }

  function nudgeMattingSlider(kind, delta) {
    var input = kind === "smooth" ? els.mattingSmooth : els.mattingOpacity;
    input.value = formatMattingValue(Number(input.value) + Number(delta));
    onMattingSliderInput();
  }

  function applyLiveImage() {
    var pano = krpano();
    var record = currentRecord();
    if (!pano || !record || !HS.isImageType(record.icon && record.icon.type)) return;
    writeImageForm(record);
    writeTitleForm(record);
    HS.applyImageAppearance(pano, record);
    HS.applyTitleHotspot(pano, record, { editable: true });
    renderList();
  }

  function syncImageInteraction() {
    var pano = krpano();
    if (!pano) return;
    imageRecords().forEach(function (hs) {
      var name = HS.safeName(hs.id);
      var selected = !drawing && hs.id === selectedId;
      pano.set(HS.hsPath(name, "ondown"), selected ? "drag_image();" : "");
      pano.set(HS.hsPath(name, "onup"), selected ? "js(onImageDragEnd());" : "");
      pano.set(HS.hsPath(name, "capture"), selected);
      pano.set(HS.hsPath(name, "onclick"), selected ? "" : "js(onEditorSelectHotspot(" + HS.quote(name) + "));");
    });
  }

  function moveImageBy(dath, datv) {
    var record = currentRecord();
    if (!record || !HS.isImageType(record.icon && record.icon.type)) return;
    var oldAth = Number(record.icon.ath) || 0;
    var oldAtv = Number(record.icon.atv) || 0;
    record.icon.ath = oldAth + dath;
    record.icon.atv = oldAtv + datv;
    var ts = HS.ensureTitleSetting(record);
    if (ts.ath == null) ts.ath = oldAth;
    if (ts.atv == null) ts.atv = oldAtv;
    ts.ath = Number(ts.ath) + dath;
    ts.atv = Number(ts.atv) + datv;
    var pano = krpano();
    if (pano) {
      HS.applyImageAppearance(pano, record);
      HS.applyTitleHotspot(pano, record, { editable: true });
    }
  }

  function onImageScaleInput(axis) {
    var record = currentRecord();
    if (!record || !record.icon) return;
    var x = Number(els.imageScaleX.value);
    var y = Number(els.imageScaleY.value);
    if (els.imageLock.checked) {
      var sx = pctFromScale(record.icon.scaleX);
      var sy = pctFromScale(record.icon.scaleY != null ? record.icon.scaleY : record.icon.scaleX);
      var ratio = sx ? sy / sx : 1;
      if (axis === "x") {
        y = Math.max(1, Math.min(200, Number((x * ratio).toFixed(1))));
        els.imageScaleY.value = y;
      } else {
        x = ratio ? Math.max(1, Math.min(200, Number((y / ratio).toFixed(1)))) : y;
        els.imageScaleX.value = x;
      }
    }
    els.imageScaleXValue.textContent = formatPct(els.imageScaleX.value);
    els.imageScaleYValue.textContent = formatPct(els.imageScaleY.value);
    applyLiveImage();
  }

  function resetImageAdvanced() {
    var record = currentRecord();
    if (!record || !record.icon) return;
    if (imageAdvTab === "matting") {
      delete record.icon.chromaColor;
      delete record.icon.chromaThreshold;
      delete record.icon.chromaSmoothing;
      fillMattingForm(record);
      hideColorPicker();
      applyLiveImage();
      setStatus("已清除抠像设置", "ok");
      return;
    }
    var defaults = HS.defaultImageIcon();
    record.icon.edge = defaults.edge;
    record.icon.scaleLock = defaults.scaleLock;
    record.icon.scaleX = defaults.scaleX;
    record.icon.scaleY = defaults.scaleY;
    record.icon.rx = defaults.rx;
    record.icon.ry = defaults.ry;
    record.icon.rz = defaults.rz;
    record.icon.rotate = defaults.rotate;
    fillImageForm(record);
    applyLiveImage();
    setStatus("已重置图片细节设置", "ok");
  }

  function fillTitleForm(record) {
    var ts = HS.ensureTitleSetting(record);
    var text = record.title || "";
    els.title.value = text;
    els.titleText.value = text;
    els.titleCount.textContent = text.length + "/500";
    els.showTitle.checked = record.showTitle !== 0;
    els.titleZoom.checked = ts.zoom === true || ts.zoom === 1;
    els.titleFixed.checked = ts.fixedHV === 1;
    els.titleHover.checked = ts.showWhenHoving === 1;
  }

  function writeTitleForm(record) {
    if (!record) return;
    var ts = HS.ensureTitleSetting(record);
    record.title = (els.titleText.value || els.title.value || "").trim() || HS.typeLabel(record.icon && record.icon.type);
    record.showTitle = els.showTitle.checked ? 1 : 0;
    ts.zoom = els.titleZoom.checked;
    ts.fixedHV = els.titleFixed.checked ? 1 : 0;
    ts.showWhenHoving = els.titleHover.checked ? 1 : 0;
    els.title.value = record.title;
    els.titleText.value = record.title;
    els.titleCount.textContent = String(record.title || "").length + "/500";
  }

  function applyLiveTitle() {
    var pano = krpano();
    var record = currentRecord();
    if (!pano || !record || drawing) return;
    writeTitleForm(record);
    HS.applyTitleHotspot(pano, record, { editable: true });
    renderList();
  }

  function onStyleChange() {
    writeFormToIcon();
    els.widthValue.textContent = els.borderWidth.value + "px";
    applyLiveStyle();
    if (!drawing) renderList();
  }

  function setColorPair(hexInput, colorInput, value) {
    var hex = String(value || "").trim();
    if (hex.charAt(0) !== "#") hex = "#" + hex;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return;
    if (hex.length === 4) {
      hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    hexInput.value = hex.toLowerCase();
    colorInput.value = hex;
    onStyleChange();
  }

  function resetCurrentColors() {
    var record = currentRecord();
    if (!record || !record.icon) return;
    var defaults = HS.defaultPolyIcon(record.icon.type);
    if (styleTab === "hover") {
      record.icon.overBorderColor = defaults.overBorderColor;
      record.icon.overBorderWidth = defaults.overBorderWidth;
      if (defaults.overFillColor) record.icon.overFillColor = defaults.overFillColor;
    } else {
      record.icon.borderColor = defaults.borderColor;
      record.icon.borderWidth = defaults.borderWidth;
      if (defaults.fillColor) record.icon.fillColor = defaults.fillColor;
    }
    fillForm(record);
    applyLiveStyle();
  }

  function openSettings(id) {
    var record = HS.findHotspot(tourData, id);
    if (!record) return;
    if (HS.isPolyType(record.icon && record.icon.type)) {
      inspectShape(record);
      return;
    }
    if (drawing) cancelDraw(true);
    selectedId = id;
    styleTab = "normal";
    imageAdvTab = "detail";
    hideColorPicker();
    stopScenePick();
    showPanel("settings");
    fillForm(record);
    clearVertices();
    syncImageInteraction();
    var pano = krpano();
    if (pano) HS.applyTitleHotspot(pano, record, { editable: true });
    updateDrawButtons();
    renderList();
    setStatus("拖动图片调整位置，或在侧栏修改样式");
  }

  function inspectShape(record) {
    if (drawing && draft && draft.existingId === record.id) return;
    if (drawing) cancelDraw(true);
    selectedId = record.id;
    styleTab = "normal";
    showPanel("settings");
    fillForm(record);
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    renderInspectAnchor(record);
    updateDrawButtons();
    renderList();
    syncImageInteraction();
    setStatus("点击最新端点上的编辑图标开始改点");
  }

  function resumeDraw(record) {
    if (drawing && draft && draft.existingId === record.id) return;
    if (drawing) cancelDraw(true);
    var pano = krpano();
    selectedId = record.id;
    drawing = true;
    HS.ensureTitleSetting(record);
    draft = {
      type: record.icon.type,
      points: HS.unwrapPoints(record.icon.points).slice(),
      title: record.title,
      icon: record.icon,
      showTitle: record.showTitle,
      titleSetting: record.titleSetting,
      existingId: record.id
    };
    HS.removeHotspot(pano, HS.safeName(record.id));
    setPolyHotspotsEnabled(false);
    setDrawEvents(true);
    showPanel("settings");
    fillForm(draft);
    renderDraft();
    updateDrawButtons();
    renderList();
    setStatus(record.icon.type === HS.TYPE_POLYGON
      ? "编辑多边形：点击加点，可自由删点，至少 3 点后完成"
      : "编辑折线：点击加点，可自由删点，至少 2 点后完成");
  }

  function settleSettings(record) {
    selectedId = record.id;
    drawing = false;
    draft = null;
    showPanel("settings");
    fillForm(record);
    renderInspectAnchor(record);
    updateDrawButtons();
    renderList();
    syncImageInteraction();
  }

  function backToList(cancelIfDrawing) {
    if (drawing && cancelIfDrawing !== false) cancelDraw(true);
    selectedId = null;
    styleTab = "normal";
    imageAdvTab = "detail";
    hideColorPicker();
    stopScenePick();
    clearVertices();
    showPanel("list");
    renderList();
    updateDrawButtons();
    syncImageInteraction();
    setStatus("从列表进入热点设置，或添加多边形 / 折线 / 图片");
  }

  function renderDraft() {
    var pano = krpano();
    HS.removeHotspot(pano, DRAFT_NAME);
    if (!draft || draft.points.length < 1) {
      clearVertices();
      return;
    }
    var asLine = draft.type === HS.TYPE_POLYLINE || draft.points.length < 3;
    var icon = {};
    Object.keys(draft.icon).forEach(function (key) {
      icon[key] = draft.icon[key];
    });
    icon.points = draft.points;
    var record = {
      id: DRAFT_NAME,
      zOrder: 999,
      visible: 1,
      icon: icon
    };
    if (draft.points.length >= 2) {
      HS.addPolyHotspot(pano, record, asLine, { editable: true });
      pano.set(HS.hsPath(DRAFT_NAME, "onclick"), "");
      pano.set(HS.hsPath(DRAFT_NAME, "enabled"), false);
      applyLiveStyle();
    }
    renderVertices(DRAFT_NAME, draft.points, true);
  }

  function renderInspectAnchor(record) {
    clearVertices();
    if (!record || !record.icon || !record.icon.points || !record.icon.points.length) return;
    var points = HS.unwrapPoints(record.icon.points);
    var last = points[points.length - 1];
    addVertex(HS.safeName(record.id), points.length - 1, last, false, true, false);
    addActionButton(ACT_EDIT, last, 0, "edit");
  }

  function startDraw(type) {
    if (drawing) cancelDraw(true);
    selectedId = null;
    drawing = true;
    var sceneName = HS.getScene(tourData) && HS.getScene(tourData).name;
    draft = {
      type: type,
      points: [],
      title: sceneName || HS.typeLabel(type),
      icon: HS.defaultPolyIcon(type),
      showTitle: 1,
      titleSetting: HS.defaultTitleSetting()
    };
    styleTab = "normal";
    clearVertices();
    setPolyHotspotsEnabled(false);
    setDrawEvents(true);
    showPanel("settings");
    fillForm(draft);
    updateDrawButtons();
    syncImageInteraction();
    setStatus(type === HS.TYPE_POLYGON
      ? "绘制多边形：点击全景加点，至少 3 点后点完成"
      : "绘制折线：点击全景加点，至少 2 点后点完成");
  }

  function startImage() {
    if (drawing) cancelDraw(true);
    var pano = krpano();
    if (!pano) return;
    var ath = Number(pano.get("view.hlookat")) || 0;
    var atv = Number(pano.get("view.vlookat")) || 0;
    var record = HS.createImageHotspotRecord(ath, atv, HS.nextZOrder(tourData));
    var sceneName = HS.getScene(tourData) && HS.getScene(tourData).name;
    if (sceneName) record.title = sceneName;
    HS.upsertHotspot(tourData, record);
    HS.addImageHotspot(pano, record, { editable: true });
    openSettings(record.id);
    setStatus("已添加图片热点，可拖动位置或在侧栏调整，记得保存", "ok");
  }

  function cancelDraw(silent) {
    var pano = krpano();
    var existingId = draft && draft.existingId;
    drawing = false;
    draft = null;
    if (pano) HS.removeHotspot(pano, DRAFT_NAME);
    clearVertices();
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    if (existingId && pano) {
      var record = HS.findHotspot(tourData, existingId);
      if (record) {
        HS.addPolyHotspot(pano, record, record.icon.type === HS.TYPE_POLYLINE, { editable: true });
        HS.applyTitleHotspot(pano, record, { editable: true });
      }
    }
    updateDrawButtons();
    syncImageInteraction();
    if (!silent) setStatus("已取消绘制");
  }

  function finishDraw() {
    if (!drawing || !draft) return;
    var minPoints = draft.type === HS.TYPE_POLYGON ? 3 : 2;
    if (draft.points.length < minPoints) {
      setStatus("点数不足，无法完成", "error");
      return;
    }
    writeFormToIcon();
    var pano = krpano();
    var record;
    if (draft.existingId) {
      record = HS.findHotspot(tourData, draft.existingId);
      HS.syncRecordPoints(record, draft.points);
      record.title = draft.title || record.title;
      record.showTitle = draft.showTitle != null ? draft.showTitle : record.showTitle;
      record.titleSetting = draft.titleSetting || record.titleSetting;
    } else {
      record = HS.createHotspotRecord(draft.type, draft.points, HS.nextZOrder(tourData), draft.icon);
      record.title = draft.title || HS.typeLabel(draft.type);
      record.showTitle = draft.showTitle != null ? draft.showTitle : 1;
      record.titleSetting = draft.titleSetting || HS.defaultTitleSetting();
      if (record.titleSetting.ath == null) record.titleSetting.ath = record.icon.ath;
      if (record.titleSetting.atv == null) record.titleSetting.atv = record.icon.atv;
      HS.upsertHotspot(tourData, record);
    }
    HS.removeHotspot(pano, DRAFT_NAME);
    drawing = false;
    draft = null;
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    HS.addPolyHotspot(pano, record, record.icon.type === HS.TYPE_POLYLINE, { editable: true });
    HS.applyTitleHotspot(pano, record, { editable: true });
    settleSettings(record);
    setStatus("已完成" + HS.typeLabel(record.icon.type) + "编辑，记得保存", "ok");
  }

  function deleteLastEditPoint() {
    undoPoint();
  }

  function finishEditVertices() {
    clearVertices();
    setStatus("已完成点编辑，可继续改样式或拖动标题", "ok");
  }

  function undoPoint() {
    if (!drawing || !draft || !draft.points.length) return;
    draft.points.pop();
    renderDraft();
    updateDrawButtons();
    setStatus("已撤销一点，当前 " + draft.points.length + " 点");
  }

  function addPoint(ath, atv) {
    if (!drawing || !draft) return;
    draft.points.push({ ath: ath, atv: atv });
    renderDraft();
    updateDrawButtons();
    setStatus("已添加第 " + draft.points.length + " 点");
  }

  function deleteSelected() {
    if (drawing || !selectedId) return;
    var pano = krpano();
    var name = HS.safeName(selectedId);
    HS.removeHotspot(pano, name);
    HS.removeTitleHotspot(pano, selectedId);
    HS.removeHotspotRecord(tourData, selectedId);
    selectedId = null;
    clearVertices();
    showPanel("list");
    renderList();
    updateDrawButtons();
    syncImageInteraction();
    setStatus("已删除，记得保存", "ok");
  }

  function save() {
    if (drawing) {
      setStatus("请先完成绘制再保存", "error");
      return;
    }
    writeFormToIcon();
    setStatus("保存中…");
    TourAPI.saveTour(tourData)
      .then(function (result) {
        setStatus(result && result.local ? "已保存到本机（GitHub Pages 无法写回仓库）" : "已保存", "ok");
      })
      .catch(function (err) {
        setStatus(err.message || "保存失败", "error");
      });
  }

  window.onPanoLoaded = function () {
    var pano = krpano();
    if (!pano || !pano.get("xml.scene") || !tourData || loaded) return;
    loaded = true;
    HS.applyHotspots(pano, tourData, { editable: true });
    renderList();
    updateDrawButtons();
    setStatus("从列表进入热点设置，或添加多边形 / 折线 / 图片");
  };

  window.onEditorPanoClick = function () {
    if (ignorePanoClick) return;
    var pano = krpano();
    if (!pano || !drawing) return;
    var now = Date.now();
    if (now - lastClickAt < 280 && draft && draft.points.length >= (draft.type === HS.TYPE_POLYGON ? 3 : 2)) {
      finishDraw();
      lastClickAt = 0;
      return;
    }
    lastClickAt = now;
    pano.call("screentosphere(mouse.x, mouse.y, click_ath, click_atv)");
    addPoint(Number(pano.get("click_ath")), Number(pano.get("click_atv")));
  };

  window.onEditorSelectHotspot = function (name) {
    if (drawing) return;
    var id = krpano().get(HS.hsPath(name, "data_id")) || name;
    openSettings(id);
  };

  window.onVertexDrag = function (name) {
    var pano = krpano();
    var meta = vertexMap[name];
    if (!pano || !meta) return;
    var ath = Number(pano.get(HS.hsPath(name, "ath")));
    var atv = Number(pano.get(HS.hsPath(name, "atv")));
    pano.set(HS.hsPath(meta.targetName, "point[" + meta.index + "].ath"), ath);
    pano.set(HS.hsPath(meta.targetName, "point[" + meta.index + "].atv"), atv);
    if (meta.isDraft && draft) {
      draft.points[meta.index] = { ath: ath, atv: atv };
      if (meta.index === draft.points.length - 1) syncActionButtons(draft.points[meta.index]);
      return;
    }
    var record = HS.findHotspot(tourData, selectedId);
    if (!record) return;
    HS.syncRecordPoints(record, HS.readPoints(pano, meta.targetName));
    if (meta.index === (record.icon.points || []).length - 1) {
      syncActionButtons({ ath: ath, atv: atv });
    }
  };

  window.onVertexDragEnd = function () {
    renderList();
  };

  window.onImageDrag = function (name) {
    var pano = krpano();
    var record = currentRecord();
    if (!pano || !record || !HS.isImageType(record.icon && record.icon.type)) return;
    var ath = Number(pano.get(HS.hsPath(name, "ath")));
    var atv = Number(pano.get(HS.hsPath(name, "atv")));
    var oldAth = Number(record.icon.ath || 0);
    var oldAtv = Number(record.icon.atv || 0);
    var dath = ath - oldAth;
    var datv = atv - oldAtv;
    var ts = record.titleSetting || HS.ensureTitleSetting(record);
    var titleAth = ts.ath != null ? Number(ts.ath) : oldAth;
    var titleAtv = ts.atv != null ? Number(ts.atv) : oldAtv;
    record.icon.ath = ath;
    record.icon.atv = atv;
    ts.ath = titleAth + dath;
    ts.atv = titleAtv + datv;
    HS.applyTitleHotspot(pano, record, { editable: true });
  };

  window.onImageDragEnd = function () {
    setStatus("图片位置已更新，记得保存", "ok");
  };

  window.onTitleDrag = function (name) {
    var pano = krpano();
    var record = currentRecord();
    if (!pano || !record) return;
    var ts = HS.ensureTitleSetting(record);
    ts.ath = Number(pano.get(HS.hsPath(name, "ath")));
    ts.atv = Number(pano.get(HS.hsPath(name, "atv")));
  };

  window.onTitleDragEnd = function () {
    setStatus("标题位置已更新，记得保存", "ok");
  };

  window.onStartEditClick = function () {
    ignorePanoClick = true;
    var record = selectedId ? HS.findHotspot(tourData, selectedId) : null;
    if (record) resumeDraw(record);
    setTimeout(function () { ignorePanoClick = false; }, 50);
  };

  window.onDrawFinishClick = function () {
    ignorePanoClick = true;
    if (drawing) finishDraw();
    else finishEditVertices();
    setTimeout(function () { ignorePanoClick = false; }, 50);
  };

  window.onDrawDeleteClick = function () {
    ignorePanoClick = true;
    if (drawing) undoPoint();
    else deleteLastEditPoint();
    setTimeout(function () { ignorePanoClick = false; }, 50);
  };

  els.add.addEventListener("click", function () {
    if (allRecords().length >= MAX_HOTSPOTS) {
      setStatus("热点数量已达上限", "error");
      return;
    }
    showPanel("picker");
  });
  els.pickerBack.addEventListener("click", function () { showPanel("list"); });
  els.settingsBack.addEventListener("click", function () { backToList(true); });
  els.pickPoly.addEventListener("click", function () { startDraw(HS.TYPE_POLYGON); });
  els.pickLine.addEventListener("click", function () { startDraw(HS.TYPE_POLYLINE); });
  if (els.pickImage) {
    els.pickImage.addEventListener("click", startImage);
  }
  els.finish.addEventListener("click", finishDraw);
  els.undo.addEventListener("click", undoPoint);
  els.remove.addEventListener("click", deleteSelected);
  els.save.addEventListener("click", save);
  els.search.addEventListener("input", function () {
    searchText = els.search.value;
    renderList();
  });
  els.title.addEventListener("input", function () {
    var record = currentRecord();
    if (!record) return;
    record.title = els.title.value;
    if (els.titleText) els.titleText.value = els.title.value;
    if (els.titleCount) els.titleCount.textContent = els.title.value.length + "/500";
    if (drawing && draft) draft.title = els.title.value;
    renderList();
    if (!drawing) applyLiveTitle();
  });
  if (els.titleText) {
    els.titleText.addEventListener("input", function () {
      var record = currentRecord();
      if (!record) return;
      record.title = els.titleText.value;
      els.title.value = els.titleText.value;
      els.titleCount.textContent = els.titleText.value.length + "/500";
      if (drawing && draft) draft.title = els.titleText.value;
      renderList();
      if (!drawing) applyLiveTitle();
    });
  }
  [els.showTitle, els.titleZoom, els.titleFixed, els.titleHover].forEach(function (input) {
    if (!input) return;
    input.addEventListener("change", function () {
      if (!drawing) applyLiveTitle();
      else writeTitleForm(currentRecord());
    });
  });
  if (els.titleToggle) {
    els.titleToggle.addEventListener("click", function () {
      els.titleAccordion.classList.toggle("open");
    });
  }
  els.tabs.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".tab");
    if (!btn) return;
    writeFormToIcon();
    styleTab = btn.getAttribute("data-state") || "normal";
    fillForm(currentRecord());
    applyLiveStyle();
  });
  els.borderColor.addEventListener("input", function () {
    setColorPair(els.borderHex, els.borderColor, els.borderColor.value);
  });
  els.borderHex.addEventListener("change", function () {
    setColorPair(els.borderHex, els.borderColor, els.borderHex.value);
  });
  els.fillColor.addEventListener("input", function () {
    setColorPair(els.fillHex, els.fillColor, els.fillColor.value);
  });
  els.fillHex.addEventListener("change", function () {
    setColorPair(els.fillHex, els.fillColor, els.fillHex.value);
  });
  els.borderWidth.addEventListener("input", onStyleChange);
  els.blink.addEventListener("change", onStyleChange);
  els.resetBorder.addEventListener("click", resetCurrentColors);
  els.resetFill.addEventListener("click", resetCurrentColors);

  [els.imageZoom, els.imageFixed, els.imageLock, els.imageEdge].forEach(function (input) {
    if (!input) return;
    input.addEventListener("change", applyLiveImage);
  });
  if (els.imageScaleX) {
    els.imageScaleX.addEventListener("input", function () { onImageScaleInput("x"); });
  }
  if (els.imageScaleY) {
    els.imageScaleY.addEventListener("input", function () { onImageScaleInput("y"); });
  }
  function bindRotation(input, label) {
    if (!input || !label) return;
    input.addEventListener("input", function () {
      label.textContent = formatDeg(input.value);
      applyLiveImage();
    });
  }
  bindRotation(els.imageRx, els.imageRxValue);
  bindRotation(els.imageRy, els.imageRyValue);
  bindRotation(els.imageRz, els.imageRzValue);
  if (els.imageNudge) {
    els.imageNudge.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-dir]");
      if (!btn) return;
      var dir = btn.getAttribute("data-dir");
      var step = 1;
      if (dir === "up") moveImageBy(0, -step);
      else if (dir === "down") moveImageBy(0, step);
      else if (dir === "left") moveImageBy(-step, 0);
      else if (dir === "right") moveImageBy(step, 0);
      setStatus("图片位置已更新，记得保存", "ok");
    });
  }
  if (els.imageAdvTabs) {
    els.imageAdvTabs.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".tab");
      if (!btn) return;
      var tab = btn.getAttribute("data-tab") || "detail";
      setImageAdvTab(tab);
    });
  }
  if (els.mattingColorBtn) {
    els.mattingColorBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      toggleColorPicker();
    });
  }
  if (els.mattingEyedropper) {
    els.mattingEyedropper.addEventListener("click", function (ev) {
      ev.stopPropagation();
      startEyedropper();
    });
  }
  if (els.mattingOpacity) {
    els.mattingOpacity.addEventListener("input", onMattingSliderInput);
  }
  if (els.mattingSmooth) {
    els.mattingSmooth.addEventListener("input", onMattingSliderInput);
  }
  document.querySelectorAll(".range-step[data-matting]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      nudgeMattingSlider(btn.getAttribute("data-matting"), btn.getAttribute("data-delta"));
    });
  });
  initColorPicker();
  window.addEventListener("resize", function () {
    if (colorPickerOpen) positionColorPicker();
  });
  if (els.imageAdvToggle) {
    els.imageAdvToggle.addEventListener("click", function () {
      els.imageAdvanced.classList.toggle("open");
    });
  }
  if (els.imageReset) {
    els.imageReset.addEventListener("click", resetImageAdvanced);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && drawing) {
      ev.preventDefault();
      finishDraw();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      if (pickingColor) {
        stopScenePick();
        setStatus("已取消取色");
      } else if (colorPickerOpen) {
        hideColorPicker();
      } else if (drawing) backToList(true);
      else if (panel === "picker" || panel === "settings") showPanel("list");
    } else if ((ev.key === "Backspace" || ev.key === "Delete") && drawing && document.activeElement === document.body) {
      ev.preventDefault();
      undoPoint();
    }
  });

  TourAPI.getTour()
    .then(function (data) {
      tourData = data;
      window.onPanoLoaded();
    })
    .catch(function (err) {
      setStatus(err.message || "数据加载失败", "error");
    });
})();
