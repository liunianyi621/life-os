# iPhone PWA 数据保护与恢复记录

> 后续目标更新：用户已明确暂停旧数据恢复，批准提供独立的“开始全新使用”流程并部署。本文后续“等待手机备份、禁止上线”的段落是此前恢复阶段的历史记录，不再作为本次新开始版本的上线前提。旧数据仍不删除或覆盖；本次实施见 `docs/FRESH_START_RELEASE.md`。用户无需连接手机、运行 Console 或导出原始数据。

## 当前结论与边界

- 本次开始时 main / HEAD：`c9b529b3074f44b6cc7ac4a87e8ea7fa1f476fce`，工作区原先干净。
- 项目唯一源目录：`/Users/nianyi/codex-workspace/Active/LifeOS`。
- `outputs/life-rpg` 是构建输出，不是另一份用户数据库。
- 真实用户数据只在 iPhone 主屏幕 PWA。Mac 测试数据不能代表手机。
- **尚未取得或验证任何 iPhone 原始数据，不能声称数据已恢复或已丢失。**
- 本次仅本地代码修复、合成数据验证；不提交、不 push、不部署、不操作手机数据。

## 已确认的代码缺陷（不是手机数据已经丢失的证明）

以下行号对应本次开始时的 HEAD，可用 `git show c9b529b:js/persistence.js` 核对：

1. `js/persistence.js:30-33` 只要 v3 键存在，就不再看旧数据；v3 为空时也挡住 v2/v1。v3 缺失时则未经完整性验证直接复制 v2，只有 v2 缺失才读 v1；v2 部分迁移或空状态可能遮住完整 v1。
2. `js/storage.js:773-845,884` 在申请编辑权前，仅从当前 v3 读取；缺失时返回正常默认空状态，未标为读取受阻。之后 `persistence.js:38-40` 的初始化/自动检查，以及 `js/ui/goals.js` 的刷新入口获得写权限后，可把默认空对象存成 v3。这是一条实际存在的空状态持久化路径，不等于已证明手机走过此路径。
3. `js/persistence.js:56-58` 的 pagehide 释放编辑权，而 pageshow 只加载/渲染，不重新申请。iOS 从后台恢复、不重新触发 DOMContentLoaded 时，单窗口也可能永远只读。
4. `js/persistence.js:41-43` 的错误处理先显示读取错误，finally 又用默认“另一窗口正在编辑”覆盖。锁 API 失败也被显示为另一窗口。该提示不能证明手机确有第二窗口。
5. `js/storage.js:782-791,868` 在读取路径执行旧金币迁移、创建快照及清理保存；读取并非只读。合法旧金币版本和损坏存储必须区分，不能靠反复启动试探恢复。
6. `js/backup.js:125-132` 的正常 Backup 导出主要来自当前内存，而非所有旧键。缺失 v3 返回空对象时，不能把这份正常备份视为原始数据已备份。
7. `js/ui/goals.js:75` 不分事件来源或读取结果，直接在 storage 事件里重新 load/render；发生读失败时可能再次把内存默认值渲染为 0。本地已交由统一存储保护处理，所有浏览器读取失败均使业务界面进入保护状态。

当前源码以 localStorage 保存，未发现 IndexedDB 或 Service Worker 注册/缓存代码。manifest 使用相对 `start_url` 和 standalone；浏览器 HTTP 缓存及不同域名、Safari/PWA 的独立存储仍需在手机核对，不能只由源码断言排除。

## 本地修复

- 新增纯检查层 `js/storage-audit.js`，枚举整个当前来源的存储并再次核对一致性，保留精确原始字符串。
- 缺失 v3 但存在旧键/备份、损坏/部分 v3、空 v3 遮住旧数据、独立版本冲突、未核验旧金币迁移：停止写入，隐藏默认空业务界面，说明具体保护原因。
- 自动启动不再从 v1/v2 复制、归档冲突、重新做金币倍率迁移或清理保存。浏览器 `loadState()` 不写本地存储。
- 归档日历数据在浏览器读取时原样保留，不再因为缺少时间戳而在每次读取时补上“现在”；不恢复日历 UI。
- 只有检查通过的当前数据或确实可读且全空的新容器，才申请独占锁；锁内重检后才进入原有初始化及结算。**这不是恢复试运行入口；手机备份前不要部署或把原始数据导入来试。**
- 所有主状态写入检查读取时的原始版本；别的页面修改后，旧页面不能把自己的整份内存写回。不同版本不会自动合并金币。
- pagehide 后的 pageshow/focus/回前台重新申请编辑权；只在确实未取得锁时显示其他窗口提示，真实错误不被覆盖。
- 正常 Backup 在数据保护/无编辑权时不导出伪空对象。原始救援导出独立于应用状态、锁和结算。
- 旧原始键、历史交易、基金、习惯等不删除。SettlementService 与经济规则未修改。

