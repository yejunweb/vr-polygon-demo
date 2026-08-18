(function () {
  var HS = TourHotspots;
  var DRAFT_NAME = "_draft";
  var tourData = null;
  var loaded = false;
  var selectedId = null;
  var drawing = false;
  var draft = null;
  var vertexNames = [];
  var vertexMap = {};
  var lastClickAt = 0;

  var els = {
    list: document.getElementById("hotspot-list"),
    status: document.getElementById("status"),
    poly: document.getElementById("btn-poly"),
    line: document.getElementById("btn-line"),
    finish: document.getElementById("btn-finish"),
    undo: document.getElementById("btn-undo"),
    remove: document.getElementById("btn-delete"),
    save: document.getElementById("btn-save")
  };

  function krpano() {
    return window.krpano || null;
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = "status" + (kind ? " " + kind : "");
  }

  function polyRecords() {
    return HS.getHotspots(tourData).filter(function (hs) {
      return HS.isPolyType(hs.icon && hs.icon.type);
    });
  }

  function updateButtons() {
    var pointCount = draft ? draft.points.length : 0;
    var minPoints = draft && draft.type === HS.TYPE_POLYGON ? 3 : 2;
    els.poly.classList.toggle("active", drawing && draft && draft.type === HS.TYPE_POLYGON);
    els.line.classList.toggle("active", drawing && draft && draft.type === HS.TYPE_POLYLINE);
    els.finish.disabled = !drawing || pointCount < minPoints;
    els.undo.disabled = !drawing || pointCount < 1;
    els.remove.disabled = drawing || !selectedId;
    els.poly.disabled = drawing && draft && draft.type !== HS.TYPE_POLYGON;
    els.line.disabled = drawing && draft && draft.type !== HS.TYPE_POLYLINE;
  }

  function renderList() {
    els.list.innerHTML = "";
    polyRecords().forEach(function (hs) {
      var li = document.createElement("li");
      var type = hs.icon && hs.icon.type;
      var pointCount = (hs.icon.points || []).length;
      li.dataset.id = hs.id;
      if (hs.id === selectedId) li.className = "selected";
      li.innerHTML = "<strong>" + (hs.title || HS.typeLabel(type)) + "</strong>" +
        "<span class=\"meta\">" + HS.typeLabel(type) + " · " + pointCount + " 点</span>";
      li.addEventListener("click", function () {
        if (drawing) return;
        selectHotspot(hs.id);
      });
      els.list.appendChild(li);
    });
    if (!els.list.children.length) {
      var empty = document.createElement("li");
      empty.textContent = "暂无多边形 / 折线";
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

  function highlightSelected() {
    var pano = krpano();
    if (!pano) return;
    polyRecords().forEach(function (hs) {
      var name = HS.safeName(hs.id);
      var width = hs.id === selectedId
        ? (hs.icon.borderWidth || 2) + 2
        : (hs.icon.borderWidth || 2);
      pano.set(HS.hsPath(name, "borderwidth"), width);
      pano.set(HS.hsPath(name, "normalborderwidth"), width);
    });
  }

  function selectHotspot(id) {
    if (drawing) return;
    selectedId = id;
    var record = HS.findHotspot(tourData, id);
    renderList();
    highlightSelected();
    if (record && record.icon && record.icon.points) {
      renderVertices(HS.safeName(record.id), HS.unwrapPoints(record.icon.points), false);
      setStatus("已选中" + HS.typeLabel(record.icon.type) + "，拖动顶点可改形状");
    } else {
      clearVertices();
    }
    updateButtons();
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
      icon: {
        type: asLine ? HS.TYPE_POLYLINE : HS.TYPE_POLYGON,
        points: draft.points,
        fillColor: "15,15,15,0.35",
        borderColor: "40,110,250,1",
        borderWidth: 2,
        blink: 0
      }
    };
    if (draft.points.length >= 2) {
      HS.addPolyHotspot(pano, record, asLine, { editable: true });
      pano.set(HS.hsPath(DRAFT_NAME, "onclick"), "");
      pano.set(HS.hsPath(DRAFT_NAME, "enabled"), false);
    }
    renderVertices(DRAFT_NAME, draft.points, true);
  }

  function startDraw(type) {
    if (drawing && draft && draft.type === type) {
      cancelDraw();
      return;
    }
    if (drawing) cancelDraw(true);
    selectedId = null;
    drawing = true;
    draft = { type: type, points: [] };
    clearVertices();
    setPolyHotspotsEnabled(false);
    setDrawEvents(true);
    renderList();
    highlightSelected();
    updateButtons();
    setStatus(type === HS.TYPE_POLYGON
      ? "绘制多边形：点击全景加点，至少 3 点后点完成；Enter 完成，Esc 取消"
      : "绘制折线：点击全景加点，至少 2 点后点完成；Enter 完成，Esc 取消");
  }

  function cancelDraw(silent) {
    var pano = krpano();
    drawing = false;
    draft = null;
    if (pano) HS.removeHotspot(pano, DRAFT_NAME);
    clearVertices();
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    updateButtons();
    if (!silent) setStatus("已取消绘制");
  }

  function finishDraw() {
    if (!drawing || !draft) return;
    var minPoints = draft.type === HS.TYPE_POLYGON ? 3 : 2;
    if (draft.points.length < minPoints) {
      setStatus("点数不足，无法完成", "error");
      return;
    }
    var pano = krpano();
    var record = HS.createHotspotRecord(draft.type, draft.points, HS.nextZOrder(tourData));
    HS.upsertHotspot(tourData, record);
    HS.removeHotspot(pano, DRAFT_NAME);
    drawing = false;
    draft = null;
    setDrawEvents(false);
    setPolyHotspotsEnabled(true);
    HS.addPolyHotspot(pano, record, record.icon.type === HS.TYPE_POLYLINE, { editable: true });
    selectHotspot(record.id);
    setStatus("已添加" + HS.typeLabel(record.icon.type) + "，记得保存", "ok");
  }

  function undoPoint() {
    if (!drawing || !draft || !draft.points.length) return;
    draft.points.pop();
    renderDraft();
    updateButtons();
    setStatus("已撤销一点，当前 " + draft.points.length + " 点");
  }

  function addPoint(ath, atv) {
    if (!drawing || !draft) return;
    draft.points.push({ ath: ath, atv: atv });
    renderDraft();
    updateButtons();
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
    renderList();
    highlightSelected();
    updateButtons();
    setStatus("已删除，记得保存", "ok");
  }

  function save() {
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
    updateButtons();
    setStatus("点击列表或色块选中，拖动顶点编辑；或开始绘制多边形 / 折线");
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
    selectHotspot(id);
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

  els.poly.addEventListener("click", function () { startDraw(HS.TYPE_POLYGON); });
  els.line.addEventListener("click", function () { startDraw(HS.TYPE_POLYLINE); });
  els.finish.addEventListener("click", finishDraw);
  els.undo.addEventListener("click", undoPoint);
  els.remove.addEventListener("click", deleteSelected);
  els.save.addEventListener("click", save);

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && drawing) {
      ev.preventDefault();
      finishDraw();
    } else if (ev.key === "Escape" && drawing) {
      ev.preventDefault();
      cancelDraw();
    } else if ((ev.key === "Backspace" || ev.key === "Delete") && drawing) {
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
