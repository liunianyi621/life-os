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

    function dayHasEditableRecords(day) {
      return state.history.some(item => item.date === day && (
        DAY_DETAIL_HISTORY_TYPES.has(item.type) || isRewardPageEvent(item)
      ))
        || Boolean(priorityTaskForDate(day))
        || Boolean(state.dailyReviews?.[day]);
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
        if (item.date !== day) return;
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

    function dayRecordDeleteButtonHtml(recordId, label = "删除这条记录") {
      if (!recordId) return "";
      return iconActionButtonHtml({
        className: "detail-action-button icon-only-button",
        icon: "minus.circle",
        label,
        attrs: `data-delete-day-record="${escapeAttr(recordId)}"`
      });
    }

    function detailListHtml(items, emptyText, amountForItem, actionForItem = null) {
      if (!items.length) {
        return `<p class="detail-empty">${escapeHtml(emptyText)}</p>`;
      }
      return `
        <div class="detail-list">
          ${items.map(item => {
            const time = historyTimeLabel(item.timestamp);
            return `
              <div class="detail-item detail-record-card">
                <span class="detail-item-main">
                  ${escapeHtml(item.name || "未命名")}
                  ${time ? `<small>${escapeHtml(time)}</small>` : ""}
                </span>
                <span class="detail-item-side">
                  ${signedAmountHtml(amountForItem(item))}
                  ${actionForItem ? actionForItem(item) : ""}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function historyRecordActionHtml(item) {
      return dayRecordDeleteButtonHtml(item.id);
    }

    function detailSectionHtml(title, count, body) {
      return `
        <section class="detail-section">
          <div class="detail-section-title">
            <span>${escapeHtml(title)}</span>
            <span>${formatNumber(count)} 条</span>
          </div>
          ${body}
        </section>
      `;
    }

    function priorityTaskDetailHtml(day) {
      const task = priorityTaskForDate(day);
      if (!task) {
        return `<p class="detail-empty">当天没有设置今天最重要的一件事。</p>`;
      }
      const statusLabel = task.status === "done"
        ? "已完成"
        : task.status === "failed"
          ? "未完成，已扣除"
          : "未完成";
      const historyId = task.status === "done"
        ? task.rewardHistoryId
        : task.status === "failed"
          ? task.penaltyHistoryId
          : null;
      const historyEntry = historyId
        ? state.history.find(item => item.id === historyId)
        : null;
      const amount = historyEntry
        ? historyCoinDelta(historyEntry)
        : task.status === "done"
          ? priorityTaskSettlementAmount("done")
          : task.status === "failed"
            ? -priorityTaskSettlementAmount("failed")
            : 0;
      return `
        <div class="detail-list">
          <div class="detail-item detail-record-card">
            <span class="detail-item-main">
              ${escapeHtml(task.title)}
              <small>${escapeHtml(statusLabel)}</small>
            </span>
            <span class="detail-item-side">
              ${amount ? signedAmountHtml(amount) : `<span class="detail-amount">0.00</span>`}
              ${dayRecordDeleteButtonHtml(`priority:${day}`)}
            </span>
          </div>
        </div>
      `;
    }

    function dayReviewDetailHtml(day) {
      const review = state.dailyReviews?.[day];
      if (!review || (!review.best && !review.mistake && !review.priority)) {
        return `<p class="detail-empty">当天没有保存每日复盘。</p>`;
      }
      return `
        <div class="detail-list">
          <div class="detail-item detail-record-card detail-record-stack">
            <span class="detail-item-main">
              每日复盘
              <small>已保存</small>
            </span>
            <span class="detail-item-side">
              ${dayRecordDeleteButtonHtml(`review:${day}`)}
            </span>
            <div class="detail-record-body">
              ${reviewAnswerHtml("今天做得最好的事情是什么？", review.best)}
              ${reviewAnswerHtml("今天最大的失误是什么？", review.mistake)}
              ${reviewAnswerHtml("明天最重要的一件事是什么？", review.priority)}
            </div>
          </div>
        </div>
      `;
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
        ${detailSectionHtml(
          "完成任务",
          summary.completed.length,
          detailListHtml(summary.completed, "当天没有完成任务。", item => taskEarnedCoinsFromItem(item), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "完成习惯",
          summary.habits.length,
          detailListHtml(summary.habits, "当天没有完成习惯。", item => parseAmount(item.coins), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "今天最重要的一件事",
          priorityTaskForDate(day) ? 1 : 0,
          priorityTaskDetailHtml(day)
        )}
        ${detailSectionHtml(
          "失败任务",
          summary.failed.length,
          detailListHtml(summary.failed, "当天没有失败任务。", item => -(item.type === "task_failed" ? parseCoinAmount(item.coins) : parseAmount(item.coins)), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "失败习惯",
          summary.failedHabits.length,
          detailListHtml(summary.failedHabits, "当天没有失败习惯。", item => -parseCoinAmount(item.coins), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "坏习惯记录",
          summary.badHabits.length,
          detailListHtml(
            summary.badHabits,
            "当天没有坏习惯记录。",
            item => -parseAmount(item.coins),
            historyRecordActionHtml
          )
        )}
        ${detailSectionHtml(
          "基金注入",
          summary.rewards.length,
          detailListHtml(summary.rewards, "当天没有基金注入记录。", item => coinEventFinancialDelta(item), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "复盘奖励",
          summary.reviewRewards.length,
          detailListHtml(summary.reviewRewards, "当天没有复盘奖励。", item => parseCoinAmount(item.coins), historyRecordActionHtml)
        )}
        ${detailSectionHtml(
          "无坏习惯奖励",
          summary.noBadHabitBonuses.length,
          detailListHtml(summary.noBadHabitBonuses, "当天没有无坏习惯奖励。", item => parseCoinAmount(item.coins), historyRecordActionHtml)
        )}
        ${detailSectionHtml("每日复盘", state.dailyReviews?.[day] ? 1 : 0, dayReviewDetailHtml(day))}
      `;
    }

    function openDayDetail(day) {
      const { month, day: dayNumber } = datePartsFromKey(day);
      els.dayDetailTitle.textContent = month && dayNumber ? `${month}月${dayNumber}日 · 当天记录` : "当天记录";
      els.dayDetailContent.innerHTML = buildDayDetailHtml(day);
      syncSheetViewport();
      els.dayDetailBackdrop.classList.remove("hidden");
      els.dayDetailBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
    }

    function closeDayDetail() {
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

    function renderHabitTrend(rows) {
      const width = trendWidth(rows);
      const values = rows.flatMap(row => [row.completed, row.badHabits]);
      const spread = Math.max(1, ...values);
      const ticks = new Set(trendDateTickIndexes(rows));
      const focusSeconds = rows.reduce((total, row) => total + row.focusSeconds, 0);
      const completedTotal = rows.reduce((total, row) => total + row.completed, 0);
      const badTotal = rows.reduce((total, row) => total + row.badHabits, 0);
      const gridTemplate = `repeat(${rows.length}, minmax(4px, 1fr))`;
      els.habitTrendChart.innerHTML = `
        <div class="habit-bar-chart" style="--trend-width: ${width}px;">
          <div class="habit-bar-grid" style="grid-template-columns: ${gridTemplate};" role="img" aria-label="习惯趋势柱状图">
            ${rows.map(row => {
              const completedHeight = row.completed > 0 ? Math.max(8, (row.completed / spread) * 100) : 0;
              const badHeight = row.badHabits > 0 ? Math.max(8, (row.badHabits / spread) * 100) : 0;
              const title = `${trendDateLabel(row, rows)}：完成 ${row.completed}，坏习惯 ${row.badHabits} 次`;
              return `
                <div class="habit-bar-day" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}">
                  <div class="habit-bar-group">
                    <span class="habit-bar good" style="height: ${completedHeight.toFixed(1)}%;"></span>
                    <span class="habit-bar bad" style="height: ${badHeight.toFixed(1)}%;"></span>
                  </div>
                </div>
              `;
            }).join("")}
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