`planMigration` / `commitVerifiedMigration` 是未接入任何启动或 UI 的准备工具，仅在合成数据测试执行。它要求备份确认、明确批准和锁检查；只能精确复制已核验源字符串到不存在的 v3，目标即使为空也拒绝覆盖。中断后可重复执行，旧源与原始副本保留。**不要在手机检查器调用这两个函数。真实恢复方案必须在取得文件后另行核定。**

## 先保全手机

- 不点“在此窗口继续”、重置、导入；不刷新、强制关闭/卸载 PWA、清理网站数据。
- 不切到 Mac 或新 Safari 页来代替原 PWA，不假设同一个网址一定是同一个存储容器。
- Git 标签只保留代码，不能备份手机 localStorage；直接回滚可能又触发旧迁移或补结算。
- Web Inspector 连接前无法从 Mac 冻结旧页面。切到设置、回前台可能触发原代码的生命周期；这是仍然存在的风险。尽量保留原窗口，避免反复启动；连接后尽快暂停页面脚本。

## USB + Safari 只读导出

1. iPhone：设置 → App → Safari → 高级 → Web 检查器，打开。旧 iOS 的 Safari 设置可能直接在设置首页。
2. USB 连接 Mac，解锁 iPhone，按设备提示选择信任。
3. Mac Safari：设置 → 高级 → 显示网页开发者功能（旧版为显示“开发”菜单）。
4. Safari 菜单“开发” → **你的 iPhone** → 原先主屏幕安装的 **LifeOS Web App**。不要选择 Mac 页面，也不要用新开的手机 Safari 标签代替。
5. 确保是原 PWA 的检查器；在调试器暂停页面脚本。保持暂停，避免应用自己的定时检查/保存继续运行。随后在这个检查器 Console 执行下列生成的只读表达式。

Mac 终端：

```sh
cd /Users/nianyi/codex-workspace/Active/LifeOS
node scripts/iphone-raw-export.cjs | pbcopy
```

将剪贴板脚本粘贴到 **远程 iPhone PWA** 的 Console 并执行一次。它：

- 验证 iOS + standalone 上下文；不调用 LifeOS 初始化、迁移、结算、恢复或保存。
- 读取全部 localStorage 与 sessionStorage，而非仅 v3，包含 v1/v2、source、conflict、before-import、backup 和未知键。
- 每个键保留精确原始字符串，包括损坏 JSON；输出只有键名、字节数、JSON 解析状态及记录数量，不打印私人正文。
- 数量只统计已识别的顶层字段；未知结构/备份包装层显示 0，不证明其内部没有数据。完整原始字符串仍在导出文件里。
- 通过检查器 `copy()` 复制完整 JSON 到 Mac 剪贴板。不创建下载导航，不写手机持久化；另保留一份内存字符串。
- 返回 `complete`、`clipboardCopied`、`origin`、`standalone` 等摘要。`userDataVerified:false` 表示还需核对原件，不能当作恢复成功。

**只有看到 `clipboardCopied:true` 才继续。** 若脚本被拒绝、没有 PWA 可检查、读失败、复制失败，不要改用 Mac/Safari 空数据、不要刷新试探；停止并报告摘要。`complete:false` 的文件也应保留，但不能直接用于恢复。完全空文件只证明当前容器为空，不证明原数据消失。

Mac 终端保存并校验：

```sh
backup="$HOME/Desktop/LifeOS-iPhone-raw-$(date +%Y%m%d-%H%M%S)-$RANDOM.json"
(set -C; pbpaste > "$backup") &&
node scripts/verify-raw-recovery.cjs "$backup"
```

