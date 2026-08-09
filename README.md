# LifeOS

LifeOS 是一个移动端优先、数据保存在浏览器本地的个人生活系统。

## 当前状态

- 当前是纯静态 App，无运行时依赖和前端框架。
- 主入口是 `index.html`，样式在 `css/styles.css`，交互脚本在 `js/` 中。
- 已包含 PWA manifest、图标和 Vercel 静态部署配置。
- `outputs/life-rpg` 是生成产物，不再手动维护。
- 应用状态持久化在浏览器 `localStorage` 的 `minimal-discipline-v1` 中。
- 旧版字段在加载时统一兼容；迁移必须使用明确版本标记并保持幂等。

## 主要功能

- 今日任务管理
- 每日习惯与重点事项
- MiniCal 风格月度计划
- 每日复盘与历史编辑
- 人生主线基金
- 金币、撤回和历史纠错
- 行为热力图与趋势统计
- 备忘录和调试数据导出

## 代码结构

- `js/storage.js`：状态加载、规范化、迁移、持久化和日期工具。
- `js/tasks.js` / `js/habits.js`：任务与习惯领域规则。
- `js/economy.js`：金币事件、自动结算、纠错和撤回。
- `js/stats-data.js`：财务与行为统计的纯数据聚合。
- `js/stats.js`：热力图、趋势、成就和当天详情渲染。
- `js/ui/`：共享元素、反馈、时间选择和 sheet。
- `js/ui.js`：当前页面渲染调度、页面手势和全局事件分发。

启动顺序为：加载状态 → 迁移与规范化 → 自动结算 → 渲染当前页面。金币变化应通过 `recordCoinEvent()`，撤回应使用历史事件中保存的实际金额。

## 本地运行

启动本地静态服务：

```bash
python3 -m http.server 4173
```

然后打开 `http://127.0.0.1:4173/`。

## 构建预览副本

生成 `outputs/life-rpg`：

```text
node scripts/build-output.js
```

如果本机安装了 npm，也可以运行：

```text
npm run build
```

## 测试

```bash
node --test tests/*.test.js
```
