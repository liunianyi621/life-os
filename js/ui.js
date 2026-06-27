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

    function actionButtonHtml({ tone, icon, label, attrs = "", disabled = false }) {
      return iconActionButtonHtml({
        className: `swipe-action ${tone}`,
        icon,
        label,
        attrs,
        disabled
      });
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
      if (card.dataset.editCard === "note") openNoteSheet(editId);
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
      renderMemoSummary();
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
      if (!els.memoBackdrop.classList.contains("hidden")) renderMemos();
      renderStatsVisuals();
    }

    function renderHabits() {
      if (!state.habits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>还没有习惯</strong>
            <p>添加一个每天固定出现的长期习惯。</p>
            ${iconActionButtonHtml({
              className: "icon-button empty-icon-action",
              icon: "plus",
              label: "添加习惯",
              attrs: "data-open-habit"
            })}
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

    function taskMetaHtml(task, status) {
      if (status === "running") {
        const startedAt = taskStartedAtLabel(task);
        return `
          <span class="pill green">进行中</span>
          ${startedAt ? `<span class="pill">开始于 ${escapeHtml(startedAt)}</span>` : ""}
        `;
      }
      if (taskHasTime(task)) {
        return `<span class="pill coin-pill">${formatCoinAmount(taskRewardAmount(task))} 金币/小时</span>`;
      }
      return `<span class="pill coin-pill">${formatCoinAmount(taskRewardAmount(task))} 金币</span>`;
    }

    function taskActionsHtml(task, status) {
      const taskId = escapeAttr(task.id);
      const failAction = actionButtonHtml({
        tone: "red",
        icon: "xmark.circle",
        label: "任务未完成",
        attrs: `data-fail-task="${taskId}"`
      });
      if (!taskHasTime(task)) {
        return `
          ${actionButtonHtml({
            tone: "green",
            icon: "checkmark.circle",
            label: "完成任务",
            attrs: `data-complete-task="${taskId}"`
          })}
          ${failAction}
        `;
      }
      const primaryAction = status === "running"
        ? actionButtonHtml({
            tone: "green",
            icon: "stop.circle",
            label: "完成计时任务",
            attrs: `data-stop-task="${taskId}"`
          })
        : actionButtonHtml({
            tone: "blue",
            icon: "play.circle",
            label: "开始任务",
            attrs: `data-start-task="${taskId}"`
          });
      return `
        ${primaryAction}
        ${failAction}
      `;
    }

    function renderTasks() {
      const tasksForToday = todayTasks();
      if (!tasksForToday.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今天没有任务</strong>
            <p>添加一个你今天必须完成的任务。</p>
            ${iconActionButtonHtml({
              className: "button icon-only-button empty-action",
              icon: "plus",
              label: "新建任务",
              attrs: "data-open-task"
            })}
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
          ${group.label ? `<div class="task-time-heading">${escapeHtml(group.label)}</div>` : ""}
          <div class="task-time-list">
            ${group.tasks.map(task => {
              const status = taskStatusToday(task);
              return swipeRowHtml({
                attrs: `data-task-card="${escapeAttr(task.id)}"`,
                actionWidth: 168,
                editType: "task",
                editId: task.id,
                actions: taskActionsHtml(task, status),
                content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(task.name)}</h3>
                <div class="meta-row">
                  ${taskMetaHtml(task, status)}
                </div>
              </div>
            </div>
              `
              });
            }).join("")}
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
            ${iconActionButtonHtml({
              className: "button icon-only-button empty-action",
              icon: "plus",
              label: "新建坏习惯",
              attrs: "data-open-bad"
            })}
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
            ${iconActionButtonHtml({
              className: "button icon-only-button empty-action",
              icon: "plus",
              label: "新建笔记",
              attrs: "data-open-note"
            })}
          </div>
        `;
        return;
      }

      els.noteList.innerHTML = state.notes.map(note => `
        <article class="card note-card" data-edit-card="note" data-edit-id="${escapeAttr(note.id)}" role="button" tabindex="0" aria-label="编辑笔记">
          <div class="card-main">
            <div class="title-wrap">
              <p>${escapeHtml(note.text)}</p>
            </div>
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
            ${iconActionButtonHtml({
              className: "button icon-only-button empty-action",
              icon: "plus",
              label: "新建奖励",
              attrs: "data-open-reward"
            })}
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
      const memoSummaryCard = event.target.closest("#memoSummaryCard");
      const toggleMemoButton = event.target.closest("[data-toggle-memo]");
      const editMemoTarget = event.target.closest("[data-edit-memo]");
      const deleteMemoButton = event.target.closest("[data-delete-memo]");
      const editTaskButton = event.target.closest("[data-edit-task]");
      const editHabitButton = event.target.closest("[data-edit-habit]");
      const editBadButton = event.target.closest("[data-edit-bad]");
      const editNoteButton = event.target.closest("[data-edit-note]");
      const editRewardButton = event.target.closest("[data-edit-reward]");
      const completeTaskButton = event.target.closest("[data-complete-task]");
      const startTaskButton = event.target.closest("[data-start-task]");
      const stopTaskButton = event.target.closest("[data-stop-task]");
      const completeHabitButton = event.target.closest("[data-complete-habit]");
      const failTaskButton = event.target.closest("[data-fail-task]");
      const triggerBadButton = event.target.closest("[data-trigger-bad]");
      const redeemRewardButton = event.target.closest("[data-redeem-reward]");
      const statsRangeButton = event.target.closest("[data-stats-range]");
      const heatMonthButton = event.target.closest("[data-heat-month]");
      const dayDetailButton = event.target.closest("[data-day-detail]");
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
      if (navButton) {
        switchView(navButton.dataset.nav);
        if (runAutomaticChecks()) render();
      }
      if (openTaskButton) openTaskSheet();
      if (openHabitButton) openHabitSheet();
      if (openBadButton) openBadHabitSheet();
      if (openNoteButton) openNoteSheet();
      if (openRewardButton) openRewardSheet();
      if (memoSummaryCard) openMemoSheet();
      if (toggleMemoButton) {
        toggleMemo(toggleMemoButton.dataset.toggleMemo);
        return;
      }
      if (editMemoTarget) {
        editMemo(editMemoTarget.dataset.editMemo);
        return;
      }
      if (deleteMemoButton) {
        deleteMemo(deleteMemoButton.dataset.deleteMemo);
        return;
      }
      if (editCard?.dataset.editCard === "note") handleEditCardTap(editCard);
      if (editTaskButton) openTaskSheet(editTaskButton.dataset.editTask);
      if (editHabitButton) openHabitSheet(editHabitButton.dataset.editHabit);
      if (editBadButton) openBadHabitSheet(editBadButton.dataset.editBad);
      if (editNoteButton) openNoteSheet(editNoteButton.dataset.editNote);
      if (editRewardButton) openRewardSheet(editRewardButton.dataset.editReward);
      if (completeTaskButton) {
        completeTask(completeTaskButton.dataset.completeTask, completeTaskButton.closest("[data-task-card]"));
      }
      if (startTaskButton) {
        startTask(startTaskButton.dataset.startTask, startTaskButton.closest("[data-task-card]"));
      }
      if (stopTaskButton) {
        finishTask(stopTaskButton.dataset.stopTask, stopTaskButton.closest("[data-task-card]"));
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
      if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
      if (deleteHabitButton) deleteHabit(deleteHabitButton.dataset.deleteHabit);
      if (deleteBadButton) deleteBadHabit(deleteBadButton.dataset.deleteBad);
      if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
      if (deleteRewardButton) deleteReward(deleteRewardButton.dataset.deleteReward);
    });

    els.sheetBackdrop.addEventListener("click", event => {
      if (event.target === els.sheetBackdrop) closeSheet();
    });
    els.dayDetailBackdrop.addEventListener("click", event => {
      if (event.target === els.dayDetailBackdrop) closeDayDetail();
    });
    els.memoBackdrop.addEventListener("click", event => {
      if (event.target === els.memoBackdrop) closeMemoSheet();
    });
    els.confirmAcceptBtn.addEventListener("click", () => closeConfirm(true));
    els.confirmBackdrop.addEventListener("click", event => {
      if (event.target === els.confirmBackdrop) closeConfirm(false);
    });
    els.sheetForm.addEventListener("submit", handleSheetSubmit);
    els.memoForm.addEventListener("submit", handleMemoSubmit);
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
    els.resetAllBtn.addEventListener("click", async () => {
      const confirmed = await askForConfirmation({
        title: "重置所有数据",
        message: "此操作会清空当前浏览器中的全部记录。",
        confirmText: "确认重置"
      });
      if (confirmed) resetAllData();
    });

    document.addEventListener("keydown", event => {
      const noteEditCard = event.target.closest?.("[data-edit-card='note']");
      const memoEditTarget = event.target.closest?.("[data-edit-memo]");
      if (memoEditTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        editMemo(memoEditTarget.dataset.editMemo);
        return;
      }
      if (noteEditCard && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        handleEditCardTap(noteEditCard);
        return;
      }
      if (event.key === "Escape") {
        if (!els.confirmBackdrop.classList.contains("hidden")) {
          closeConfirm(false);
          return;
        }
        if (!els.dayDetailBackdrop.classList.contains("hidden")) {
          closeDayDetail();
          return;
        }
        if (!els.memoBackdrop.classList.contains("hidden")) {
          closeMemoSheet();
          return;
        }
        if (!els.sheetBackdrop.classList.contains("hidden")) {
          closeSheet();
        }
      }
    });

    runAutomaticChecks({ renderAfter: false });
    render();
