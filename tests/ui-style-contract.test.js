const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const feedbackSource = fs.readFileSync(path.join(ROOT, "js/ui/feedback.js"), "utf8");
const economySource = fs.readFileSync(path.join(ROOT, "js/economy.js"), "utf8");

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

test("撤回提示使用单一紧凑 Snackbar 组件", () => {
  assert.match(indexHtml, /<div class="snackbar" id="toast"/);
  assert.match(feedbackSource, /function renderSnackbar\(/);
  assert.match(economySource, /renderSnackbar\(\{ \.\.\.presentation, actionLabel: undoLabel \}\)/);
  assert.doesNotMatch(economySource, /separatorEl\.textContent\s*=\s*"·"/);
  assert.doesNotMatch(economySource, /className\s*=\s*"toast-message-stacked"/);
});

test("Snackbar 保持 60px 高、白色背景并位于 sheet 下层", () => {
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?z-index:\s*90;/);
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?height:\s*60px;/);
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?background:\s*#ffffff;/);
  assert.match(productionCss, /\.snackbar-action\s*\{[\s\S]*?border:\s*0;/);
  assert.match(feedbackSource, /nav\.getBoundingClientRect\(\)/);
});
