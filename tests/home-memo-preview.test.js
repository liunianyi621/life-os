const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const memoSource = fs.readFileSync(path.join(ROOT, "js/memos.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const escapeAttr = escapeHtml;

function createMemoContext(memos) {
  const context = {
    state: { memos },
    els: {
      homeMemoCount: { textContent: "" },
      homeMemoList: { innerHTML: "" }
    },
    formatNumber: value => String(value),
    escapeHtml,
    escapeAttr
  };
  vm.createContext(context);
  vm.runInContext(memoSource, context);
  vm.runInContext("renderMemoSummary()", context);
  return { context };
}

test("首页使用紧凑余额与独立备忘录 Chip 区域", () => {
  const header = indexHtml.match(/<header class="header today-header[\s\S]*?<\/header>/)?.[0] || "";
  assert.doesNotMatch(header, /data-open-task/);
  assert.match(header, /class="home-coin-balance"/);
  assert.match(header, /id="homeCoins"/);
  assert.equal((indexHtml.match(/data-open-task/g) || []).length, 1);
  assert.match(indexHtml, /class="today-section home-memo-section"/);
  assert.match(indexHtml, /id="homeMemoList"/);
  assert.match(indexHtml, /data-open-memo/);
  assert.doesNotMatch(indexHtml, /home-memo-card|homeMemoPreview|memoSummaryCard/);
  assert.doesNotMatch(indexHtml, /class="summary-grid today-summary/);
  assert.match(productionCss, /\.home-coin-balance__amount\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(productionCss, /#homeMemoList\.memo-template-grid[\s\S]*?flex-wrap:\s*wrap;/);
  assert.doesNotMatch(productionCss, /\.home-memo-card\s*\{/);
});

test("首页把所有 ACTIVE 备忘录渲染为纯文字 Chip，并隐藏已安排与已完成项", () => {
  const { context } = createMemoContext([
    { id: "completed", text: "已完成内容", completed: true, updatedAt: "2026-08-27T12:00:00Z" },
    { id: "memo-1", text: "第一条", completed: false, updatedAt: "2026-08-27T11:00:00Z" },
    { id: "memo-2", text: "第二条", completed: false, updatedAt: "2026-08-27T10:00:00Z" },
    { id: "memo-3", text: "第三条", completed: false, updatedAt: "2026-08-27T09:00:00Z" },
    { id: "memo-4", text: "第四条", completed: false, updatedAt: "2026-08-27T08:00:00Z" },
    { id: "scheduled", text: "已安排内容", status: "SCHEDULED", linkedTaskId: "task-1" }
  ]);
  const chips = context.els.homeMemoList.innerHTML;

  assert.equal(context.els.homeMemoCount.textContent, "4 项");
  assert.match(chips, /第一条[\s\S]*第二条[\s\S]*第三条[\s\S]*第四条/);
  assert.doesNotMatch(chips, /已完成内容|已安排内容/);
  assert.equal((chips.match(/memo-template-chip/g) || []).length, 4);
  assert.equal((chips.match(/data-memo-card/g) || []).length, 4);
  assert.doesNotMatch(chips, /<svg|金币|data-toggle-memo|data-delete-memo/);
});

test("首页备忘录空状态区分没有记录和全部已安排", () => {
  const empty = createMemoContext([]).context.els.homeMemoList.innerHTML;
  assert.match(empty, /暂无备忘录/);

  const scheduled = createMemoContext([
    { id: "scheduled", text: "已安排项", status: "SCHEDULED", linkedTaskId: "task-1" }
  ]).context;
  assert.equal(scheduled.els.homeMemoCount.textContent, "0 项");
  assert.match(scheduled.els.homeMemoList.innerHTML, /今天没有待安排的备忘录/);
  assert.doesNotMatch(scheduled.els.homeMemoList.innerHTML, /已安排项/);
});
