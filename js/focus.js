    function focusHabitAvailable(habitId, day = dateKey()) {
      const habit = state.habits.find(item => item.id === habitId);
      return Boolean(habit && habitActiveOnDate(habit, day)
        && !habitCompletedOnDate(habitId, day) && !habitFailedOnDate(habitId, day));
    }

    function focusSourceItem(sourceType, sourceId) {
      return sourceType === "habit" ? state.habits.find(item => item.id === sourceId)
        : sourceType === "dailyTask" ? (state.dailyTasks || []).find(item => item.id === sourceId) : null;
    }

    function focusSourceAvailable(sourceType, sourceId, day = dateKey()) {
      if (sourceType === "habit") return focusHabitAvailable(sourceId, day);
      const task = focusSourceItem(sourceType, sourceId);
      return Boolean(task && task.localDateKey === day && !dailyTaskSettled(task));
    }

    function reconcileFocusSession(now = new Date()) {
      if (state.currentFocus == null) return false;
      const session = normalizeFocusSession(state.currentFocus);
      if (!session || session.localDateKey !== dateKey(now)
        || !focusSourceAvailable(session.sourceType, session.sourceId, session.localDateKey)) {
        state.currentFocus = null;
        return true;
      }
      if (session.status === "active" && now.getTime() >= Date.parse(session.endsAt)) {
        state.currentFocus = { ...session, status: "expired" };
        return true;
      }
      return false;
    }

    function startHabitFocus(habitId, { replaceSessionId = null, now = new Date() } = {}) {
      return startFocusSession("habit", habitId, { replaceSessionId, now });
    }

    function startFocusSession(sourceType, sourceId, { replaceSessionId = null, now = new Date() } = {}) {
      runAutomaticChecks({ now, showToast: false });
      if (!focusSourceAvailable(sourceType, sourceId, dateKey(now))) return false;
      const current = normalizeFocusSession(state.currentFocus);
      if (current?.sourceType === sourceType && current.sourceId === sourceId && current.localDateKey === dateKey(now)) return true;
      if (current && current.id !== replaceSessionId) return false;
      const before = JSON.stringify(state);
      state.currentFocus = {
        id: createId("focus"), sourceType, sourceId, ...(sourceType === "habit" ? { habitId: sourceId } : {}), localDateKey: dateKey(now),
        startedAt: now.toISOString(), endsAt: new Date(now.getTime() + FOCUS_DURATION_MS).toISOString(),
        status: "active"
      };
      return saveTaskAction(before);
    }

    function endHabitFocus(sessionId = state.currentFocus?.id) {
      if (!state.currentFocus || state.currentFocus.id !== sessionId) return false;
      const before = JSON.stringify(state);
      state.currentFocus = null;
      return saveTaskAction(before);
    }

    function completeHabitFocus(sessionId) {
      // A stale card must never complete a different day's or a replacement session's habit.
      runAutomaticChecks({ showToast: false });
      const session = normalizeFocusSession(state.currentFocus);
      if (!session || session.id !== sessionId || session.localDateKey !== dateKey()
        || !focusSourceAvailable(session.sourceType, session.sourceId, session.localDateKey)) return false;
      if (session.sourceType === "dailyTask") return completeDailyTask(session.sourceId, null, session.localDateKey);
      completeHabit(session.sourceId, null, session.localDateKey);
      return habitCompletedToday(session.sourceId);
    }

    function focusSecondsRemaining(session, now = Date.now()) {
      if (session.status === "expired") return 0;
      return Math.max(0, Math.min(3600, Math.ceil((Date.parse(session.endsAt) - now) / 1000)));
    }

    function focusTimeLabel(seconds) {
      return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }
