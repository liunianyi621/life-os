    function renderStatsVisuals() {
      const { trendRows, heatRows } = buildStatsDashboardData(currentStatsRange, currentHeatmapMonth);
      renderHeatmap(heatRows);
      renderAchievements();
      renderHabitTrend(trendRows);
    }

    function historyTimeLabel(timestamp) {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }

    function signedAmountHtml(amount) {
      const value = Number(amount) || 0;
      const tone = value > 0 ? "positive" : value < 0 ? "negative" : "";
      const sign = value > 0 ? "+" : value < 0 ? "-" : "";
      return `<span class="detail-amount ${tone}">${sign}${formatCoinAmount(Math.abs(value))}</span>`;
    }

    const DAY_DETAIL_HISTORY_TYPES = new Set([
      "task_completed",
      "task_failed",
      "task_missed",
      "habit_completed",
      "habit_failed",
      "bad_habit",
      "fund_deposit",
      "reward_redeemed",
      "review_reward",
      "priority_task_reward",
      "priority_task_penalty",
      "no_bad_habit_bonus"
    ]);

    const DAY_TIMELINE_TYPE_LABELS = {
      task_completed: "完成任务",
      task_failed: "任务未完成",
      task_missed: "任务未完成",
      habit_completed: "完成习惯",
      habit_failed: "习惯未完成",
      bad_habit: "坏习惯记录",
      fund_deposit: "基金注入",
      fund_withdraw: "基金取出",
      reward_redeemed: "奖励兑换",
      reward_refund: "奖励退款",
      review_reward: "复盘奖励",
      priority_task_reward: "重点事项完成",
      priority_task_penalty: "重点事项未完成",
      no_bad_habit_bonus: "无坏习惯奖励",
      day_record_correction: "历史纠错"
    };

    let currentDayDetailDate = null;

    function dayTimelineTimestamp(item = {}) {
      return item.timestamp || item.completedAt || item.failedAt || item.createdAt || item.updatedAt || "";
    }

    function dayTimelineDateKey(item = {}) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ""))) return item.date;
      const timestamp = dayTimelineTimestamp(item);
      if (!timestamp) return "";
      const parsed = new Date(timestamp);
      return Number.isNaN(parsed.getTime()) ? "" : dateKey(parsed);
    }

    function dayTimelineTitle(item = {}) {
      const name = String(item.name || item.title || item.description || "未命名记录").trim();
      const quoted = `「${name}」`;
      const titles = {
        task_completed: `完成任务${quoted}`,
        task_failed: `${quoted}未完成`,
        task_missed: `${quoted}未完成`,
        habit_completed: `完成习惯${quoted}`,
        habit_failed: `习惯${quoted}未完成`,
        bad_habit: `记录坏习惯${quoted}`,
        fund_deposit: `已注入${quoted}`,
        fund_withdraw: `从${quoted}取出`,
        reward_redeemed: `兑换奖励${quoted}`,
        reward_refund: `撤销奖励${quoted}`,
        priority_task_reward: `完成重点事项${quoted}`,
        priority_task_penalty: `重点事项${quoted}未完成`,
        review_reward: "保存每日复盘",
        no_bad_habit_bonus: "无坏习惯奖励",
        day_record_correction: name
      };
      return titles[item.type] || name;
    }

    function dayTimelineIsAutomatic(item = {}) {
      const reason = String(item.reason || item.action || "").toLowerCase();
      return Boolean(item.settlementKey)
        || item.type === "task_missed"
        || reason === "timeout"
        || reason === "habit_missed"
        || reason.includes("automatic")
        || reason.includes("cross_day");
    }

    function dayTimelineRecordFromHistory(item) {
      const timestamp = dayTimelineTimestamp(item);
      const durationSeconds = taskDurationSecondsFromItem(item);
      const detailParts = [dayTimelineIsAutomatic(item) ? "自动记录" : "手动记录"];
      if (durationSeconds > 0) detailParts.push(`专注 ${formatFocusDuration(durationSeconds)}`);
      return {
        key: item.id,
        raw: item,
        timestamp,
        time: historyTimeLabel(timestamp) || "时间未知",
        sortTime: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).getTime() : -Infinity,
        title: dayTimelineTitle(item),
        typeLabel: DAY_TIMELINE_TYPE_LABELS[item.type] || item.type || "其他记录",
        amount: historyCoinDelta(item),
        detail: detailParts.join(" · "),
        automatic: dayTimelineIsAutomatic(item),
        canCorrect: item.type !== "day_record_correction" && (
          DAY_DETAIL_HISTORY_TYPES.has(item.type)
          || isRewardPageEvent(item)
          || item.coinDelta !== undefined
        )
      };
    }

    function dayTimelineRecords(day) {
      const records = (Array.isArray(state.history) ? state.history : [])
        .filter(item => dayTimelineDateKey(item) === day)
        .map(dayTimelineRecordFromHistory);
      const review = state.dailyReviews?.[day];
      const hasReviewHistory = records.some(record => record.raw?.type === "review_reward");
      if (review && !hasReviewHistory) {
        const timestamp = review.updatedAt || review.createdAt || "";
        records.push({
          key: `review:${day}`,
          raw: review,
          timestamp,
          time: historyTimeLabel(timestamp) || "时间未知",
          sortTime: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).getTime() : -Infinity,
          title: "保存每日复盘",
          typeLabel: "每日复盘",
          amount: 0,
          detail: "手动记录",
          automatic: false,
          canCorrect: true
        });
      }
      const priority = priorityTaskForDate(day);
      const hasPriorityHistory = records.some(record => (
        record.raw?.type === "priority_task_reward" || record.raw?.type === "priority_task_penalty"
      ));
      if (priority && priority.status !== "pending" && !hasPriorityHistory) {
        const timestamp = priority.completedAt || priority.failedAt || priority.updatedAt || "";
        const completed = priority.status === "done";
        records.push({
          key: `priority:${day}`,
          raw: priority,
          timestamp,
          time: historyTimeLabel(timestamp) || "时间未知",
          sortTime: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).getTime() : -Infinity,
          title: completed ? `完成重点事项「${priority.title}」` : `重点事项「${priority.title}」未完成`,
          typeLabel: completed ? "重点事项完成" : "重点事项未完成",
          amount: completed ? priorityTaskSettlementAmount("done") : -priorityTaskSettlementAmount("failed"),
          detail: "手动记录",
          automatic: false,
          canCorrect: true
        });
      }
      return records.sort((left, right) => right.sortTime - left.sortTime);
    }

    function dayHasEditableRecords(day) {
      return dayTimelineRecords(day).length > 0;
    }

    function dayCoinSummary(day) {
      const summary = {
        completed: [],
        habits: [],
        failed: [],
        failedHabits: [],
        badHabits: [],
        rewards: [],
        reviewRewards: [],
        priorityRewards: [],
        priorityPenalties: [],
        noBadHabitBonuses: [],
        earned: 0,
        deducted: 0,
        behaviorEarned: 0,
        behaviorDeducted: 0
      };

      state.history.forEach(item => {
        if (dayTimelineDateKey(item) !== day) return;
        const metrics = statsMetricsForHistoryItem(item);
        const { isBehaviorTransaction, financialDelta, behaviorDelta } = metrics;

        if (isBehaviorTransaction && item.type === "task_completed") summary.completed.push(item);
        if (isBehaviorTransaction && item.type === "habit_completed") summary.habits.push(item);
        if (isBehaviorTransaction && (item.type === "task_failed" || item.type === "task_missed")) {
          summary.failed.push(item);
        }
        if (isBehaviorTransaction && item.type === "habit_failed") summary.failedHabits.push(item);
        if (isBehaviorTransaction && item.type === "bad_habit") summary.badHabits.push(item);
        if (isRewardPageEvent(item)) summary.rewards.push(item);
        if (item.type === "review_reward") summary.reviewRewards.push(item);
        if (item.type === "priority_task_reward") summary.priorityRewards.push(item);
        if (item.type === "priority_task_penalty") summary.priorityPenalties.push(item);
        if (item.type === "no_bad_habit_bonus") summary.noBadHabitBonuses.push(item);

        if (financialDelta > 0) summary.earned += financialDelta;
        if (financialDelta < 0) summary.deducted += Math.abs(financialDelta);

        if (isBehaviorTransaction) {
          if (behaviorDelta > 0) summary.behaviorEarned += behaviorDelta;
          if (behaviorDelta < 0) summary.behaviorDeducted += Math.abs(behaviorDelta);
        }
      });

      return {
        ...summary,
        net: summary.earned - summary.deducted,
        behaviorNet: summary.behaviorEarned - summary.behaviorDeducted
      };
    }

    function dayTimelineHtml(day) {
      const records = dayTimelineRecords(day);
      if (!records.length) return `<p class="detail-empty">当天没有记录。</p>`;
      return `
        <section class="day-timeline-section">
          <h3>当天时间线</h3>
          <div class="day-timeline-list">
            ${records.map(record => {
              const icon = record.amount < 0 ? "xmark.circle" : record.amount > 0 ? "checkmark.circle" : "minus.circle";
              const tone = record.amount < 0 ? "negative" : record.amount > 0 ? "positive" : "neutral";
              return `
                <button class="day-timeline-row" type="button" data-open-day-record="${escapeAttr(record.key)}">
                  <time>${escapeHtml(record.time)}</time>
                  <span class="day-timeline-icon ${tone}">${actionIconHtml(icon)}</span>
                  <span class="day-timeline-main">
                    <strong>${escapeHtml(record.title)}</strong>
                    <small>${escapeHtml(record.detail)}</small>
                  </span>
                  ${signedAmountHtml(record.amount)}
                </button>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }

    function openDayTimelineRecord(recordKey) {
      if (!currentDayDetailDate) return;
      const record = dayTimelineRecords(currentDayDetailDate).find(item => item.key === recordKey);
      if (!record) return;
      sheetMode = "day-record";
      editingId = record.key;
      els.sheetTitle.textContent = "记录详情";
      els.sheetForm.innerHTML = `
        <div class="day-record-detail">
          <div class="day-record-detail-row"><span>时间</span><strong>${escapeHtml(record.time)}</strong></div>
          <div class="day-record-detail-row"><span>事件</span><strong>${escapeHtml(record.title)}</strong></div>
          <div class="day-record-detail-row"><span>类型</span><strong>${escapeHtml(record.typeLabel)}</strong></div>
          <div class="day-record-detail-row"><span>金币变化</span><strong>${signedAmountHtml(record.amount)}</strong></div>
          <div class="day-record-detail-row"><span>记录方式</span><strong>${record.automatic ? "自动" : "手动"}</strong></div>
        </div>
        ${record.canCorrect ? `
          <button class="day-record-correct-button" type="button" data-correct-day-record="${escapeAttr(record.key)}">
            撤销这条历史记录
          </button>
        ` : `<p class="day-record-readonly">这是一条纠错流水，不能再次直接撤销。</p>`}
      `;
      openSheet({ position: "top", layer: "above" });
    }

    function buildDayDetailHtml(day) {
      const summary = dayCoinSummary(day);
      const netTone = summary.net > 0 ? "positive" : summary.net < 0 ? "negative" : "";
      const netPrefix = summary.net > 0 ? "+" : summary.net < 0 ? "-" : "";
      const behaviorTone = summary.behaviorNet > 0 ? "positive" : summary.behaviorNet < 0 ? "negative" : "";
      const behaviorPrefix = summary.behaviorNet > 0 ? "+" : summary.behaviorNet < 0 ? "-" : "";
      const summaryHtml = `
        <div class="detail-summary-grid" aria-label="当天金币与行为表现">
          <div class="detail-metric">
            <span>获得</span>
            <strong class="positive">+${formatCoinAmount(summary.earned)}</strong>
          </div>
          <div class="detail-metric">
            <span>扣除 / 消耗</span>
            <strong class="negative">-${formatCoinAmount(summary.deducted)}</strong>
          </div>
          <div class="detail-metric">
            <span>净变化</span>
            <strong class="${netTone}">${netPrefix}${formatCoinAmount(Math.abs(summary.net))}</strong>
          </div>
          <div class="detail-metric">
            <span>行为表现</span>
            <strong class="${behaviorTone}">${behaviorPrefix}${formatCoinAmount(Math.abs(summary.behaviorNet))}</strong>
          </div>
        </div>
      `;

      if (!dayHasEditableRecords(day)) {
        return `
          ${summaryHtml}
          <section class="detail-section">
            <p class="detail-empty">当天没有记录。</p>
          </section>
        `;
      }

      return `
        ${summaryHtml}
        ${dayTimelineHtml(day)}
      `;
    }

    function openDayDetail(day) {
      currentDayDetailDate = day;
      const { month, day: dayNumber } = datePartsFromKey(day);
      els.dayDetailTitle.textContent = month && dayNumber ? `${month}月${dayNumber}日 · 当天记录` : "当天记录";
      els.dayDetailContent.innerHTML = buildDayDetailHtml(day);
      syncSheetViewport();
      els.dayDetailBackdrop.classList.remove("hidden");
      els.dayDetailBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
    }

    function closeDayDetail() {
      currentDayDetailDate = null;
      els.dayDetailBackdrop.classList.add("hidden");
      els.dayDetailBackdrop.setAttribute("aria-hidden", "true");
      els.dayDetailContent.innerHTML = "";
      syncModalState();
    }

    function achievementDateLabel(achievement) {
      const key = achievement.date || dateKey(new Date(achievement.completedAt || Date.now()));
      const { month, day } = datePartsFromKey(key);
      return month && day ? `${month}月${day}日` : key;
    }

    function renderAchievements() {
      if (!els.achievementsList) return;
      const achievements = (Array.isArray(state.achievements) ? state.achievements : [])
        .slice()
        .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)));
      if (!achievements.length) {
        els.achievementsList.innerHTML = `
          <div class="achievement-empty">
            <strong>还没有成就</strong>
            <p>完成人生主线基金后会记录在这里。</p>
          </div>
        `;
        return;
      }
      els.achievementsList.innerHTML = achievements.map(achievement => `
        <article class="achievement-item">
          <span>${escapeHtml(achievementDateLabel(achievement))}</span>
          <strong>完成：${escapeHtml(achievement.name)}</strong>
          <small>${formatFundCoins(achievement.totalCoins)} 金币</small>
        </article>
      `).join("");
    }

    function renderHeatmap(rows = null) {
      const heatRows = rows || buildMonthlyHeatRows(currentHeatmapMonth);
      const monthlyTaskSummary = buildMonthlyTaskSummary(currentHeatmapMonth, heatRows);
      const monthStart = monthDateFromKey(currentHeatmapMonth);
      const leadingDays = (monthStart.getDay() + 6) % 7;
      const maxNet = Math.max(...heatRows.map(row => Math.max(0, row.behaviorNet)), 0);
      const maxLoss = Math.max(...heatRows.map(row => Math.max(0, -row.behaviorNet)), 0);
      const today = dateKey();
      const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

      els.heatmapMonthLabel.textContent = formatMonth(currentHeatmapMonth);
      els.heatmapChart.dataset.monthlyTaskDuration = String(monthlyTaskSummary.monthlyTaskDuration);
      els.heatmapChart.dataset.monthlyEarnedCoinsFromTasks = String(monthlyTaskSummary.monthlyEarnedCoinsFromTasks);
      els.heatmapChart.innerHTML = `
        <div class="calendar-heatmap">
          <div class="calendar-weekdays" aria-hidden="true">
            ${weekdays.map(day => `<span>${day}</span>`).join("")}
          </div>
          <div class="calendar-grid">
            ${Array.from({ length: leadingDays }, () => `<span class="calendar-empty" aria-hidden="true"></span>`).join("")}
            ${heatRows.map(row => {
              const level = calendarDayClass(row, maxNet, maxLoss);
              const todayClass = row.key === today ? " today" : "";
              const behaviorNet = Number(row.behaviorNet) || 0;
              const netLabel = behaviorNet > 0 ? `+${formatCoinAmount(behaviorNet)}` : formatCoinAmount(behaviorNet);
              const title = row.hasBehaviorRecord
                ? `${formatFullDateKey(row.key)}：表现净值 ${netLabel}，完成 ${row.completed}，负向 ${row.failed + row.badHabits} 条`
                : `${formatFullDateKey(row.key)}：无记录`;
              const hasDetail = dayHasEditableRecords(row.key);
              return `<button class="calendar-day ${level}${todayClass}" type="button" data-day-detail="${escapeAttr(row.key)}" data-day-has-detail="${hasDetail ? "true" : "false"}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><span>${row.day}</span></button>`;
            }).join("")}
          </div>
        </div>
      `;
    }

    function trendWidth(rows) {
      if (rows.length <= 7) return 320;
      if (rows.length <= 30) return 620;
      return 1240;
    }

    function datePartsFromKey(key) {
      const [year, month, day] = String(key || "").split("-").map(Number);
      return { year, month, day };
    }

    function trendDateLabel(row, rows) {
      const { month, day } = datePartsFromKey(row.key);
      if (!month || !day) return row.label || "";
      if (rows.length > 30 && day === 1) return `${month}月`;
      if (rows.length > 30) return `${month}/${day}`;
      return `${month}/${day}`;
    }

    function trendDateTickIndexes(rows) {
      if (rows.length <= 7) return rows.map((_, index) => index);
      if (rows.length <= 30) {
        const indexes = [];
        for (let index = 0; index < rows.length; index += 5) indexes.push(index);
        if (indexes[indexes.length - 1] !== rows.length - 1) indexes.push(rows.length - 1);
        return indexes;
      }

      const indexes = [];
      rows.forEach((row, index) => {
        const { day } = datePartsFromKey(row.key);
        if (day === 1) indexes.push(index);
      });
      return indexes.length ? indexes : [0, rows.length - 1];
    }

    function trendDateAxisHtml(rows, padX, xStep) {
      const lastIndex = rows.length - 1;
      const ticks = trendDateTickIndexes(rows);
      return `
        <div class="trend-date-axis" aria-label="趋势日期标注">
          ${ticks.map(index => {
            const row = rows[index];
            const x = padX + index * xStep;
            const edgeClass = index === 0 ? " edge-start" : index === lastIndex ? " edge-end" : "";
            return `<span class="trend-date-tick${edgeClass}" style="left: ${x.toFixed(1)}px;">${escapeHtml(trendDateLabel(row, rows))}</span>`;
          }).join("")}
        </div>
      `;
    }

    function buildHabitTrendSeries(rows) {
      return {
        labels: rows.map(row => trendDateLabel(row, rows)),
        completedSeries: rows.map(row => Math.max(0, Number(row.completed) || 0)),
        failureSeries: rows.map(row => Math.max(0, Number(row.badHabits) || 0)),
        focusSeries: rows.map(row => Math.max(0, (Number(row.focusSeconds) || 0) / 60))
      };
    }

    function renderHabitTrend(rows) {
      const width = trendWidth(rows);
      const series = buildHabitTrendSeries(rows);
      const activitySpread = Math.max(1, ...series.completedSeries, ...series.failureSeries);
      const focusSpread = Math.max(1, ...series.focusSeries);
      const hasData = [...series.completedSeries, ...series.failureSeries, ...series.focusSeries]
        .some(value => value > 0);
      const ticks = new Set(trendDateTickIndexes(rows));
      const focusSeconds = rows.reduce((total, row) => total + row.focusSeconds, 0);
      const completedTotal = rows.reduce((total, row) => total + row.completed, 0);
      const badTotal = rows.reduce((total, row) => total + row.badHabits, 0);
      const summaryHasData = completedTotal > 0 || badTotal > 0 || focusSeconds > 0;
      if (summaryHasData && !hasData && ["localhost", "127.0.0.1"].includes(window.location?.hostname)) {
        console.warn("Habit trend summary contains data but all chart series are empty.");
      }
      const gridTemplate = `repeat(${rows.length}, minmax(4px, 1fr))`;
      els.habitTrendChart.innerHTML = `
        <div class="habit-bar-chart stats-trend-chart" style="--trend-width: ${width}px;">
          <div class="habit-bar-grid stats-trend-chart__plot" style="grid-template-columns: ${gridTemplate};" role="img" aria-label="习惯趋势柱状图">
            ${hasData ? rows.map((row, index) => {
              const completed = series.completedSeries[index];
              const failed = series.failureSeries[index];
              const focusMinutes = series.focusSeries[index];
              const completedHeight = completed > 0 ? Math.max(8, (completed / activitySpread) * 100) : 0;
              const badHeight = failed > 0 ? Math.max(8, (failed / activitySpread) * 100) : 0;
              const focusHeight = focusMinutes > 0 ? Math.max(8, (focusMinutes / focusSpread) * 100) : 0;
              const title = `${series.labels[index]}：完成 ${completed}，坏习惯 ${failed} 次，专注 ${formatNumber(focusMinutes)} 分钟`;
              return `
                <div class="habit-bar-day stats-trend-chart__day" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}">
                  <div class="habit-bar-group stats-trend-chart__bar-group">
                    <span class="habit-bar good stats-trend-chart__bar stats-trend-chart__bar--completed" style="height: ${completedHeight.toFixed(1)}%;"></span>
                    <span class="habit-bar bad stats-trend-chart__bar stats-trend-chart__bar--failure" style="height: ${badHeight.toFixed(1)}%;"></span>
                    <span class="habit-bar focus stats-trend-chart__bar stats-trend-chart__bar--focus" style="height: ${focusHeight.toFixed(1)}%;"></span>
                  </div>
                </div>
              `;
            }).join("") : `<div class="stats-trend-chart__empty">该周期暂无记录</div>`}
          </div>
          <div class="habit-bar-axis" style="grid-template-columns: ${gridTemplate};" aria-label="趋势日期标注">
            ${rows.map((row, index) => `<span>${ticks.has(index) ? escapeHtml(trendDateLabel(row, rows)) : ""}</span>`).join("")}
          </div>
          <div class="trend-summary">
            完成 ${formatNumber(completedTotal)} · 坏习惯 ${formatNumber(badTotal)}
            <span>本周期专注：${escapeHtml(formatFocusDuration(focusSeconds))}</span>
          </div>
        </div>
      `;
    }

    function lastDays(count) {
      const days = [];
      const formatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
      for (let index = count - 1; index >= 0; index -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - index);
        days.push({
          key: dateKey(date),
          label: formatter.format(date)
        });
      }
      return days;
    }
