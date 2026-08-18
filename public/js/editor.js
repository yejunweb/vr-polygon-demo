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
    titleAccordion: document.getElementById("title-settings")
  };

  var ignorePanoClick = false;
  var VERTEX_BLUE = "#286EFA";
  var VERTEX_RED = "#E23C3C";
  var ACT_OK = "vtx_act_ok";
  var ACT_DEL = "vtx_act_del";

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
    var icon = kind === "ok"
      ? "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>"
      : "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6l-1 14H6L5 6\"/><path d=\"M10 11v6M14 11v6\"/><path d=\"M9 6V4h6v2\"/></svg>";
    return "<div style=\"width:32px;height:32px;border-radius:6px;background:rgba(20,22,26,.78);display:flex;align-items:center;justify-content:center;\">" + icon + "</div>";
  }

  function addVertex(targetName, index, point, isDraft, isLatest) {
    var pano = krpano();
    var name = "vtx_" + index;
    pano.call("addhotspot(" + HS.quote(name) + ")");
    pano.call("callwith(hotspot[" + HS.quote(name) + "], loadstyle(poly_vertex));");
    pano.set(HS.hsPath(name, "ath"), point.ath);
    pano.set(HS.hsPath(name, "atv"), point.atv);
    pano.set(HS.hsPath(name, "html"), vertexHtml(isLatest ? VERTEX_RED : VERTEX_BLUE));
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
      : "js(onDrawDeleteClick());");
    vertexNames.push(name);
  }

  function syncActionButtons(point) {
    var pano = krpano();
    if (!pano || !point) return;
    [ACT_OK, ACT_DEL].forEach(function (name) {
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
    polyRecords().forEach(function (hs) {
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
    els.title.value = record.title || "";
    els.settingsTitle.textContent = HS.typeLabel(icon.type) + "设置";
    els.polySettings.hidden = !isPoly;
    els.imageSettings.hidden = isPoly;
    els.nameField.hidden = isPoly;
    els.fillField.hidden = icon.type !== HS.TYPE_POLYGON;
    if (!isPoly) return;
    fillTitleForm(record);
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
    if (!record || !HS.isPolyType(record.icon && record.icon.type)) return null;
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
      resumeDraw(record);
      return;
    }
    if (drawing) cancelDraw(true);
    selectedId = id;
    styleTab = "normal";
    showPanel("settings");
    fillForm(record);
    clearVertices();
    updateDrawButtons();
    renderList();
    setStatus("图片热点");
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
    clearVertices();
    updateDrawButtons();
    renderList();
  }

  function backToList(cancelIfDrawing) {
    if (drawing && cancelIfDrawing !== false) cancelDraw(true);
    selectedId = null;
    styleTab = "normal";
    clearVertices();
    showPanel("list");
    renderList();
    updateDrawButtons();
    setStatus("从列表进入热点设置，或添加多边形 / 折线");
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
    setStatus(type === HS.TYPE_POLYGON
      ? "绘制多边形：点击全景加点，至少 3 点后点完成"
      : "绘制折线：点击全景加点，至少 2 点后点完成");
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
      .then(function () {
        setStatus("已保存", "ok");
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
    setStatus("从列表进入热点设置，或添加多边形 / 折线");
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

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && drawing) {
      ev.preventDefault();
      finishDraw();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      if (drawing) backToList(true);
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
