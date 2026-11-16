# 模式、目标与导航 UI 更新

实施前 HEAD：`7d9f1b3b099d75c6e4ef69eacf4cad33bebaee1d`，工作区干净。

## 范围

- Today 顶部改为常驻的普通 / 休假 / 冲刺小型切换器，不再使用旧模式选择 Sheet。
- 普通和冲刺直接调用原 `saveDayModes`，未结算冲刺任务仍会阻止不安全切换。
- 休假入口只确认明天的预约或取消，不改变今天；已生效休假仍锁定。旧的未来连续日期安排与日期日志不删除，按原服务继续生效。
- 目标卡保持白底、黑字、浅边框；数值目标展示当前/目标、细绿色进度、起始值、完成百分比；奖励与失败约定并排。非数值目标不显示空进度。
- 新建仅显示名称、截止日期、奖励、失败约定；数值进度按需展开。编辑复用同一表单和原键盘架构。
- 四个导航入口和路由不变，使用 Lucide 的 list-checks、book-open、target、chart-no-axes-column；底栏减为 68px，白底、小面积浅灰选中态。

## 数据保护

- 没有数据迁移、存储键变化、默认状态重建、旧记录删除或余额重算。
- 没有修改 `js/goals.js`、`js/day-modes.js`、SettlementService 或本地存储保护模块。
- 表单只提交可见字段。原 `saveGoal` 的合并保留分类、描述、额外字段、稳定 ID、创建时间和旧日志。
- 旧里程碑目标只编辑四个基础字段，不把旧类型悄悄变为完成型，也不提交空里程碑数组。原详情、加入今日重点、达成校验、结算和纠错仍可使用。
- 数值目标仍通过原 `goalProgress` 计算，完成奖励仍需原达成确认，不因编辑进度自动加币。
- 结束目标不可编辑，原始结算金额与历史记录保持原样。

## 图标

SVG 几何来自官方 `lucide-icons/lucide` 仓库，内联使用，不依赖运行时 CDN，也未新增包依赖。线宽统一复用现有 1.75。ISC 及 Feather 衍生图标的 MIT 授权声明保留在 `js/ui/elements.js` 中。

## 文件

- `index.html`：直接模式入口、导航图标键、目标页 class、相关静态资源版本。
- `js/ui/day-modes.js`：直接切换与明天休假确认/取消；删除旧的大型模式选择界面代码。
- `js/ui/goals.js`：白色卡片内容层级、日期展示、精简表单和保留旧字段的提交。
- `js/ui/elements.js`：官方 Lucide 图标与授权。
- `css/qonto-system.css`：仅对应模块的卡片、表单、模式行和导航样式，清理对应旧规则。
- `tests/goal-presentation.test.js`：日期、进度、可选字段、旧字段保留与转义。
- `tests/browser-goals-ui.cjs`：三种 iPhone 尺寸、白卡、表单、模拟键盘、奖励幂等、旧字段、刷新及图标验证。
- `tests/browser-day-modes.cjs`、`tests/browser-goals.cjs`：更新入口定位，保留原业务断言。

## 验证边界

- 371 项 Node 自动化测试通过，27 个完整 Chromium 浏览器回归脚本全部通过。
- WebKit 的目标 UI 和模式专测均通过 390×844、393×852、430×932；包含白底、触控区、可选数值、模拟键盘、旧字段、多行约定、刷新、跨日与幂等。
- 静态生产构建、JavaScript 语法和 `git diff --check` 通过；项目未单独配置 lint/typecheck 命令。
- 自动化使用隔离的合成数据，不读取真实手机存储。Chromium/WebKit 移动尺寸和视口缩小模拟不能代替真实 iPhone Safari/PWA 或原生键盘验收。
- Production commit 与部署状态在最终交付报告中记录；未宣称真实 iPhone 验收通过。
