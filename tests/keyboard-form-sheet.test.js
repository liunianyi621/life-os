const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const feedbackSource = fs.readFileSync(path.join(ROOT, "js/ui/feedback.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");

function createFeedbackRuntime({ innerHeight = 844, viewportHeight = 500, offsetTop = 40 } = {}) {
  const properties = new Map();
  const bodyClasses = new Set(["modal-open"]);
  const listenerCounts = new Map();
  const viewportListenerCounts = new Map();
  class FakeHTMLElement {}
  const classList = {
    contains(name) { return bodyClasses.has(name); },
    toggle(name, force) {
      if (force) bodyClasses.add(name);
      else bodyClasses.delete(name);
    }
  };
  const hiddenBackdrop = { classList: { contains: () => true } };
  const openBackdrop = { classList: { contains: () => false } };
  const context = {
    console,
    HTMLElement: FakeHTMLElement,
    setTimeout,
    clearTimeout,
    window: {
      innerHeight,
      visualViewport: {
        height: viewportHeight,
        offsetTop,
        addEventListener(name) {
          viewportListenerCounts.set(name, (viewportListenerCounts.get(name) || 0) + 1);
        }
      },
      addEventListener(name) {
        listenerCounts.set(name, (listenerCounts.get(name) || 0) + 1);
      },
      requestAnimationFrame(callback) { callback(); },
      setTimeout,
      clearTimeout
    },
    document: {
      activeElement: null,
      body: { classList },
      documentElement: {
        clientHeight: innerHeight,
        style: { setProperty(name, value) { properties.set(name, value); } }
      },
      addEventListener(name) {
        listenerCounts.set(`document:${name}`, (listenerCounts.get(`document:${name}`) || 0) + 1);
      },
      querySelector() { return null; }
    },
    els: {
      sheetBackdrop: openBackdrop,
      dayDetailBackdrop: hiddenBackdrop,
      memoBackdrop: hiddenBackdrop,
      confirmBackdrop: hiddenBackdrop,
      fundCelebrationBackdrop: hiddenBackdrop,
      toast: null
    }
  };
  vm.createContext(context);
  vm.runInContext(feedbackSource, context, { filename: "js/ui/feedback.js" });
  return { context, properties, bodyClasses, listenerCounts, viewportListenerCounts, FakeHTMLElement };
}

test("visualViewport 同步统一的可视高度、键盘高度和顶部偏移", () => {
  const { context, properties, bodyClasses } = createFeedbackRuntime();
  vm.runInContext("syncSheetViewport()", context);
  assert.equal(properties.get("--app-visible-height"), "500px");
  assert.equal(properties.get("--keyboard-height"), "304px");
  assert.equal(properties.get("--viewport-offset-top"), "40px");
  assert.equal(bodyClasses.has("keyboard-open"), true);
});

test("PWA 同时缩小 layout viewport 时仍能识别键盘", () => {
  const { context, properties, bodyClasses, FakeHTMLElement } = createFeedbackRuntime({
    innerHeight: 844,
    viewportHeight: 844,
    offsetTop: 0
  });
  vm.runInContext("syncSheetViewport()", context);
  const input = new FakeHTMLElement();
  input.matches = () => true;
  context.document.activeElement = input;
  context.window.innerHeight = 500;
  context.window.visualViewport.height = 500;
  vm.runInContext("syncSheetViewport()", context);
  assert.equal(properties.get("--keyboard-height"), "344px");
  assert.equal(bodyClasses.has("keyboard-open"), true);
});

test("全局键盘监听只安装一次并包含横竖屏更新", () => {
  const { context, listenerCounts, viewportListenerCounts } = createFeedbackRuntime();
  vm.runInContext("installSheetViewportSync(); installSheetViewportSync();", context);
  assert.equal(viewportListenerCounts.get("resize"), 1);
  assert.equal(viewportListenerCounts.get("scroll"), 1);
  assert.equal(listenerCounts.get("resize"), 1);
  assert.equal(listenerCounts.get("orientationchange"), 1);
  assert.equal(listenerCounts.get("document:focusin"), 1);
});

test("聚焦字段只滚动 Form Body，不滚动 document", () => {
  const { context, FakeHTMLElement } = createFeedbackRuntime();
  const scrolls = [];
  const body = {
    getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    scrollBy: options => scrolls.push(options)
  };
  const target = new FakeHTMLElement();
  target.matches = () => true;
  target.closest = selector => selector === ".keyboard-form-sheet__body" ? body : null;
  target.getBoundingClientRect = () => ({ top: 320, bottom: 370 });
  context.target = target;
  vm.runInContext("ensureFocusedFormFieldVisible(target)", context);
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0].top, 78);
  assert.equal(scrolls[0].behavior, "smooth");
});

test("所有可输入动态 Sheet 复用同一 Form Body/Footer 组件", () => {
  assert.match(sheetSource, /function keyboardFormSheetHtml\(/);
  assert.equal((sheetSource.match(/keyboardFormSheetHtml\(\{/g) || []).length, 8);
  assert.equal((sheetSource.match(/keyboardForm: true/g) || []).length, 7);
  assert.match(indexHtml, /memo-sheet q-sheet keyboard-form-sheet/);
  assert.match(indexHtml, /memo-form keyboard-form-sheet__footer/);
  assert.match(productionCss, /\.keyboard-form-sheet__footer\s*\{[\s\S]*?border-top:/);
  assert.doesNotMatch(productionCss, /\.sheet-actions\s*\{[\s\S]*?position:\s*sticky;/);
});

test("统一布局没有替换既有保存业务入口", () => {
  [
    "saveTask(",
    "savePriorityTask(",
    "saveHabit(",
    "saveNote(",
    "saveReward(",
    "saveCalendarEvent(",
    "saveEditedDailyReview("
  ].forEach(call => assert.ok(sheetSource.includes(call), `missing existing handler ${call}`));
});
