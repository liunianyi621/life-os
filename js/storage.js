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
      badHabits: [],
      notes: [],
      rewards: [],
      dailyReviews: {},
      history: [],
      totals: {
        completedTasks: 0,
        coinsSpent: 0,
        coinsPenalty: 0
      }
    };

    let state = loadState();
    let sheetMode = null;
    let editingId = null;
    let currentStatsRange = "week";
    let currentHeatmapMonth = monthKey();
    let pendingUndo = null;
    let confirmResolver = null;
    let activeSwipe = null;
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
          rewards: Array.isArray(saved.rewards) ? saved.rewards : [],
          dailyReviews: saved.dailyReviews && typeof saved.dailyReviews === "object" ? saved.dailyReviews : {},
          history: Array.isArray(saved.history) ? saved.history : [],
          completions: saved.completions && typeof saved.completions === "object" ? saved.completions : {},
          taskResults: saved.taskResults && typeof saved.taskResults === "object" ? saved.taskResults : {},
          habitCompletions: saved.habitCompletions && typeof saved.habitCompletions === "object" ? saved.habitCompletions : {}
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

        return merged;
      } catch {
        const fresh = cloneEmptyState();
        fresh.settledThroughDate = yesterdayKey();
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

    function formatDate(date = new Date()) {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(date);
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
      saveState();
      render();
      showToast("所有数据已重置");
    }
    function dailyReviewToday() {
      return state.dailyReviews[dateKey()] || {
        best: "",
        mistake: "",
        priority: ""
      };
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

    function saveDailyReview(reviewData) {
      const today = dateKey();
      const best = String(reviewData.best || "").trim();
      const mistake = String(reviewData.mistake || "").trim();
      const priority = String(reviewData.priority || "").trim();

      if (!best && !mistake && !priority) {
        showToast("至少填写一项复盘");
        return;
      }

      const previous = state.dailyReviews[today] || {};
      state.dailyReviews[today] = {
        date: today,
        best,
        mistake,
        priority,
        createdAt: previous.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveState();
      renderDailyReview({ clearInputs: true });
      showReviewSavedStatus();
      showToast("✓ 已保存", 2000);
    }
