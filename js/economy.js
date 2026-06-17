    function summaryTotals() {
      if (!state.history.length) {
        return {
          completedTasks: state.totals.completedTasks || 0,
          coinsSpent: state.totals.coinsSpent || 0,
          coinsPenalty: state.totals.coinsPenalty || 0
        };
      }

      return state.history.reduce((totals, item) => {
        if (item.type === "task_completed" || item.type === "habit_completed") {
          totals.completedTasks += 1;
        }
        if (item.type === "reward_redeemed") {
          totals.coinsSpent += parseAmount(item.cost);
        }
        if (item.type === "task_failed" || item.type === "task_missed" || item.type === "bad_habit") {
          totals.coinsPenalty += parseAmount(item.coins);
        }
        return totals;
      }, {
        completedTasks: 0,
        coinsSpent: 0,
        coinsPenalty: 0
      });
    }

    function setCoinReadouts(value) {
      const formatted = formatNumber(value);
      [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].forEach(target => {
        if (target) target.textContent = formatted;
      });
    }

    function animateCoinBalance(from, to, duration = 720) {
      const targets = [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].filter(Boolean);
      targets.forEach(target => {
        target.classList.remove("coin-pulse-positive", "coin-pulse-negative", "coin-pulse-gold");
        void target.offsetWidth;
        target.classList.add("coin-pulse-gold");
      });

      const now = window.performance?.now ? () => window.performance.now() : () => Date.now();
      const frame = window.requestAnimationFrame
        ? callback => window.requestAnimationFrame(callback)
        : callback => setTimeout(() => callback(now()), 16);
      const start = now();
      const change = to - from;
      const tick = timestamp => {
        const progress = Math.min(1, (timestamp - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCoinReadouts(Math.round(from + change * eased));
        if (progress < 1) frame(tick);
        else setCoinReadouts(to);
      };
      frame(tick);
    }

    function updatePrimaryReadouts() {
      const streak = currentStreak();
      const activeCount = activeTasksToday().length;
      const totals = summaryTotals();
      setCoinReadouts(state.coins);
      els.homeStreak.textContent = formatNumber(streak);
      els.todayTaskCount.textContent = `${activeCount} 项`;
      if (els.statStreak) els.statStreak.textContent = formatNumber(streak);
      if (els.statCompleted) els.statCompleted.textContent = formatNumber(totals.completedTasks);
      if (els.statCoins) els.statCoins.textContent = formatNumber(state.coins);
      if (els.statSpent) els.statSpent.textContent = formatNumber(totals.coinsSpent);
      if (els.statPenalty) els.statPenalty.textContent = formatNumber(totals.coinsPenalty);
    }
    function completeTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return;

      const today = dateKey();
      const amount = parseAmount(task.coins);
      state.completions[today] = state.completions[today] || {};
      state.completions[today][taskId] = true;
      state.taskResults[today] = state.taskResults[today] || {};
      state.taskResults[today][taskId] = "completed";
      state.coins += amount;
      state.totals.completedTasks += 1;
      updateStreakForCompletion(today);
      state.history.unshift({
        id: createId("history"),
        type: "task_completed",
        taskId: task.id,
        name: task.name,
        coins: amount,
        date: today,
        timestamp: new Date().toISOString()
      });
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(amount, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showToast("任务已完成");
    }

    function completeHabit(habitId, sourceEl = null) {
      const habit = state.habits.find(item => item.id === habitId);
      if (!habit || habitCompletedToday(habitId)) return;

      const today = dateKey();
      const amount = parseAmount(habit.coins);
      state.habitCompletions[today] = state.habitCompletions[today] || {};
      state.habitCompletions[today][habitId] = true;
      state.coins += amount;
      updateStreakForCompletion(today);
      state.history.unshift({
        id: createId("history"),
        type: "habit_completed",
        habitId: habit.id,
        name: habit.name,
        coins: amount,
        date: today,
        timestamp: new Date().toISOString()
      });
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(amount, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showToast("习惯已完成");
    }

    async function failTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return;

      const today = dateKey();
      const amount = parseAmount(task.coins) * 5;
      const confirmed = await askForConfirmation({
        title: "确认任务失败",
        message: `将扣除 ${formatNumber(amount)} 金币。确认把「${task.name}」判定为失败吗？`,
        confirmText: "确认失败"
      });
      if (!confirmed || taskResultToday(taskId)) return;

      state.taskResults[today] = state.taskResults[today] || {};
      state.taskResults[today][taskId] = "failed";
      state.coins -= amount;
      state.totals.coinsPenalty += amount;
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "task_failed",
        taskId: task.id,
        name: task.name,
        coins: amount,
        date: today,
        timestamp: new Date().toISOString()
      });
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-penalty");
      showCoinFeedback(amount, "negative", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "task_failed",
        historyId,
        taskId: task.id,
        date: today,
        amount
      });
    }

    function updateStreakForCompletion(today) {
      if (state.lastCompletedDate === today) return;
      state.streak = state.lastCompletedDate === yesterdayKey() ? state.streak + 1 : 1;
      state.lastCompletedDate = today;
    }

    async function triggerBadHabit(habitId, sourceEl = null) {
      const habit = state.badHabits.find(item => item.id === habitId);
      if (!habit) return;
      const amount = parseAmount(habit.penalty);
      const confirmed = await askForConfirmation({
        title: "确认记录坏习惯",
        message: `将扣除 ${formatNumber(amount)} 金币。确认记录「${habit.name}」吗？`,
        confirmText: "确认扣除"
      });
      if (!confirmed || !state.badHabits.some(item => item.id === habitId)) return;

      state.coins -= amount;
      state.totals.coinsPenalty += amount;
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "bad_habit",
        habitId: habit.id,
        name: habit.name,
        coins: amount,
        date: dateKey(),
        timestamp: new Date().toISOString()
      });
      saveState();
      updatePrimaryReadouts();
      showCoinFeedback(amount, "negative", sourceEl);
      scheduleRender(240);
      showUndoToast({
        type: "bad_habit",
        historyId,
        amount
      });
    }

    async function redeemReward(rewardId, sourceEl = null, buttonEl = null) {
      const reward = state.rewards.find(item => item.id === rewardId);
      if (!reward) return;
      const amount = parseAmount(reward.cost);
      if (state.coins < amount) {
        showToast("金币不足");
        return;
      }
      const confirmed = await askForConfirmation({
        title: "确认兑换奖励",
        message: `将消耗 ${formatNumber(amount)} 金币。确认兑换「${reward.name}」吗？`,
        confirmText: "确认兑换"
      });
      if (!confirmed) return;
      if (!state.rewards.some(item => item.id === rewardId)) return;
      if (state.coins < amount) {
        showToast("金币不足");
        return;
      }

      const previousCoins = state.coins;
      state.coins -= amount;
      state.totals.coinsSpent += amount;
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "reward_redeemed",
        rewardId: reward.id,
        name: reward.name,
        cost: amount,
        date: dateKey(),
        timestamp: new Date().toISOString()
      });
      saveState();
      const totals = summaryTotals();
      if (els.statSpent) els.statSpent.textContent = formatNumber(totals.coinsSpent);
      if (els.statPenalty) els.statPenalty.textContent = formatNumber(totals.coinsPenalty);
      if (sourceEl) {
        prepareActionCard(sourceEl);
        sourceEl.classList.remove("reward-redeemed");
        void sourceEl.offsetWidth;
        sourceEl.classList.add("reward-redeemed");
      }
      if (buttonEl) {
        buttonEl.classList.remove("reward-button-spend");
        void buttonEl.offsetWidth;
        buttonEl.classList.add("reward-button-spend");
      }
      animateCoinBalance(previousCoins, state.coins);
      showRewardRedeemedFeedback(sourceEl);
      scheduleRender(840);
      showUndoToast({
        type: "reward_redeemed",
        historyId,
        amount
      });
    }
    function showRewardRedeemedFeedback(sourceEl = null) {
      const rect = sourceEl ? sourceEl.getBoundingClientRect() : els.rewardCoins.getBoundingClientRect();
      const message = document.createElement("span");
      message.className = "floating-reward-message";
      message.textContent = "Reward redeemed";
      message.style.left = `${rect.left + rect.width / 2}px`;
      message.style.top = `${rect.top + 12}px`;
      document.body.appendChild(message);
      message.addEventListener("animationend", () => message.remove(), { once: true });
    }

    function showCoinFeedback(amount, tone = "negative", sourceEl = null, options = {}) {
      const pulseClass = tone === "positive" ? "coin-pulse-positive" : "coin-pulse-negative";
      [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].forEach(target => {
        if (!target) return;
        target.classList.remove("coin-pulse-positive", "coin-pulse-negative");
        void target.offsetWidth;
        target.classList.add(pulseClass);
      });

      if (sourceEl && options.flash !== false) {
        const flashClass = tone === "positive" ? "flash-green" : "flash-red";
        sourceEl.classList.remove("flash-green", "flash-red");
        void sourceEl.offsetWidth;
        sourceEl.classList.add(flashClass);
      }

      const rect = sourceEl ? sourceEl.getBoundingClientRect() : els.homeCoins.getBoundingClientRect();
      const delta = document.createElement("span");
      delta.className = `floating-delta ${tone}`;
      delta.textContent = `${tone === "positive" ? "+" : "-"}${formatNumber(amount)}`;
      delta.style.left = `${rect.left + rect.width / 2}px`;
      delta.style.top = `${rect.top + 14}px`;
      document.body.appendChild(delta);
      delta.addEventListener("animationend", () => delta.remove(), { once: true });
    }
    function clearPendingUndo(hideToast = false) {
      if (pendingUndo?.timer) {
        clearTimeout(pendingUndo.timer);
      }
      pendingUndo = null;
      els.toast.classList.remove("interactive");
      if (hideToast) {
        els.toast.classList.remove("show");
        els.toast.textContent = "";
      }
    }

    function showUndoToast(undoData) {
      clearPendingUndo(false);
      clearTimeout(showToast.timer);
      pendingUndo = {
        ...undoData,
        timer: window.setTimeout(() => {
          clearPendingUndo(true);
        }, 10000)
      };
      els.toast.innerHTML = `<span>操作已执行</span><span aria-hidden="true">·</span><button type="button" data-undo-action>撤销</button>`;
      els.toast.classList.add("interactive", "show");
    }

    function undoLastAction() {
      if (!pendingUndo) return;
      const undo = pendingUndo;
      clearPendingUndo(true);
      clearTimeout(scheduleRender.timer);

      const historyItem = state.history.find(item => item.id === undo.historyId);
      if (!historyItem) {
        showToast("无法撤销");
        return;
      }

      state.history = state.history.filter(item => item.id !== undo.historyId);
      if (undo.type === "task_failed") {
        if (state.taskResults[undo.date]) {
          delete state.taskResults[undo.date][undo.taskId];
          if (!Object.keys(state.taskResults[undo.date]).length) {
            delete state.taskResults[undo.date];
          }
        }
        state.coins += undo.amount;
        state.totals.coinsPenalty = Math.max(0, parseAmount(state.totals.coinsPenalty) - undo.amount);
      }
      if (undo.type === "bad_habit") {
        state.coins += undo.amount;
        state.totals.coinsPenalty = Math.max(0, parseAmount(state.totals.coinsPenalty) - undo.amount);
      }
      if (undo.type === "reward_redeemed") {
        state.coins += undo.amount;
        state.totals.coinsSpent = Math.max(0, parseAmount(state.totals.coinsSpent) - undo.amount);
      }

      saveState();
      render();
      showToast("已撤销");
    }
