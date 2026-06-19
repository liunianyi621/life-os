    function swipeRowHtml({ attrs = "", actionWidth = 84, actions = "", content = "", editType = "", editId = "", extraClass = "" }) {
      const editAttrs = editType && editId
        ? ` data-edit-card="${escapeAttr(editType)}" data-edit-id="${escapeAttr(editId)}"`
        : "";
      return `
        <article class="swipe-row ${extraClass}" data-swipe-row style="--swipe-width: ${actionWidth}px;" ${attrs}>
          <div class="card swipe-card" data-swipe-content${editAttrs}>
            ${content}
            ${actions ? `<div class="inline-card-actions" aria-label="快捷操作">${actions}</div>` : ""}
          </div>
        </article>
      `;
    }
    function swipeRowWidth(row) {
      const value = getComputedStyle(row).getPropertyValue("--swipe-width").trim();
      return Number(value.replace("px", "")) || 84;
    }

    const actionIcons = {
      "checkmark.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="m8.55 12.18 2.18 2.18 4.82-5.08"></path>
        </svg>
      `,
      "xmark.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="m9.3 9.3 5.4 5.4"></path>
          <path d="m14.7 9.3-5.4 5.4"></path>
        </svg>
      `,
      "minus.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="M8.6 12h6.8"></path>
        </svg>
      `,
      gift: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M5.5 10h13"></path>
          <path d="M6.6 10v8.3h10.8V10"></path>
          <path d="M12 10v8.3"></path>
          <path d="M12 10c-2.5 0-4.05-.85-4.05-2.2 0-.98.78-1.75 1.84-1.75 1.44 0 2.21 1.55 2.21 3.95Z"></path>
          <path d="M12 10c2.5 0 4.05-.85 4.05-2.2 0-.98-.78-1.75-1.84-1.75-1.44 0-2.21 1.55-2.21 3.95Z"></path>
        </svg>
      `
    };

    function actionButtonHtml({ tone, icon, label, attrs = "", disabled = false }) {
      const disabledAttr = disabled ? " disabled" : "";
      return `
        <button class="swipe-action ${tone}" type="button" ${attrs}${disabledAttr} aria-label="${escapeAttr(label)}">
          <span class="action-icon" aria-hidden="true">${actionIcons[icon] || ""}</span>
        </button>
      `;
    }

    function setSwipeOffset(row, offset) {
      row.style.setProperty("--swipe-offset", `${Math.round(offset)}px`);
    }

    function closeSwipeRow(row) {
      if (!row) return;
      row.classList.remove("swipe-open", "swiping");
      setSwipeOffset(row, 0);
    }

    function openSwipeRow(row) {
      if (!row) return;
      closeOpenSwipeRows(row);
      row.classList.remove("swiping");
      row.classList.add("swipe-open");
      setSwipeOffset(row, -swipeRowWidth(row));
    }

    function closeOpenSwipeRows(exceptRow = null) {
      document.querySelectorAll("[data-swipe-row].swipe-open").forEach(row => {
        if (row !== exceptRow) closeSwipeRow(row);
      });
    }

    function handleEditCardTap(card) {
      const editId = card.dataset.editId;
      if (!editId) return;
      if (card.dataset.editCard === "task") openTaskSheet(editId);
      if (card.dataset.editCard === "habit") openHabitSheet(editId);
      if (card.dataset.editCard === "bad") openBadHabitSheet(editId);
      if (card.dataset.editCard === "reward") openRewardSheet(editId);
    }

    function triggerLongPressEdit(press) {
      if (!press?.card) return;
      press.triggered = true;
      suppressNextCardTap = true;
      press.row?.classList.add("long-press-active");
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
      handleEditCardTap(press.card);
      window.setTimeout(() => {
        press.row?.classList.remove("long-press-active");
      }, 220);
    }

    function clearActivePress() {
      if (!activeSwipe) return null;
      const press = activeSwipe;
      activeSwipe = null;
      clearTimeout(press.timer);
      press.card?.releasePointerCapture?.(press.pointerId);
      return press;
    }

    function beginSwipe(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const card = event.target.closest("[data-edit-card]");
      if (!card) return;
      const row = card.closest("[data-swipe-row]");
      if (!row) return;

      activeSwipe = {
        row,
        card,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        triggered: false,
        timer: window.setTimeout(() => {
          if (activeSwipe?.pointerId === event.pointerId) triggerLongPressEdit(activeSwipe);
        }, 580)
      };
      card.setPointerCapture?.(event.pointerId);
    }

    function moveSwipe(event) {
      if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
      const deltaX = event.clientX - activeSwipe.startX;
      const deltaY = event.clientY - activeSwipe.startY;
      if (Math.hypot(deltaX, deltaY) > 12) clearActivePress();
    }

    function endSwipe(event) {
      if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
      const press = clearActivePress();
      if (press?.triggered) {
        window.setTimeout(() => {
          suppressNextCardTap = false;
        }, 0);
      }
    }
    function render() {
      const activeCount = activeTasksToday().length;
      const visibleHabitCount = visibleHabitsToday().length;

      els.todayDate.textContent = formatDate();
      updatePrimaryReadouts();
      els.habitCount.textContent = `${visibleHabitCount} 项`;
      els.todayTaskCount.textContent = `${activeCount} 项`;
      els.badHabitCount.textContent = `${state.badHabits.length} 项`;
      els.noteCount.textContent = `${state.notes.length} 条`;
      els.rewardCount.textContent = `${state.rewards.length} 项`;

      renderHabits();
      renderTasks();
      renderBadHabits();
      renderNotes();
      renderDailyReview();
      renderRewards();
      renderStatsVisuals();
    }

    function renderHabits() {
      if (!state.habits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>还没有习惯</strong>
            <p>添加一个每天固定出现的长期习惯。</p>
            <button class="icon-button empty-icon-action" data-open-habit aria-label="添加习惯">
              <span class="icon-plus" aria-hidden="true"></span>
            </button>
          </div>
        `;
        return;
      }

      const activeHabits = visibleHabitsToday();
      if (!activeHabits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>今日习惯已清空</strong>
            <p>完成的习惯已经收起，明天会自动重新出现。</p>
          </div>
        `;
        return;
      }

      els.habitList.innerHTML = activeHabits.map(habit => swipeRowHtml({
        attrs: `data-habit-card="${escapeAttr(habit.id)}"`,
        editType: "habit",
        editId: habit.id,
        actions: actionButtonHtml({
          tone: "green",
          icon: "checkmark.circle",
          label: "习惯达成",
          attrs: `data-complete-habit="${escapeAttr(habit.id)}"`
        }),
        content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(habit.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(parseAmount(habit.coins))} 金币</span>
                </div>
              </div>
            </div>
        `
      })).join("");
    }

    function renderTasks() {
      const tasksForToday = todayTasks();
      if (!tasksForToday.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今天没有任务</strong>
            <p>添加一个你今天必须完成的任务。</p>
            <button class="button empty-action" data-open-task>新建任务</button>
          </div>
        `;
        return;
      }

      const activeTasks = tasksForToday.filter(task => !taskResultToday(task.id));
      if (!activeTasks.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今日任务已清空</strong>
            <p>今天的选择已经记录。明天会重新开始。</p>
          </div>
        `;
        return;
      }

      els.todayTaskList.innerHTML = groupedActiveTasks(activeTasks).map(group => `
        <section class="task-time-group">
          <div class="task-time-heading">${escapeHtml(group.label)}</div>
          <div class="task-time-list">
            ${group.tasks.map(task => swipeRowHtml({
              attrs: `data-task-card="${escapeAttr(task.id)}"`,
              actionWidth: 168,
              editType: "task",
              editId: task.id,
              actions: `
                ${actionButtonHtml({
                  tone: "green",
                  icon: "checkmark.circle",
                  label: "任务达成",
                  attrs: `data-complete-task="${escapeAttr(task.id)}"`
                })}
                ${actionButtonHtml({
                  tone: "red",
                  icon: "xmark.circle",
                  label: "任务未达成",
                  attrs: `data-fail-task="${escapeAttr(task.id)}"`
                })}
              `,
              content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(task.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(parseAmount(task.coins))} 金币</span>
                </div>
              </div>
            </div>
              `
            })).join("")}
          </div>
        </section>
      `).join("");
    }

    function renderBadHabits() {
      if (!state.badHabits.length) {
        els.badHabitList.innerHTML = `
          <div class="empty-state">
            <strong>没有坏习惯</strong>
            <p>添加一个需要立刻付出代价的行为。</p>
            <button class="button empty-action" data-open-bad>新建坏习惯</button>
          </div>
        `;
        return;
      }

      els.badHabitList.innerHTML = state.badHabits.map(habit => swipeRowHtml({
        attrs: `data-habit-card="${escapeAttr(habit.id)}" data-bad-card="${escapeAttr(habit.id)}"`,
        editType: "bad",
        editId: habit.id,
        actions: actionButtonHtml({
          tone: "orange",
          icon: "minus.circle",
          label: "坏习惯扣金币",
          attrs: `data-trigger-bad="${escapeAttr(habit.id)}"`
        }),
        content: `
          <div class="card-main">
            <div class="title-wrap">
                <h3>${escapeHtml(habit.name)}</h3>
                <div class="meta-row">
                <span class="pill coin-pill">${formatNumber(parseAmount(habit.penalty))} 金币</span>
                </div>
              </div>
          </div>
        `
      })).join("");
    }

    function renderNotes() {
      if (!state.notes.length) {
        els.noteList.innerHTML = `
          <div class="empty-state">
            <strong>没有笔记</strong>
            <p>写下一个简单提醒。</p>
            <button class="button empty-action" data-open-note>新建笔记</button>
          </div>
        `;
        return;
      }

      els.noteList.innerHTML = state.notes.map(note => `
        <article class="card note-card">
          <div class="card-main">
            <div class="title-wrap">
              <p>${escapeHtml(note.text)}</p>
            </div>
            <button class="text-button" data-edit-note="${note.id}">编辑</button>
          </div>
        </article>
      `).join("");
    }

    function reviewAnswerHtml(label, value) {
      const isEmpty = !String(value || "").trim();
      return `
        <div class="review-answer ${isEmpty ? "empty" : ""}">
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(isEmpty ? "未填写" : value)}</p>
        </div>
      `;
    }

    function renderDailyReview(options = {}) {
      const reviewDate = setSelectedReviewDate(selectedReviewDate);
      const selectedReview = dailyReviewForDate(reviewDate);
      const today = dateKey();
      const history = sortedDailyReviews(true);
      const shouldClearInputs = options.clearInputs === true;

      els.reviewDate.textContent = formatReviewDateLabel(reviewDate);
      if (els.reviewDateInput) {
        els.reviewDateInput.value = reviewDate;
        els.reviewDateInput.max = today;
      }
      els.reviewBest.value = shouldClearInputs ? "" : selectedReview.best || "";
      els.reviewMistake.value = shouldClearInputs ? "" : selectedReview.mistake || "";
      els.reviewPriority.value = shouldClearInputs ? "" : selectedReview.priority || "";
      els.reviewHistoryCount.textContent = `${history.length} 条`;

      if (!history.length) {
        els.reviewHistoryList.innerHTML = `
          <div class="empty-state">
            <strong>还没有历史复盘</strong>
            <p>保存今天的复盘后，明天会自动进入历史。</p>
          </div>
        `;
        return;
      }

      els.reviewHistoryList.innerHTML = history.map(([day, review]) => `
        <article class="card review-card">
          <div class="review-card-header">
            <div class="review-date">
              <span class="review-date-label">日期</span>
              <span class="review-date-main">${escapeHtml(day === today ? "今天" : formatFullDateKey(day))}</span>
            </div>
            ${day === today ? `<span class="review-today-pill">今天</span>` : ""}
          </div>
          ${reviewAnswerHtml("今天做得最好的事情是什么？", review.best)}
          ${reviewAnswerHtml("今天最大的失误是什么？", review.mistake)}
          ${reviewAnswerHtml("明天最重要的一件事是什么？", review.priority)}
        </article>
      `).join("");
    }

    function renderRewards() {
      if (!state.rewards.length) {
        els.rewardList.innerHTML = `
          <div class="empty-state">
            <strong>没有奖励</strong>
            <p>添加一个可以用金币兑换的奖励。</p>
            <button class="button empty-action" data-open-reward>新建奖励</button>
          </div>
        `;
        return;
      }

      els.rewardList.innerHTML = state.rewards.map(reward => {
        const cost = parseAmount(reward.cost);
        const affordable = state.coins >= cost;
        return swipeRowHtml({
          attrs: `data-reward-card="${escapeAttr(reward.id)}"`,
          editType: "reward",
          editId: reward.id,
          actions: actionButtonHtml({
            tone: "blue",
            icon: "gift",
            label: affordable ? "使用奖励" : "金币不足",
            attrs: `data-redeem-reward="${escapeAttr(reward.id)}"`,
            disabled: !affordable
          }),
          content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(reward.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(cost)} 金币</span>
                </div>
              </div>
            </div>
          `
        });
      }).join("");
    }

    document.addEventListener("pointerdown", beginSwipe);
    document.addEventListener("pointermove", moveSwipe, { passive: false });
    document.addEventListener("pointerup", endSwipe);
    document.addEventListener("pointercancel", endSwipe);

    document.addEventListener("click", event => {
      const undoButton = event.target.closest("[data-undo-action]");
      const swipeActionButton = event.target.closest(".swipe-action");
      const swipeContent = event.target.closest("[data-swipe-content]");
      const editCard = event.target.closest("[data-edit-card]");
      const navButton = event.target.closest("[data-nav]");
      const openTaskButton = event.target.closest("[data-open-task]");
      const openHabitButton = event.target.closest("[data-open-habit]");
      const openBadButton = event.target.closest("[data-open-bad]");
      const openNoteButton = event.target.closest("[data-open-note]");
      const openRewardButton = event.target.closest("[data-open-reward]");
      const editTaskButton = event.target.closest("[data-edit-task]");
      const editHabitButton = event.target.closest("[data-edit-habit]");
      const editBadButton = event.target.closest("[data-edit-bad]");
      const editNoteButton = event.target.closest("[data-edit-note]");
      const editRewardButton = event.target.closest("[data-edit-reward]");
      const completeTaskButton = event.target.closest("[data-complete-task]");
      const completeHabitButton = event.target.closest("[data-complete-habit]");
      const failTaskButton = event.target.closest("[data-fail-task]");
      const triggerBadButton = event.target.closest("[data-trigger-bad]");
      const redeemRewardButton = event.target.closest("[data-redeem-reward]");
      const statsRangeButton = event.target.closest("[data-stats-range]");
      const heatMonthButton = event.target.closest("[data-heat-month]");
      const dayDetailButton = event.target.closest("[data-day-detail]");
      const closeButton = event.target.closest("[data-close-sheet]");
      const deleteTaskButton = event.target.closest("[data-delete-task]");
      const deleteHabitButton = event.target.closest("[data-delete-habit]");
      const deleteBadButton = event.target.closest("[data-delete-bad]");
      const deleteNoteButton = event.target.closest("[data-delete-note]");
      const deleteRewardButton = event.target.closest("[data-delete-reward]");

      if (undoButton) {
        undoLastAction();
        return;
      }
      if (!event.target.closest("[data-swipe-row]")) {
        closeOpenSwipeRows();
      }
      if (suppressNextCardTap && (swipeContent || editCard)) {
        suppressNextCardTap = false;
        return;
      }
      if (navButton) switchView(navButton.dataset.nav);
      if (openTaskButton) openTaskSheet();
      if (openHabitButton) openHabitSheet();
      if (openBadButton) openBadHabitSheet();
      if (openNoteButton) openNoteSheet();
      if (openRewardButton) openRewardSheet();
      if (editTaskButton) openTaskSheet(editTaskButton.dataset.editTask);
      if (editHabitButton) openHabitSheet(editHabitButton.dataset.editHabit);
      if (editBadButton) openBadHabitSheet(editBadButton.dataset.editBad);
      if (editNoteButton) openNoteSheet(editNoteButton.dataset.editNote);
      if (editRewardButton) openRewardSheet(editRewardButton.dataset.editReward);
      if (completeTaskButton) {
        completeTask(completeTaskButton.dataset.completeTask, completeTaskButton.closest("[data-task-card]"));
      }
      if (completeHabitButton) {
        completeHabit(completeHabitButton.dataset.completeHabit, completeHabitButton.closest("[data-habit-card]"));
      }
      if (failTaskButton) {
        failTask(failTaskButton.dataset.failTask, failTaskButton.closest("[data-task-card]"));
      }
      if (triggerBadButton) {
        triggerBadHabit(triggerBadButton.dataset.triggerBad, triggerBadButton.closest("[data-habit-card]"));
      }
      if (redeemRewardButton) {
        redeemReward(
          redeemRewardButton.dataset.redeemReward,
          redeemRewardButton.closest("[data-reward-card]"),
          redeemRewardButton
        );
      }
      if (statsRangeButton) {
        currentStatsRange = statsRangeButton.dataset.statsRange;
        document.querySelectorAll("[data-stats-range]").forEach(button => {
          button.classList.toggle("active", button === statsRangeButton);
        });
        renderHabitTrend(buildStatsRows(currentStatsRange));
      }
      if (heatMonthButton) {
        currentHeatmapMonth = shiftMonthKey(
          currentHeatmapMonth,
          heatMonthButton.dataset.heatMonth === "next" ? 1 : -1
        );
        renderHeatmap();
      }
      if (dayDetailButton) openDayDetail(dayDetailButton.dataset.dayDetail);
      if (closeButton) closeSheet();
      if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
      if (deleteHabitButton) deleteHabit(deleteHabitButton.dataset.deleteHabit);
      if (deleteBadButton) deleteBadHabit(deleteBadButton.dataset.deleteBad);
      if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
      if (deleteRewardButton) deleteReward(deleteRewardButton.dataset.deleteReward);
    });

    els.closeSheetBtn.addEventListener("click", closeSheet);
    els.sheetBackdrop.addEventListener("click", event => {
      if (event.target === els.sheetBackdrop) closeSheet();
    });
    els.closeDayDetailBtn.addEventListener("click", closeDayDetail);
    els.dayDetailBackdrop.addEventListener("click", event => {
      if (event.target === els.dayDetailBackdrop) closeDayDetail();
    });
    els.confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
    els.confirmAcceptBtn.addEventListener("click", () => closeConfirm(true));
    els.confirmBackdrop.addEventListener("click", event => {
      if (event.target === els.confirmBackdrop) closeConfirm(false);
    });
    els.sheetForm.addEventListener("submit", handleSheetSubmit);
    els.reviewDateButton.addEventListener("click", () => {
      if (!els.reviewDateInput) return;
      els.reviewDateInput.value = selectedReviewDate;
      els.reviewDateInput.max = dateKey();
      if (typeof els.reviewDateInput.showPicker === "function") {
        els.reviewDateInput.showPicker();
        return;
      }
      els.reviewDateInput.focus();
    });
    els.reviewDateInput.addEventListener("change", event => {
      const nextDate = setSelectedReviewDate(event.target.value);
      event.target.value = nextDate;
      renderDailyReview();
    });
    els.dailyReviewForm.addEventListener("submit", event => {
      event.preventDefault();
      const formData = new FormData(els.dailyReviewForm);
      saveDailyReview({
        best: formData.get("best"),
        mistake: formData.get("mistake"),
        priority: formData.get("priority")
      }, selectedReviewDate);
    });
    els.resetAllBtn.addEventListener("click", () => {
      const confirmed = confirm("确定要重置所有数据吗？此操作会清空当前浏览器中的全部记录。");
      if (confirmed) resetAllData();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!els.confirmBackdrop.classList.contains("hidden")) {
          closeConfirm(false);
          return;
        }
        if (!els.dayDetailBackdrop.classList.contains("hidden")) {
          closeDayDetail();
          return;
        }
        if (!els.sheetBackdrop.classList.contains("hidden")) {
          closeSheet();
        }
      }
    });

    render();
