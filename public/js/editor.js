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
    resetFill: document.getElementById("reset-fill")
  };

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

  function addVertex(targetName, index, point, isDraft) {
    var pano = krpano();
    var name = "vtx_" + index;
    pano.call("addhotspot(" + HS.quote(name) + ")");
    pano.call("callwith(hotspot[" + HS.quote(name) + "], loadstyle(poly_vertex));");
    pano.set(HS.hsPath(name, "ath"), point.ath);
    pano.set(HS.hsPath(name, "atv"), point.atv);
    pano.set(HS.hsPath(name, "html"), String(index + 1));
    vertexNames.push(name);
    vertexMap[name] = { targetName: targetName, index: index, isDraft: !!isDraft };
  }

  function renderVertices(targetName, points, isDraft) {
    clearVertices();
    for (var i = 0; i < points.length; i++) {
      addVertex(targetName, i, points[i], isDraft);
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
    els.fillField.hidden = icon.type !== HS.TYPE_POLYGON;
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
    record.title = els.title.value.trim() || HS.typeLabel(icon.type);
    return record;
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
    selectedId = id;
    styleTab = "normal";
    var record = HS.findHotspot(tourData, id);
    showPanel("settings");
    fillForm(record);
    updateDrawButtons();
    renderList();
    if (record && HS.isPolyType(record.icon && record.icon.type) && record.icon.points) {
      renderVertices(HS.safeName(record.id), HS.unwrapPoints(record.icon.points), false);
      applyLiveStyle();
      setStatus("拖动顶点改形状，或在右侧调整颜色 / 粗细 / 动画");
    } else {
      clearVertices();
      setStatus("图片热点");
    }
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
    var record = {
      id: DRAFT_NAME,
      zOrder: 999,
      visible: 1,
      icon: draft.icon
    };
    draft.icon.points = draft.points;
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
    draft = {
      type: type,
      points: [],
      title: HS.typeLabel(type),
      icon: HS.defaultPolyIcon(type)
    };
    styleTab = "normal";
    clearVertices();
    setPolyHotspotsEnabled(false);
    setDrawEvents(true);
    showPanel("settings");
    fillForm({ title: draft.title, icon: draft.icon });
    updateDrawButtons();
    setStatus(type === HS.TYPE_POLYGON
      ? "绘制多边形：点击全景加点，至少 3 点后点完成"
      : "绘制折线：点击全景加点，至少 2 点后点完成");
  }

  function cancelDraw(silent) {
    var pano = krpano();
    drawing = false;
    draft = null;
    if (pano) HS.removeHotspot(pano, DRAFT_NAME);
    clearVertices();
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
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
    var record = HS.createHotspotRecord(draft.type, draft.points, HS.nextZOrder(tourData), draft.icon);
    record.title = draft.title || HS.typeLabel(draft.type);
    var scene = HS.getScene(tourData);
    if (scene && scene.name) record.title = els.title.value.trim() || scene.name;
    HS.upsertHotspot(tourData, record);
    HS.removeHotspot(pano, DRAFT_NAME);
    drawing = false;
    draft = null;
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    HS.addPolyHotspot(pano, record, record.icon.type === HS.TYPE_POLYLINE, { editable: true });
    openSettings(record.id);
    setStatus("已添加" + HS.typeLabel(record.icon.type) + "，记得保存", "ok");
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
      return;
    }
    var record = HS.findHotspot(tourData, selectedId);
    if (!record) return;
    HS.syncRecordPoints(record, HS.readPoints(pano, meta.targetName));
  };

  window.onVertexDragEnd = function () {
    renderList();
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
    if (drawing && draft) draft.title = els.title.value;
    renderList();
  });
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
