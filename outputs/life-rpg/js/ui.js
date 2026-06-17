    const els = {
      todayDate: document.getElementById("todayDate"),
      homeCoins: document.getElementById("homeCoins"),
      homeStreak: document.getElementById("homeStreak"),
      habitCount: document.getElementById("habitCount"),
      habitList: document.getElementById("habitList"),
      todayTaskCount: document.getElementById("todayTaskCount"),
      todayTaskList: document.getElementById("todayTaskList"),
      badCoins: document.getElementById("badCoins"),
      badHabitCount: document.getElementById("badHabitCount"),
      badHabitList: document.getElementById("badHabitList"),
      noteCount: document.getElementById("noteCount"),
      noteList: document.getElementById("noteList"),
      reviewDate: document.getElementById("reviewDate"),
      dailyReviewForm: document.getElementById("dailyReviewForm"),
      reviewBest: document.getElementById("reviewBest"),
      reviewMistake: document.getElementById("reviewMistake"),
      reviewPriority: document.getElementById("reviewPriority"),
      reviewSaveStatus: document.getElementById("reviewSaveStatus"),
      reviewHistoryCount: document.getElementById("reviewHistoryCount"),
      reviewHistoryList: document.getElementById("reviewHistoryList"),
      rewardCoins: document.getElementById("rewardCoins"),
      rewardCount: document.getElementById("rewardCount"),
      rewardList: document.getElementById("rewardList"),
      statStreak: document.getElementById("statStreak"),
      statCompleted: document.getElementById("statCompleted"),
      statCoins: document.getElementById("statCoins"),
      statSpent: document.getElementById("statSpent"),
      statPenalty: document.getElementById("statPenalty"),
      heatmapMonthLabel: document.getElementById("heatmapMonthLabel"),
      heatmapChart: document.getElementById("heatmapChart"),
      habitTrendChart: document.getElementById("habitTrendChart"),
      resetAllBtn: document.getElementById("resetAllBtn"),
      sheetBackdrop: document.getElementById("sheetBackdrop"),
      sheetTitle: document.getElementById("sheetTitle"),
      sheetForm: document.getElementById("sheetForm"),
      closeSheetBtn: document.getElementById("closeSheetBtn"),
      dayDetailBackdrop: document.getElementById("dayDetailBackdrop"),
      dayDetailTitle: document.getElementById("dayDetailTitle"),
      dayDetailContent: document.getElementById("dayDetailContent"),
      closeDayDetailBtn: document.getElementById("closeDayDetailBtn"),
      confirmBackdrop: document.getElementById("confirmBackdrop"),
      confirmTitle: document.getElementById("confirmTitle"),
      confirmMessage: document.getElementById("confirmMessage"),
      confirmCancelBtn: document.getElementById("confirmCancelBtn"),
      confirmAcceptBtn: document.getElementById("confirmAcceptBtn"),
      toast: document.getElementById("toast")
    };
    function parseTimeValue(value) {
      const raw = String(value || "").trim();
      const twelveHour = raw.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i);
      if (twelveHour) {
        const hour = Number(twelveHour[1]);
        if (hour >= 1 && hour <= 12) {
          return {
            hour: String(hour),
            minute: twelveHour[2],
            period: twelveHour[3].toUpperCase()
          };
        }
      }

      const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (twentyFourHour) {
        return timePartsFrom24Hour(Number(twentyFourHour[1]), twentyFourHour[2]);
      }

      return null;
    }

    function timePartsFrom24Hour(hour24, minute = "00") {
      const normalizedHour = ((Number(hour24) % 24) + 24) % 24;
      const hour = normalizedHour % 12 || 12;
      return {
        hour: String(hour),
        minute: String(minute).padStart(2, "0"),
        period: normalizedHour >= 12 ? "PM" : "AM"
      };
    }

    function nextWholeHourTime() {
      const now = new Date();
      return timePartsFrom24Hour(now.getHours() + 1, "00");
    }

    function formatTimeParts(parts) {
      if (!parts) return "";
      const hour = Number(parts.hour);
      const minute = String(parts.minute || "00").padStart(2, "0");
      const period = parts.period === "PM" ? "PM" : "AM";
      return `${hour || 12}:${minute} ${period}`;
    }

    function timeOptionButtons(type, selected) {
      const values = {
        hour: Array.from({ length: 12 }, (_, index) => String(index + 1)),
        minute: Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")),
        period: ["AM", "PM"]
      }[type] || [];
      const selectedValue = selected == null ? "" : String(selected);
      return values.map(value => {
        const selectedClass = value === selectedValue ? " selected" : "";
        return `<button class="time-option${selectedClass}" type="button" data-time-${type}="${value}">${value}</button>`;
      }).join("");
    }

    function initTimePicker(initialValue = "") {
      const picker = els.sheetForm.querySelector("[data-time-picker]");
      if (!picker) return;

      const hiddenInput = picker.querySelector("input[name='time']");
      const valueLabel = picker.querySelector("[data-time-value]");
      const hourWheel = picker.querySelector("[data-time-wheel='hour']");
      const minuteWheel = picker.querySelector("[data-time-wheel='minute']");
      const periodWheel = picker.querySelector("[data-time-wheel='period']");
      const initial = parseTimeValue(initialValue);
      let userWheelIntent = false;

      function datasetKey(type) {
        return `time${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      }

      function selectedValueFor(type, parts) {
        if (type === "hour") return parts.hour;
        if (type === "minute") return parts.minute;
        return parts.period;
      }

      function vibrateTimeChange() {
        try {
          if (navigator.vibrate) navigator.vibrate(10);
        } catch (error) {
          // Haptics are a best-effort touch nicety.
        }
      }

      function currentTimeParts() {
        return parseTimeValue(hiddenInput.value) || nextWholeHourTime();
      }

      function findWheelOption(wheel, type, value) {
        return Array.from(wheel.querySelectorAll(".time-option")).find(option => (
          option.dataset[datasetKey(type)] === String(value)
        ));
      }

      function scrollWheelTo(type, value, behavior = "smooth") {
        const wheel = picker.querySelector(`[data-time-wheel='${type}']`);
        if (!wheel) return;
        findWheelOption(wheel, type, value)?.scrollIntoView({ block: "center", behavior });
      }

      function setTime(parts, options = {}) {
        const nextParts = {
          hour: String(Number(parts.hour) || 12),
          minute: String(parts.minute || "00").padStart(2, "0"),
          period: parts.period === "PM" ? "PM" : "AM"
        };
        const previousValue = hiddenInput.value;
        const nextValue = formatTimeParts(nextParts);
        picker.dataset.hour = nextParts.hour;
        picker.dataset.minute = nextParts.minute;
        picker.dataset.period = nextParts.period;
        delete picker.dataset.timeCleared;
        hiddenInput.value = nextValue;
        valueLabel.textContent = nextValue;
        picker.querySelectorAll(".time-option").forEach(option => {
          const type = option.closest("[data-time-wheel]")?.dataset.timeWheel;
          option.classList.toggle("selected", Boolean(type) && option.dataset[datasetKey(type)] === selectedValueFor(type, nextParts));
        });
        if (options.vibrate && previousValue !== nextValue) vibrateTimeChange();
      }

      function clearTime() {
        delete picker.dataset.hour;
        delete picker.dataset.minute;
        delete picker.dataset.period;
        picker.dataset.timeCleared = "true";
        userWheelIntent = false;
        hiddenInput.value = "";
        valueLabel.textContent = "未设置";
        picker.querySelectorAll(".time-option").forEach(option => option.classList.remove("selected"));
      }

      if (initial) {
        setTime(initial);
        requestAnimationFrame(() => {
          scrollWheelTo("hour", initial.hour, "auto");
          scrollWheelTo("minute", initial.minute, "auto");
          scrollWheelTo("period", initial.period, "auto");
        });
      } else {
        clearTime();
      }

      picker.addEventListener("click", event => {
        const hourButton = event.target.closest("[data-time-hour]");
        const minuteButton = event.target.closest("[data-time-minute]");
        const periodButton = event.target.closest("[data-time-period]");
        const clearButton = event.target.closest("[data-clear-time]");

        if (clearButton) {
          clearTime();
          return;
        }

        if (hourButton || minuteButton || periodButton) {
          const next = currentTimeParts();
          if (hourButton) next.hour = hourButton.dataset.timeHour;
          if (minuteButton) next.minute = minuteButton.dataset.timeMinute;
          if (periodButton) next.period = periodButton.dataset.timePeriod;
          setTime(next, { vibrate: true });
          if (hourButton) scrollWheelTo("hour", next.hour);
          if (minuteButton) scrollWheelTo("minute", next.minute);
          if (periodButton) scrollWheelTo("period", next.period);
        }
      });

      function attachWheelScroll(wheel, type) {
        if (!wheel) return;
        let scrollTimer;
        const markUserWheelIntent = () => {
          userWheelIntent = true;
        };
        const settleWheel = () => {
          if (!hiddenInput.value && picker.dataset.timeCleared === "true" && !userWheelIntent) return;
          const wheelRect = wheel.getBoundingClientRect();
          const center = wheelRect.top + wheelRect.height / 2;
          const options = Array.from(wheel.querySelectorAll(".time-option"));
          const nearest = options.reduce((closest, option) => {
            const rect = option.getBoundingClientRect();
            const distance = Math.abs(rect.top + rect.height / 2 - center);
            return !closest || distance < closest.distance ? { option, distance } : closest;
          }, null)?.option;
          if (!nearest) return;
          const next = currentTimeParts();
          next[type] = nearest.dataset[datasetKey(type)];
          setTime(next, { vibrate: true });
          userWheelIntent = false;
        };

        wheel.addEventListener("pointerdown", markUserWheelIntent, { passive: true });
        wheel.addEventListener("touchstart", markUserWheelIntent, { passive: true });
        wheel.addEventListener("wheel", markUserWheelIntent, { passive: true });
        wheel.addEventListener("scroll", () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(settleWheel, 90);
        }, { passive: true });
        wheel.addEventListener("scrollend", settleWheel, { passive: true });
      }

      attachWheelScroll(hourWheel, "hour");
      attachWheelScroll(minuteWheel, "minute");
      attachWheelScroll(periodWheel, "period");
    }

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
    function swipeRowHtml({ attrs = "", actionWidth = 84, actions = "", content = "", editType = "", editId = "", extraClass = "" }) {
      const editAttrs = editType && editId
        ? ` data-edit-card="${escapeAttr(editType)}" data-edit-id="${escapeAttr(editId)}"`
        : "";
      return `
        <article class="swipe-row ${extraClass}" data-swipe-row style="--swipe-width: ${actionWidth}px;" ${attrs}>
          <div class="card swipe-card" data-swipe-content${editAttrs}>
            ${content}
            ${actions ? `<div class="inline-card-actions" aria-label="快捷操作">${actions}</div>` : ""}
          </div>
        </article>
      `;
    }
    function scheduleRender(delay = 320) {
      clearTimeout(scheduleRender.timer);
      scheduleRender.timer = setTimeout(render, delay);
    }

    function prepareActionCard(card) {
      if (!card) return;
      card.querySelectorAll("button").forEach(button => {
        button.disabled = true;
      });
    }

    function swipeRowWidth(row) {
      const value = getComputedStyle(row).getPropertyValue("--swipe-width").trim();
      return Number(value.replace("px", "")) || 84;
    }

    function setSwipeOffset(row, offset) {
      row.style.setProperty("--swipe-offset", `${Math.round(offset)}px`);
    }

    function closeSwipeRow(row) {
      if (!row) return;
      row.classList.remove("swipe-open", "swiping");
      setSwipeOffset(row, 0);
    }

    function openSwipeRow(row) {
      if (!row) return;
      closeOpenSwipeRows(row);
      row.classList.remove("swiping");
      row.classList.add("swipe-open");
      setSwipeOffset(row, -swipeRowWidth(row));
    }

    function closeOpenSwipeRows(exceptRow = null) {
      document.querySelectorAll("[data-swipe-row].swipe-open").forEach(row => {
        if (row !== exceptRow) closeSwipeRow(row);
      });
    }

    function handleEditCardTap(card) {
      const editId = card.dataset.editId;
      if (!editId) return;
      if (card.dataset.editCard === "task") openTaskSheet(editId);
      if (card.dataset.editCard === "habit") openHabitSheet(editId);
      if (card.dataset.editCard === "bad") openBadHabitSheet(editId);
      if (card.dataset.editCard === "reward") openRewardSheet(editId);
    }

    function triggerLongPressEdit(press) {
      if (!press?.card) return;
      press.triggered = true;
      suppressNextCardTap = true;
      press.row?.classList.add("long-press-active");
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
      handleEditCardTap(press.card);
      window.setTimeout(() => {
        press.row?.classList.remove("long-press-active");
      }, 220);
    }

    function clearActivePress() {
      if (!activeSwipe) return null;
      const press = activeSwipe;
      activeSwipe = null;
      clearTimeout(press.timer);
      press.card?.releasePointerCapture?.(press.pointerId);
      return press;
    }

    function beginSwipe(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const card = event.target.closest("[data-edit-card]");
      if (!card) return;
      const row = card.closest("[data-swipe-row]");
      if (!row) return;

      activeSwipe = {
        row,
        card,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        triggered: false,
        timer: window.setTimeout(() => {
          if (activeSwipe?.pointerId === event.pointerId) triggerLongPressEdit(activeSwipe);
        }, 580)
      };
      card.setPointerCapture?.(event.pointerId);
    }

    function moveSwipe(event) {
      if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
      const deltaX = event.clientX - activeSwipe.startX;
      const deltaY = event.clientY - activeSwipe.startY;
      if (Math.hypot(deltaX, deltaY) > 12) clearActivePress();
    }

    function endSwipe(event) {
      if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
      const press = clearActivePress();
      if (press?.triggered) {
        window.setTimeout(() => {
          suppressNextCardTap = false;
        }, 0);
      }
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

    function render() {
      const activeCount = activeTasksToday().length;
      const visibleHabitCount = visibleHabitsToday().length;

      els.todayDate.textContent = formatDate();
      updatePrimaryReadouts();
      els.habitCount.textContent = `${visibleHabitCount} 项`;
      els.todayTaskCount.textContent = `${activeCount} 项`;
      els.badHabitCount.textContent = `${state.badHabits.length} 项`;
      els.noteCount.textContent = `${state.notes.length} 条`;
      els.rewardCount.textContent = `${state.rewards.length} 项`;

      renderHabits();
      renderTasks();
      renderBadHabits();
      renderNotes();
      renderDailyReview();
      renderRewards();
      renderStatsVisuals();
    }

    function renderHabits() {
      if (!state.habits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>还没有习惯</strong>
            <p>添加一个每天固定出现的长期习惯。</p>
            <button class="button empty-action" data-open-habit>新建习惯</button>
          </div>
        `;
        return;
      }

      const activeHabits = visibleHabitsToday();
      if (!activeHabits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>今日习惯已清空</strong>
            <p>完成的习惯已经收起，明天会自动重新出现。</p>
          </div>
        `;
        return;
      }

      els.habitList.innerHTML = activeHabits.map(habit => swipeRowHtml({
        attrs: `data-habit-card="${escapeAttr(habit.id)}"`,
        editType: "habit",
        editId: habit.id,
        actions: `<button class="swipe-action green" type="button" data-complete-habit="${escapeAttr(habit.id)}" aria-label="完成习惯"><span class="action-icon" aria-hidden="true">✓</span><span class="action-label">完成</span></button>`,
        content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(habit.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(parseAmount(habit.coins))} 金币</span>
                </div>
              </div>
            </div>
        `
      })).join("");
    }

    function renderTasks() {
      const tasksForToday = todayTasks();
      if (!tasksForToday.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今天没有任务</strong>
            <p>添加一个你今天必须完成的任务。</p>
            <button class="button empty-action" data-open-task>新建任务</button>
          </div>
        `;
        return;
      }

      const activeTasks = tasksForToday.filter(task => !taskResultToday(task.id));
      if (!activeTasks.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今日任务已清空</strong>
            <p>今天的选择已经记录。明天会重新开始。</p>
          </div>
        `;
        return;
      }

      els.todayTaskList.innerHTML = groupedActiveTasks(activeTasks).map(group => `
        <section class="task-time-group">
          <div class="task-time-heading">${escapeHtml(group.label)}</div>
          <div class="task-time-list">
            ${group.tasks.map(task => swipeRowHtml({
              attrs: `data-task-card="${escapeAttr(task.id)}"`,
              actionWidth: 168,
              editType: "task",
              editId: task.id,
              actions: `
                <button class="swipe-action green" type="button" data-complete-task="${escapeAttr(task.id)}" aria-label="完成任务"><span class="action-icon" aria-hidden="true">✓</span><span class="action-label">完成</span></button>
                <button class="swipe-action red" type="button" data-fail-task="${escapeAttr(task.id)}" aria-label="任务失败"><span class="action-icon" aria-hidden="true">×</span><span class="action-label">失败</span></button>
              `,
              content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(task.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(parseAmount(task.coins))} 金币</span>
                </div>
              </div>
            </div>
              `
            })).join("")}
          </div>
        </section>
      `).join("");
    }

    function renderBadHabits() {
      if (!state.badHabits.length) {
        els.badHabitList.innerHTML = `
          <div class="empty-state">
            <strong>没有坏习惯</strong>
            <p>添加一个需要立刻付出代价的行为。</p>
            <button class="button empty-action" data-open-bad>新建坏习惯</button>
          </div>
        `;
        return;
      }

      els.badHabitList.innerHTML = state.badHabits.map(habit => swipeRowHtml({
        attrs: `data-habit-card="${escapeAttr(habit.id)}" data-bad-card="${escapeAttr(habit.id)}"`,
        editType: "bad",
        editId: habit.id,
        actions: `<button class="swipe-action red" type="button" data-trigger-bad="${escapeAttr(habit.id)}" aria-label="记录坏习惯"><span class="action-icon" aria-hidden="true">×</span><span class="action-label">记录</span></button>`,
        content: `
          <div class="card-main">
            <div class="title-wrap">
                <h3>${escapeHtml(habit.name)}</h3>
                <div class="meta-row">
                <span class="pill coin-pill">${formatNumber(parseAmount(habit.penalty))} 金币</span>
                </div>
              </div>
          </div>
        `
      })).join("");
    }

    function renderNotes() {
      if (!state.notes.length) {
        els.noteList.innerHTML = `
          <div class="empty-state">
            <strong>没有笔记</strong>
            <p>写下一个简单提醒。</p>
            <button class="button empty-action" data-open-note>新建笔记</button>
          </div>
        `;
        return;
      }

      els.noteList.innerHTML = state.notes.map(note => `
        <article class="card note-card">
          <div class="card-main">
            <div class="title-wrap">
              <p>${escapeHtml(note.text)}</p>
            </div>
            <button class="text-button" data-edit-note="${note.id}">编辑</button>
          </div>
        </article>
      `).join("");
    }

    function reviewAnswerHtml(label, value) {
      const isEmpty = !String(value || "").trim();
      return `
        <div class="review-answer ${isEmpty ? "empty" : ""}">
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(isEmpty ? "未填写" : value)}</p>
        </div>
      `;
    }

    function renderDailyReview(options = {}) {
      const todayReview = dailyReviewToday();
      const today = dateKey();
      const history = sortedDailyReviews(true);
      const shouldClearInputs = options.clearInputs === true;

      els.reviewDate.textContent = formatDate();
      els.reviewBest.value = shouldClearInputs ? "" : todayReview.best || "";
      els.reviewMistake.value = shouldClearInputs ? "" : todayReview.mistake || "";
      els.reviewPriority.value = shouldClearInputs ? "" : todayReview.priority || "";
      els.reviewHistoryCount.textContent = `${history.length} 条`;

      if (!history.length) {
        els.reviewHistoryList.innerHTML = `
          <div class="empty-state">
            <strong>还没有历史复盘</strong>
            <p>保存今天的复盘后，明天会自动进入历史。</p>
          </div>
        `;
        return;
      }

      els.reviewHistoryList.innerHTML = history.map(([day, review]) => `
        <article class="card review-card">
          <div class="review-card-header">
            <div class="review-date">
              <span class="review-date-label">日期</span>
              <span class="review-date-main">${escapeHtml(day === today ? "今天" : formatFullDateKey(day))}</span>
            </div>
            ${day === today ? `<span class="review-today-pill">今天</span>` : ""}
          </div>
          ${reviewAnswerHtml("今天做得最好的事情是什么？", review.best)}
          ${reviewAnswerHtml("今天最大的失误是什么？", review.mistake)}
          ${reviewAnswerHtml("明天最重要的一件事是什么？", review.priority)}
        </article>
      `).join("");
    }

    function renderRewards() {
      if (!state.rewards.length) {
        els.rewardList.innerHTML = `
          <div class="empty-state">
            <strong>没有奖励</strong>
            <p>添加一个可以用金币兑换的奖励。</p>
            <button class="button empty-action" data-open-reward>新建奖励</button>
          </div>
        `;
        return;
      }

      els.rewardList.innerHTML = state.rewards.map(reward => {
        const cost = parseAmount(reward.cost);
        const affordable = state.coins >= cost;
        return swipeRowHtml({
          attrs: `data-reward-card="${escapeAttr(reward.id)}"`,
          editType: "reward",
          editId: reward.id,
          actions: `<button class="swipe-action blue" type="button" data-redeem-reward="${escapeAttr(reward.id)}" ${affordable ? "" : "disabled"} aria-label="${affordable ? "兑换奖励" : "金币不足"}"><span class="action-icon" aria-hidden="true">兑</span><span class="action-label">${affordable ? "兑换" : "不足"}</span></button>`,
          content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(reward.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(cost)} 金币</span>
                </div>
              </div>
            </div>
          `
        });
      }).join("");
    }
    function switchView(view) {
      document.querySelectorAll(".view").forEach(node => {
        node.classList.toggle("active", node.dataset.view === view);
      });
      document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.toggle("active", button.dataset.nav === view);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeConfirm(result = false) {
      if (!confirmResolver) return;
      const resolve = confirmResolver;
      confirmResolver = null;
      els.confirmBackdrop.classList.add("hidden");
      els.confirmBackdrop.setAttribute("aria-hidden", "true");
      resolve(result);
    }

    function askForConfirmation({ title, message, confirmText }) {
      if (confirmResolver) closeConfirm(false);
      return new Promise(resolve => {
        confirmResolver = resolve;
        els.confirmTitle.textContent = title;
        els.confirmMessage.textContent = message;
        els.confirmAcceptBtn.textContent = confirmText || "确认";
        els.confirmBackdrop.classList.remove("hidden");
        els.confirmBackdrop.setAttribute("aria-hidden", "false");
        window.setTimeout(() => els.confirmAcceptBtn.focus(), 0);
      });
    }

    function showToast(message, duration = 1800) {
      clearPendingUndo(false);
      els.toast.textContent = message;
      els.toast.classList.remove("interactive");
      els.toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, duration);
    }

    function showReviewSavedStatus() {
      els.reviewSaveStatus.classList.add("show");
      clearTimeout(showReviewSavedStatus.timer);
      showReviewSavedStatus.timer = setTimeout(() => {
        els.reviewSaveStatus.classList.remove("show");
      }, 2000);
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
    document.addEventListener("pointerdown", beginSwipe);
    document.addEventListener("pointermove", moveSwipe, { passive: false });
    document.addEventListener("pointerup", endSwipe);
    document.addEventListener("pointercancel", endSwipe);

    document.addEventListener("click", event => {
      const undoButton = event.target.closest("[data-undo-action]");
      const swipeActionButton = event.target.closest(".swipe-action");
      const swipeContent = event.target.closest("[data-swipe-content]");
      const editCard = event.target.closest("[data-edit-card]");
      const navButton = event.target.closest("[data-nav]");
      const openTaskButton = event.target.closest("[data-open-task]");
      const openHabitButton = event.target.closest("[data-open-habit]");
      const openBadButton = event.target.closest("[data-open-bad]");
      const openNoteButton = event.target.closest("[data-open-note]");
      const openRewardButton = event.target.closest("[data-open-reward]");
      const editTaskButton = event.target.closest("[data-edit-task]");
      const editHabitButton = event.target.closest("[data-edit-habit]");
      const editBadButton = event.target.closest("[data-edit-bad]");
      const editNoteButton = event.target.closest("[data-edit-note]");
      const editRewardButton = event.target.closest("[data-edit-reward]");
      const completeTaskButton = event.target.closest("[data-complete-task]");
      const completeHabitButton = event.target.closest("[data-complete-habit]");
      const failTaskButton = event.target.closest("[data-fail-task]");
      const triggerBadButton = event.target.closest("[data-trigger-bad]");
      const redeemRewardButton = event.target.closest("[data-redeem-reward]");
      const statsRangeButton = event.target.closest("[data-stats-range]");
      const heatMonthButton = event.target.closest("[data-heat-month]");
      const dayDetailButton = event.target.closest("[data-day-detail]");
      const closeButton = event.target.closest("[data-close-sheet]");
      const deleteTaskButton = event.target.closest("[data-delete-task]");
      const deleteHabitButton = event.target.closest("[data-delete-habit]");
      const deleteBadButton = event.target.closest("[data-delete-bad]");
      const deleteNoteButton = event.target.closest("[data-delete-note]");
      const deleteRewardButton = event.target.closest("[data-delete-reward]");

      if (undoButton) {
        undoLastAction();
        return;
      }
      if (!event.target.closest("[data-swipe-row]")) {
        closeOpenSwipeRows();
      }
      if (suppressNextCardTap && (swipeContent || editCard)) {
        suppressNextCardTap = false;
        return;
      }
      if (navButton) switchView(navButton.dataset.nav);
      if (openTaskButton) openTaskSheet();
      if (openHabitButton) openHabitSheet();
      if (openBadButton) openBadHabitSheet();
      if (openNoteButton) openNoteSheet();
      if (openRewardButton) openRewardSheet();
      if (editTaskButton) openTaskSheet(editTaskButton.dataset.editTask);
      if (editHabitButton) openHabitSheet(editHabitButton.dataset.editHabit);
      if (editBadButton) openBadHabitSheet(editBadButton.dataset.editBad);
      if (editNoteButton) openNoteSheet(editNoteButton.dataset.editNote);
      if (editRewardButton) openRewardSheet(editRewardButton.dataset.editReward);
      if (completeTaskButton) {
        completeTask(completeTaskButton.dataset.completeTask, completeTaskButton.closest("[data-task-card]"));
      }
      if (completeHabitButton) {
        completeHabit(completeHabitButton.dataset.completeHabit, completeHabitButton.closest("[data-habit-card]"));
      }
      if (failTaskButton) {
        failTask(failTaskButton.dataset.failTask, failTaskButton.closest("[data-task-card]"));
      }
      if (triggerBadButton) {
        triggerBadHabit(triggerBadButton.dataset.triggerBad, triggerBadButton.closest("[data-habit-card]"));
      }
      if (redeemRewardButton) {
        redeemReward(
          redeemRewardButton.dataset.redeemReward,
          redeemRewardButton.closest("[data-reward-card]"),
          redeemRewardButton
        );
      }
      if (statsRangeButton) {
        currentStatsRange = statsRangeButton.dataset.statsRange;
        document.querySelectorAll("[data-stats-range]").forEach(button => {
          button.classList.toggle("active", button === statsRangeButton);
        });
        renderHabitTrend(buildStatsRows(currentStatsRange));
      }
      if (heatMonthButton) {
        currentHeatmapMonth = shiftMonthKey(
          currentHeatmapMonth,
          heatMonthButton.dataset.heatMonth === "next" ? 1 : -1
        );
        renderHeatmap();
      }
      if (dayDetailButton) openDayDetail(dayDetailButton.dataset.dayDetail);
      if (closeButton) closeSheet();
      if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
      if (deleteHabitButton) deleteHabit(deleteHabitButton.dataset.deleteHabit);
      if (deleteBadButton) deleteBadHabit(deleteBadButton.dataset.deleteBad);
      if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
      if (deleteRewardButton) deleteReward(deleteRewardButton.dataset.deleteReward);
    });

    els.closeSheetBtn.addEventListener("click", closeSheet);
    els.sheetBackdrop.addEventListener("click", event => {
      if (event.target === els.sheetBackdrop) closeSheet();
    });
    els.closeDayDetailBtn.addEventListener("click", closeDayDetail);
    els.dayDetailBackdrop.addEventListener("click", event => {
      if (event.target === els.dayDetailBackdrop) closeDayDetail();
    });
    els.confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
    els.confirmAcceptBtn.addEventListener("click", () => closeConfirm(true));
    els.confirmBackdrop.addEventListener("click", event => {
      if (event.target === els.confirmBackdrop) closeConfirm(false);
    });
    els.sheetForm.addEventListener("submit", handleSheetSubmit);
    els.dailyReviewForm.addEventListener("submit", event => {
      event.preventDefault();
      const formData = new FormData(els.dailyReviewForm);
      saveDailyReview({
        best: formData.get("best"),
        mistake: formData.get("mistake"),
        priority: formData.get("priority")
      });
    });
    els.resetAllBtn.addEventListener("click", () => {
      const confirmed = confirm("确定要重置所有数据吗？此操作会清空当前浏览器中的全部记录。");
      if (confirmed) resetAllData();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!els.confirmBackdrop.classList.contains("hidden")) {
          closeConfirm(false);
          return;
        }
        if (!els.dayDetailBackdrop.classList.contains("hidden")) {
          closeDayDetail();
          return;
        }
        if (!els.sheetBackdrop.classList.contains("hidden")) {
          closeSheet();
        }
      }
    });

    render();
