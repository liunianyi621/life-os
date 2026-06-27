    function deleteIconButtonHtml({ action, id, label }) {
      return iconActionButtonHtml({
        className: "danger-button icon-only-button",
        icon: "trash",
        label,
        attrs: `data-delete-${action}="${escapeAttr(id || "")}"`
      });
    }

    function submitSheetButtonHtml(label) {
      return iconActionButtonHtml({
        className: "button icon-only-button",
        type: "submit",
        icon: "checkmark.circle",
        label
      });
    }

    function openTaskSheet(taskId = null) {
      sheetMode = "task";
      editingId = taskId;
      const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
      const defaultRange = defaultTaskTimeRange();
      const startTimeValue = task ? taskStartTimeValue(task) : defaultRange.start;
      const parsedStartTime = parseTimeValue(startTimeValue);
      const initialStartTimeValue = parsedStartTime ? formatTimeParts(parsedStartTime) : "";
      els.sheetTitle.textContent = task ? "编辑任务" : "新建任务";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">任务名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(task?.name || "")}" placeholder="输入任务名称" required>
        </label>
        <label class="field">
          <span class="field-label">奖励金币</span>
          <input name="coins" type="number" min="0" step="0.01" inputmode="decimal" value="${taskRewardInputValue(task)}" placeholder="默认 2">
          <span class="field-help">有时间任务按每小时计算；无时间任务按固定奖励计算。</span>
        </label>
        <div class="field">
          <span class="field-label">开始时间</span>
          <div class="time-picker" data-time-picker data-time-role="start">
            <input name="timeStart" type="hidden" value="${escapeAttr(initialStartTimeValue)}">
            <div class="time-picker-header">
              <span class="time-picker-value" data-time-value>${escapeHtml(initialStartTimeValue || "未设置")}</span>
              ${iconActionButtonHtml({
                className: "time-clear icon-only-button",
                icon: "xmark.circle",
                label: "不设置开始时间",
                attrs: "data-clear-time"
              })}
            </div>
            <div class="time-wheels" aria-label="选择开始时间">
              <div class="time-wheel" data-time-wheel="hour" aria-label="小时">
                ${timeOptionButtons("hour", parsedStartTime?.hour)}
              </div>
              <div class="time-wheel" data-time-wheel="minute" aria-label="分钟">
                ${timeOptionButtons("minute", parsedStartTime?.minute)}
              </div>
              <div class="time-wheel" data-time-wheel="period" aria-label="上午或下午">
                ${timeOptionButtons("period", parsedStartTime?.period)}
              </div>
            </div>
          </div>
          <span class="field-help">结束时间会自动设为开始时间后一小时。</span>
        </div>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(task ? "保存任务" : "创建任务")}
        </div>
        <div class="delete-row ${task ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "task", id: task?.id, label: "移除任务" })}
        </div>
      `;
      openSheet({ position: "top" });
      initTimePicker();
      focusSheetField("input[name='name']");
    }

    function openHabitSheet(habitId = null) {
      sheetMode = "habit";
      editingId = habitId;
      const habit = habitId ? state.habits.find(item => item.id === habitId) : null;
      els.sheetTitle.textContent = habit ? "编辑习惯" : "新建习惯";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">习惯名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(habit?.name || "")}" placeholder="输入习惯名称" required>
        </label>
        <label class="field">
          <span class="field-label">金币数量</span>
          <input name="coins" type="number" min="0" step="1" inputmode="numeric" value="${habit?.coins ?? ""}" placeholder="0">
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(habit ? "保存习惯" : "创建习惯")}
        </div>
        <div class="delete-row ${habit ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "habit", id: habit?.id, label: "移除习惯" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='name']");
    }

    function openBadHabitSheet(habitId = null) {
      sheetMode = "bad";
      editingId = habitId;
      const habit = habitId ? state.badHabits.find(item => item.id === habitId) : null;
      els.sheetTitle.textContent = habit ? "编辑坏习惯" : "新建坏习惯";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">习惯名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(habit?.name || "")}" placeholder="输入坏习惯名称" required>
        </label>
        <label class="field">
          <span class="field-label">金币惩罚</span>
          <input name="penalty" type="number" min="0" step="1" inputmode="numeric" value="${habit?.penalty ?? ""}" placeholder="0">
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(habit ? "保存坏习惯" : "创建坏习惯")}
        </div>
        <div class="delete-row ${habit ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "bad", id: habit?.id, label: "移除坏习惯" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='name']");
    }

    function openNoteSheet(noteId = null) {
      sheetMode = "note";
      editingId = noteId;
      const note = noteId ? state.notes.find(item => item.id === noteId) : null;
      els.sheetTitle.textContent = note ? "编辑笔记" : "新建笔记";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">笔记内容</span>
          <textarea name="text" maxlength="500" placeholder="输入提醒内容" required>${escapeHtml(note?.text || "")}</textarea>
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(note ? "保存笔记" : "创建笔记")}
        </div>
        <div class="delete-row ${note ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "note", id: note?.id, label: "移除笔记" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("textarea[name='text']");
    }

    function openRewardSheet(rewardId = null) {
      sheetMode = "reward";
      editingId = rewardId;
      const reward = rewardId ? state.rewards.find(item => item.id === rewardId) : null;
      els.sheetTitle.textContent = reward ? "编辑奖励" : "新建奖励";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">奖励名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(reward?.name || "")}" placeholder="输入奖励名称" required>
        </label>
        <label class="field">
          <span class="field-label">金币成本</span>
          <input name="cost" type="number" min="0" step="1" inputmode="numeric" value="${reward?.cost ?? ""}" placeholder="0">
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(reward ? "保存奖励" : "创建奖励")}
        </div>
        <div class="delete-row ${reward ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "reward", id: reward?.id, label: "移除奖励" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='name']");
    }

    function openSheet(options = {}) {
      syncSheetViewport();
      els.sheetBackdrop.dataset.sheetPosition = options.position || "top";
      els.sheetBackdrop.classList.remove("hidden");
      els.sheetBackdrop.setAttribute("aria-hidden", "false");
      els.sheetForm.scrollTop = 0;
      syncModalState();
    }

    function closeSheet() {
      els.sheetBackdrop.classList.add("hidden");
      els.sheetBackdrop.setAttribute("aria-hidden", "true");
      delete els.sheetBackdrop.dataset.sheetPosition;
      sheetMode = null;
      editingId = null;
      els.sheetForm.innerHTML = "";
      syncModalState();
    }

    function focusSheetField(selector) {
      const target = els.sheetForm.querySelector(selector);
      if (!target) return;
      window.setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 150);
    }

    function handleSheetSubmit(event) {
      event.preventDefault();
      const formData = new FormData(els.sheetForm);
      if (sheetMode === "task") {
        const taskCoinsInput = String(formData.get("coins") || "").trim();
        const taskCoins = taskCoinsInput === "" ? "" : parseCoinAmount(Math.max(0, Number(taskCoinsInput)));
        const timeStart = String(formData.get("timeStart") || "").trim();
        const timeEnd = timeStart ? shiftTimeValue(timeStart, 60) : "";
        saveTask({
          name: String(formData.get("name") || "").trim(),
          coins: taskCoins,
          hourlyReward: taskCoins,
          reward: taskCoins,
          timeStart,
          timeEnd,
          time: timeStart
        });
      }
      if (sheetMode === "habit") {
        saveHabit({
          name: String(formData.get("name") || "").trim(),
          coins: parseAmount(formData.get("coins"))
        });
      }
      if (sheetMode === "bad") {
        saveBadHabit({
          name: String(formData.get("name") || "").trim(),
          penalty: parseAmount(formData.get("penalty"))
        });
      }
      if (sheetMode === "note") {
        saveNote({
          text: String(formData.get("text") || "").trim()
        });
      }
      if (sheetMode === "reward") {
        saveReward({
          name: String(formData.get("name") || "").trim(),
          cost: parseAmount(formData.get("cost"))
        });
      }
    }

    function saveNote(noteData) {
      if (!noteData.text) {
        showToast("请输入笔记内容");
        return;
      }
      if (editingId) {
        state.notes = state.notes.map(note => (
          note.id === editingId
            ? { ...note, ...noteData, updatedAt: new Date().toISOString() }
            : note
        ));
        showToast("笔记已更新");
      } else {
        state.notes.unshift({
          id: createId("note"),
          ...noteData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("笔记已创建");
      }
      saveState();
      closeSheet();
      render();
    }

    function saveReward(rewardData) {
      if (!rewardData.name) {
        showToast("请输入奖励名称");
        return;
      }
      if (editingId) {
        state.rewards = state.rewards.map(reward => (
          reward.id === editingId
            ? { ...reward, ...rewardData, updatedAt: new Date().toISOString() }
            : reward
        ));
        showToast("奖励已更新");
      } else {
        state.rewards.push({
          id: createId("reward"),
          ...rewardData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("奖励已创建");
      }
      saveState();
      closeSheet();
      render();
    }

    function deleteNote(noteId) {
      state.notes = state.notes.filter(note => note.id !== noteId);
      saveState();
      closeSheet();
      render();
      showToast("笔记已移除");
    }

    function deleteReward(rewardId) {
      state.rewards = state.rewards.filter(reward => reward.id !== rewardId);
      saveState();
      closeSheet();
      render();
      showToast("奖励已移除");
    }
