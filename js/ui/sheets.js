    function openTaskSheet(taskId = null) {
      sheetMode = "task";
      editingId = taskId;
      const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
      const parsedTaskTime = parseTimeValue(task?.time);
      const taskTime = task ? parsedTaskTime : nextWholeHourTime();
      const initialTimeValue = taskTime ? formatTimeParts(taskTime) : "";
      els.sheetTitle.textContent = task ? "编辑任务" : "新建任务";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">任务名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(task?.name || "")}" placeholder="输入任务名称" required>
        </label>
        <label class="field">
          <span class="field-label">金币金额</span>
          <input name="coins" type="number" min="0" step="1" inputmode="numeric" value="${task?.coins ?? ""}" placeholder="0">
        </label>
        <div class="field">
          <span class="field-label">时间（可选）</span>
          <div class="time-picker" data-time-picker>
            <input name="time" type="hidden" value="${escapeAttr(initialTimeValue)}">
            <div class="time-picker-header">
              <span class="time-picker-value" data-time-value>${escapeHtml(initialTimeValue || "未设置")}</span>
              <button class="time-clear" type="button" data-clear-time>不设置</button>
            </div>
            <div class="time-wheels" aria-label="选择时间">
              <div class="time-wheel" data-time-wheel="hour" aria-label="小时">
                ${timeOptionButtons("hour", taskTime?.hour)}
              </div>
              <div class="time-wheel" data-time-wheel="minute" aria-label="分钟">
                ${timeOptionButtons("minute", taskTime?.minute)}
              </div>
              <div class="time-wheel" data-time-wheel="period" aria-label="上午或下午">
                ${timeOptionButtons("period", taskTime?.period)}
              </div>
            </div>
          </div>
        </div>
        <div class="sheet-actions">
          <button class="ghost-button" type="button" data-close-sheet>取消</button>
          <button class="button" type="submit">${task ? "保存" : "创建"}</button>
        </div>
        <div class="delete-row ${task ? "" : "hidden"}">
          <button class="danger-button" type="button" data-delete-task="${task?.id || ""}">删除任务</button>
        </div>
      `;
      openSheet();
      initTimePicker(initialTimeValue);
      els.sheetForm.querySelector("input[name='name']").focus();
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
          <button class="ghost-button" type="button" data-close-sheet>取消</button>
          <button class="button" type="submit">${habit ? "保存" : "创建"}</button>
        </div>
        <div class="delete-row ${habit ? "" : "hidden"}">
          <button class="danger-button" type="button" data-delete-habit="${habit?.id || ""}">删除习惯</button>
        </div>
      `;
      openSheet();
      els.sheetForm.querySelector("input[name='name']").focus();
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
          <button class="ghost-button" type="button" data-close-sheet>取消</button>
          <button class="button" type="submit">${habit ? "保存" : "创建"}</button>
        </div>
        <div class="delete-row ${habit ? "" : "hidden"}">
          <button class="danger-button" type="button" data-delete-bad="${habit?.id || ""}">删除坏习惯</button>
        </div>
      `;
      openSheet();
      els.sheetForm.querySelector("input[name='name']").focus();
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
          <button class="ghost-button" type="button" data-close-sheet>取消</button>
          <button class="button" type="submit">${note ? "保存" : "创建"}</button>
        </div>
        <div class="delete-row ${note ? "" : "hidden"}">
          <button class="danger-button" type="button" data-delete-note="${note?.id || ""}">删除笔记</button>
        </div>
      `;
      openSheet();
      els.sheetForm.querySelector("textarea[name='text']").focus();
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
          <button class="ghost-button" type="button" data-close-sheet>取消</button>
          <button class="button" type="submit">${reward ? "保存" : "创建"}</button>
        </div>
        <div class="delete-row ${reward ? "" : "hidden"}">
          <button class="danger-button" type="button" data-delete-reward="${reward?.id || ""}">删除奖励</button>
        </div>
      `;
      openSheet();
      els.sheetForm.querySelector("input[name='name']").focus();
    }

    function openSheet() {
      els.sheetBackdrop.classList.remove("hidden");
      els.sheetBackdrop.setAttribute("aria-hidden", "false");
    }

    function closeSheet() {
      els.sheetBackdrop.classList.add("hidden");
      els.sheetBackdrop.setAttribute("aria-hidden", "true");
      sheetMode = null;
      editingId = null;
      els.sheetForm.innerHTML = "";
    }

    function handleSheetSubmit(event) {
      event.preventDefault();
      const formData = new FormData(els.sheetForm);
      if (sheetMode === "task") {
        saveTask({
          name: String(formData.get("name") || "").trim(),
          coins: parseAmount(formData.get("coins")),
          time: String(formData.get("time") || "").trim()
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
      showToast("笔记已删除");
    }

    function deleteReward(rewardId) {
      state.rewards = state.rewards.filter(reward => reward.id !== rewardId);
      saveState();
      closeSheet();
      render();
      showToast("奖励已删除");
    }
