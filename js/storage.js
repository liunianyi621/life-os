    const STORAGE_KEY = "minimal-discipline-v1";
    const OLD_STORAGE_KEYS = [
      "life-rpg-system-v1",
      "life-os-ios-v1",
      "life-streak-os-v1"
    ];

    const emptyState = {
      coins: 0,
      streak: 0,
      lastCompletedDate: null,
      settledThroughDate: null,
      tasks: [],
      completions: {},
      taskResults: {},
      habits: [],
      habitCompletions: {},
      habitFailures: {},
      taskAutoFailures: {},
      badHabits: [],
      notes: [],
      memos: [],
      rewards: [],
      phoneTimer: {
        status: "idle",
        startTime: null,
        updatedAt: null
      },
      breakTimer: {
        status: "idle",
        startedAt: null,
        endTime: null,
        notifiedEndTime: null
      },
      dailyReviews: {},
      reviewRewards: {},
      noBadHabitBonuses: {},
      noBadHabitBonusCheckedThroughDate: null,
      history: [],
      totals: {
        completedTasks: 0,
        coinsSpent: 0,
        coinsPenalty: 0,
        taskDurationSeconds: 0,
        earnedTaskCoins: 0
      }
    };

    let state = loadState();
    let sheetMode = null;
    let editingId = null;
    let editingReviewDate = null;
    let currentStatsRange = "week";
    let currentHeatmapMonth = monthKey();
    let selectedReviewDate = dateKey();
    let pendingUndo = null;
    let confirmResolver = null;
    let activeSwipe = null;
    let activeReviewPress = null;
    let suppressNextCardTap = false;

    function cloneEmptyState() {
      return JSON.parse(JSON.stringify(emptyState));
    }

    function loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const merged = saved ? {
          ...cloneEmptyState(),
          ...saved,
          totals: { ...cloneEmptyState().totals, ...(saved.totals || {}) },
          tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
          habits: Array.isArray(saved.habits) ? saved.habits : [],
          badHabits: Array.isArray(saved.badHabits) ? saved.badHabits : [],
          notes: Array.isArray(saved.notes) ? saved.notes : [],
          memos: Array.isArray(saved.memos) ? saved.memos : [],
          rewards: Array.isArray(saved.rewards) ? saved.rewards : [],
          phoneTimer: saved.phoneTimer && typeof saved.phoneTimer === "object"
            ? { ...cloneEmptyState().phoneTimer, ...saved.phoneTimer }
            : cloneEmptyState().phoneTimer,
          breakTimer: saved.breakTimer && typeof saved.breakTimer === "object"
            ? { ...cloneEmptyState().breakTimer, ...saved.breakTimer }
            : cloneEmptyState().breakTimer,
          dailyReviews: saved.dailyReviews && typeof saved.dailyReviews === "object" ? saved.dailyReviews : {},
          reviewRewards: saved.reviewRewards && typeof saved.reviewRewards === "object" ? saved.reviewRewards : {},
          noBadHabitBonuses: saved.noBadHabitBonuses && typeof saved.noBadHabitBonuses === "object" ? saved.noBadHabitBonuses : {},
          noBadHabitBonusCheckedThroughDate: saved.noBadHabitBonusCheckedThroughDate || null,
          history: Array.isArray(saved.history) ? saved.history : [],
          completions: saved.completions && typeof saved.completions === "object" ? saved.completions : {},
          taskResults: saved.taskResults && typeof saved.taskResults === "object" ? saved.taskResults : {},
          habitCompletions: saved.habitCompletions && typeof saved.habitCompletions === "object" ? saved.habitCompletions : {},
          habitFailures: saved.habitFailures && typeof saved.habitFailures === "object" ? saved.habitFailures : {},
          taskAutoFailures: saved.taskAutoFailures && typeof saved.taskAutoFailures === "object" ? saved.taskAutoFailures : {}
        } : cloneEmptyState();

        if (!Object.keys(merged.taskResults).length && Object.keys(merged.completions).length) {
          Object.entries(merged.completions).forEach(([day, tasks]) => {
            merged.taskResults[day] = merged.taskResults[day] || {};
            Object.keys(tasks || {}).forEach(taskId => {
              merged.taskResults[day][taskId] = "completed";
            });
          });
        }

        if (!merged.settledThroughDate) {
          merged.settledThroughDate = yesterdayKey();
        }
        if (!merged.noBadHabitBonusCheckedThroughDate) {
          merged.noBadHabitBonusCheckedThroughDate = shiftDateKey(yesterdayKey(), -1);
        }

        return merged;
      } catch {
        const fresh = cloneEmptyState();
        fresh.settledThroughDate = yesterdayKey();
        fresh.noBadHabitBonusCheckedThroughDate = shiftDateKey(yesterdayKey(), -1);
        return fresh;
      }
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function dateKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function monthKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    function dateFromKey(key) {
      const [year, month, day] = String(key || "").split("-").map(Number);
      return new Date(year || 1970, (month || 1) - 1, day || 1);
    }

    function monthDateFromKey(key) {
      const [year, month] = String(key || monthKey()).split("-").map(Number);
      return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
    }

    function shiftMonthKey(key, offset) {
      const date = monthDateFromKey(key);
      date.setMonth(date.getMonth() + offset);
      return monthKey(date);
    }

    function yesterdayKey() {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      return dateKey(date);
    }

    function shiftDateKey(key, offset) {
      const date = dateFromKey(key || dateKey());
      date.setDate(date.getDate() + offset);
      return dateKey(date);
    }

    function formatDate(date = new Date()) {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(date);
    }

    function formatReviewDateLabel(key = selectedReviewDate) {
      const date = dateFromKey(key);
      const monthDay = new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric"
      }).format(date);
      const weekday = new Intl.DateTimeFormat("zh-CN", {
        weekday: "long"
      }).format(date);
      return `${monthDay} ${weekday}`;
    }

    function formatMonth(key) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long"
      }).format(monthDateFromKey(key));
    }

    function formatFullDateKey(key) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(dateFromKey(key));
    }

    function formatNumber(value) {
      return new Intl.NumberFormat("zh-CN").format(Number(value) || 0);
    }

    function createId(prefix) {
      return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function parseAmount(value) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) return 0;
      return Math.round(amount);
    }

    function parseCoinAmount(value) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return 0;
      return Math.round(amount * 100) / 100;
    }

    function formatCoinAmount(value) {
      return new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(parseCoinAmount(value));
    }

    function currentStreak() {
      if (!state.lastCompletedDate) return 0;
      const today = dateKey();
      if (state.lastCompletedDate === today || state.lastCompletedDate === yesterdayKey()) {
        return state.streak;
      }
      return 0;
    }
    function resetAllData() {
      localStorage.removeItem(STORAGE_KEY);
      OLD_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      state = cloneEmptyState();
      state.settledThroughDate = yesterdayKey();
      state.noBadHabitBonusCheckedThroughDate = shiftDateKey(yesterdayKey(), -1);
      selectedReviewDate = dateKey();
      saveState();
      render();
      showToast("所有数据已重置");
    }

    function normalizeReviewDateKey(key) {
      const value = String(key || "").trim();
      const today = dateKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
      return value > today ? today : value;
    }

    function setSelectedReviewDate(key) {
      selectedReviewDate = normalizeReviewDateKey(key);
      return selectedReviewDate;
    }

    function dailyReviewForDate(key = selectedReviewDate) {
      return state.dailyReviews[normalizeReviewDateKey(key)] || {
        best: "",
        mistake: "",
        priority: ""
      };
    }

    function dailyReviewToday() {
      return dailyReviewForDate(dateKey());
    }

    function sortedDailyReviews(includeToday = true) {
      const today = dateKey();
      return Object.entries(state.dailyReviews || {})
        .filter(([day, review]) => {
          if (!includeToday && day === today) return false;
          return review && typeof review === "object";
        })
        .sort(([left], [right]) => right.localeCompare(left));
    }

    function saveDailyReview(reviewData, key = selectedReviewDate) {
      const reviewDate = setSelectedReviewDate(key);
      const best = String(reviewData.best || "").trim();
      const mistake = String(reviewData.mistake || "").trim();
      const priority = String(reviewData.priority || "").trim();

      if (!best && !mistake && !priority) {
        showToast("至少填写一项复盘");
        return;
      }

      const previous = state.dailyReviews[reviewDate] || {};
      const hadPreviousReview = Boolean(state.dailyReviews[reviewDate]);
      const shouldReward = !state.reviewRewards?.[reviewDate];
      const rewardAmount = 2;
      const savedAt = new Date().toISOString();
      state.dailyReviews[reviewDate] = {
        date: reviewDate,
        best,
        mistake,
        priority,
        createdAt: previous.createdAt || savedAt,
        updatedAt: savedAt
      };
      if (shouldReward) {
        const historyId = createId("history");
        state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
        state.reviewRewards[reviewDate] = historyId;
        state.coins = parseCoinAmount(state.coins + rewardAmount);
        state.history.unshift({
          id: historyId,
          type: "review_reward",
          name: "每日复盘",
          coins: rewardAmount,
          date: reviewDate,
          timestamp: savedAt
        });
        saveState();
        renderDailyReview();
        updatePrimaryReadouts();
        showReviewSavedStatus();
        showUndoToast({
          type: "review_reward",
          historyId,
          date: reviewDate,
          amount: rewardAmount,
          previousReview: { ...previous },
          hadPreviousReview
        }, {
          icon: "checkmark.circle",
          lines: [
            "✓ 复盘已保存",
            `获得 ${formatNumber(rewardAmount)} 金币`
          ],
          undoLabel: "撤回",
          duration: 5000,
          iconTone: "positive"
        });
        return;
      }
      saveState();
      renderDailyReview();
      showReviewSavedStatus();
      showToast("✓ 复盘已保存", 2000);
    }

    function moveReviewRewardDate(fromDate, toDate) {
      if (fromDate === toDate) return;
      state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
      const historyId = state.reviewRewards[fromDate];
      if (!historyId) return;

      delete state.reviewRewards[fromDate];
      state.reviewRewards[toDate] = historyId;
      const historyItem = state.history.find(item => item.id === historyId && item.type === "review_reward");
      if (historyItem) {
        historyItem.date = toDate;
      }
    }

    async function saveEditedDailyReview(reviewData, originalDate = editingReviewDate) {
      const previousDate = normalizeReviewDateKey(originalDate);
      const reviewDate = normalizeReviewDateKey(reviewData.date);
      const best = String(reviewData.best || "").trim();
      const mistake = String(reviewData.mistake || "").trim();
      const priority = String(reviewData.priority || "").trim();

      if (!state.dailyReviews?.[previousDate]) {
        showToast("找不到这条复盘");
        return false;
      }

      if (!best && !mistake && !priority) {
        showToast("至少填写一项复盘");
        return false;
      }

      if (reviewDate !== previousDate && state.dailyReviews?.[reviewDate]) {
        const confirmed = await askForConfirmation({
          title: "覆盖已有复盘",
          message: `${formatFullDateKey(reviewDate)} 已经有复盘。确认移动并覆盖这一天的复盘吗？`,
          confirmText: "确认覆盖"
        });
        if (!confirmed) return false;
      }

      const now = new Date().toISOString();
      const previous = state.dailyReviews[previousDate] || {};
      state.dailyReviews[reviewDate] = {
        ...previous,
        date: reviewDate,
        best,
        mistake,
        priority,
        createdAt: previous.createdAt || now,
        updatedAt: now
      };
      if (reviewDate !== previousDate) {
        delete state.dailyReviews[previousDate];
        moveReviewRewardDate(previousDate, reviewDate);
        if (selectedReviewDate === previousDate) selectedReviewDate = reviewDate;
      }

      saveState();
      closeSheet();
      renderDailyReview();
      showToast("复盘已更新");
      return true;
    }
