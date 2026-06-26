    const DEFAULT_TASK_REWARD = 2;
    const TASK_FAILURE_MULTIPLIER = 5;

    function firstPresentValue(values) {
      return values.find(value => String(value ?? "").trim() !== "");
    }

    function taskResultOnDate(taskId, day) {
      return state.taskResults[day]?.[taskId] || null;
    }

    function taskResultToday(taskId) {
      return taskResultOnDate(taskId, dateKey());
    }

    function taskStatusToday(task) {
      const result = taskResultToday(task.id);
      if (result === "completed" || result === "failed") return result;
      if (taskHasTime(task) && task.status === "running" && task.startTime && !task.endTime) return "running";
      return "pending";
    }

    function taskStartedAtLabel(task) {
      if (!task?.startTime) return "";
      const date = new Date(task.startTime);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(date);
    }

    function taskRewardInputValue(task) {
      const value = Number(firstPresentValue([task?.hourlyReward, task?.reward, task?.coins]));
      return Number.isFinite(value) && value > 0 ? parseCoinAmount(value) : "";
    }

    function taskRewardAmount(task) {
      const value = Number(firstPresentValue([task?.hourlyReward, task?.reward, task?.coins]));
      return Number.isFinite(value) && value > 0 ? parseCoinAmount(value) : DEFAULT_TASK_REWARD;
    }

    function taskFailurePenalty(task) {
      return parseCoinAmount(taskRewardAmount(task) * TASK_FAILURE_MULTIPLIER);
    }

    function taskHasTime(task) {
      return Boolean(taskTimeRange(task));
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
      const end = taskEndDateTime(task);
      return Boolean(end && now >= end);
    }

    function saveTask(taskData) {
      if (!taskData.name) {
        showToast("请输入任务名称");
        return;
      }
      if (editingId) {
        state.tasks = state.tasks.map(task => (
          task.id === editingId
            ? { ...task, ...taskData, updatedAt: new Date().toISOString() }
            : task
        ));
        showToast("任务已更新");
      } else {
        const today = dateKey();
        state.tasks.push({
          id: createId("task"),
          ...taskData,
          date: today,
          createdDate: today,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showToast("任务已创建");
      }
      saveState();
      closeSheet();
      render();
    }
    function todayTasks() {
      const today = dateKey();
      return state.tasks.filter(task => taskDate(task) === today);
    }

    function activeTasksToday() {
      return todayTasks().filter(task => {
        const status = taskStatusToday(task);
        return status !== "completed" && status !== "failed";
      });
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
      state.tasks = state.tasks.filter(task => task.id !== taskId);
      saveState();
      closeSheet();
      render();
      showToast("任务已移除");
    }
