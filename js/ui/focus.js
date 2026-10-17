    let focusTickTimer = null;

    function stopFocusTick() {
      window.clearTimeout(focusTickTimer);
      focusTickTimer = null;
    }

    function updateFocusClock() {
      stopFocusTick();
      const session = state.currentFocus;
      if (!session || document.visibilityState !== "visible" || activeViewName() !== "today") return;
      if (session.localDateKey !== dateKey() || !focusHabitAvailable(session.habitId, session.localDateKey)
        || (session.status === "active" && Date.now() >= Date.parse(session.endsAt))) {
        if (runAutomaticChecks({ showToast: false })) { render(); return; }
        // A failed save keeps the previous session; retry without a render loop.
        focusTickTimer = window.setTimeout(updateFocusClock, 30000);
        const clock = document.getElementById("focusTime");
        if (clock) clock.textContent = focusTimeLabel(focusSecondsRemaining(session));
        return;
      }
      const seconds = focusSecondsRemaining(session);
      const clock = document.getElementById("focusTime");
      const progress = document.getElementById("focusProgress");
      if (clock) clock.textContent = focusTimeLabel(seconds);
      if (progress) progress.value = 3600 - seconds;
      if (session.status === "active") focusTickTimer = window.setTimeout(updateFocusClock, 1000);
    }

    function renderFocusTask() {
      stopFocusTick();
      const section = document.getElementById("currentFocusTask");
      if (!section) return;
      const session = normalizeFocusSession(state.currentFocus);
      const habit = session && state.habits.find(item => item.id === session.habitId);
      const visible = Boolean(session && habit && session.localDateKey === dateKey()
        && focusHabitAvailable(session.habitId, session.localDateKey));
      section.classList.toggle("hidden", !visible);
      if (!visible) { section.textContent = ""; return; }
      const seconds = focusSecondsRemaining(session);
      section.innerHTML = `<div class="focus-task-heading"><h2>当前任务</h2>
        <span class="focus-task-status" role="status">${session.status === "expired" ? "时间已到" : ""}</span></div>
        <h3 class="focus-task-name">${escapeHtml(habit.name)}</h3>
        <div class="focus-task-time" id="focusTime" aria-label="剩余时间">${focusTimeLabel(seconds)}</div>
        <progress class="focus-task-progress" id="focusProgress" max="3600" value="${3600 - seconds}" aria-label="专注进度"></progress>
        <div class="focus-task-actions">
          <button class="q-primary-button" type="button" data-complete-focus="${escapeAttr(session.id)}">完成任务</button>
          <button class="q-secondary-button" type="button" data-end-focus="${escapeAttr(session.id)}">结束专注</button>
        </div>`;
      updateFocusClock();
    }

    function revealFocusTask() {
      document.getElementById("currentFocusTask")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function openHabitActionSheet(habitId) {
      runAutomaticChecks({ showToast: false });
      const habit = state.habits.find(item => item.id === habitId);
      if (!habit || !habitActiveOnDate(habit, dateKey())) { render(); return; }
      sheetMode = "habit-actions";
      editingId = null;
      els.sheetTitle.textContent = habit.name;
      els.sheetForm.innerHTML = `<div class="habit-focus-menu">
        <button class="q-primary-button" type="button" data-start-focus="${escapeAttr(habitId)}" ${focusHabitAvailable(habitId) ? "" : "disabled"}>开始专注</button>
        <button class="q-secondary-button" type="button" data-edit-habit="${escapeAttr(habitId)}">编辑习惯</button>
      </div>`;
      openSheet({ position: "bottom", kind: "habit-actions" });
    }

    function requestHabitFocus(habitId) {
      runAutomaticChecks({ showToast: false });
      if (!focusHabitAvailable(habitId)) { closeSheet(); render(); return; }
      const current = state.currentFocus;
      if (!current || current.habitId === habitId) {
        const started = startHabitFocus(habitId);
        if (started) closeSheet();
        render();
        if (started) revealFocusTask();
        return;
      }
      const habit = state.habits.find(item => item.id === current.habitId);
      sheetMode = "focus-switch";
      editingId = null;
      els.sheetTitle.textContent = `当前正在专注「${habit.name}」`;
      els.sheetForm.innerHTML = `<div class="habit-focus-menu">
        <button class="q-primary-button" type="button" data-continue-focus>继续当前任务</button>
        <button class="q-secondary-button" type="button" data-replace-focus="${escapeAttr(habitId)}" data-focus-session="${escapeAttr(current.id)}">结束当前专注并开始新任务</button>
        <button class="focus-cancel-button" type="button" data-cancel-focus>取消</button>
      </div>`;
      openSheet({ position: "bottom", kind: "habit-actions" });
    }
