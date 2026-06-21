    function renderStatsVisuals() {
      const rows = buildStatsRows(currentStatsRange);
      renderHeatmap();
      renderHabitTrend(rows);
    }

    function buildStatsRows(range) {
      const periods = lastDays(range === "year" ? 365 : range === "month" ? 30 : 7);
      const rows = periods.map(period => ({
        key: period.key,
        label: period.label,
        completed: 0,
        failed: 0,
        badHabits: 0,
        earned: 0,
        deducted: 0,
        focusSeconds: 0,
        focusMinutes: 0,
        earnedTaskCoins: 0,
        net: 0,
        score: 0
      }));
      const byKey = new Map(rows.map(row => [row.key, row]));

      state.history.forEach(item => {
        const key = item.date;
        const row = byKey.get(key);
        if (!row) return;

        if (item.type === "task_completed" || item.type === "habit_completed") {
          row.completed += 1;
          row.earned += item.type === "task_completed" ? taskEarnedCoinsFromItem(item) : parseAmount(item.coins);
        }
        if (item.type === "task_completed") {
          row.focusSeconds += taskDurationSecondsFromItem(item);
          row.earnedTaskCoins += taskEarnedCoinsFromItem(item);
        }
        if (item.type === "task_failed" || item.type === "task_missed") {
          row.failed += 1;
          row.deducted += parseAmount(item.coins);
        }
        if (item.type === "bad_habit") {
          row.badHabits += 1;
          row.deducted += parseAmount(item.coins);
        }
        if (item.type === "reward_redeemed") {
          row.deducted += parseAmount(item.cost);
        }
      });

      rows.forEach(row => {
        row.focusMinutes = Math.round(row.focusSeconds / 60);
        row.net = row.earned - row.deducted;
        row.score = row.completed - row.failed - row.badHabits;
      });

      return rows;
    }

    function buildMonthlyHeatRows(month) {
      const monthStart = monthDateFromKey(month);
      const year = monthStart.getFullYear();
      const monthIndex = monthStart.getMonth();
      const dayCount = new Date(year, monthIndex + 1, 0).getDate();
      const rows = Array.from({ length: dayCount }, (_, index) => {
        const date = new Date(year, monthIndex, index + 1);
        return {
          key: dateKey(date),
          day: index + 1,
          completed: 0,
          failed: 0,
          badHabits: 0,
          earned: 0,
          deducted: 0,
          focusSeconds: 0,
          focusMinutes: 0,
          earnedTaskCoins: 0,
          net: 0,
          hasRecord: false
        };
      });
      const byKey = new Map(rows.map(row => [row.key, row]));

      state.history.forEach(item => {
        const row = byKey.get(item.date);
        if (!row) return;
        row.hasRecord = true;

        if (item.type === "task_completed" || item.type === "habit_completed") {
          row.completed += 1;
          row.earned += item.type === "task_completed" ? taskEarnedCoinsFromItem(item) : parseAmount(item.coins);
        }
        if (item.type === "task_completed") {
          row.focusSeconds += taskDurationSecondsFromItem(item);
          row.earnedTaskCoins += taskEarnedCoinsFromItem(item);
        }
        if (item.type === "task_failed" || item.type === "task_missed") {
          row.failed += 1;
          row.deducted += parseAmount(item.coins);
        }
        if (item.type === "bad_habit") {
          row.badHabits += 1;
          row.deducted += parseAmount(item.coins);
        }
        if (item.type === "reward_redeemed") {
          row.deducted += parseAmount(item.cost);
        }
      });

      rows.forEach(row => {
        row.focusMinutes = Math.round(row.focusSeconds / 60);
        row.net = row.earned - row.deducted;
      });

      return rows;
    }

    function buildMonthlyTaskSummary(month) {
      const rows = buildMonthlyHeatRows(month);
      return {
        monthlyTaskDuration: rows.reduce((total, row) => total + row.focusSeconds, 0),
        monthlyEarnedCoinsFromTasks: parseCoinAmount(rows.reduce((total, row) => total + row.earnedTaskCoins, 0))
      };
    }

    function calendarDayClass(row, maxNet, maxLoss) {
      if (!row.hasRecord) return "empty";
      if (row.net > 0) {
        const ratio = maxNet ? row.net / maxNet : 1;
        if (ratio > 0.75) return "net-4";
        if (ratio > 0.5) return "net-3";
        if (ratio > 0.25) return "net-2";
        return "net-1";
      }
      if (row.net < 0) {
        const loss = Math.abs(row.net);
        const ratio = maxLoss ? loss / maxLoss : 1;
        if (ratio > 0.66) return "bad-3";
        if (ratio > 0.33) return "bad-2";
        return "bad-1";
      }
      return "net-0";
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

    function dayEntries(day, matcher) {
      return state.history.filter(item => item.date === day && matcher(item));
    }

    function dayCoinSummary(day) {
      const completed = dayEntries(day, item => item.type === "task_completed");
      const habits = dayEntries(day, item => item.type === "habit_completed");
      const failed = dayEntries(day, item => item.type === "task_failed" || item.type === "task_missed");
      const badHabits = dayEntries(day, item => item.type === "bad_habit");
      const rewards = dayEntries(day, item => item.type === "reward_redeemed");
      const earned = completed.reduce((sum, item) => sum + taskEarnedCoinsFromItem(item), 0)
        + habits.reduce((sum, item) => sum + parseAmount(item.coins), 0);
      const deducted = failed.reduce((sum, item) => sum + parseAmount(item.coins), 0)
        + badHabits.reduce((sum, item) => sum + parseAmount(item.coins), 0)
        + rewards.reduce((sum, item) => sum + parseAmount(item.cost), 0);
      return {
        completed,
        habits,
        failed,
        badHabits,
        rewards,
        earned,
        deducted,
        net: earned - deducted
      };
    }

    function detailListHtml(items, emptyText, amountForItem) {
      if (!items.length) {
        return `<p class="detail-empty">${escapeHtml(emptyText)}</p>`;
      }
      return `
        <div class="detail-list">
          ${items.map(item => {
            const time = historyTimeLabel(item.timestamp);
            return `
              <div class="detail-item">
                <span>
                  ${escapeHtml(item.name || "未命名")}
                  ${time ? `<small>${escapeHtml(time)}</small>` : ""}
                </span>
                ${signedAmountHtml(amountForItem(item))}
              </div>
            `;
          }).join("")}
        </div>
      `;
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

    function dayReviewDetailHtml(day) {
      const review = state.dailyReviews?.[day];
      if (!review || (!review.best && !review.mistake && !review.priority)) {
        return `<p class="detail-empty">当天没有保存每日复盘。</p>`;
      }
      return `
        <div class="detail-list">
          ${reviewAnswerHtml("今天做得最好的事情是什么？", review.best)}
          ${reviewAnswerHtml("今天最大的失误是什么？", review.mistake)}
          ${reviewAnswerHtml("明天最重要的一件事是什么？", review.priority)}
        </div>
      `;
    }

    function buildDayDetailHtml(day) {
      const summary = dayCoinSummary(day);
      const netTone = summary.net > 0 ? "positive" : summary.net < 0 ? "negative" : "";
      const netPrefix = summary.net > 0 ? "+" : summary.net < 0 ? "-" : "";
      return `
        <div class="detail-summary-grid" aria-label="当天金币变化">
          <div class="detail-metric">
            <span>获得</span>
            <strong class="positive">+${formatNumber(summary.earned)}</strong>
          </div>
          <div class="detail-metric">
            <span>扣除 / 消耗</span>
            <strong class="negative">-${formatNumber(summary.deducted)}</strong>
          </div>
          <div class="detail-metric">
            <span>净变化</span>
            <strong class="${netTone}">${netPrefix}${formatNumber(Math.abs(summary.net))}</strong>
          </div>
        </div>
        ${detailSectionHtml(
          "完成任务",
          summary.completed.length,
          detailListHtml(summary.completed, "当天没有完成任务。", item => taskEarnedCoinsFromItem(item))
        )}
        ${detailSectionHtml(
          "完成习惯",
          summary.habits.length,
          detailListHtml(summary.habits, "当天没有完成习惯。", item => parseAmount(item.coins))
        )}
        ${detailSectionHtml(
          "失败任务",
          summary.failed.length,
          detailListHtml(summary.failed, "当天没有失败任务。", item => -parseAmount(item.coins))
        )}
        ${detailSectionHtml(
          "坏习惯记录",
          summary.badHabits.length,
          detailListHtml(summary.badHabits, "当天没有坏习惯记录。", item => -parseAmount(item.coins))
        )}
        ${detailSectionHtml(
          "奖励兑换",
          summary.rewards.length,
          detailListHtml(summary.rewards, "当天没有奖励兑换记录。", item => -parseAmount(item.cost))
        )}
        ${detailSectionHtml("每日复盘", state.dailyReviews?.[day] ? 1 : 0, dayReviewDetailHtml(day))}
      `;
    }

    function openDayDetail(day) {
      els.dayDetailTitle.textContent = formatFullDateKey(day);
      els.dayDetailContent.innerHTML = buildDayDetailHtml(day);
      els.dayDetailBackdrop.classList.remove("hidden");
      els.dayDetailBackdrop.setAttribute("aria-hidden", "false");
    }

    function closeDayDetail() {
      els.dayDetailBackdrop.classList.add("hidden");
      els.dayDetailBackdrop.setAttribute("aria-hidden", "true");
      els.dayDetailContent.innerHTML = "";
    }

    function renderHeatmap() {
      const rows = buildMonthlyHeatRows(currentHeatmapMonth);
      const monthlyTaskSummary = buildMonthlyTaskSummary(currentHeatmapMonth);
      const monthStart = monthDateFromKey(currentHeatmapMonth);
      const leadingDays = (monthStart.getDay() + 6) % 7;
      const maxNet = Math.max(...rows.map(row => Math.max(0, row.net)), 0);
      const maxLoss = Math.max(...rows.map(row => Math.max(0, -row.net)), 0);
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
            ${rows.map(row => {
              const level = calendarDayClass(row, maxNet, maxLoss);
              const todayClass = row.key === today ? " today" : "";
              const netLabel = row.net > 0 ? `+${formatNumber(row.net)}` : formatNumber(row.net);
              const title = row.hasRecord
                ? `${formatFullDateKey(row.key)}：净金币 ${netLabel}，完成 ${row.completed}，失败 ${row.failed}，坏习惯 ${row.badHabits} 次`
                : `${formatFullDateKey(row.key)}：无记录`;
              return `<button class="calendar-day ${level}${todayClass}" type="button" data-day-detail="${escapeAttr(row.key)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><span>${row.day}</span></button>`;
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
      const height = 168;
      const padX = 14;
      const padY = 18;
      const values = rows.flatMap(row => [row.completed, row.badHabits]);
      const max = Math.max(...values, 0);
      const spread = Math.max(1, max);
      const xStep = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : 0;
      const yForValue = value => height - padY - (value / spread) * (height - padY * 2);
      const pointsFor = key => rows.map((row, index) => {
        const x = padX + index * xStep;
        const y = yForValue(row[key]);
        return { x, y, row };
      });
      const pathFor = points => points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      const completedPoints = pointsFor("completed");
      const badPoints = pointsFor("badHabits");
      const completedPath = pathFor(completedPoints);
      const badPath = pathFor(badPoints);
      const completedStart = completedPoints[0];
      const completedEnd = completedPoints[completedPoints.length - 1];
      const badStart = badPoints[0];
      const badEnd = badPoints[badPoints.length - 1];
      const lastRow = rows[rows.length - 1];
      const focusSeconds = rows.reduce((total, row) => total + row.focusSeconds, 0);
      const zeroY = yForValue(0);
      els.habitTrendChart.innerHTML = `
        <div class="balance-chart" style="--trend-width: ${width}px;">
          <svg class="balance-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="习惯趋势">
            <line class="balance-grid" x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${width - padX}" y2="${zeroY.toFixed(1)}"></line>
            <path class="balance-line good" d="${completedPath}"></path>
            <path class="balance-line bad" d="${badPath}"></path>
            <circle class="balance-point good" cx="${completedStart.x.toFixed(1)}" cy="${completedStart.y.toFixed(1)}" r="4"></circle>
            <circle class="balance-point good" cx="${completedEnd.x.toFixed(1)}" cy="${completedEnd.y.toFixed(1)}" r="4"></circle>
            <circle class="balance-point bad" cx="${badStart.x.toFixed(1)}" cy="${badStart.y.toFixed(1)}" r="4"></circle>
            <circle class="balance-point bad" cx="${badEnd.x.toFixed(1)}" cy="${badEnd.y.toFixed(1)}" r="4"></circle>
          </svg>
          ${trendDateAxisHtml(rows, padX, xStep)}
          <div class="trend-summary">
            完成 ${formatNumber(rows[0].completed)} → ${formatNumber(lastRow.completed)} · 坏习惯 ${formatNumber(rows[0].badHabits)} → ${formatNumber(lastRow.badHabits)}
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
