// Test-only fixture for tasks created before Memo became an independent reminder list.
    function createLegacyMemoTask(memoId, startTime = new Date(), scheduledSlotStart = null) {
      const memo = memoItems().find(item => item.id === memoId);
      const arrangedAt = new Date(startTime);
      const range = scheduledSlotStart
        ? getHourlyRangeFromStart(scheduledSlotStart)
        : getNextFullHourRange(arrangedAt);
      if (!memo || !memoIsActive(memo) || !range) return null;

      const scheduledAt = arrangedAt.toISOString();
      const scheduledStart = range.start.toISOString();
      const scheduledEnd = range.end.toISOString();
      const taskDateKey = dateKey(range.start);
      const timeStart = minutesToClockLabel(range.start.getHours() * 60 + range.start.getMinutes());
      const timeEnd = minutesToClockLabel(range.end.getHours() * 60 + range.end.getMinutes());
      const task = {
        ...createTaskRecord({
          name: memo.text,
          coins: defaultTaskReward(),
          reward: defaultTaskReward(),
          source: "MEMO",
          originId: memo.id,
          sourceMemoId: memo.id,
          status: "pending",
          scheduledAt,
          scheduledStart,
          scheduledEnd,
          timeStart,
          timeEnd,
          time: timeStart,
          startedAt: null,
          actualStartTime: null,
          actualEndTime: null,
          timerStartedAt: null,
          startTime: null,
          isRunning: false,
          elapsedSeconds: 0,
          endTime: null,
          durationMinutes: null,
          durationSeconds: null,
          earnedCoins: null,
          lifecycleEvents: [{
            id: createId("task-lifecycle"),
            type: TASK_LIFECYCLE_EVENT.SCHEDULED,
            timestamp: scheduledAt,
            source: "MEMO",
            originId: memo.id,
            scheduledStart,
            scheduledEnd
          }]
        }, arrangedAt),
        date: taskDateKey,
        createdDate: taskDateKey
      };

      state.tasks.push(task);
      const memoSnapshot = linkMemoToTask(memo.id, task.id, scheduledAt);
      if (!memoSnapshot) {
        state.tasks = state.tasks.filter(item => item.id !== task.id);
        return null;
      }
      try {
        saveState();
      } catch (error) {
        state.tasks = state.tasks.filter(item => item.id !== task.id);
        restoreMemoSnapshot(memoSnapshot);
        showToast("无法安排任务");
        return null;
      }
      render();
      showUndoToast({
        type: "memo_task_scheduled",
        taskId: task.id,
        memoId: memo.id,
        name: task.name,
        date: task.date
      }, {
        message: `已安排「${task.name}」`,
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "neutral"
      });
      return task;
    }

    function linkMemoToTask(memoId, taskId, timestamp = new Date().toISOString()) {
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo || !memoIsActive(memo)) return null;
      const previousMemo = { ...memo };
      state.memos = memoItems().map(item => (
        item.id === memoId
          ? { ...item, status: MEMO_STATUS.SCHEDULED, linkedTaskId: taskId, updatedAt: timestamp }
          : item
      ));
      return previousMemo;
    }
