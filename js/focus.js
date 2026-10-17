    function focusHabitAvailable(habitId, day = dateKey()) {
      const habit = state.habits.find(item => item.id === habitId);
      return Boolean(habit && habitActiveOnDate(habit, day)
        && !habitCompletedOnDate(habitId, day) && !habitFailedOnDate(habitId, day));
    }

    function reconcileFocusSession(now = new Date()) {
      if (state.currentFocus == null) return false;
      const session = normalizeFocusSession(state.currentFocus);
      if (!session || session.localDateKey !== dateKey(now)
        || !focusHabitAvailable(session.habitId, session.localDateKey)) {
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
      runAutomaticChecks({ now, showToast: false });
      if (!focusHabitAvailable(habitId, dateKey(now))) return false;
      const current = state.currentFocus;
      if (current?.habitId === habitId && current.localDateKey === dateKey(now)) return true;
      if (current && current.id !== replaceSessionId) return false;
      const before = JSON.stringify(state);
      state.currentFocus = {
        id: createId("focus"), habitId, localDateKey: dateKey(now),
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
      const session = state.currentFocus;
      if (!session || session.id !== sessionId || session.localDateKey !== dateKey()
        || !focusHabitAvailable(session.habitId, session.localDateKey)) return false;
      completeHabit(session.habitId, null, session.localDateKey);
      return habitCompletedToday(session.habitId);
    }

    function focusSecondsRemaining(session, now = Date.now()) {
      if (session.status === "expired") return 0;
      return Math.max(0, Math.min(3600, Math.ceil((Date.parse(session.endsAt) - now) / 1000)));
    }

    function focusTimeLabel(seconds) {
      return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }
