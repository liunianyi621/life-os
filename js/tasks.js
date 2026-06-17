    function taskResultOnDate(taskId, day) {
      return state.taskResults[day]?.[taskId] || null;
    }

    function taskResultToday(taskId) {
      return taskResultOnDate(taskId, dateKey());
    }

    function taskDate(task) {
      if (task.date) return task.date;
      if (task.createdDate) return task.createdDate;
      if (task.createdAt) return String(task.createdAt).slice(0, 10);
      return "";
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
      return todayTasks().filter(task => !taskResultToday(task.id));
    }
    function timeToMinutes(value) {
      const parts = parseTimeValue(value);
      if (!parts) return null;
      const hour = Number(parts.hour);
      const minute = Number(parts.minute);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      const hour24 = (hour % 12) + (parts.period === "PM" ? 12 : 0);
      return hour24 * 60 + minute;
    }

    function taskTimeGroupLabel(value) {
      const raw = String(value || "").trim();
      const parts = parseTimeValue(value);
      return parts ? raw || formatTimeParts(parts) : "无时间任务";
    }

    function groupedActiveTasks(tasks) {
      const sorted = [...tasks].sort((left, right) => {
        const leftMinutes = timeToMinutes(left.time);
        const rightMinutes = timeToMinutes(right.time);
        if (leftMinutes == null && rightMinutes == null) return left.name.localeCompare(right.name, "zh-CN");
        if (leftMinutes == null) return 1;
        if (rightMinutes == null) return -1;
        if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
        return left.name.localeCompare(right.name, "zh-CN");
      });

      const groups = [];
      sorted.forEach(task => {
        const minutes = timeToMinutes(task.time);
        const key = minutes == null ? "no-time" : String(minutes);
        let group = groups.find(item => item.key === key);
        if (!group) {
          group = {
            key,
            label: minutes == null ? "无时间任务" : taskTimeGroupLabel(task.time),
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
