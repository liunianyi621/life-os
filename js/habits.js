    let dailyHabitActivationRequested = false;

    function dailyHabitSystemEnabled() {
      return state.dailyHabitSystem?.version === 1;
    }

    function storedHabitReward(habit) {
      const value = Number(habit?.coins ?? habit?.reward);
      return Number.isFinite(value) && value >= 0 ? parseCoinAmount(value) : currentSettings().economy.habitReward;
    }

    function activateDailyHabitSystem(now = new Date()) {
      if (dailyHabitSystemEnabled()) return false;
      const day = dateKey(now);
      state.dailyHabitSystem = { version: 1, activatedOn: day };
      state.habits.forEach(habit => {
        habit.dailyRewardHistory = [{ effectiveDate: day, coins: storedHabitReward(habit) }];
      });
      // The new commitment period starts today, never by back-charging old templates.
      if (!state.fixedRewardRulesSince) state.fixedRewardRulesSince = day;
      state.settledThroughDate = [state.settledThroughDate || "", shiftDateKey(day, -1)].sort().at(-1);
      return true;
    }

    function habitRewardAmount(habit, day = dateKey(), now = new Date()) {
      if (dailyHabitSystemEnabled()) {
        const revisions = Array.isArray(habit?.dailyRewardHistory) ? habit.dailyRewardHistory : [];
        const revision = revisions.filter(item => item && item.effectiveDate <= day).at(-1);
        return revision ? storedHabitReward(revision) : storedHabitReward(habit);
      }
      const linked = state.tasks.find(task => taskHabitId(task) === habit?.id && taskSettlementDay(task) === day);
      if (linked) return taskRewardAmount(linked);
      return economyRules(new Date(Math.min(now.getTime(), settlementDayEnd(day).getTime()))).habitReward;
    }

    function saveHabit(habitData) {
      const coins = Number(habitData.coins);
      if (!Number.isFinite(coins) || coins < 0 || coins * 10 > Number.MAX_SAFE_INTEGER) {
        showToast("请输入有效的奖励金额"); return;
      }
      habitData = { ...habitData, coins: parseCoinAmount(coins) };
      if (!habitData.name) {
        showToast("请输入习惯名称");
        return;
      }
      runAutomaticChecks({ showToast: false });
      const before = JSON.stringify(state);
      const today = dateKey();
      if (editingId) {
        state.habits = state.habits.map(habit => (
          habit.id === editingId
            ? { ...habit, ...habitData, updatedAt: new Date().toISOString(), dailyRewardHistory: [
                ...(habit.dailyRewardHistory || []).filter(item => item.effectiveDate < today),
                { effectiveDate: today, coins: habitData.coins }
              ] }
            : habit
        ));
        showToast("习惯已更新");
      } else {
        state.habits.push({
          id: createId("habit"),
          ...habitData,
          createdDate: today,
          dailyRewardHistory: [{ effectiveDate: today, coins: habitData.coins }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("习惯已创建");
      }
      if (!saveTaskAction(before)) return;
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
      return habit.active !== false && habit.archived !== true && (!createdDate || createdDate <= day)
        && (!habit.deletedDate || day < habit.deletedDate);
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

    function habitsDueToday() {
      return state.habits.filter(habit => habitActiveOnDate(habit, dateKey()));
    }

    function visibleHabitsToday() {
      const today = dateKey();
      if (dailyHabitSystemEnabled()) return habitsDueToday().filter(habit => !habitCompletedOnDate(habit.id, today));
      return state.habits.filter(habit => (
        habitActiveOnDate(habit, today)
        && !habitCompletedOnDate(habit.id, today)
        && !habitFailedOnDate(habit.id, today)
        && !habitScheduledAsTaskOnDate(habit.id, today)
      ));
    }
    function deleteHabit(habitId) {
      runAutomaticChecks({ showToast: false });
      const before = JSON.stringify(state);
      state.habits = state.habits.map(habit => habit.id === habitId ? { ...habit, deletedDate: dateKey() } : habit);
      if (!saveTaskAction(before)) return;
      closeSheet();
      render();
      showToast("习惯已移除");
    }

    function reorderHabit(habitId, targetId, after = false) {
      if (habitId === targetId) return false;
      const habit = state.habits.find(item => item.id === habitId);
      if (!habit || !state.habits.some(item => item.id === targetId)) return false;
      const before = JSON.stringify(state);
      const ordered = state.habits.filter(item => item.id !== habitId);
      ordered.splice(ordered.findIndex(item => item.id === targetId) + (after ? 1 : 0), 0, habit);
      state.habits = ordered;
      if (!saveTaskAction(before)) return false;
      render();
      return true;
    }

    function moveHabit(habitId, direction) {
      const habits = visibleHabitsToday();
      const index = habits.findIndex(item => item.id === habitId);
      const target = habits[index + direction];
      if (target) reorderHabit(habitId, target.id, direction > 0);
    }

    function deleteBadHabit(habitId) {
      state.badHabits = state.badHabits.filter(habit => habit.id !== habitId);
      saveState();
      closeSheet();
      render();
      showToast("坏习惯已移除");
    }
