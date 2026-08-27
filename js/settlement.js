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

    function settleMissedHabits(day = yesterdayKey(), settledEventKeys = buildSettledEventKeys()) {
      let totalPenalty = 0;
      const entries = [];
      state.habits.forEach(habit => {
        if (!habitActiveOnDate(habit, day)) return;
        if (habitCompletedOnDate(habit.id, day)) return;
        if (habitFailedOnDate(habit.id, day)) return;

        const identity = habitFailureSettlementIdentity(habit.id, day);
        if (settledEventKeys.has(identity)) return;

        const rewardAmount = habitRewardAmount(habit);
        const amount = getIncompletePenalty(rewardAmount);
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        const coinEvent = recordCoinEvent({
          type: "habit_failed",
          amount: -amount,
          date: day,
          history: {
            habitId: habit.id,
            name: habit.name,
            coins: amount,
            rewardAmount,
            penaltyMultiplier: INCOMPLETE_PENALTY_MULTIPLIER,
            penaltyAmount: amount,
            reason: "habit_missed"
          }
        });
        const historyId = coinEvent.historyId;
        ensureSettlementDayRecord("habitFailures", day)[habit.id] = historyId;
        settledEventKeys.add(identity);
        entries.push({
          historyId,
          habitId: habit.id,
          date: day,
          amount,
          rewardAmount,
          penaltyMultiplier: INCOMPLETE_PENALTY_MULTIPLIER
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
      });
      return { count: entries.length, totalPenalty, entries };
    }

    function settleMissedHabitsThroughDate(lastDay = yesterdayKey(), settledEventKeys = buildSettledEventKeys()) {
      let checkedThrough = state.settledThroughDate || shiftDateKey(lastDay, -1);
      const previousCheckedThrough = checkedThrough;
      const entries = [];
      let totalPenalty = 0;

      if (checkedThrough >= lastDay) {
        return {
          count: 0,
          totalPenalty: 0,
          entries,
          checkedThroughChanged: false
        };
      }

      while (checkedThrough < lastDay) {
        const day = shiftDateKey(checkedThrough, 1);
        const result = settleMissedHabits(day, settledEventKeys);
        entries.push(...result.entries);
        totalPenalty = parseCoinAmount(totalPenalty + result.totalPenalty);
        checkedThrough = day;
      }

      state.settledThroughDate = lastDay;
      return {
        count: entries.length,
        totalPenalty,
        entries,
        checkedThroughChanged: previousCheckedThrough !== lastDay
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
        const taskDay = taskDate(task);
        if (!taskDay || taskDay > today) return;
        if (!taskHasTime(task)) return;
        if (state.taskResults?.[taskDay]?.[task.id]) return;
        if (["completed", "done", "failed"].includes(task.status)) return;
        if (taskIsInProgress(task)) return;
        if (taskAutoFailedOnDate(task.id, taskDay, settledEventKeys)) return;
        if (!taskPastEndTime(task, now)) return;

        const identity = taskFailureSettlementIdentity(task.id, taskDay);
        const rewardAmount = taskRewardAmount(task);
        const amount = getIncompletePenalty(rewardAmount);
        const failedAt = now.toISOString();
        const previousTask = taskPreviousState(task);

        state.tasks = state.tasks.map(item => (
          item.id === task.id
            ? {
                ...item,
                status: "failed",
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
            penaltyMultiplier: INCOMPLETE_PENALTY_MULTIPLIER,
            penaltyAmount: amount,
            reason: "timeout"
          }
        });
        const historyId = coinEvent.historyId;
        ensureSettlementDayRecord("taskAutoFailures", taskDay)[task.id] = historyId;
        settledEventKeys.add(identity);
        entries.push({
          historyId,
          taskId: task.id,
          date: taskDay,
          amount,
          rewardAmount,
          penaltyMultiplier: INCOMPLETE_PENALTY_MULTIPLIER,
          previousTask
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

        const amount = priorityTaskSettlementAmount("failed");
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
            rewardAmount: PRIORITY_TASK_REWARD,
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
      const lastHabitDay = options.lastHabitDay || shiftDateKey(dateKey(now), -1);
      const settledEventKeys = buildSettledEventKeys();
      const habitFailures = settleMissedHabitsThroughDate(lastHabitDay, settledEventKeys);
      const taskFailures = settleTimedTaskTimeouts(now, settledEventKeys);
      const priorityFailures = settleMissedPriorityTasks(now, settledEventKeys);
      const changed = habitFailures.count > 0
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
