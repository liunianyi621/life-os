const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");

test("生产样式覆盖全部热力图状态 class", () => {
  [
    "net-0",
    "net-1",
    "net-2",
    "net-3",
    "net-4",
    "bad-1",
    "bad-2",
    "bad-3",
    "empty"
  ].forEach(className => {
    assert.match(
      productionCss,
      new RegExp(`\\.calendar-heatmap \\.calendar-day\\.${className.replace("-", "\\-")}(?:\\s|,|\\{)`),
      `missing production heatmap style for ${className}`
    );
  });
});

test("MiniCal 使用独立的 Qonto 蓝和重要红色变量", () => {
  assert.match(productionCss, /\.planning-calendar\s*\{[\s\S]*--calendar-normal-marker:\s*#2f80ed;/);
  assert.match(productionCss, /\.planning-calendar\s*\{[\s\S]*--calendar-important-marker:\s*#e05252;/);
  assert.match(productionCss, /\.calendar-event-range\s*\{[\s\S]*background:\s*var\(--calendar-normal-soft\);/);
  assert.match(productionCss, /\.calendar-event-range\.calendar-event-important\s*\{[\s\S]*background:\s*var\(--calendar-important-soft\);/);
});