校验器只读 Mac 文件，检查格式、每键摘要、完整性，并输出哈希和数量，不恢复或打印正文。文件应留在用户自己控制的磁盘，再复制一份安全备份；不要把完整私人文件直接粘贴到聊天。

请仅回报：是否选中真实主屏幕 PWA、origin、键名、各键大小/解析情况/主要记录数量、complete/clipboardCopied、校验是否通过。原始文件中能否找到熟悉的历史日期/内容也需由用户本地确认。**等用户实际完成导出，再决定恢复哪一个源、如何处理冲突、是否允许迁移和补结算。**

此原始救援 JSON **不是标准 LifeOS Backup**，不要通过应用“导入备份”直接导入。

## 官方参考

- Web Inspector 设置与 USB 检查：https://webkit.org/web-inspector/enabling-web-inspector/
- 新版 iOS 设置路径：https://webkit.org/blog/15865/webkit-features-in-safari-18-0/
- Console `copy(value)`：https://webkit.org/web-inspector/console-command-line-api/
- 主屏幕 Web App 存储与 Safari 隔离：https://developer.apple.com/videos/play/wwdc2023/10120/

## 上线门槛

必须先取得真实 iPhone PWA 的原始文件，核对来源、完整性、版本和熟悉记录，另存备份；随后制定针对实际键的恢复计划并获得用户明确批准。当前缺少这些条件，**不能部署，不能宣称数据恢复。**

## 本地验证记录

- 356 项 Node 自动化测试通过（包括 17 项新增的检查、原始导出及明确授权复制测试）。
- 25 个 Chromium 浏览器回归脚本全部通过；存储保护专测覆盖 390×844、393×852、430×932、8 类受保护数据、读取异常、锁不可用/拒绝、后台恢复、刷新及旧状态保存拦截。
- 生产构建通过；没有独立配置 lint/typecheck 命令。
- WebKit 驱动在创建测试页面 `browserContext.newPage` 阶段卡住，已主动终止，不能算测试通过；没有真实 iPhone Safari/PWA 验证。
- 远程 main 经只读检查仍为上述 HEAD；两个恢复标签 `lifeos-pre-goals-20261116`、`lifeos-pre-three-modes-20261116` 均仍存在，未修改。
- 本地修改尚未提交；未 push、未部署，等待真实 PWA 原始备份及明确批准。

## 修改文件清单

| 文件 | 修改与原因 |
| --- | --- |
| `js/storage-audit.js` | 新增纯检查和明确授权恢复准备工具，先区分空容器、旧版本、冲突与损坏数据。 |
| `js/persistence.js` | 统一检查、版本保护、独占编辑权及后台恢复，禁止未读数据自动写回。 |
| `js/storage.js` | 浏览器读取不保存或重跑旧倍率迁移，失败通知保护层；原样保留归档日历数据。 |
| `js/backup.js` | 阻止伪空/过期内存备份；导入的主键写入也经过统一版本检查。 |
| `js/ui.js` | 保护状态不渲染默认业务空对象，避免误导为数据全空。 |
| `js/ui/goals.js` | 存储事件交由统一保护层，不再独立重读并渲染失败后的空状态。 |
| `index.html` | 先加载检查层，更新本次修改脚本的缓存标识。 |
| `scripts/iphone-raw-export.cjs` | 生成只读远程 PWA 导出表达式，不依赖应用初始化或解锁。 |
| `scripts/verify-raw-recovery.cjs` | 只读校验原始 JSON、摘要及哈希，不执行恢复。 |
| `tests/storage-audit.test.js` | 新增 17 项版本、损坏、冲突、授权复制、原始导出与文件校验测试。 |
| `tests/browser-storage-recovery.cjs` | 新增浏览器数据保护、恢复生命周期及归档原件不变测试。 |
| `tests/browser-storage-concurrency.cjs` | 旧版本冲突应停止写入，不再期待自动复制/归档；仍检查金币结算一次和窗口切换。 |
| `tests/browser-startup-recovery.cjs` | 损坏数据应显示保护状态而不是默认空业务界面。 |
| `docs/IPHONE_DATA_RECOVERY.md` | 记录代码证据、只读导出步骤、限制、测试及上线门槛。 |
