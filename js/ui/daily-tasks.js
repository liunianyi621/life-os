    function renderDailyTaskProgress() {
      const tasks = dailyTasksForToday();
      const legacyCompleted = unifiedCompletedRecords(dateKey()).filter(row=>!row.id.startsWith("task:")).length;
      const completed = tasks.filter(task => task.status === "completed").length + legacyCompleted;
      const total = tasks.length + legacyCompleted;
      document.getElementById("dailyTaskProgress").textContent = `${completed} / ${total}`;
      return { total, completed };
    }

    function renderDailyTasks() {
      const list = document.getElementById("dailyTaskList");
      if (!list) return;
      const { total, completed } = renderDailyTaskProgress();
      const tasks = pendingDailyTasks();
      if (!tasks.length) {
        list.innerHTML = `<div class="daily-task-empty"><span>${total ? completed === total ? "今日重点已全部完成 ✓" : "今日重点已结算" : "今天还没有任务"}</span>
          ${!total ? '<button type="button" data-open-daily-task>＋ 新增今日重点</button>' : ""}</div>`;
        appendUnifiedCompleted(list);return;
      }
      list.innerHTML = tasks.map(task => `<div class="daily-habit-row" data-daily-task-row="${escapeAttr(task.id)}">
        <button class="habit-order-handle" type="button" data-daily-task-handle="${escapeAttr(task.id)}" aria-label="调整${escapeAttr(task.name)}的顺序" title="调整顺序"><span aria-hidden="true">≡</span></button>
        <button class="daily-habit-content" type="button" data-daily-task-actions="${escapeAttr(task.id)}">
          <span class="daily-habit-name">${escapeHtml(task.name)}</span><span class="daily-habit-reward">+${task.reward} / −${task.penalty}</span>
        </button>
        <button class="habit-complete-control" type="button" data-complete-daily-task="${escapeAttr(task.id)}" aria-label="完成${escapeAttr(task.name)}"><span class="habit-empty-circle" aria-hidden="true"></span></button>
      </div>`).join("");
      appendUnifiedCompleted(list);
    }

    function appendUnifiedCompleted(list) {
      const done=unifiedCompletedRecords(dateKey());
      if(done.length) list.insertAdjacentHTML("beforeend",`<details class="unified-completed"><summary>已完成 ${done.length}</summary>${done.map(r=>`<div>${escapeHtml(r.title)}</div>`).join("")}</details>`);
    }

    function openDailyTaskSheet(taskId = null) {
      runAutomaticChecks({ showToast: false });
      const task = taskId ? pendingDailyTasks().find(item => item.id === taskId) : null;
      if (taskId && !task) { closeSheet(); render(); return; }
      sheetMode = "daily-task"; editingId = taskId;
      els.sheetTitle.textContent = task ? "编辑任务" : "新建今日重点";
      els.sheetForm.innerHTML = keyboardFormSheetHtml({ bodyHtml: `
        <label class="field"><span class="field-label">任务名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(task?.name || "")}" placeholder="输入任务名称" required></label>
        <input name="reward" type="hidden" value="50"><p class="field-help">完成 +50 / 未完成 −200</p>`, submitLabel: "保存任务" });
      els.sheetForm.querySelector(".keyboard-form-sheet__footer").insertAdjacentHTML("beforeend",
        `<button class="q-secondary-button" type="submit" name="focusAction" value="start">保存并开始专注</button>`);
      openSheet({ position: "top", kind: "daily-task", keyboardForm: true });
      focusSheetField("input[name='name']");
    }

    function openDailyTaskActions(taskId) {
      runAutomaticChecks({ showToast: false });
      const task = pendingDailyTasks().find(item => item.id === taskId);
      if (!task) { render(); return; }
      sheetMode = "daily-task-actions"; editingId = null;
      els.sheetTitle.textContent = task.name;
      els.sheetForm.innerHTML = `<div class="habit-focus-menu">
        <button class="q-primary-button" type="button" data-start-daily-focus="${escapeAttr(task.id)}">开始专注</button>
        <button class="q-secondary-button" type="button" data-edit-daily-task="${escapeAttr(task.id)}">编辑任务</button>
        <button class="focus-cancel-button daily-task-delete" type="button" data-delete-daily-task="${escapeAttr(task.id)}">删除任务</button>
      </div>`;
      openSheet({ position: "bottom", kind: "habit-actions" });
    }

    function openDailyTaskOrderSheet(taskId) {
      const tasks = pendingDailyTasks();
      const index = tasks.findIndex(task => task.id === taskId);
      if (index < 0) return;
      sheetMode = "daily-task-order"; editingId = null;
      els.sheetTitle.textContent = tasks[index].name;
      els.sheetForm.innerHTML = `<div class="habit-order-actions">
        <button class="q-secondary-button" type="button" data-move-daily-task="${escapeAttr(taskId)}" data-direction="-1" ${index === 0 ? "disabled" : ""}>上移</button>
        <button class="q-secondary-button" type="button" data-move-daily-task="${escapeAttr(taskId)}" data-direction="1" ${index === tasks.length - 1 ? "disabled" : ""}>下移</button>
      </div>`;
      openSheet({ position: "bottom", kind: "habit-actions" });
    }
