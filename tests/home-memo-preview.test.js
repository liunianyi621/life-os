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

function createMemoContext(memos) {
  const attributes = new Map();
  const context = {
    state: { memos },
    els: {
      homeMemoCount: { textContent: "" },
      homeMemoPreview: { innerHTML: "" },
      memoSummaryCard: {
        setAttribute(name, value) {
          attributes.set(name, value);
        }
      }
    },
    formatNumber: value => String(value),
    escapeHtml
  };
  vm.createContext(context);
  vm.runInContext(memoSource, context);
  vm.runInContext("renderMemoSummary()", context);
  return { context, attributes };
}

test("首页移除全局加号并使用紧凑余额与全宽备忘录", () => {
  const header = indexHtml.match(/<header class="header today-header[\s\S]*?<\/header>/)?.[0] || "";
  assert.doesNotMatch(header, /data-open-task/);
  assert.match(header, /class="home-coin-balance"/);
  assert.match(header, /id="homeCoins"/);
  assert.equal((indexHtml.match(/data-open-task/g) || []).length, 1);
  assert.match(indexHtml, /class="home-memo-overview"/);
  assert.match(indexHtml, /class="home-memo-card"[^>]*id="memoSummaryCard"/);
  assert.match(indexHtml, /id="homeMemoPreview"/);
  assert.doesNotMatch(indexHtml, /class="summary-grid today-summary/);
  assert.match(productionCss, /\.home-coin-balance__amount\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(productionCss, /\.home-memo-card\s*\{[\s\S]*?width:\s*100%;/);
});

test("首页最多预览三个未完成备忘录并复用更新时间排序", () => {
  const { context, attributes } = createMemoContext([
    { id: "completed", text: "已完成内容", completed: true, updatedAt: "2026-08-27T12:00:00Z" },
    { id: "memo-1", text: "第一条", completed: false, updatedAt: "2026-08-27T11:00:00Z" },
    { id: "memo-2", text: "第二条", completed: false, updatedAt: "2026-08-27T10:00:00Z" },
    { id: "memo-3", text: "第三条", completed: false, updatedAt: "2026-08-27T09:00:00Z" },
    { id: "memo-4", text: "第四条", completed: false, updatedAt: "2026-08-27T08:00:00Z" }
  ]);
  const preview = context.els.homeMemoPreview.innerHTML;

  assert.equal(context.els.homeMemoCount.textContent, "4");
  assert.match(attributes.get("aria-label"), /4 项待处理/);
  assert.match(preview, /第一条[\s\S]*第二条[\s\S]*第三条/);
  assert.doesNotMatch(preview, /第四条|已完成内容/);
  assert.match(preview, /还有 1 项/);
  assert.equal((preview.match(/home-memo-preview__item/g) || []).length, 3);
});

test("首页备忘录空状态区分从未创建和全部完成", () => {
  const empty = createMemoContext([]).context.els.homeMemoPreview.innerHTML;
  assert.match(empty, /还没有备忘录/);

  const completed = createMemoContext([
    { id: "done", text: "完成项", completed: true, updatedAt: "2026-08-27T12:00:00Z" }
  ]).context;
  assert.equal(completed.els.homeMemoCount.textContent, "0");
  assert.match(completed.els.homeMemoPreview.innerHTML, /没有待处理的备忘录/);
  assert.doesNotMatch(completed.els.homeMemoPreview.innerHTML, /完成项/);
});
