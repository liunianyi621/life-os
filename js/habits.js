    function habitRewardAmount(habit) {
      return 5;
    }

    function saveHabit(habitData) {
      habitData = { ...habitData, coins: 5 };
      if (!habitData.name) {
        showToast("请输入习惯名称");
        return;
      }
      if (editingId) {
        state.habits = state.habits.map(habit => (
          habit.id === editingId
            ? { ...habit, ...habitData, updatedAt: new Date().toISOString() }
            : habit
        ));
        showToast("习惯已更新");
      } else {
        state.habits.push({
          id: createId("habit"),
          ...habitData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("习惯已创建");
      }
      saveState();
      closeSheet();
      render();
    }

    function saveBadHabit(habitData) {
      if (!habitData.name) {
        showToast("请输入习惯名称");
        return;
      }
      if (editingId) {
        state.badHabits = state.badHabits.map(habit => (
          habit.id === editingId
            ? { ...habit, ...habitData, updatedAt: new Date().toISOString() }
            : habit
        ));
        showToast("坏习惯已更新");
      } else {
        state.badHabits.push({
          id: createId("bad"),
          ...habitData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("坏习惯已创建");
      }
      saveState();
      closeSheet();
      render();
    }
    function habitCompletedOnDate(habitId, day) {
      return Boolean(state.habitCompletions?.[day]?.[habitId])
        || state.history.some(item => item.habitId === habitId && (item.habitDate || item.date) === day
          && ["habit_completed", "task_completed"].includes(item.type))
        || state.tasks.some(task => taskHabitId(task) === habitId && (task.sourceHabitScheduledDate || taskDate(task)) === day
          && (String(task.status).toLowerCase() === "completed"
            || state.history.some(item => item.taskId === task.id && item.type === "task_completed")));
    }

    function habitCompletedToday(habitId) {
      return habitCompletedOnDate(habitId, dateKey());
    }

    function habitFailedOnDate(habitId, day) {
      return Boolean(state.habitFailures?.[day]?.[habitId])
        || state.history.some(item => item.habitId === habitId && (item.habitDate || item.date) === day
          && ["habit_failed", "task_failed"].includes(item.type))
        || state.tasks.some(task => taskHabitId(task) === habitId && (task.sourceHabitScheduledDate || taskDate(task)) === day
          && (String(task.status).toLowerCase() === "failed"
            || state.history.some(item => item.taskId === task.id && ["task_failed", "task_missed"].includes(item.type))));
    }

    function habitActiveOnDate(habit, day) {
      const created = new Date(habit.createdAt || "");
      const createdDate = habit.createdDate || (!Number.isNaN(created.getTime()) ? dateKey(created) : "");
      return habit.active !== false && habit.archived !== true && (!createdDate || createdDate <= day);
    }

    function scheduledHabitDateKey(day = dateKey()) {
      const candidate = String(day || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return dateKey();
      return dateKey(dateFromKey(candidate)) === candidate ? candidate : dateKey();
    }

    function scheduledHabitIdsForDate(day = dateKey()) {
      const ids = state.scheduledHabitIdsByDate?.[scheduledHabitDateKey(day)];
      return new Set(Array.isArray(ids) ? ids.map(id => String(id)).filter(Boolean) : []);
    }

    function habitScheduledAsTaskOnDate(habitId, day = dateKey()) {
      return scheduledHabitIdsForDate(day).has(String(habitId));
    }

    function markHabitScheduledAsTask(habitId, day = dateKey()) {
      const scheduledDay = scheduledHabitDateKey(day);
      const habitKey = String(habitId || "");
      if (!habitKey || habitScheduledAsTaskOnDate(habitKey, scheduledDay)) return false;
      state.scheduledHabitIdsByDate = state.scheduledHabitIdsByDate && typeof state.scheduledHabitIdsByDate === "object"
        ? state.scheduledHabitIdsByDate
        : {};
      state.scheduledHabitIdsByDate[scheduledDay] = [...scheduledHabitIdsForDate(scheduledDay), habitKey];
      return true;
    }

    function unmarkHabitScheduledAsTask(habitId, day = dateKey()) {
      const scheduledDay = scheduledHabitDateKey(day);
      const habitKey = String(habitId || "");
      const current = scheduledHabitIdsForDate(scheduledDay);
      if (!habitKey || !current.delete(habitKey)) return false;
      if (current.size) state.scheduledHabitIdsByDate[scheduledDay] = [...current];
      else delete state.scheduledHabitIdsByDate[scheduledDay];
      return true;
    }

    function visibleHabitsToday() {
      const today = dateKey();
      return state.habits.filter(habit => (
        habitActiveOnDate(habit, today)
        && !habitCompletedOnDate(habit.id, today)
        && !habitFailedOnDate(habit.id, today)
        && !habitScheduledAsTaskOnDate(habit.id, today)
      ));
    }
    function deleteHabit(habitId) {
      state.habits = state.habits.filter(habit => habit.id !== habitId);
      saveState();
      closeSheet();
      render();
      showToast("习惯已移除");
    }

    function deleteBadHabit(habitId) {
      state.badHabits = state.badHabits.filter(habit => habit.id !== habitId);
      saveState();
      closeSheet();
      render();
      showToast("坏习惯已移除");
    }
