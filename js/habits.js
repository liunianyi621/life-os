    function saveHabit(habitData) {
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
      return Boolean(state.habitCompletions?.[day]?.[habitId]);
    }

    function habitCompletedToday(habitId) {
      return habitCompletedOnDate(habitId, dateKey());
    }

    function habitFailedOnDate(habitId, day) {
      return Boolean(state.habitFailures?.[day]?.[habitId]);
    }

    function habitActiveOnDate(habit, day) {
      const createdDate = String(habit.createdDate || habit.createdAt || "").slice(0, 10);
      return !createdDate || createdDate <= day;
    }

    function visibleHabitsToday() {
      return state.habits.filter(habit => !habitCompletedToday(habit.id));
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
