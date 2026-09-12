    function settlementIdentity(kind, entityId, day) {
      return entityId ? `${kind}:${entityId}:${day}` : `${kind}:${day}`;
    }

    function taskFailureSettlementIdentity(taskId, day) {
      return settlementIdentity("task-failure", taskId, day);
    }

    function habitFailureSettlementIdentity(habitId, day) {
      return settlementIdentity("habit-incomplete", habitId, day);
    }

    function priorityFailureSettlementIdentity(day) {
      return settlementIdentity("priority-incomplete", null, day);
    }

    function settlementIdentityFromHistory(item) {
      const day = String(item?.date || "");
      if (!day) return null;
      if ((item.type === "task_failed" || item.type === "task_missed") && item.taskId) {
        return taskFailureSettlementIdentity(item.taskId, day);
      }
      if (item.type === "habit_failed" && item.habitId) {
        return habitFailureSettlementIdentity(item.habitId, day);
      }
      if (item.type === "priority_task_penalty") {
        return priorityFailureSettlementIdentity(day);
      }
      return null;
    }

    function buildSettledEventKeys() {
      const keys = new Set();
      // Existing history remains authoritative when legacy auxiliary maps are incomplete.
      (Array.isArray(state.history) ? state.history : []).forEach(item => {
        const identity = settlementIdentityFromHistory(item);
        if (identity) keys.add(identity);
      });

      Object.entries(state.taskAutoFailures || {}).forEach(([day, failures]) => {
        Object.keys(failures || {}).forEach(taskId => {
          keys.add(taskFailureSettlementIdentity(taskId, day));
        });
      });
      Object.entries(state.taskResults || {}).forEach(([day, results]) => {
        Object.entries(results || {}).forEach(([taskId, result]) => {
          if (result === "failed") keys.add(taskFailureSettlementIdentity(taskId, day));
        });
      });
      Object.entries(state.habitFailures || {}).forEach(([day, failures]) => {
        Object.keys(failures || {}).forEach(habitId => {
          keys.add(habitFailureSettlementIdentity(habitId, day));
        });
      });
      Object.entries(ensurePriorityTasks()).forEach(([day, task]) => {
        if (task?.settledPenalty || task?.status === "failed") {
          keys.add(priorityFailureSettlementIdentity(day));
        }
      });
      return keys;
    }

    function ensureSettlementDayRecord(collection, day) {
      state[collection] = state[collection] && typeof state[collection] === "object" ? state[collection] : {};
      state[collection][day] = state[collection][day] && typeof state[collection][day] === "object" ? state[collection][day] : {};
      return state[collection][day];
    }

    function ensureFixedRewardRules(now = new Date()) {
      if (state.fixedRewardRulesSince) return false;
      // Never back-charge the previous template-only period on upgrade.
      state.fixedRewardRulesSince = dateKey(now);
      state.settledThroughDate = shiftDateKey(state.fixedRewardRulesSince, -1);
      return true;
    }

    function settleHabitFailure(habit, day, settledEventKeys = buildSettledEventKeys(), now = new Date(), automatic = true,
      ruleTime = new Date(Math.min(now.getTime(), settlementDayEnd(day).getTime()))) {
      const identity = habitFailureSettlementIdentity(habit.id, day);
      if (habitCompletedOnDate(habit.id, day) || habitFailedOnDate(habit.id, day) || settledEventKeys.has(identity)) return null;
      const rewardAmount = habitRewardAmount(habit, day, now);
      const amount = getIncompletePenalty(rewardAmount, ruleTime);
      const taskEntries = state.tasks.filter(task => taskHabitId(task) === habit.id
        && taskSettlementDay(task) === day && !taskIsSettled(task))
        .map(task => ({ taskId: task.id, date: day, previousTask: taskPreviousState(task) }));
      const failedAt = now.toISOString();
      const coinEvent = recordCoinEvent({
        type: "habit_failed", amount: -amount, date: day, timestamp: failedAt,
        history: { habitId: habit.id, name: habit.name, coins: amount, rewardAmount,
          penaltyMultiplier: penaltyMultiplier(ruleTime), penaltyAmount: amount,
          reason: automatic ? "day_end" : "manual", linkedTaskIds: taskEntries.map(entry => entry.taskId) }
      });
      ensureSettlementDayRecord("habitFailures", day)[habit.id] = coinEvent.historyId;
      taskEntries.forEach(entry => {
        const task = state.tasks.find(task => task.id === entry.taskId);
        Object.assign(task, { status: "failed", isRunning: false, timerStartedAt: null, failedAt, updatedAt: failedAt });
        ensureSettlementDayRecord("taskResults", day)[task.id] = "failed";
      });
      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      settledEventKeys.add(identity);
      return { habitId: habit.id, date: day, amount, historyId: coinEvent.historyId, taskEntries, automatic };
    }

    function settleMissedHabits(day = yesterdayKey(), settledEventKeys = buildSettledEventKeys(), now = new Date()) {
      const entries = [];
      if (!state.fixedRewardRulesSince || day < state.fixedRewardRulesSince) return { count: 0, totalPenalty: 0, entries };
      if (!currentSettings().settlement.autoFailHabitsDaily || !settingsAt(settlementDayEnd(day)).settlement.autoFailHabitsDaily) {
        return { count: 0, totalPenalty: 0, entries };
      }
      state.habits.filter(habit => habitActiveOnDate(habit, day)).forEach(habit => {
        const entry = settleHabitFailure(habit, day, settledEventKeys, now);
        if (entry) entries.push(entry);
      });
      return { count: entries.length, totalPenalty: entries.reduce((sum, entry) => sum + entry.amount, 0), entries };
    }

    function settleMissedHabitsThroughDate(lastDay = yesterdayKey(), settledEventKeys = buildSettledEventKeys(), now = new Date()) {
      const entries = [];
      let checkedThroughChanged = false;
      let day = state.settledThroughDate ? shiftDateKey(state.settledThroughDate, 1) : state.fixedRewardRulesSince;
      if (day < state.fixedRewardRulesSince) day = state.fixedRewardRulesSince;
      while (day && day <= lastDay) {
        entries.push(...settleMissedHabits(day, settledEventKeys, now).entries);
        state.settledThroughDate = day;
        checkedThroughChanged = true;
        day = shiftDateKey(day, 1);
      }
      return {
        count: entries.length,
        totalPenalty: entries.reduce((sum, entry) => sum + entry.amount, 0),
        entries,
        checkedThroughChanged
      };
    }

    function taskAutoFailedOnDate(taskId, day, settledEventKeys = null) {
      if (state.taskAutoFailures?.[day]?.[taskId]) return true;
      return Boolean(settledEventKeys?.has(taskFailureSettlementIdentity(taskId, day)));
    }

    function settleTimedTaskTimeouts(now = new Date(), settledEventKeys = buildSettledEventKeys()) {
      const today = dateKey(now);
      const entries = [];
      let totalPenalty = 0;

      state.tasks.forEach(task => {
        const taskDay = taskSettlementDay(task);
        if (!state.fixedRewardRulesSince || !taskDay || taskDay >= today) return;
        if (!taskAutomaticFailureEnabled(task)) return;
        if (taskHabitId(task) && state.habits.some(habit => habit.id === taskHabitId(task))) return; // Share the habit's daily identity while its definition exists.
        if (taskIsSettled(task)) return;
        if (taskAutoFailedOnDate(task.id, taskDay, settledEventKeys)) return;

        const identity = taskFailureSettlementIdentity(task.id, taskDay);
        const rewardAmount = taskRewardAmount(task);
        const ruleTime = taskSlotDeadline(task) || settlementDayEnd(taskDay);
        const amount = getIncompletePenalty(rewardAmount, ruleTime);
        const failedAt = now.toISOString();
        const previousTask = taskPreviousState(task);

        state.tasks = state.tasks.map(item => (
          item.id === task.id
            ? {
                ...item,
                status: "failed",
                isRunning: false,
                timerStartedAt: null,
                failedAt,
                updatedAt: failedAt
              }
            : item
        ));
        state.taskResults[taskDay] = state.taskResults[taskDay] || {};
        state.taskResults[taskDay][task.id] = "failed";
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        const coinEvent = recordCoinEvent({
          type: "task_failed",
          amount: -amount,
          date: taskDay,
          timestamp: failedAt,
          history: {
            taskId: task.id,
            name: task.name,
            coins: amount,
            rewardAmount,
            penaltyMultiplier: penaltyMultiplier(ruleTime),
            penaltyAmount: amount,
            reason: "day_end"
          }
        });
        const historyId = coinEvent.historyId;
        const memoSnapshot = typeof releaseMemoForTask === "function" ? releaseMemoForTask(task) : null;
        ensureSettlementDayRecord("taskAutoFailures", taskDay)[task.id] = historyId;
        settledEventKeys.add(identity);
        entries.push({
          historyId,
          taskId: task.id,
          date: taskDay,
          amount,
          rewardAmount,
          penaltyMultiplier: penaltyMultiplier(ruleTime),
          previousTask,
          memoSnapshot
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
      });

      return { count: entries.length, totalPenalty, entries };
    }

    function settleMissedPriorityTasks(now = new Date(), settledEventKeys = buildSettledEventKeys()) {
      const today = dateKey(now);
      const tasksByDate = ensurePriorityTasks();
      const entries = [];
      let totalPenalty = 0;

      Object.entries(tasksByDate).forEach(([day, task]) => {
        if (!task || day >= today) return;
        if (task.status !== "pending") return;
        if (task.settledPenalty) return;

        const identity = priorityFailureSettlementIdentity(day);
        if (settledEventKeys.has(identity)) return;

        const ruleTime = settlementDayEnd(day);
        const amount = priorityTaskSettlementAmount("failed", ruleTime);
        const failedAt = now.toISOString();
        const previousTask = priorityTaskSnapshot(task);
        const coinEvent = recordCoinEvent({
          type: "priority_task_penalty",
          amount: -amount,
          date: day,
          timestamp: failedAt,
          source: "behavior",
          category: "habit_performance",
          action: "priority_task_penalty",
          entityType: "priority_task",
          history: {
            name: task.title,
            coins: amount,
            rewardAmount: economyRules(ruleTime).priorityReward,
            penaltyAmount: amount,
            settlementRule: "fixed_priority_penalty"
          }
        });
        const historyId = coinEvent.historyId;

        tasksByDate[day] = {
          ...task,
          status: "failed",
          failedAt,
          settledPenalty: true,
          penaltyHistoryId: historyId,
          updatedAt: failedAt
        };
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        settledEventKeys.add(identity);
        entries.push({
          historyId,
          date: day,
          amount,
          previousTask
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
      });

      return { count: entries.length, totalPenalty, entries };
    }

    function runPendingSettlements(options = {}) {
      const now = options.now instanceof Date ? options.now : new Date();
      const activated = ensureFixedRewardRules(now);
      const lastHabitDay = options.lastHabitDay || shiftDateKey(dateKey(now), -1);
      const settledEventKeys = buildSettledEventKeys();
      const habitFailures = settleMissedHabitsThroughDate(lastHabitDay, settledEventKeys, now);
      const taskFailures = settleTimedTaskTimeouts(now, settledEventKeys);
      const priorityFailures = settleMissedPriorityTasks(now, settledEventKeys);
      const changed = activated || habitFailures.count > 0
        || taskFailures.count > 0
        || priorityFailures.count > 0
        || habitFailures.checkedThroughChanged;

      return {
        habitFailures,
        taskFailures,
        priorityFailures,
        changed
      };
    }
