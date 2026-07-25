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

    function openPrioritySheet(day = dateKey()) {
      const priorityDate = normalizeReviewDateKey(day);
      const task = priorityTaskForDate(priorityDate);
      sheetMode = "priority";
      editingId = priorityDate;
      els.sheetTitle.textContent = task ? "编辑重点" : "设定重点";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">今天最重要的一件事</span>
          <input name="title" type="text" maxlength="80" value="${escapeAttr(task?.title || "")}" placeholder="只写一件最重要的事" required>
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(task ? "保存重点" : "设定重点")}
        </div>
        <div class="delete-row ${task ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "priority", id: priorityDate, label: "移除重点" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='title']");
    }

    function openTaskSheet(taskId = null, defaults = {}) {
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
          <input name="name" type="text" maxlength="80" value="${escapeAttr(task?.name || defaults.name || "")}" placeholder="输入任务名称" required>
        </label>
        <label class="field">
          <span class="field-label">奖励金币</span>
          <input name="coins" type="number" min="0" step="0.01" inputmode="decimal" value="${taskRewardInputValue(task)}" placeholder="默认 20">
          <span class="field-help">有时间任务默认 20 金币/小时；无时间任务按设置的固定奖励金额结算。</span>
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

    function calendarCategoryControlHtml(selectedCategory) {
      return `
        <input name="category" type="hidden" value="${escapeAttr(selectedCategory)}">
        <div class="calendar-category-control" role="group" aria-label="计划分类">
          <button class="${selectedCategory === "normal" ? "active" : ""}" type="button" data-calendar-category="normal">普通</button>
          <button class="${selectedCategory === "important" ? "active" : ""}" type="button" data-calendar-category="important">重要</button>
        </div>
      `;
    }

    function openCalendarEventSheet(eventId = null, defaults = {}) {
      const event = eventId ? calendarEventById(eventId) : null;
      const defaultDate = normalizeCalendarDate(defaults.date || selectedCalendarDate || dateKey());
      const startDate = event?.startDate || defaultDate;
      const endDate = event?.endDate || startDate;
      const category = normalizeCalendarCategory(event || defaults);
      sheetMode = "calendar-event";
      editingId = event?.id || null;
      els.sheetTitle.textContent = event ? "编辑计划" : "新增计划";
      els.sheetForm.innerHTML = `
        <label class="calendar-title-field">
          <input name="title" type="text" maxlength="120" value="${escapeAttr(event?.title || defaults.title || "")}" placeholder="计划名称" required>
        </label>
        <div class="calendar-date-fields calendar-date-fields-compact">
          <label class="field">
            <span class="field-label">开始日期</span>
            <input name="startDate" type="date" value="${escapeAttr(startDate)}" required>
          </label>
          <label class="field">
            <span class="field-label">结束日期</span>
            <input name="endDate" type="date" value="${escapeAttr(endDate)}" required>
          </label>
        </div>
        ${calendarCategoryControlHtml(category)}
        <div class="sheet-actions">
          ${submitSheetButtonHtml(event ? "保存计划" : "创建计划")}
        </div>
        <div class="delete-row ${event ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "calendar-event", id: event?.id, label: "删除计划" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='title']");
    }

    function openCalendarEventActionSheet(eventId) {
      const event = calendarEventById(eventId);
      if (!event) return;
      sheetMode = "calendar-event-actions";
      editingId = event.id;
      els.sheetTitle.textContent = event.title;
      els.sheetForm.innerHTML = `
        <div class="calendar-event-action-sheet">
          <button class="calendar-action-row" type="button" data-calendar-edit="${escapeAttr(event.id)}">编辑</button>
          <button class="calendar-action-row danger" type="button" data-calendar-delete="${escapeAttr(event.id)}">删除</button>
        </div>
      `;
      openSheet({ position: "top" });
    }

    function saveCalendarEvent(eventData) {
      const title = String(eventData.title || "").trim();
      const startDate = String(eventData.startDate || "").trim();
      const endDate = String(eventData.endDate || "").trim();
      if (!title) {
        showToast("请输入计划标题");
        return false;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        showToast("请选择计划日期");
        return false;
      }
      if (endDate < startDate) {
        showToast("结束日期不能早于开始日期");
        return false;
      }
      const existing = editingId ? calendarEventById(editingId) : null;
      const now = new Date().toISOString();
      const next = normalizeCalendarEvent({
        ...existing,
        ...eventData,
        id: existing?.id || createId("calendar-event"),
        title,
        startDate,
        endDate,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      });
      if (!next) return false;
      state.calendarEvents = existing
        ? state.calendarEvents.map(event => event.id === existing.id ? next : event)
        : [...state.calendarEvents, next];
      saveState();
      closeSheet();
      render();
      showToast(existing ? "计划已更新" : "计划已创建");
      return true;
    }

    async function deleteCalendarEvent(eventId) {
      const event = calendarEventById(eventId);
      if (!event) return;
      const confirmed = await askForConfirmation({
        title: "删除这个计划？",
        message: "删除后无法恢复。",
        confirmText: "删除"
      });
      if (!confirmed) return;
      state.calendarEvents = state.calendarEvents.filter(item => item.id !== event.id);
      saveState();
      closeSheet();
      render();
      showToast("计划已删除");
    }

    function addCalendarEventToTodayTask(eventId) {
      const event = calendarEventById(eventId);
      if (!event) return;
      closeSheet();
      openTaskSheet(null, { name: event.title });
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
          <input name="coins" type="number" min="0" step="0.01" inputmode="decimal" value="${habit?.coins ?? ""}" placeholder="0">
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
      els.sheetTitle.textContent = reward ? "编辑基金" : "新建基金";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">基金名称</span>
          <input name="name" type="text" maxlength="80" value="${escapeAttr(reward?.name || "")}" placeholder="输入基金名称" required>
        </label>
        <label class="field">
          <span class="field-label">目标金币</span>
          <input name="totalCoins" type="number" min="1" step="1" inputmode="numeric" value="${reward ? fundTotalCoins(reward) : ""}" placeholder="2000">
        </label>
        <label class="field">
          <span class="field-label">每次注入金币</span>
          <input name="amountPerDeposit" type="number" min="1" step="1" inputmode="numeric" value="${reward ? fundAmountPerDeposit(reward) : ""}" placeholder="100">
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml(reward ? "保存基金" : "创建基金")}
        </div>
        <div class="delete-row ${reward ? "" : "hidden"}">
          ${deleteIconButtonHtml({ action: "reward", id: reward?.id, label: "移除基金" })}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("input[name='name']");
    }

    function openReviewEditSheet(day) {
      const reviewDate = normalizeReviewDateKey(day);
      const review = state.dailyReviews?.[reviewDate];
      if (!review) {
        showToast("找不到这条复盘");
        return;
      }

      sheetMode = "review-edit";
      editingId = null;
      editingReviewDate = reviewDate;
      els.sheetTitle.textContent = "编辑复盘";
      els.sheetForm.innerHTML = `
        <label class="field">
          <span class="field-label">日期</span>
          <input name="date" type="date" max="${escapeAttr(dateKey())}" value="${escapeAttr(reviewDate)}" required>
        </label>
        <label class="field">
          <span class="field-label">今天做得最好的事情是什么？</span>
          <textarea name="best" maxlength="500" placeholder="写下值得保留的部分">${escapeHtml(review.best || "")}</textarea>
        </label>
        <label class="field">
          <span class="field-label">今天最大的失误是什么？</span>
          <textarea name="mistake" maxlength="500" placeholder="写下需要调整的部分">${escapeHtml(review.mistake || "")}</textarea>
        </label>
        <label class="field">
          <span class="field-label">明天最重要的一件事是什么？</span>
          <textarea name="priority" maxlength="500" placeholder="写下下一步">${escapeHtml(review.priority || "")}</textarea>
        </label>
        <div class="sheet-actions">
          ${submitSheetButtonHtml("保存复盘")}
        </div>
      `;
      openSheet({ position: "top" });
      focusSheetField("textarea[name='best']");
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
      editingReviewDate = null;
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

    async function handleSheetSubmit(event) {
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
      if (sheetMode === "priority") {
        await savePriorityTask({
          title: String(formData.get("title") || "").trim()
        });
      }
      if (sheetMode === "habit") {
        saveHabit({
          name: String(formData.get("name") || "").trim(),
          coins: Math.max(0, parseCoinAmount(formData.get("coins")))
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
          totalCoins: parseCoinAmount(formData.get("totalCoins")),
          amountPerDeposit: parseCoinAmount(formData.get("amountPerDeposit"))
        });
      }
      if (sheetMode === "calendar-event") {
        saveCalendarEvent({
          title: String(formData.get("title") || "").trim(),
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          category: formData.get("category")
        });
      }
      if (sheetMode === "review-edit") {
        await saveEditedDailyReview({
          date: formData.get("date"),
          best: formData.get("best"),
          mistake: formData.get("mistake"),
          priority: formData.get("priority")
        }, editingReviewDate);
      }
    }

    async function savePriorityTask(priorityData) {
      const title = String(priorityData.title || "").trim();
      if (!title) {
        showToast("请输入今天最重要的一件事");
        return false;
      }
      const day = normalizeReviewDateKey(editingId || dateKey());
      const existing = priorityTaskForDate(day);
      if (existing && existing.status !== "pending") {
        showToast("已结算，不能编辑");
        return false;
      }
      setPriorityTaskForDate(day, title);
      saveState();
      closeSheet();
      render();
      showToast(existing ? "重点已更新" : "重点已设定");
      return true;
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
        showToast("请输入基金名称");
        return;
      }
      if (rewardData.totalCoins <= 0) {
        showToast("请输入目标金币");
        return;
      }
      if (rewardData.amountPerDeposit <= 0) {
        showToast("请输入每次注入金币");
        return;
      }
      if (editingId) {
        state.rewards = state.rewards.map((reward, index) => {
          if (reward.id !== editingId) return reward;
          const { completedBeforePastCoinHistoryScaleMigration, ...editableReward } = reward;
          const merged = normalizeFundReward({
            ...editableReward,
            ...rewardData,
            currentCoins: fundCurrentCoins(reward),
            updatedAt: new Date().toISOString()
          }, index);
          const stillComplete = fundCompleted(merged);
          if (!stillComplete && reward.achievementId) {
            state.achievements = (Array.isArray(state.achievements) ? state.achievements : [])
              .filter(item => item.id !== reward.achievementId);
            merged.completedAt = null;
            merged.achievementId = null;
          }
          return merged;
        });
        showToast("基金已更新");
      } else {
        state.rewards.push(normalizeFundReward({
          id: createId("reward"),
          ...rewardData,
          currentCoins: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, state.rewards.length));
        showToast("基金已创建");
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
      showToast("基金已移除");
    }

    function deletePriorityTask(day) {
      const date = normalizeReviewDateKey(day);
      const task = priorityTaskForDate(date);
      if (!task) return;
      if (task.status !== "pending") {
        showToast("已结算，不能删除");
        return;
      }
      delete ensurePriorityTasks()[date];
      saveState();
      closeSheet();
      render();
      showToast("重点已移除");
    }
