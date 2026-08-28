    const DEFAULT_TASK_REWARD = 20;
    const INCOMPLETE_PENALTY_MULTIPLIER = 10;
    const TASK_FAILURE_MULTIPLIER = INCOMPLETE_PENALTY_MULTIPLIER;
    const TASK_STATUS = Object.freeze({
      WAITING: "waiting",
      RUNNING: "running",
      PAUSED: "paused",
      COMPLETED: "completed"
    });
    const TASK_LIFECYCLE_EVENT = Object.freeze({
      SCHEDULED: "TASK_SCHEDULED",
      STARTED: "TASK_STARTED",
      RESUMED: "TASK_RESUMED"
    });

    function getIncompletePenalty(rewardAmount) {
      const reward = Number(rewardAmount);
      if (!Number.isFinite(reward) || reward <= 0) return 0;
      return parseCoinAmount(reward * INCOMPLETE_PENALTY_MULTIPLIER);
    }

    function firstPresentValue(values) {
      return values.find(value => String(value ?? "").trim() !== "");
    }

    function taskResultOnDate(taskId, day) {
      return state.taskResults[day]?.[taskId] || null;
    }

    function taskResultToday(taskId) {
      return taskResultOnDate(taskId, dateKey());
    }

    function taskRunningStartTime(task) {
      const timerStarted = typeof task?.timerStarted === "string" ? task.timerStarted : null;
      return firstPresentValue([
        task?.actualStartTime,
        task?.startedAt,
        task?.timerStartedAt,
        task?.startTime,
        timerStarted,
        (task?.isRunning || task?.timerStarted === true) ? task?.updatedAt || task?.createdAt : null
      ]) || null;
    }

    function taskIsInProgress(task) {
      if (!task || ["completed", "done", "failed"].includes(task.status)) return false;
      if (task.status === TASK_STATUS.WAITING) return false;
      if ([TASK_STATUS.RUNNING, "in_progress", TASK_STATUS.PAUSED].includes(task.status)) {
        return !task.endTime && !task.failedAt;
      }
      return Boolean(taskRunningStartTime(task) && !task.endTime && !task.failedAt);
    }

    function appendTaskLifecycleEvent(task, type, timestamp, details = {}) {
      const events = Array.isArray(task?.lifecycleEvents) ? task.lifecycleEvents : [];
      return [
        ...events,
        {
          id: createId("task-lifecycle"),
          type,
          timestamp,
          ...details
        }
      ];
    }

    function taskStatusToday(task) {
      const result = taskResultToday(task.id);
      if (result === "completed" || result === "failed") return result;
      if ([TASK_STATUS.COMPLETED, "done"].includes(task.status)) return "completed";
      if (task.status === "failed") return "failed";
      if (task.status === TASK_STATUS.PAUSED) return TASK_STATUS.PAUSED;
      if (task.status === TASK_STATUS.WAITING) return TASK_STATUS.WAITING;
      if (taskUsesTimer(task) && taskIsInProgress(task)) return TASK_STATUS.RUNNING;
      if ((!task.status || task.status === "pending") && taskUsesTimer(task)) return TASK_STATUS.WAITING;
      return "pending";
    }

    function taskStartedAtLabel(task) {
      const startedAt = taskRunningStartTime(task);
      if (!startedAt) return "";
      const date = new Date(startedAt);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(date);
    }

    function taskRewardInputValue(task) {
      const value = Number(firstPresentValue([task?.hourlyReward, task?.reward, task?.coins]));
      return Number.isFinite(value) && value >= 0 ? parseCoinAmount(value) : DEFAULT_TASK_REWARD;
    }

    function taskRewardAmount(task) {
      const value = Number(firstPresentValue([task?.hourlyReward, task?.reward, task?.coins]));
      return Number.isFinite(value) && value >= 0 ? parseCoinAmount(value) : DEFAULT_TASK_REWARD;
    }

    function taskFailurePenalty(task) {
      return getIncompletePenalty(taskRewardAmount(task));
    }

    function taskHasTime(task) {
      return Boolean(taskTimeRange(task));
    }

    function taskEstimateDurationMinutes(task) {
      const value = Number(task?.estimateDurationMinutes);
      return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    }

    function taskUsesTimer(task) {
      return taskHasTime(task) || taskEstimateDurationMinutes(task) > 0 || taskIsInProgress(task);
    }

    function taskEstimateDurationLabel(task) {
      const minutes = taskEstimateDurationMinutes(task);
      if (!minutes) return "";
      if (minutes % 60 === 0) return `预计 ${formatNumber(minutes / 60)} 小时`;
      return `预计 ${formatNumber(minutes)} 分钟`;
    }

    function taskElapsedSeconds(task, now = new Date()) {
      const runningStartTime = taskRunningStartTime(task);
      if (!runningStartTime) return 0;
      const startedAt = new Date(runningStartTime);
      const current = new Date(now);
      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(current.getTime())) return 0;
      return Math.max(0, Math.floor((current.getTime() - startedAt.getTime()) / 1000));
    }

    function formatTaskElapsedClock(seconds) {
      const value = Math.max(0, Math.floor(Number(seconds) || 0));
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      const restSeconds = value % 60;
      return [hours, minutes, restSeconds].map(part => String(part).padStart(2, "0")).join(":");
    }

    function taskDurationPayload(startTime, endTime = new Date(), hourlyCoins = DEFAULT_TASK_REWARD) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return {
          durationSeconds: 0,
          durationMinutes: 0,
          earnedCoins: 0
        };
      }
      const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
      const durationMinutes = Math.round((durationSeconds / 60) * 100) / 100;
      const rate = Number(hourlyCoins);
      const earnedCoins = parseCoinAmount((durationSeconds / 3600) * (Number.isFinite(rate) ? rate : DEFAULT_TASK_REWARD));
      return { durationSeconds, durationMinutes, earnedCoins };
    }

    function formatTaskDurationClock(seconds) {
      const value = Math.max(0, Math.round(Number(seconds) || 0));
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      const restSeconds = value % 60;
      if (hours > 0) return `${hours}小时${String(minutes).padStart(2, "0")}分${String(restSeconds).padStart(2, "0")}秒`;
      return `${minutes}分${String(restSeconds).padStart(2, "0")}秒`;
    }

    function formatFocusDuration(seconds) {
      const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
      if (minutes < 60) return `${formatNumber(minutes)} 分钟`;
      const hours = Math.floor(minutes / 60);
      const restMinutes = minutes % 60;
      return `${formatNumber(hours)}小时${String(restMinutes).padStart(2, "0")}分钟`;
    }

    function taskDurationSecondsFromItem(item) {
      if (item?.type !== "task_completed") return 0;
      const seconds = Number(item.durationSeconds);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    }

    function totalCompletedTaskDurationSeconds(items = state.history) {
      return (items || []).reduce((total, item) => total + taskDurationSecondsFromItem(item), 0);
    }

    function taskEarnedCoinsFromItem(item) {
      if (item?.type !== "task_completed") return 0;
      return parseCoinAmount(item.earnedCoins ?? item.coins);
    }

    function taskDate(task) {
      if (task.date) return task.date;
      if (task.createdDate) return task.createdDate;
      if (task.createdAt) return String(task.createdAt).slice(0, 10);
      return "";
    }

    function taskStartTimeValue(task) {
      return String(task?.timeStart || task?.scheduledStart || task?.time || "").trim();
    }

    function taskEndTimeValue(task) {
      return String(task?.timeEnd || task?.scheduledEnd || "").trim();
    }

    function timePartsToMinutes(parts) {
      if (!parts) return null;
      const hour = Number(parts.hour);
      const minute = Number(parts.minute);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      const hour24 = (hour % 12) + (parts.period === "PM" ? 12 : 0);
      return hour24 * 60 + minute;
    }

    function minutesToClockLabel(minutes) {
      const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
      const hour = Math.floor(normalized / 60);
      const minute = normalized % 60;
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    function getNextFullHourRange(now = new Date()) {
      const current = new Date(now);
      if (Number.isNaN(current.getTime())) return null;
      const start = new Date(current);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      return { start, end };
    }

    function taskTimeRange(task) {
      const startMinutes = timeToMinutes(taskStartTimeValue(task));
      const endMinutes = timeToMinutes(taskEndTimeValue(task));
      if (startMinutes == null || endMinutes == null) return null;
      return { startMinutes, endMinutes };
    }

    function taskTimeRangeLabel(task) {
      const range = taskTimeRange(task);
      if (!range) return "";
      return `${minutesToClockLabel(range.startMinutes)} - ${minutesToClockLabel(range.endMinutes)}`;
    }

    function taskEndDateTime(task, day = taskDate(task) || dateKey()) {
      const range = taskTimeRange(task);
      if (!range) return null;
      const end = dateFromKey(day);
      end.setHours(Math.floor(range.endMinutes / 60), range.endMinutes % 60, 0, 0);
      if (range.endMinutes <= range.startMinutes) {
        end.setDate(end.getDate() + 1);
      }
      return end;
    }

    function taskPastEndTime(task, now = new Date()) {
      if (["HABIT", "MEMO"].includes(task?.source) && task?.status === TASK_STATUS.WAITING) return false;
      const end = taskEndDateTime(task);
      return Boolean(end && now >= end);
    }

    function createTaskRecord(taskData, now = new Date()) {
      const today = dateKey(now);
      const timestamp = now.toISOString();
      return {
        id: createId("task"),
        ...taskData,
        date: today,
        createdDate: today,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }

    function habitTaskRewardAmount(habit) {
      const configuredReward = [habit?.coins, habit?.reward, habit?.hourlyReward]
        .map(value => Number(value))
        .find(value => Number.isFinite(value) && value > 0);
      return configuredReward == null ? DEFAULT_TASK_REWARD : parseCoinAmount(configuredReward);
    }

    function saveTask(taskData) {
      if (!taskData.name) {
        showToast("请输入任务名称");
        return null;
      }
      const createData = !editingId && taskHasTime(taskData)
        ? {
            ...taskData,
            source: taskData.source || "MANUAL",
            status: TASK_STATUS.WAITING,
            startedAt: null,
            actualStartTime: null,
            timerStartedAt: null,
            startTime: null,
            isRunning: false,
            elapsedSeconds: 0
          }
        : taskData;
      let createdTask = null;
      if (editingId) {
        state.tasks = state.tasks.map(task => (
          task.id === editingId
            ? { ...task, ...taskData, updatedAt: new Date().toISOString() }
            : task
        ));
        showToast("任务已更新");
      } else {
        createdTask = createTaskRecord(createData);
        state.tasks.push(createdTask);
        showToast("任务已创建");
      }
      saveState();
      closeSheet();
      render();
      return createdTask;
    }

    function scheduleHabitAsTask(habitId, startTime = new Date()) {
      const habit = state.habits.find(item => item.id === habitId);
      const arrangedAt = new Date(startTime);
      const range = getNextFullHourRange(arrangedAt);
      if (!habit || !range) return null;
      const habitScheduleDate = dateKey(arrangedAt);
      if (habitScheduledAsTaskOnDate(habit.id, habitScheduleDate)) {
        showToast("今天已安排过该习惯");
        return null;
      }

      const rewardAmount = habitTaskRewardAmount(habit);
      const scheduledAt = arrangedAt.toISOString();
      const scheduledStart = range.start.toISOString();
      const scheduledEnd = range.end.toISOString();
      const taskDateKey = dateKey(range.start);
      const timeStart = minutesToClockLabel(range.start.getHours() * 60 + range.start.getMinutes());
      const timeEnd = minutesToClockLabel(range.end.getHours() * 60 + range.end.getMinutes());
      const task = {
        ...createTaskRecord({
          name: habit.name,
          coins: rewardAmount,
          hourlyReward: rewardAmount,
          reward: rewardAmount,
          source: "HABIT",
          originId: habit.id,
          sourceHabitScheduledDate: habitScheduleDate,
          status: TASK_STATUS.WAITING,
          scheduledAt,
          scheduledStart,
          scheduledEnd,
          timeStart,
          timeEnd,
          time: timeStart,
          startedAt: null,
          actualStartTime: null,
          timerStartedAt: null,
          startTime: null,
          isRunning: false,
          elapsedSeconds: 0,
          endTime: null,
          estimateDurationMinutes: 60,
          durationMinutes: null,
          durationSeconds: null,
          earnedCoins: null,
          sourceHabitId: habit.id,
          lifecycleEvents: [{
            id: createId("task-lifecycle"),
            type: TASK_LIFECYCLE_EVENT.SCHEDULED,
            timestamp: scheduledAt,
            source: "HABIT",
            originId: habit.id,
            scheduledStart,
            scheduledEnd
          }]
        }, arrangedAt),
        date: taskDateKey,
        createdDate: taskDateKey
      };

      state.tasks.push(task);
      const markedScheduled = markHabitScheduledAsTask(habit.id, habitScheduleDate);
      try {
        saveState();
      } catch (error) {
        state.tasks = state.tasks.filter(item => item.id !== task.id);
        if (markedScheduled) unmarkHabitScheduledAsTask(habit.id, habitScheduleDate);
        showToast("无法安排任务");
        return null;
      }
      render();
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
      showUndoToast({
        type: "habit_task_scheduled",
        taskId: task.id,
        habitId: habit.id,
        name: task.name,
        date: task.date,
        habitScheduleDate
      }, {
        message: `已安排「${task.name}」`,
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "neutral"
      });
      return task;
    }

    function todayTasks() {
      const today = dateKey();
      return state.tasks.filter(task => taskDate(task) === today || taskIsInProgress(task));
    }

    function activeTasksToday() {
      return todayTasks().filter(task => {
        const status = taskStatusToday(task);
        return status !== "completed" && status !== "failed";
      });
    }

    function ensureNextStep() {
      state.nextStep = state.nextStep && typeof state.nextStep === "object"
        ? { taskId: null, updatedAt: null, ...state.nextStep }
        : { taskId: null, updatedAt: null };
      return state.nextStep;
    }

    function nextStepTask() {
      const taskId = ensureNextStep().taskId;
      if (!taskId) return null;
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return null;
      return task;
    }

    function clearNextStep(save = false) {
      const current = ensureNextStep();
      if (!current.taskId) return false;
      state.nextStep = {
        taskId: null,
        updatedAt: new Date().toISOString()
      };
      if (save) saveState();
      return true;
    }

    function clearNextStepForTask(taskId) {
      if (ensureNextStep().taskId !== taskId) return false;
      return clearNextStep(false);
    }

    function normalizeNextStep(save = false) {
      const current = ensureNextStep();
      if (!current.taskId) return false;
      if (nextStepTask()) return false;
      return clearNextStep(save);
    }

    function setNextStepTask(taskId) {
      const task = activeTasksToday().find(item => item.id === taskId);
      if (!task) {
        showToast("请选择未完成任务");
        return false;
      }
      state.nextStep = {
        taskId: task.id,
        updatedAt: new Date().toISOString()
      };
      saveState();
      render();
      showToast("已设为下一步");
      return true;
    }

    function createNextStepTask(name) {
      const taskName = String(name || "").trim();
      if (!taskName) {
        showToast("请输入任务名称");
        return null;
      }
      const today = dateKey();
      const task = {
        id: createId("task"),
        name: taskName,
        coins: "",
        hourlyReward: "",
        reward: "",
        timeStart: "",
        timeEnd: "",
        time: "",
        date: today,
        createdDate: today,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.tasks.push(task);
      state.nextStep = {
        taskId: task.id,
        updatedAt: new Date().toISOString()
      };
      saveState();
      render();
      showToast("已设为下一步");
      return task;
    }

    function timeToMinutes(value) {
      const parts = parseTimeValue(value);
      return timePartsToMinutes(parts);
    }

    function taskTimeGroupLabel(value) {
      const raw = String(value || "").trim();
      const parts = parseTimeValue(value);
      return parts ? raw || formatTimeParts(parts) : "无时间任务";
    }

    function groupedActiveTasks(tasks) {
      const sorted = [...tasks].sort((left, right) => {
        const leftRange = taskTimeRange(left);
        const rightRange = taskTimeRange(right);
        const leftMinutes = leftRange?.startMinutes ?? null;
        const rightMinutes = rightRange?.startMinutes ?? null;
        if (leftMinutes == null && rightMinutes == null) return left.name.localeCompare(right.name, "zh-CN");
        if (leftMinutes == null) return 1;
        if (rightMinutes == null) return -1;
        if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
        if ((leftRange?.endMinutes ?? 0) !== (rightRange?.endMinutes ?? 0)) {
          return (leftRange?.endMinutes ?? 0) - (rightRange?.endMinutes ?? 0);
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });

      const groups = [];
      sorted.forEach(task => {
        const range = taskTimeRange(task);
        const key = range ? `${range.startMinutes}-${range.endMinutes}` : "no-time";
        let group = groups.find(item => item.key === key);
        if (!group) {
          group = {
            key,
            label: range ? taskTimeRangeLabel(task) : "",
            tasks: []
          };
          groups.push(group);
        }
        group.tasks.push(task);
      });
      return groups;
    }
    function deleteTask(taskId) {
      const task = state.tasks.find(item => item.id === taskId);
      clearNextStepForTask(taskId);
      state.tasks = state.tasks.filter(task => task.id !== taskId);
      const taskResult = task ? taskResultOnDate(task.id, taskDate(task)) : null;
      const isTerminal = task && (["completed", "done", "failed"].includes(task.status) || ["completed", "failed"].includes(taskResult));
      if (task?.sourceHabitId && !isTerminal) {
        unmarkHabitScheduledAsTask(task.sourceHabitId, task.sourceHabitScheduledDate || taskDate(task));
      }
      if (task?.source === "MEMO" && !isTerminal && typeof releaseMemoForTask === "function") {
        releaseMemoForTask(task);
      }
      saveState();
      closeSheet();
      render();
      showToast("任务已移除");
    }
