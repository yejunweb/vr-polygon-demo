const fs = require("fs");
const path = require("path");
const express = require("express");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "tour.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.PORT) || 8888;

function readTour() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeTour(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use("/krpano", express.static(path.join(ROOT, "krpano")));
app.use("/assets", express.static(path.join(ROOT, "assets")));
app.use("/data", express.static(path.join(ROOT, "data")));
app.use(express.static(PUBLIC_DIR));

app.get("/api/tour", function (req, res) {
  try {
    res.json(readTour());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "读取数据失败" });
  }
});

app.put("/api/tour", function (req, res) {
  const body = req.body;
  if (!body || typeof body !== "object" || !Array.isArray(body.scenes)) {
    res.status(400).json({ error: "数据格式无效，需要包含 scenes 数组" });
    return;
  }
  try {
    body.updateDate = Math.floor(Date.now() / 1000);
    writeTour(body);
    res.json({ ok: true, updateDate: body.updateDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "保存失败" });
  }
});

app.get(["/", "/preview"], function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, "preview.html"));
});

app.get("/editor", function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, "editor.html"));
});

app.listen(PORT, function () {
  console.log("预览页 http://localhost:" + PORT + "/preview");
  console.log("编辑页 http://localhost:" + PORT + "/editor");
});
