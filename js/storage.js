    const STORAGE_KEY = "minimal-discipline-v1";
    const OLD_STORAGE_KEYS = [
      "life-rpg-system-v1",
      "life-os-ios-v1",
      "life-streak-os-v1"
    ];
    const PAST_COIN_HISTORY_SCALE_MIGRATION_VERSION = 1;
    const PAST_COIN_HISTORY_SCALE_FACTOR = 10;
    const PAST_COIN_HISTORY_SCALE_BACKUP_KEY = `${STORAGE_KEY}-backup-before-past-coin-scale-v1`;

    const emptyState = {
      pastCoinHistoryScaleMigrationVersion: PAST_COIN_HISTORY_SCALE_MIGRATION_VERSION,
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
      achievements: [],
      priorityTaskByDate: {},
      nextStep: {
        taskId: null,
        updatedAt: null
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

    function cloneEmptyState() {
      return JSON.parse(JSON.stringify(emptyState));
    }

    const DEFAULT_FUND_REWARDS = [
      { name: "冰岛基金", totalCoins: 3000, amountPerDeposit: 100 },
      { name: "苏格兰自驾基金", totalCoins: 2000, amountPerDeposit: 100 },
      { name: "相机升级基金", totalCoins: 2500, amountPerDeposit: 100 },
      { name: "南极基金", totalCoins: 5000, amountPerDeposit: 100 },
      { name: "下一次独立旅行基金", totalCoins: 1500, amountPerDeposit: 100 },
      { name: "个人摄影项目基金", totalCoins: 2000, amountPerDeposit: 100 },
      { name: "电影节基金", totalCoins: 800, amountPerDeposit: 100 },
      { name: "机票基金", totalCoins: 1200, amountPerDeposit: 100 }
    ];

    function firstAvailableValue(values, fallback = "") {
      const found = values.find(value => value !== undefined && value !== null && value !== "");
      return found === undefined ? fallback : found;
    }

    const BEHAVIOR_COIN_EVENT_TYPES = new Set([
      "task_completed",
      "habit_completed",
      "review_reward",
      "priority_task_reward",
      "no_bad_habit_bonus",
      "task_failed",
      "task_missed",
      "habit_failed",
      "priority_task_penalty",
      "bad_habit"
    ]);

    const REWARD_PAGE_EVENT_TYPES = new Set([
      "reward_redeemed",
      "reward_refund",
      "reward_refunded",
      "reward_spending",
      "reward_consumption",
      "reward_deposit",
      "reward_withdraw",
      "reward_transfer",
      "fund_deposit",
      "fund_withdraw",
      "fund_withdrawal",
      "fund_transfer",
      "fund_move",
      "fund_refund"
    ]);

    const REWARD_PAGE_SOURCES = new Set(["reward", "rewards", "fund", "funds", "wallet"]);
    const REWARD_PAGE_CATEGORIES = new Set([
      "reward_spending",
      "reward_management",
      "reward_exchange",
      "fund_management",
      "fund_transfer",
      "wallet_management",
      "wallet_transfer",
      "asset_transfer"
    ]);
    const REWARD_PAGE_ENTITY_TYPES = new Set([
      "reward",
      "reward_fund",
      "reward_transaction",
      "fund",
      "fund_transfer",
      "wallet"
    ]);

    function normalizedEventField(value) {
      return String(value || "").trim().toLowerCase();
    }

    function behaviorEntityTypeForEvent(type) {
      const normalizedType = normalizedEventField(type);
      if (normalizedType === "bad_habit") return "bad_habit";
      if (normalizedType === "habit_completed" || normalizedType === "habit_failed") return "habit";
      if (normalizedType.startsWith("task_")) return "task";
      if (normalizedType.startsWith("priority_task_")) return "priority_task";
      if (normalizedType === "review_reward") return "review";
      if (normalizedType === "no_bad_habit_bonus") return "habit_day";
      return "behavior";
    }

    function hasReliableBehaviorEvidence(event = {}) {
      const type = normalizedEventField(event.type);
      const source = normalizedEventField(event.source);
      const category = normalizedEventField(event.category);
      const entityType = normalizedEventField(event.entityType);
      const expectedEntityType = behaviorEntityTypeForEvent(type);
      const hasExplicitBehaviorMetadata = event.affectsBehaviorScore === true && (
        source === "behavior"
        || category === "habit_performance"
        || entityType === expectedEntityType
      );

      if (type === "task_completed" || type === "task_failed" || type === "task_missed") {
        return Boolean(event.taskId) || hasExplicitBehaviorMetadata;
      }
      if (type === "habit_completed" || type === "habit_failed") {
        return Boolean(event.habitId) || hasExplicitBehaviorMetadata;
      }
      if (type === "bad_habit") {
        return Boolean(event.badHabitId || event.habitId) || hasExplicitBehaviorMetadata;
      }
      return hasExplicitBehaviorMetadata;
    }

    function isRewardPageEvent(event = {}) {
      if (!event || typeof event !== "object") return false;
      if (event.affectsBehaviorScore === false) return true;
      if (event.rewardId || event.fundId || event.reward || event.fund) return true;

      const type = normalizedEventField(event.type);
      const source = normalizedEventField(event.source);
      const category = normalizedEventField(event.category);
      const action = normalizedEventField(event.action);
      const entityType = normalizedEventField(event.entityType);

      return REWARD_PAGE_EVENT_TYPES.has(type)
        || REWARD_PAGE_SOURCES.has(source)
        || REWARD_PAGE_CATEGORIES.has(category)
        || REWARD_PAGE_EVENT_TYPES.has(action)
        || REWARD_PAGE_ENTITY_TYPES.has(entityType);
    }

    function isHabitPerformanceTransaction(event = {}) {
      if (!event || typeof event !== "object") return false;
      if (event.affectsBehaviorScore === false || isRewardPageEvent(event)) return false;
      const type = normalizedEventField(event.type);
      return BEHAVIOR_COIN_EVENT_TYPES.has(type) && hasReliableBehaviorEvidence(event);
    }

    function positiveCoinValue(value, fallback = 0) {
      const parsed = parseCoinAmount(value);
      const fallbackValue = parseCoinAmount(fallback);
      return parsed > 0 ? parsed : fallbackValue;
    }

    function clampCoinValue(value, min, max) {
      const parsed = parseCoinAmount(value);
      return Math.min(max, Math.max(min, parsed));
    }

    function defaultFundRewards() {
      const now = new Date().toISOString();
      return DEFAULT_FUND_REWARDS.map((fund, index) => ({
        id: `reward-fund-${index + 1}`,
        name: fund.name,
        totalCoins: fund.totalCoins,
        amountPerDeposit: fund.amountPerDeposit,
        currentCoins: 0,
        completedAt: null,
        achievementId: null,
        createdAt: now,
        updatedAt: now
      }));
    }

    function normalizeFundReward(reward = {}, index = 0) {
      const seed = DEFAULT_FUND_REWARDS[index] || DEFAULT_FUND_REWARDS[0];
      const now = new Date().toISOString();
      const name = String(reward.name || seed.name || "主线基金").trim() || "主线基金";
      const totalCoins = positiveCoinValue(
        firstAvailableValue([reward.totalCoins, reward.targetCoins], seed.totalCoins),
        seed.totalCoins
      );
      const amountPerDeposit = Math.min(
        totalCoins,
        positiveCoinValue(
          firstAvailableValue([reward.amountPerDeposit, reward.depositCoins, reward.cost], seed.amountPerDeposit),
          seed.amountPerDeposit
        )
      );
      const currentCoins = Math.max(
        0,
        parseCoinAmount(firstAvailableValue([reward.currentCoins, reward.depositedCoins], 0))
      );
      const completionStateBeforeMigration = typeof reward.completedBeforePastCoinHistoryScaleMigration === "boolean"
        ? reward.completedBeforePastCoinHistoryScaleMigration
        : null;
      const isComplete = completionStateBeforeMigration ?? currentCoins >= totalCoins;
      const normalized = {
        id: reward.id || `reward-fund-${index + 1}`,
        name,
        totalCoins,
        amountPerDeposit,
        currentCoins,
        completedAt: isComplete ? reward.completedAt || reward.finishedAt || null : null,
        achievementId: isComplete ? reward.achievementId || null : null,
        createdAt: reward.createdAt || now,
        updatedAt: reward.updatedAt || now
      };
      if (completionStateBeforeMigration !== null) {
        normalized.completedBeforePastCoinHistoryScaleMigration = completionStateBeforeMigration;
      }
      return normalized;
    }

    function normalizeRewards(rewards) {
      const cleaned = (Array.isArray(rewards) ? rewards : []).filter(reward => (
        String(reward?.name || "").trim() !== "玩手机"
      ));
      const hasFundShape = cleaned.some(reward => (
        Object.prototype.hasOwnProperty.call(reward || {}, "totalCoins")
        || Object.prototype.hasOwnProperty.call(reward || {}, "amountPerDeposit")
        || Object.prototype.hasOwnProperty.call(reward || {}, "currentCoins")
      ));
      if (!cleaned.length || !hasFundShape) return defaultFundRewards();
      return cleaned.map(normalizeFundReward);
    }

    function fundTotalCoins(fund) {
      return positiveCoinValue(fund?.totalCoins, 1000);
    }

    function fundAmountPerDeposit(fund) {
      return Math.min(fundTotalCoins(fund), positiveCoinValue(fund?.amountPerDeposit, 100));
    }

    function fundCurrentCoins(fund) {
      return Math.max(0, parseCoinAmount(fund?.currentCoins));
    }

    function fundProgressPercent(fund) {
      const total = fundTotalCoins(fund);
      return total > 0 ? Math.min(100, Math.round((fundCurrentCoins(fund) / total) * 100)) : 0;
    }

    function fundCompleted(fund) {
      if (typeof fund?.completedBeforePastCoinHistoryScaleMigration === "boolean") {
        return fund.completedBeforePastCoinHistoryScaleMigration;
      }
      return fundCurrentCoins(fund) >= fundTotalCoins(fund);
    }

    function normalizeAchievements(achievements) {
      return (Array.isArray(achievements) ? achievements : [])
        .filter(item => String(item?.name || "").trim())
        .map(item => ({
          id: item.id || createId("achievement"),
          type: "fund_completed",
          rewardId: item.rewardId || null,
          name: String(item.name || "").trim(),
          totalCoins: positiveCoinValue(item.totalCoins, 0),
          completedAt: item.completedAt || item.timestamp || new Date().toISOString(),
          date: normalizeReviewDateKey(item.date || dateKey(new Date(item.completedAt || item.timestamp || Date.now())))
        }))
        .filter(item => item.totalCoins > 0)
        .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)));
    }

    function normalizeCoinHistory(history) {
      return (Array.isArray(history) ? history : []).map(item => {
        const isRewardEvent = isRewardPageEvent(item);
        if (isRewardEvent) {
          return {
            ...item,
            source: "rewards",
            category: item.category || "reward_spending",
            action: item.action || item.type || "reward_action",
            entityType: item.entityType || "reward_fund",
            affectsBehaviorScore: false
          };
        }
        if (isHabitPerformanceTransaction(item)) {
          return {
            ...item,
            source: item.source || "behavior",
            category: item.category || "habit_performance",
            action: item.action || item.type,
            entityType: item.entityType || behaviorEntityTypeForEvent(item.type),
            affectsBehaviorScore: true
          };
        }
        return {
          ...item,
          affectsBehaviorScore: item?.affectsBehaviorScore === true
        };
      });
    }

    function normalizePriorityTasks(priorityTasks) {
      const entries = priorityTasks && typeof priorityTasks === "object" ? Object.entries(priorityTasks) : [];
      return entries.reduce((normalized, [day, task]) => {
        const date = normalizeReviewDateKey(task?.date || day);
        const title = String(task?.title || task?.name || "").trim();
        if (!title) return normalized;
        const status = ["pending", "done", "failed"].includes(task?.status) ? task.status : "pending";
        normalized[date] = {
          date,
          title,
          status,
          completedAt: task?.completedAt || null,
          failedAt: task?.failedAt || null,
          settledPenalty: Boolean(task?.settledPenalty),
          rewardHistoryId: task?.rewardHistoryId || null,
          penaltyHistoryId: task?.penaltyHistoryId || null,
          createdAt: task?.createdAt || new Date().toISOString(),
          updatedAt: task?.updatedAt || new Date().toISOString()
        };
        return normalized;
      }, {});
    }

    const PAST_HISTORY_COIN_FIELDS = [
      "amount",
      "coins",
      "coinDelta",
      "rewardCoins",
      "penalty",
      "penaltyCoins",
      "cost",
      "spent",
      "refunded",
      "deposited",
      "deductedCoins",
      "earnedCoins",
      "coinEffect",
      "coinImpact",
      "previousBalance",
      "resultingBalance",
      "currentCoins",
      "currentCoinsBefore",
      "currentCoinsAfter",
      "value",
      "delta"
    ];
    const PAST_BALANCE_FIELDS = ["coins", "balance", "currentBalance", "walletBalance"];
    const PAST_TOTAL_COIN_FIELDS = ["coinsSpent", "coinsPenalty", "earnedTaskCoins"];
    const PAST_SETTLED_TASK_COIN_FIELDS = [
      "earnedCoins",
      "actualEarnedCoins",
      "deductedCoins",
      "penaltyCoins",
      "actualPenaltyCoins",
      "settledCoins"
    ];
    const PAST_UNDO_COIN_FIELDS = [
      "amount",
      "coinDelta",
      "bonusAmount",
      "correctionDelta",
      "currentCoinsBefore",
      "currentCoinsAfter",
      "previousBalance",
      "resultingBalance"
    ];

    function scalePastCoinAmount(value) {
      if (value === undefined || value === null || value === "") return value;
      const amount = Number(value);
      if (!Number.isFinite(amount)) return value;
      return parseCoinAmount(amount * PAST_COIN_HISTORY_SCALE_FACTOR);
    }

    function scalePastCoinFields(record, fields) {
      if (!record || typeof record !== "object" || Array.isArray(record)) return record;
      const scaled = { ...record };
      fields.forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(record, field)) return;
        scaled[field] = scalePastCoinAmount(record[field]);
      });
      return scaled;
    }

    function historyFinancialDeltaBeforePastCoinScale(item = {}) {
      if (item.coinDelta !== undefined && item.coinDelta !== null && item.coinDelta !== "") {
        return parseCoinAmount(item.coinDelta);
      }
      const rawAmount = [item.amount, item.coins, item.cost, item.value, item.delta]
        .find(value => value !== undefined && value !== null && value !== "");
      const amount = Math.abs(parseCoinAmount(rawAmount));
      if (!amount) return 0;
      const type = normalizedEventField(item.type);
      if ([
        "task_failed",
        "task_missed",
        "habit_failed",
        "priority_task_penalty",
        "bad_habit",
        "reward_redeemed",
        "fund_deposit"
      ].includes(type)) return -amount;
      return amount;
    }

    function scalePastHistoryItem(item) {
      if (!item || typeof item !== "object") return item;
      const behaviorDelta = isHabitPerformanceTransaction(item)
        ? historyFinancialDeltaBeforePastCoinScale(item)
        : null;
      const scaled = scalePastCoinFields(item, PAST_HISTORY_COIN_FIELDS);
      if (behaviorDelta !== null && !Object.prototype.hasOwnProperty.call(item, "behaviorScoreDelta")) {
        scaled.behaviorScoreDelta = behaviorDelta;
      }
      scaled.pastCoinHistoryScaleFactor = PAST_COIN_HISTORY_SCALE_FACTOR;
      return scaled;
    }

    function scalePastHistoryCollection(value) {
      return Array.isArray(value) ? value.map(scalePastHistoryItem) : value;
    }

    function scalePastFundProgress(fund) {
      if (!fund || typeof fund !== "object" || Array.isArray(fund)) return fund;
      const totalCoins = positiveCoinValue(firstAvailableValue([fund.totalCoins, fund.targetCoins], 0), 0);
      const currentCoins = Math.max(
        0,
        parseCoinAmount(firstAvailableValue([fund.currentCoins, fund.depositedCoins], 0))
      );
      const wasComplete = Boolean(
        fund.completedAt
        || fund.finishedAt
        || (totalCoins > 0 && currentCoins >= totalCoins)
      );
      const scaled = scalePastCoinFields(fund, ["currentCoins", "depositedCoins"]);
      scaled.completedBeforePastCoinHistoryScaleMigration = wasComplete;
      return scaled;
    }

    function scalePastSettledTask(task) {
      if (!task || typeof task !== "object" || Array.isArray(task)) return task;
      const isSettled = task.status === "completed"
        || task.status === "failed"
        || (task.earnedCoins !== undefined && task.earnedCoins !== null && task.earnedCoins !== "")
        || task.failedAt;
      return isSettled ? scalePastCoinFields(task, PAST_SETTLED_TASK_COIN_FIELDS) : task;
    }

    function scalePastUndoData(undo) {
      if (!undo || typeof undo !== "object" || Array.isArray(undo)) return undo;
      const scaled = scalePastCoinFields(undo, PAST_UNDO_COIN_FIELDS);
      ["entries", "taskEntries", "habitEntries", "priorityEntries", "bonusEntries"].forEach(field => {
        if (Array.isArray(undo[field])) {
          scaled[field] = undo[field].map(entry => scalePastCoinFields(entry, PAST_UNDO_COIN_FIELDS));
        }
      });
      if (Array.isArray(undo.originalEntries)) {
        scaled.originalEntries = undo.originalEntries.map(scalePastHistoryItem);
      }
      if (undo.snapshot && typeof undo.snapshot === "object") {
        scaled.snapshot = {
          ...undo.snapshot,
          totals: scalePastCoinFields(undo.snapshot.totals, PAST_TOTAL_COIN_FIELDS),
          task: scalePastSettledTask(undo.snapshot.task),
          fund: scalePastFundProgress(undo.snapshot.fund)
        };
      }
      return scaled;
    }

    function scalePastEconomyData(economy) {
      if (!economy || typeof economy !== "object" || Array.isArray(economy)) return economy;
      const scaled = scalePastCoinFields(economy, PAST_BALANCE_FIELDS);
      ["history", "coinHistory", "transactions", "transactionHistory", "events"].forEach(field => {
        if (Array.isArray(economy[field])) scaled[field] = scalePastHistoryCollection(economy[field]);
      });
      if (economy.totals) scaled.totals = scalePastCoinFields(economy.totals, PAST_TOTAL_COIN_FIELDS);
      return scaled;
    }

    function migratePastCoinHistoryData(saved) {
      if (!saved || typeof saved !== "object") return { state: saved, applied: false };
      if (pastCoinHistoryScaleMigrationApplied(saved)) {
        return { state: saved, applied: false };
      }

      const migrated = scalePastCoinFields(saved, PAST_BALANCE_FIELDS);
      ["history", "coinHistory", "transactions", "transactionHistory", "events"].forEach(field => {
        if (Array.isArray(saved[field])) migrated[field] = scalePastHistoryCollection(saved[field]);
      });
      if (Array.isArray(saved.tasks)) migrated.tasks = saved.tasks.map(scalePastSettledTask);
      if (Array.isArray(saved.rewards)) migrated.rewards = saved.rewards.map(scalePastFundProgress);
      if (saved.totals) migrated.totals = scalePastCoinFields(saved.totals, PAST_TOTAL_COIN_FIELDS);
      if (saved.economy) migrated.economy = scalePastEconomyData(saved.economy);
      ["pendingUndo", "undoState", "lastUndo"].forEach(field => {
        if (saved[field]) migrated[field] = scalePastUndoData(saved[field]);
      });
      migrated.pastCoinHistoryScaleMigrationVersion = PAST_COIN_HISTORY_SCALE_MIGRATION_VERSION;
      return { state: migrated, applied: true };
    }

    function pastCoinHistoryScaleMigrationApplied(saved) {
      return Number(saved?.pastCoinHistoryScaleMigrationVersion) >= PAST_COIN_HISTORY_SCALE_MIGRATION_VERSION;
    }

    function loadState() {
      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        let saved = JSON.parse(savedRaw);
        let migrationApplied = false;
        if (saved) {
          if (!pastCoinHistoryScaleMigrationApplied(saved)) {
            try {
              if (!localStorage.getItem(PAST_COIN_HISTORY_SCALE_BACKUP_KEY)) {
                localStorage.setItem(PAST_COIN_HISTORY_SCALE_BACKUP_KEY, savedRaw);
              }
            } catch {
              // A backup failure must not block the app from loading or migrating.
            }
          }
          const migration = migratePastCoinHistoryData(saved);
          saved = migration.state;
          migrationApplied = migration.applied;
        }
        const needsLegacyCleanup = Boolean(saved && (
          Object.prototype.hasOwnProperty.call(saved, "phoneTimer")
          || Object.prototype.hasOwnProperty.call(saved, "breakTimer")
          || (Array.isArray(saved.rewards) && saved.rewards.some(reward => (
            String(reward?.name || "").trim() === "玩手机"
            || Object.prototype.hasOwnProperty.call(reward || {}, "mapping")
            || Object.prototype.hasOwnProperty.call(reward || {}, "realWorldNote")
            || Object.prototype.hasOwnProperty.call(reward || {}, "cost")
            || !Object.prototype.hasOwnProperty.call(reward || {}, "totalCoins")
          )))
          || (Array.isArray(saved.history)
            && JSON.stringify(normalizeCoinHistory(saved.history)) !== JSON.stringify(saved.history))
        ));
        const merged = saved ? {
          ...cloneEmptyState(),
          ...saved,
          totals: { ...cloneEmptyState().totals, ...(saved.totals || {}) },
          tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
          habits: Array.isArray(saved.habits) ? saved.habits : [],
          badHabits: Array.isArray(saved.badHabits) ? saved.badHabits : [],
          notes: Array.isArray(saved.notes) ? saved.notes : [],
          memos: Array.isArray(saved.memos) ? saved.memos : [],
          rewards: Array.isArray(saved.rewards) ? normalizeRewards(saved.rewards) : defaultFundRewards(),
          achievements: normalizeAchievements(saved.achievements),
          priorityTaskByDate: normalizePriorityTasks(saved.priorityTaskByDate),
          nextStep: saved.nextStep && typeof saved.nextStep === "object"
            ? { ...cloneEmptyState().nextStep, ...saved.nextStep }
            : cloneEmptyState().nextStep,
          dailyReviews: saved.dailyReviews && typeof saved.dailyReviews === "object" ? saved.dailyReviews : {},
          reviewRewards: saved.reviewRewards && typeof saved.reviewRewards === "object" ? saved.reviewRewards : {},
          noBadHabitBonuses: saved.noBadHabitBonuses && typeof saved.noBadHabitBonuses === "object" ? saved.noBadHabitBonuses : {},
          noBadHabitBonusCheckedThroughDate: saved.noBadHabitBonusCheckedThroughDate || null,
          history: normalizeCoinHistory(saved.history),
          completions: saved.completions && typeof saved.completions === "object" ? saved.completions : {},
          taskResults: saved.taskResults && typeof saved.taskResults === "object" ? saved.taskResults : {},
          habitCompletions: saved.habitCompletions && typeof saved.habitCompletions === "object" ? saved.habitCompletions : {},
          habitFailures: saved.habitFailures && typeof saved.habitFailures === "object" ? saved.habitFailures : {},
          taskAutoFailures: saved.taskAutoFailures && typeof saved.taskAutoFailures === "object" ? saved.taskAutoFailures : {}
        } : {
          ...cloneEmptyState(),
          rewards: defaultFundRewards()
        };

        delete merged.phoneTimer;
        delete merged.breakTimer;

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
        if (needsLegacyCleanup || migrationApplied) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }

        return merged;
      } catch {
        const fresh = cloneEmptyState();
        fresh.rewards = defaultFundRewards();
        fresh.settledThroughDate = yesterdayKey();
        fresh.noBadHabitBonusCheckedThroughDate = shiftDateKey(yesterdayKey(), -1);
        return fresh;
      }
    }

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

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function cloneDebugValue(value) {
      if (value === undefined) return null;
      return JSON.parse(JSON.stringify(value));
    }

    function readDebugLocalStorage() {
      const raw = {};
      const parsed = {};
      const entries = [];
      const errors = [];

      try {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (!key) continue;
          const value = localStorage.getItem(key);
          raw[key] = value;
          try {
            const parsedValue = JSON.parse(value);
            parsed[key] = parsedValue;
            entries.push({ key, raw: value, parsed: parsedValue, isJson: true });
          } catch {
            parsed[key] = value;
            entries.push({ key, raw: value, parsed: value, isJson: false });
          }
        }
      } catch (error) {
        errors.push({
          section: "localStorage",
          message: String(error?.message || error)
        });
      }

      return { keys: Object.keys(raw), raw, parsed, entries, errors };
    }

    function debugSnapshotCall(label, callback, errors, fallback) {
      try {
        return callback();
      } catch (error) {
        errors.push({
          section: label,
          message: String(error?.message || error)
        });
        return fallback;
      }
    }

    function buildDebugData(exportDate = new Date()) {
      const errors = [];
      const localStorageData = readDebugLocalStorage();
      errors.push(...localStorageData.errors);
      const history = Array.isArray(state.history) ? state.history : [];
      const stateSnapshot = debugSnapshotCall("state", () => cloneDebugValue(state), errors, null);
      const currentUrl = typeof window !== "undefined" ? window.location.href : "";
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";
      const isLocalHost = /^(localhost|127\.0\.0\.1|::1)$/.test(currentHostname);
      const productionUrl = currentOrigin && !isLocalHost ? currentOrigin : null;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const schemaVersion = state.schemaVersion || state.dataVersion || STORAGE_KEY;
      const historyDates = [...new Set([
        ...history.map(item => item?.date).filter(Boolean),
        ...Object.keys(state.priorityTaskByDate || {}),
        ...Object.keys(state.dailyReviews || {})
      ])].sort();
      const summaryTotalsData = debugSnapshotCall(
        "economy.summaryTotals",
        () => typeof summaryTotals === "function" ? summaryTotals() : {},
        errors,
        {}
      );
      const statsRows = {
        week: debugSnapshotCall("statistics.week", () => buildStatsRows("week"), errors, []),
        month: debugSnapshotCall("statistics.month", () => buildStatsRows("month"), errors, []),
        year: debugSnapshotCall("statistics.year", () => buildStatsRows("year"), errors, [])
      };
      const heatmapRows = debugSnapshotCall(
        "heatmap.rows",
        () => buildMonthlyHeatRows(currentHeatmapMonth),
        errors,
        []
      );
      const monthlySummary = debugSnapshotCall(
        "statistics.monthlySummary",
        () => typeof buildMonthlyTaskSummary === "function"
          ? buildMonthlyTaskSummary(currentHeatmapMonth)
          : {},
        errors,
        {}
      );
      const daySummaries = {};
      historyDates.forEach(day => {
        daySummaries[day] = debugSnapshotCall(
          `heatmap.day.${day}`,
          () => typeof dayCoinSummary === "function" ? dayCoinSummary(day) : {},
          errors,
          {}
        );
      });

      return {
        exportedAt: exportDate.toISOString(),
        schemaVersion,
        productionUrl,
        currentUrl,
        userAgent,
        app: {
          name: "LifeOS",
          storageKey: STORAGE_KEY,
          legacyStorageKeys: [...OLD_STORAGE_KEYS],
          dataVersion: schemaVersion
        },
        localStorage: localStorageData,
        state: stateSnapshot,
        economy: {
          coins: state.coins,
          totals: debugSnapshotCall("economy.totals", () => cloneDebugValue(state.totals || {}), errors, {}),
          summaryTotals: summaryTotalsData,
          history: debugSnapshotCall("economy.history", () => cloneDebugValue(history), errors, [])
        },
        history: debugSnapshotCall("history", () => cloneDebugValue(history), errors, []),
        coinHistory: debugSnapshotCall(
          "coinHistory",
          () => cloneDebugValue(state.coinHistory || history),
          errors,
          []
        ),
        transactions: debugSnapshotCall(
          "transactions",
          () => cloneDebugValue(state.transactions || history),
          errors,
          []
        ),
        transactionHistory: debugSnapshotCall(
          "transactionHistory",
          () => cloneDebugValue(state.transactionHistory || state.transactions || history),
          errors,
          []
        ),
        events: debugSnapshotCall(
          "events",
          () => cloneDebugValue(state.events || history),
          errors,
          []
        ),
        rewards: debugSnapshotCall("rewards", () => cloneDebugValue(state.rewards || []), errors, []),
        funds: debugSnapshotCall("funds", () => cloneDebugValue(state.funds || state.rewards || []), errors, []),
        habits: debugSnapshotCall("habits", () => cloneDebugValue(state.habits || []), errors, []),
        badHabits: debugSnapshotCall("badHabits", () => cloneDebugValue(state.badHabits || []), errors, []),
        tasks: debugSnapshotCall("tasks", () => cloneDebugValue(state.tasks || []), errors, []),
        recaps: debugSnapshotCall(
          "recaps",
          () => cloneDebugValue(state.recaps || state.dailyReviews || {}),
          errors,
          {}
        ),
        memos: debugSnapshotCall("memos", () => cloneDebugValue(state.memos || []), errors, []),
        priorityTask: debugSnapshotCall(
          "priorityTask",
          () => cloneDebugValue(state.priorityTaskByDate || {}),
          errors,
          {}
        ),
        settlements: debugSnapshotCall(
          "settlements",
          () => cloneDebugValue({
            settledThroughDate: state.settledThroughDate || null,
            noBadHabitBonusCheckedThroughDate: state.noBadHabitBonusCheckedThroughDate || null,
            taskAutoFailures: state.taskAutoFailures || {},
            habitFailures: state.habitFailures || {},
            reviewRewards: state.reviewRewards || {},
            noBadHabitBonuses: state.noBadHabitBonuses || {},
            priorityTaskByDate: state.priorityTaskByDate || {}
          }),
          errors,
          {}
        ),
        dateRecords: debugSnapshotCall(
          "dateRecords",
          () => cloneDebugValue({
            completions: state.completions || {},
            taskResults: state.taskResults || {},
            habitCompletions: state.habitCompletions || {},
            habitFailures: state.habitFailures || {},
            taskAutoFailures: state.taskAutoFailures || {},
            priorityTaskByDate: state.priorityTaskByDate || {},
            dailyReviews: state.dailyReviews || {},
            recaps: state.recaps || {},
            reviewRewards: state.reviewRewards || {},
            noBadHabitBonuses: state.noBadHabitBonuses || {}
          }),
          errors,
          {}
        ),
        statistics: {
          persisted: debugSnapshotCall("statistics.persisted", () => cloneDebugValue(state.statistics || null), errors, null),
          currentRange: currentStatsRange,
          summaryTotals: summaryTotalsData,
          monthlySummary,
          ranges: statsRows,
          daySummaries
        },
        settings: {
          storageKey: STORAGE_KEY,
          legacyStorageKeys: [...OLD_STORAGE_KEYS],
          schemaVersion,
          runtime: {
            currentStatsRange,
            currentHeatmapMonth,
            selectedReviewDate,
            currentUrl,
            productionUrl,
            userAgent
          },
          persisted: localStorageData.parsed.settings ?? state.settings ?? null
        },
        heatmap: {
          persisted: debugSnapshotCall("heatmap.persisted", () => cloneDebugValue(state.heatmap || null), errors, null),
          month: currentHeatmapMonth,
          rows: heatmapRows,
          daySummaries,
          allHistoryDates: historyDates
        },
        debugErrors: errors
      };
    }

    function exportDebugData() {
      const exportDate = new Date();
      const debugData = buildDebugData(exportDate);
      const blob = new Blob([
        JSON.stringify(debugData, null, 2)
      ], { type: "application/json;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const pad = value => String(value).padStart(2, "0");
      link.download = [
        "lifeos-debug",
        `${exportDate.getFullYear()}-${pad(exportDate.getMonth() + 1)}-${pad(exportDate.getDate())}`,
        `${pad(exportDate.getHours())}${pad(exportDate.getMinutes())}`
      ].join("-") + ".json";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      if (typeof showToast === "function") showToast("调试数据已导出");
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

    function formatFundCoins(value) {
      const amount = parseCoinAmount(value);
      return Number.isInteger(amount) ? formatNumber(amount) : formatCoinAmount(amount);
    }

    function currentStreak() {
      if (!state.lastCompletedDate) return 0;
      const today = dateKey();
      if (state.lastCompletedDate === today || state.lastCompletedDate === yesterdayKey()) {
        return state.streak;
      }
      return 0;
    }

    function ensurePriorityTasks() {
      state.priorityTaskByDate = state.priorityTaskByDate && typeof state.priorityTaskByDate === "object"
        ? state.priorityTaskByDate
        : {};
      return state.priorityTaskByDate;
    }

    function priorityTaskForDate(day = dateKey()) {
      return ensurePriorityTasks()[normalizeReviewDateKey(day)] || null;
    }

    function priorityTaskToday() {
      return priorityTaskForDate(dateKey());
    }

    function priorityTaskSnapshot(task) {
      return task ? { ...task } : null;
    }

    function setPriorityTaskForDate(day, title) {
      const date = normalizeReviewDateKey(day);
      const now = new Date().toISOString();
      const previous = priorityTaskForDate(date);
      ensurePriorityTasks()[date] = {
        date,
        title: String(title || "").trim(),
        status: previous?.status || "pending",
        completedAt: previous?.completedAt || null,
        failedAt: previous?.failedAt || null,
        settledPenalty: Boolean(previous?.settledPenalty),
        rewardHistoryId: previous?.rewardHistoryId || null,
        penaltyHistoryId: previous?.penaltyHistoryId || null,
        createdAt: previous?.createdAt || now,
        updatedAt: now
      };
      return ensurePriorityTasks()[date];
    }

    function restorePriorityTask(day, snapshot) {
      const date = normalizeReviewDateKey(day);
      if (snapshot) {
        ensurePriorityTasks()[date] = { ...snapshot };
      } else {
        delete ensurePriorityTasks()[date];
      }
    }

    function resetAllData() {
      localStorage.removeItem(STORAGE_KEY);
      OLD_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      state = cloneEmptyState();
      state.rewards = defaultFundRewards();
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
      const savedAt = new Date().toISOString();
      state.dailyReviews[reviewDate] = {
        date: reviewDate,
        best,
        mistake,
        priority,
        createdAt: previous.createdAt || savedAt,
        updatedAt: savedAt
      };
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
