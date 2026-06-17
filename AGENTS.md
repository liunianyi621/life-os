# LifeOS Agent Rules

LifeOS 的唯一项目目录为：

`/Users/nianyi/codex-workspace/Active/LifeOS`

以后任何新 Chat、新任务、新会话开始时，必须先验证：

1. 该目录存在。
2. `index.html` 存在。
3. 如果需要执行写文件操作，当前工作目录必须是上述路径，并且该目录必须拥有写权限。
4. 如果当前工作目录不是上述路径：
   - 禁止修改任何文件。
   - 禁止执行任何写文件操作。
   - 允许继续进行只读或生成类工作，包括：
     1. 代码审计
     2. 功能设计
     3. 架构分析
     4. 输出完整代码
     5. 输出 patch
     6. 输出重构方案
     7. 输出实现步骤
   - 不要因为目录错误而拒绝分析和生成代码。
   - 只有真正执行写文件操作时才停止。
5. 不允许创建：
   - `LifeOS 2`
   - `LifeOS Copy`
   - `Documents/LifeOS`
   - 任何新的 LifeOS 副本目录

所有真正写文件操作都只能发生在：

`/Users/nianyi/codex-workspace/Active/LifeOS`
