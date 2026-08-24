    function coinEventFinancialDelta(item) {
      if (!item) return 0;
      if (item.coinDelta !== undefined && item.coinDelta !== null && item.coinDelta !== "") {
        return parseCoinAmount(item.coinDelta);
      }
      if (typeof historyCoinDelta === "function") {
        const historyDelta = parseCoinAmount(historyCoinDelta(item));
        if (historyDelta !== 0) return historyDelta;
      }

      const rawAmount = [item.amount, item.coins, item.cost, item.value, item.delta]
        .find(value => value !== undefined && value !== null && value !== "");
      const amount = parseCoinAmount(rawAmount);
      if (!amount) return 0;
      const type = String(item.type || "").toLowerCase();
      if ([
        "task_failed",
        "task_missed",
        "habit_failed",
        "priority_task_penalty",
        "bad_habit",
        "reward_redeemed",
        "fund_deposit"
      ].includes(type)) return -Math.abs(amount);
      if ([
        "task_completed",
        "habit_completed",
        "review_reward",
        "priority_task_reward",
        "no_bad_habit_bonus"
      ].includes(type)) return Math.abs(amount);
      return isRewardPageEvent(item) ? -Math.abs(amount) : 0;
    }

    function createStatsRow(values = {}) {
      return {
        completed: 0,
        failed: 0,
        badHabits: 0,
        earned: 0,
        deducted: 0,
        focusSeconds: 0,
        focusMinutes: 0,
        earnedTaskCoins: 0,
        net: 0,
        behaviorEarned: 0,
        behaviorDeducted: 0,
        behaviorNet: 0,
        hasBehaviorRecord: false,
        score: 0,
        ...values
      };
    }

    function statsMetricsForHistoryItem(item) {
      const isBehaviorTransaction = isHabitPerformanceTransaction(item);
      const financialDelta = coinEventFinancialDelta(item);
      const behaviorDelta = isBehaviorTransaction
        ? item.behaviorScoreDelta !== undefined && item.behaviorScoreDelta !== null && item.behaviorScoreDelta !== ""
          ? parseCoinAmount(item.behaviorScoreDelta)
          : financialDelta
        : 0;
      return { isBehaviorTransaction, financialDelta, behaviorDelta };
    }

    function addHistoryItemToStatsRow(row, item, metrics) {
      const { isBehaviorTransaction, financialDelta, behaviorDelta } = metrics;
      if (financialDelta > 0) row.earned += financialDelta;
      if (financialDelta < 0) row.deducted += Math.abs(financialDelta);
      if (behaviorDelta > 0) row.behaviorEarned += behaviorDelta;
      if (behaviorDelta < 0) row.behaviorDeducted += Math.abs(behaviorDelta);
      if (isBehaviorTransaction) row.hasBehaviorRecord = true;

      if (isBehaviorTransaction && (item.type === "task_completed" || item.type === "habit_completed")) {
        row.completed += 1;
      }
      if (isBehaviorTransaction && item.type === "task_completed") {
        row.focusSeconds += taskDurationSecondsFromItem(item);
        row.earnedTaskCoins += taskEarnedCoinsFromItem(item);
      }
      if (isBehaviorTransaction && (
        item.type === "task_failed"
        || item.type === "task_missed"
        || item.type === "habit_failed"
        || item.type === "priority_task_penalty"
      )) {
        row.failed += 1;
      }
      if (isBehaviorTransaction && item.type === "bad_habit") row.badHabits += 1;
    }

    function finalizeStatsRows(rows) {
      rows.forEach(row => {
        row.focusMinutes = Math.round(row.focusSeconds / 60);
        row.net = row.earned - row.deducted;
        row.behaviorNet = row.behaviorEarned - row.behaviorDeducted;
        row.score = row.completed - row.failed - row.badHabits;
      });
      return rows;
    }

    function aggregateStatsRowGroups(rowGroups, history = state.history) {
      const indexes = rowGroups.map(rows => new Map(rows.map(row => [row.key, row])));
      history.forEach(item => {
        let metrics = null;
        indexes.forEach(index => {
          const row = index.get(item.date);
          if (!row) return;
          metrics = metrics || statsMetricsForHistoryItem(item);
          addHistoryItemToStatsRow(row, item, metrics);
        });
      });
      rowGroups.forEach(finalizeStatsRows);
      return rowGroups;
    }

    function aggregateStatsRows(rows, history = state.history) {
      aggregateStatsRowGroups([rows], history);
      return rows;
    }

    function createStatsRangeRows(range) {
      const periods = lastDays(range === "year" ? 365 : range === "month" ? 30 : 7);
      return periods.map(period => createStatsRow({
        key: period.key,
        label: period.label
      }));
    }

    function createMonthlyHeatRows(month) {
      const monthStart = monthDateFromKey(month);
      const year = monthStart.getFullYear();
      const monthIndex = monthStart.getMonth();
      const dayCount = new Date(year, monthIndex + 1, 0).getDate();
      return Array.from({ length: dayCount }, (_, index) => {
        const date = new Date(year, monthIndex, index + 1);
        return createStatsRow({
          key: dateKey(date),
          day: index + 1
        });
      });
    }

    function buildStatsRows(range) {
      return aggregateStatsRows(createStatsRangeRows(range));
    }

    function buildMonthlyHeatRows(month) {
      return aggregateStatsRows(createMonthlyHeatRows(month));
    }

    function buildStatsDashboardData(range, month) {
      const trendRows = createStatsRangeRows(range);
      const heatRows = createMonthlyHeatRows(month);
      aggregateStatsRowGroups([trendRows, heatRows]);
      return { trendRows, heatRows };
    }

    function recentDailyScoreRows(dayCount, anchorDate = new Date(), reviews = state.dailyReviews) {
      const rows = [];
      for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
        const day = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - offset);
        const key = dateKey(day);
        rows.push({
          key,
          label: `${day.getMonth() + 1}/${day.getDate()}`,
          score: normalizeDailyScore(reviews?.[key]?.dailyScore),
          ratedCount: normalizeDailyScore(reviews?.[key]?.dailyScore) === null ? 0 : 1
        });
      }
      return rows;
    }

    function recentMonthlyScoreRows(anchorDate = new Date(), reviews = state.dailyReviews) {
      return Array.from({ length: 12 }, (_, index) => {
        const monthDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - (11 - index), 1);
        const key = monthKey(monthDate);
        const scores = Object.entries(reviews || {})
          .filter(([day]) => day.startsWith(`${key}-`))
          .map(([, review]) => normalizeDailyScore(review?.dailyScore))
          .filter(score => score !== null);
        return {
          key,
          label: `${monthDate.getMonth() + 1}月`,
          score: scores.length
            ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10
            : null,
          ratedCount: scores.length
        };
      });
    }

    function buildDailyScoreTrend(range, reviews = state.dailyReviews, anchorDate = new Date()) {
      const normalizedRange = ["week", "month", "year"].includes(range) ? range : "week";
      const rows = normalizedRange === "year"
        ? recentMonthlyScoreRows(anchorDate, reviews)
        : recentDailyScoreRows(normalizedRange === "month" ? 30 : 7, anchorDate, reviews);
      const ratedCount = rows.reduce((total, row) => total + row.ratedCount, 0);
      const weightedTotal = rows.reduce((total, row) => (
        row.score === null ? total : total + row.score * row.ratedCount
      ), 0);
      return {
        range: normalizedRange,
        rows,
        average: ratedCount ? Math.round((weightedTotal / ratedCount) * 10) / 10 : null,
        ratedCount,
        maxScore: 10
      };
    }

    function buildMonthlyTaskSummary(month, rows = null) {
      const monthlyRows = rows || buildMonthlyHeatRows(month);
      return {
        monthlyTaskDuration: monthlyRows.reduce((total, row) => total + row.focusSeconds, 0),
        monthlyEarnedCoinsFromTasks: parseCoinAmount(
          monthlyRows.reduce((total, row) => total + row.earnedTaskCoins, 0)
        )
      };
    }

    function calendarDayClass(row, maxNet, maxLoss) {
      if (!row.hasBehaviorRecord) return "empty";
      const behaviorNet = Number(row.behaviorNet) || 0;
      if (behaviorNet > 0) {
        const ratio = maxNet ? behaviorNet / maxNet : 1;
        if (ratio > 0.75) return "net-4";
        if (ratio > 0.5) return "net-3";
        if (ratio > 0.25) return "net-2";
        return "net-1";
      }
      if (behaviorNet < 0) {
        const loss = Math.abs(behaviorNet);
        const ratio = maxLoss ? loss / maxLoss : 1;
        if (ratio > 0.66) return "bad-3";
        if (ratio > 0.33) return "bad-2";
        return "bad-1";
      }
      return "net-0";
    }
