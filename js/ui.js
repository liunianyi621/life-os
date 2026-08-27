    let activeHeatmapPress = null;
    let activeCalendarMonthSwipe = null;
    let activeCalendarEventPress = null;
    let activeHabitDrag = null;
    let suppressCalendarEventTap = false;
    let suppressCalendarDateTap = false;

    function swipeRowHtml({ attrs = "", actionWidth = 84, actions = "", content = "", editType = "", editId = "", extraClass = "" }) {
      const editAttrs = editType && editId
        ? ` data-edit-card="${escapeAttr(editType)}" data-edit-id="${escapeAttr(editId)}"`
        : "";
      return `
        <article class="swipe-row q-list-row ${extraClass}" data-swipe-row style="--swipe-width: ${actionWidth}px;" ${attrs}>
          <div class="card swipe-card q-row-surface" data-swipe-content${editAttrs}>
            ${content}
            ${actions ? `<div class="inline-card-actions" aria-label="快捷操作">${actions}</div>` : ""}
          </div>
        </article>
      `;
    }

    function visualToneForId(value) {
      const tones = ["blue", "yellow", "purple", "green"];
      const score = Array.from(String(value || "")).reduce((sum, character) => sum + character.charCodeAt(0), 0);
      return tones[score % tones.length];
    }

    function rowTileHtml(content, tone = "blue", extraClass = "") {
      return `<span class="q-row-tile q-row-tile-${tone} ${extraClass}" aria-hidden="true">${content}</span>`;
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
      if (card.dataset.editCard === "note") openNoteSheet(editId);
      if (card.dataset.editCard === "reward") openRewardSheet(editId);
      if (card.dataset.editCard === "review") openReviewEditSheet(editId);
      if (card.dataset.editCard === "priority") openPrioritySheet(editId);
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

    function habitTaskDropZone() {
      return document.querySelector("[data-habit-task-drop-zone]");
    }

    function pointInsideElement(element, x, y) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function positionHabitDragPreview(drag, x, y) {
      if (!drag?.preview) return;
      drag.preview.style.transform = `translate3d(${Math.round(x + 12)}px, ${Math.round(y + 12)}px, 0)`;
    }

    function updateHabitDropState(drag, x, y) {
      const dropZone = habitTaskDropZone();
      drag.overDropZone = pointInsideElement(dropZone, x, y);
      dropZone?.classList.toggle("habit-drop-active", drag.overDropZone);
    }

    function activateHabitDrag(drag) {
      if (!drag || activeHabitDrag !== drag || drag.moved) return;
      drag.dragging = true;
      suppressNextCardTap = true;
      drag.row.classList.add("habit-drag-source");
      document.body.classList.add("habit-dragging");
      habitTaskDropZone()?.classList.add("habit-drop-available");
      const preview = document.createElement("div");
      preview.className = "habit-drag-preview";
      preview.setAttribute("aria-hidden", "true");
      preview.innerHTML = "<strong></strong><span>安排 1 小时</span>";
      preview.querySelector("strong").textContent = drag.habitName;
      document.body.appendChild(preview);
      drag.preview = preview;
      positionHabitDragPreview(drag, drag.lastX, drag.lastY);
      updateHabitDropState(drag, drag.lastX, drag.lastY);
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
    }

    function clearHabitDrag() {
      if (!activeHabitDrag) return null;
      const drag = activeHabitDrag;
      activeHabitDrag = null;
      clearTimeout(drag.timer);
      drag.card?.releasePointerCapture?.(drag.pointerId);
      drag.row?.classList.remove("habit-drag-source");
      drag.preview?.remove();
      document.body.classList.remove("habit-dragging");
      const dropZone = habitTaskDropZone();
      dropZone?.classList.remove("habit-drop-available", "habit-drop-active");
      return drag;
    }

    function beginHabitDrag(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const row = event.target.closest("[data-habit-card]");
      if (!row) return;
      const card = row.querySelector("[data-swipe-content]") || row;
      const habit = state.habits.find(item => item.id === row.dataset.habitCard);
      if (!habit) return;

      activeHabitDrag = {
        row,
        card,
        habitId: habit.id,
        habitName: habit.name,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        dragging: false,
        overDropZone: false,
        preview: null,
        timer: null
      };
      activeHabitDrag.timer = window.setTimeout(() => activateHabitDrag(activeHabitDrag), 430);
      card.setPointerCapture?.(event.pointerId);
    }

    function moveHabitDrag(event) {
      if (!activeHabitDrag || event.pointerId !== activeHabitDrag.pointerId) return;
      const drag = activeHabitDrag;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.dragging && distance > 12) {
        drag.moved = true;
        clearHabitDrag();
        return;
      }
      if (!drag.dragging) return;
      event.preventDefault();
      positionHabitDragPreview(drag, event.clientX, event.clientY);
      updateHabitDropState(drag, event.clientX, event.clientY);
    }

    function endHabitDrag(event, cancelled = false) {
      if (!activeHabitDrag || event.pointerId !== activeHabitDrag.pointerId) return;
      const drag = activeHabitDrag;
      const shouldSchedule = drag.dragging
        && !cancelled
        && pointInsideElement(habitTaskDropZone(), event.clientX, event.clientY);
      clearHabitDrag();
      if (!drag.dragging) return;
      window.setTimeout(() => {
        suppressNextCardTap = false;
      }, 220);
      if (shouldSchedule) scheduleHabitAsTask(drag.habitId, new Date());
    }

    function cancelHabitDrag(event) {
      endHabitDrag(event, true);
    }

    function beginSwipe(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const card = event.target.closest("[data-edit-card]");
      if (!card) return;
      if (card.closest("[data-habit-card]")) return;
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

    function triggerReviewLongPress(press) {
      if (!press?.card) return;
      press.triggered = true;
      suppressNextCardTap = true;
      press.card.classList.add("long-press-active");
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
      openReviewEditSheet(press.card.dataset.reviewCard);
      window.setTimeout(() => {
        press.card?.classList.remove("long-press-active");
      }, 220);
    }

    function clearReviewPress() {
      if (!activeReviewPress) return null;
      const press = activeReviewPress;
      activeReviewPress = null;
      clearTimeout(press.timer);
      press.card?.releasePointerCapture?.(press.pointerId);
      return press;
    }

    function beginReviewPress(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const card = event.target.closest("[data-review-card]");
      if (!card) return;

      activeReviewPress = {
        card,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        triggered: false,
        timer: window.setTimeout(() => {
          if (activeReviewPress?.pointerId === event.pointerId) triggerReviewLongPress(activeReviewPress);
        }, 580)
      };
      card.setPointerCapture?.(event.pointerId);
    }

    function moveReviewPress(event) {
      if (!activeReviewPress || event.pointerId !== activeReviewPress.pointerId) return;
      const deltaX = event.clientX - activeReviewPress.startX;
      const deltaY = event.clientY - activeReviewPress.startY;
      if (Math.hypot(deltaX, deltaY) > 12) clearReviewPress();
    }

    function endReviewPress(event) {
      if (!activeReviewPress || event.pointerId !== activeReviewPress.pointerId) return;
      const press = clearReviewPress();
      if (press?.triggered) {
        window.setTimeout(() => {
          suppressNextCardTap = false;
        }, 0);
      }
    }

    function openHeatmapDayDetail(button) {
      const day = button?.dataset.dayDetail;
      if (!day) return;
      openDayDetail(day);
    }

    function triggerHeatmapLongPress(press) {
      if (!press?.button) return;
      press.triggered = true;
      press.button.classList.add("long-press-active");
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (error) {
        // Haptics are best-effort.
      }
      openHeatmapDayDetail(press.button);
      window.setTimeout(() => {
        press.button?.classList.remove("long-press-active");
      }, 220);
    }

    function clearHeatmapPress() {
      if (!activeHeatmapPress) return null;
      const press = activeHeatmapPress;
      activeHeatmapPress = null;
      clearTimeout(press.timer);
      press.button?.releasePointerCapture?.(press.pointerId);
      return press;
    }

    function beginHeatmapPress(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const button = event.target.closest("[data-day-detail]");
      if (!button) return;

      activeHeatmapPress = {
        button,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        triggered: false,
        timer: window.setTimeout(() => {
          if (activeHeatmapPress?.pointerId === event.pointerId) {
            triggerHeatmapLongPress(activeHeatmapPress);
          }
        }, 560)
      };
      button.setPointerCapture?.(event.pointerId);
    }

    function moveHeatmapPress(event) {
      if (!activeHeatmapPress || event.pointerId !== activeHeatmapPress.pointerId) return;
      const deltaX = event.clientX - activeHeatmapPress.startX;
      const deltaY = event.clientY - activeHeatmapPress.startY;
      if (Math.hypot(deltaX, deltaY) > 12) clearHeatmapPress();
    }

    function endHeatmapPress(event) {
      if (!activeHeatmapPress || event.pointerId !== activeHeatmapPress.pointerId) return;
      clearHeatmapPress();
    }

    function clearCalendarMonthSwipe() {
      const swipe = activeCalendarMonthSwipe;
      activeCalendarMonthSwipe = null;
      return swipe;
    }

    function beginCalendarMonthSwipe(event) {
      const grid = event.target.closest("#calendarGrid");
      if (!grid || event.target.closest("[data-calendar-event], button[data-calendar-day], [data-calendar-more]")) return;
      activeCalendarMonthSwipe = {
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        moved: false
      };
    }

    function moveCalendarMonthSwipe(event) {
      if (!activeCalendarMonthSwipe || event.pointerId !== activeCalendarMonthSwipe.pointerId) return;
      const deltaX = event.clientX - activeCalendarMonthSwipe.startX;
      const deltaY = event.clientY - activeCalendarMonthSwipe.startY;
      if (Math.hypot(deltaX, deltaY) > 12) activeCalendarMonthSwipe.moved = true;
      if (Math.abs(deltaY) > 48) {
        suppressCalendarDateTap = true;
        clearCalendarMonthSwipe();
        window.setTimeout(() => {
          suppressCalendarDateTap = false;
        }, 180);
      }
    }

    function endCalendarMonthSwipe(event) {
      if (!activeCalendarMonthSwipe || event.pointerId !== activeCalendarMonthSwipe.pointerId) return;
      const swipe = clearCalendarMonthSwipe();
      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      if (swipe.moved) {
        suppressCalendarDateTap = true;
        window.setTimeout(() => {
          suppressCalendarDateTap = false;
        }, 180);
      }
      if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      currentCalendarMonth = shiftMonthKey(currentCalendarMonth, deltaX < 0 ? 1 : -1);
      selectedCalendarDate = dateKey(monthDateFromKey(currentCalendarMonth));
      suppressCalendarEventTap = true;
      renderCalendar();
      window.setTimeout(() => {
        suppressCalendarEventTap = false;
      }, 180);
    }

    function clearCalendarEventPress() {
      if (!activeCalendarEventPress) return null;
      const press = activeCalendarEventPress;
      activeCalendarEventPress = null;
      clearTimeout(press.timer);
      press.button?.releasePointerCapture?.(press.pointerId);
      return press;
    }

    function beginCalendarEventPress(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const button = event.target.closest("[data-calendar-event]");
      if (!button) return;
      activeCalendarEventPress = {
        button,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        triggered: false,
        timer: window.setTimeout(() => {
          if (!activeCalendarEventPress || activeCalendarEventPress.pointerId !== event.pointerId) return;
          activeCalendarEventPress.triggered = true;
          suppressCalendarEventTap = true;
          try {
            if (navigator.vibrate) navigator.vibrate(10);
          } catch {
            // Haptics are best-effort.
          }
          openCalendarEventActionSheet(button.dataset.calendarEvent);
        }, 580)
      };
      button.setPointerCapture?.(event.pointerId);
    }

    function moveCalendarEventPress(event) {
      if (!activeCalendarEventPress || event.pointerId !== activeCalendarEventPress.pointerId) return;
      const deltaX = event.clientX - activeCalendarEventPress.startX;
      const deltaY = event.clientY - activeCalendarEventPress.startY;
      if (Math.hypot(deltaX, deltaY) > 12) clearCalendarEventPress();
    }

    function endCalendarEventPress(event) {
      if (!activeCalendarEventPress || event.pointerId !== activeCalendarEventPress.pointerId) return;
      const press = clearCalendarEventPress();
      if (press?.triggered) {
        window.setTimeout(() => {
          suppressCalendarEventTap = false;
        }, 180);
      }
    }

    let lastKnownLocalDate = dateKey();

    function syncLocalDateContext() {
      const currentDate = dateKey();
      if (currentDate === lastKnownLocalDate) return false;
      if (selectedReviewDate === lastKnownLocalDate) selectedReviewDate = currentDate;
      if (selectedCalendarDate === lastKnownLocalDate) selectedCalendarDate = currentDate;
      if (currentCalendarMonth === lastKnownLocalDate.slice(0, 7)) {
        currentCalendarMonth = currentDate.slice(0, 7);
      }
      lastKnownLocalDate = currentDate;
      return true;
    }

    function activeViewName() {
      return document.querySelector(".view.active")?.dataset.view || "today";
    }

    function renderActiveView(view = activeViewName()) {
      if (view === "today") {
        const activeCount = activeTasksToday().length;
        const visibleHabitCount = visibleHabitsToday().length;
        els.todayDate.textContent = formatDate();
        renderMemoSummary();
        renderPriorityTask();
        renderNextStepCard();
        els.habitCount.textContent = `${visibleHabitCount} 项`;
        els.todayTaskCount.textContent = `${activeCount} 项`;
        renderHabits();
        renderTasks();
        return;
      }
      if (view === "calendar") {
        renderCalendar();
        return;
      }
      if (view === "notes") {
        els.noteCount.textContent = `${state.notes.length} 条`;
        renderNotes();
        return;
      }
      if (view === "review") {
        renderDailyReview();
        return;
      }
      if (view === "rewards") {
        els.rewardCount.textContent = `${state.rewards.length} 项`;
        renderRewards();
        return;
      }
      if (view === "stats") renderStatsVisuals();
    }

    function render() {
      updatePrimaryReadouts();
      renderActiveView();
      if (!els.memoBackdrop.classList.contains("hidden")) renderMemos();
    }

    function renderNextStepCard() {
      if (!els.nextStepCard) return;
      normalizeNextStep(true);
      const task = nextStepTask();
      els.nextStepCard.classList.toggle("hidden", !task);
      if (els.nextStepTitle) els.nextStepTitle.textContent = task?.name || "";
    }

    function renderPriorityTask() {
      if (!els.priorityTaskCard) return;
      const task = priorityTaskToday();
      if (!task) {
        els.priorityTaskCard.innerHTML = `
          <section class="priority-card priority-empty q-feature-card">
            <div>
              <span class="priority-label">今天最重要的一件事</span>
              <h2>今天只放一件最重要的事</h2>
              <p>完成 +100，未完成 -500</p>
            </div>
            <button class="button priority-set-button" type="button" data-open-priority>设定</button>
          </section>
        `;
        return;
      }

      const done = task.status === "done";
      const failed = task.status === "failed";
      const priorityActions = task.status === "pending"
        ? [
            actionButtonHtml({
              tone: "green",
              icon: "checkmark.circle",
              label: "完成今天最重要的一件事",
              attrs: `data-complete-priority="${escapeAttr(task.date)}"`
            }),
            actionButtonHtml({
              tone: "red",
              icon: "xmark.circle",
              label: "标记今天最重要的一件事为未完成",
              attrs: `data-fail-priority="${escapeAttr(task.date)}"`
            })
          ].join("")
        : actionButtonHtml({
            tone: done ? "green" : "red",
            icon: done ? "checkmark.circle" : "xmark.circle",
            label: done ? "已完成" : "已失败",
            disabled: true
          });
      els.priorityTaskCard.innerHTML = swipeRowHtml({
        attrs: `data-priority-card="${escapeAttr(task.date)}"`,
        actionWidth: task.status === "pending" ? 168 : 84,
        editType: "priority",
        editId: task.date,
        actions: priorityActions,
        content: `
          ${rowTileHtml(actionIconHtml(done ? "checkmark.circle" : failed ? "xmark.circle" : "target"), "purple", "priority-row-tile")}
          <div class="card-main priority-main">
            <div class="title-wrap">
              <span class="priority-label">今天最重要的一件事</span>
              <h3>${escapeHtml(task.title)}</h3>
              <div class="meta-row">
                <span class="pill green">完成 +100</span>
                <span class="pill red">未完成 -500</span>
                ${done ? `<span class="pill green">已完成</span>` : ""}
                ${failed ? `<span class="pill red">已扣除</span>` : ""}
              </div>
            </div>
          </div>
        `
      });
    }

    function renderHabits() {
      if (!state.habits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>还没有习惯</strong>
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
        }) + actionButtonHtml({
          tone: "blue",
          icon: "play.circle",
          label: `安排「${habit.name}」接下来一小时`,
          attrs: `data-schedule-habit="${escapeAttr(habit.id)}"`
        }),
        content: `
            ${rowTileHtml(escapeHtml(String(habit.name || "习").slice(0, 1)), visualToneForId(habit.id), "habit-row-tile")}
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(habit.name)}</h3>
                <div class="meta-row">
                  <span class="pill coin-pill">${formatNumber(habitRewardAmount(habit))} 金币</span>
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
          </div>
        `;
        return;
      }

      const activeTasks = tasksForToday.filter(task => !taskResultToday(task.id));
      if (!activeTasks.length) {
        els.todayTaskList.innerHTML = `
          <div class="empty-state">
            <strong>今天的任务已经完成</strong>
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
            ${rowTileHtml(actionIconHtml(status === "running" ? "play.circle" : "checklist"), visualToneForId(task.id), "task-row-tile")}
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

    function calendarGridDays(month) {
      const firstDay = monthDateFromKey(month);
      const startOffset = (firstDay.getDay() + 6) % 7;
      const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
      const totalDays = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      return Array.from({ length: totalDays }, (_, index) => {
        const day = new Date(firstDay);
        day.setDate(day.getDate() - startOffset + index);
        return dateKey(day);
      });
    }

    function calendarMonthLabel(month) {
      const date = monthDateFromKey(month);
      return `${date.getMonth() + 1}月`;
    }

    function calendarYearLabel(month) {
      return String(monthDateFromKey(month).getFullYear());
    }

    function calendarSelectedDateLabel(day) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(dateFromKey(day));
    }

    function calendarEventRangeLabel(event) {
      if (event.startDate === event.endDate) return "";
      const start = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(dateFromKey(event.startDate));
      const end = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(dateFromKey(event.endDate));
      return `${start} - ${end}`;
    }

    function calendarDayAccessibilityLabel(day, eventCount) {
      const dateLabel = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(dateFromKey(day));
      return eventCount
        ? `${dateLabel}，已有${eventCount}个计划，点击空白区域新增计划`
        : `${dateLabel}，点击新增计划`;
    }

    function openCalendarDateForCreate(day) {
      selectedCalendarDate = normalizeCalendarDate(day);
      renderCalendar();
      openCalendarEventSheet(null, { date: selectedCalendarDate });
    }

    function calendarSegmentHtml(event, day) {
      const startsHere = event.startDate === day;
      const endsHere = event.endDate === day;
      const weekStart = dateFromKey(day).getDay() === 1;
      const weekEnd = dateFromKey(day).getDay() === 0;
      const isRange = event.startDate !== event.endDate;
      const classes = [
        "calendar-event-segment",
        `calendar-event-${event.category}`,
        isRange ? "calendar-event-range" : "calendar-event-single",
        startsHere || (isRange && weekStart) ? "segment-start" : "",
        endsHere || (isRange && weekEnd) ? "segment-end" : "",
        !startsHere && !endsHere && !weekStart && !weekEnd ? "segment-middle" : ""
      ].filter(Boolean).join(" ");
      const text = startsHere || weekStart ? escapeHtml(event.title) : "";
      return `
        <button
          class="${classes}"
          type="button"
          data-calendar-event="${escapeAttr(event.id)}"
          aria-label="编辑计划：${escapeAttr(event.title)}"
          title="${escapeAttr(event.title)}"
        >${text}</button>
      `;
    }

    function renderCalendar() {
      if (!els.calendarGrid || !els.calendarMonthLabel) return;
      const activeMonth = currentCalendarMonth || monthKey();
      const today = dateKey();
      const gridDays = calendarGridDays(activeMonth);
      const eventsByDate = calendarEventsForDates(gridDays);
      els.calendarMonthLabel.textContent = calendarMonthLabel(activeMonth);
      if (els.calendarYearLabel) els.calendarYearLabel.textContent = calendarYearLabel(activeMonth);
      els.calendarGrid.innerHTML = gridDays.map(day => {
        const inCurrentMonth = day.slice(0, 7) === activeMonth;
        const isToday = day === today;
        const isSelected = day === selectedCalendarDate;
        const events = eventsByDate.get(day) || [];
        return `
          <article class="calendar-day-cell${inCurrentMonth ? "" : " outside-month"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}" data-calendar-day="${escapeAttr(day)}">
            <button class="calendar-day-number" type="button" data-calendar-day="${escapeAttr(day)}" aria-label="${escapeAttr(calendarDayAccessibilityLabel(day, events.length))}">${Number(day.slice(-2))}</button>
            <div class="calendar-day-events">
              ${events.slice(0, 3).map(event => calendarSegmentHtml(event, day)).join("")}
              ${events.length > 3 ? `<button class="calendar-more-events" type="button" data-calendar-more="${escapeAttr(day)}" aria-label="查看${events.length}个计划">+${events.length - 3}</button>` : ""}
            </div>
          </article>
        `;
      }).join("");
      renderSelectedCalendarPlans();
    }

    function renderSelectedCalendarPlans() {
      if (!els.calendarSelectedPlans || !els.calendarSelectedDateLabel) return;
      const selectedDay = normalizeCalendarDate(selectedCalendarDate || dateKey());
      const events = calendarEventsForDate(selectedDay);
      els.calendarSelectedDateLabel.textContent = calendarSelectedDateLabel(selectedDay);
      if (!events.length) {
        els.calendarSelectedPlans.innerHTML = `<p class="calendar-selected-empty">当天还没有计划</p>`;
        return;
      }
      els.calendarSelectedPlans.innerHTML = events.map(event => `
        <div class="calendar-selected-event-row q-list-row">
          <button class="calendar-selected-event calendar-event-${escapeAttr(event.category)}" type="button" data-calendar-event="${escapeAttr(event.id)}">
            <i></i>
            <span>
              <strong>${escapeHtml(event.title)}</strong>
              ${calendarEventRangeLabel(event) ? `<small>${escapeHtml(calendarEventRangeLabel(event))}</small>` : ""}
            </span>
          </button>
          ${selectedDay === dateKey() ? iconActionButtonHtml({
            className: "calendar-to-task-button icon-only-button",
            icon: "checklist",
            label: "加入今日任务",
            attrs: `data-calendar-to-task="${escapeAttr(event.id)}"`
          }) : ""}
        </div>
      `).join("");
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

    function renderDailyReview(options = {}) {
      const reviewDate = setSelectedReviewDate(selectedReviewDate);
      const selectedReview = dailyReviewForDate(reviewDate);
      const today = dateKey();
      const history = sortedDailyReviews(true);
      const shouldClearInputs = options.clearInputs === true;
      const storedReview = state.dailyReviews?.[reviewDate] || null;
      const dailyScore = normalizeDailyScore(selectedReview.dailyScore);
      const scoreHasValue = dailyScore !== null || !storedReview;

      els.reviewDate.textContent = formatReviewDateLabel(reviewDate);
      if (els.reviewDateInput) {
        els.reviewDateInput.value = reviewDate;
        els.reviewDateInput.max = today;
      }
      els.reviewBest.value = shouldClearInputs ? "" : selectedReview.best || "";
      els.reviewMistake.value = shouldClearInputs ? "" : selectedReview.mistake || "";
      els.reviewPriority.value = shouldClearInputs ? "" : reviewPriorityInputValue(reviewDate, selectedReview);
      els.reviewDailyScore.value = String(dailyScore ?? 5);
      syncDailyScoreControl(els.reviewDailyScore, scoreHasValue);
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

      els.reviewHistoryList.innerHTML = history.map(([day, review]) => {
        const summary = review.best || review.priority || review.mistake || "未填写";
        const score = normalizeDailyScore(review.dailyScore);
        return `
        <article class="card review-card q-list-row" data-review-card="${escapeAttr(day)}" data-edit-card="review" data-edit-id="${escapeAttr(day)}" role="button" tabindex="0" aria-label="打开复盘">
          <div class="review-card-header">
            <div class="review-date">
              <span class="review-date-main">${escapeHtml(day === today ? "今天" : formatFullDateKey(day))}</span>
              <span class="review-row-summary ${summary === "未填写" ? "empty" : ""}">${escapeHtml(summary)}</span>
              <span class="review-row-score"><b>今日评分</b>${score === null ? "未评分" : `${score} / 10`}</span>
            </div>
            ${day === today ? `<span class="review-today-pill">今天</span>` : ""}
            <span class="review-row-chevron" aria-hidden="true">›</span>
          </div>
        </article>
      `;
      }).join("");
    }

    function syncDailyScoreControl(input, hasValue = true) {
      if (!input) return;
      const score = normalizeDailyScore(input.value) ?? 5;
      input.value = String(score);
      input.dataset.hasValue = hasValue ? "true" : "false";
      const output = input.dataset.scoreOutput
        ? document.getElementById(input.dataset.scoreOutput)
        : input.closest(".review-score-field")?.querySelector("output");
      if (output) output.textContent = hasValue ? `${score} / 10` : "未评分";
    }

    function renderRewards() {
      if (!state.rewards.length) {
        els.rewardList.innerHTML = `
          <div class="empty-state">
            <strong>没有奖励</strong>
            <p>添加一个值得长期投入的主线基金。</p>
            ${iconActionButtonHtml({
              className: "button icon-only-button empty-action",
              icon: "plus",
              label: "新建基金",
              attrs: "data-open-reward"
            })}
          </div>
        `;
        return;
      }

      els.rewardList.innerHTML = state.rewards.map(reward => {
        const totalCoins = fundTotalCoins(reward);
        const currentCoins = fundCurrentCoins(reward);
        const percent = fundProgressPercent(reward);
        const completed = fundCompleted(reward);
        return swipeRowHtml({
          attrs: `data-reward-card="${escapeAttr(reward.id)}"`,
          extraClass: completed ? "fund-completed" : "",
          editType: "reward",
          editId: reward.id,
          actions: actionButtonHtml({
            tone: completed ? "green" : "blue",
            icon: completed ? "checkmark.circle" : "plus.circle",
            label: completed ? "已完成" : "注入金币",
            attrs: completed ? "" : `data-deposit-fund="${escapeAttr(reward.id)}"`,
            disabled: completed
          }),
          content: `
            ${rowTileHtml(actionIconHtml(completed ? "checkmark.circle" : "target"), completed ? "green" : "blue", "reward-row-tile")}
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(reward.name)}</h3>
                <div class="fund-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${escapeAttr(totalCoins)}" aria-valuenow="${escapeAttr(currentCoins)}" aria-label="${escapeAttr(`${reward.name} 进度`)}">
                  <span class="fund-progress-fill" style="width: ${percent}%;"></span>
                </div>
                <div class="fund-progress-meta">
                  <span>${formatFundCoins(currentCoins)} / ${formatFundCoins(totalCoins)} 金币</span>
                  <strong>${formatNumber(percent)}%</strong>
                </div>
                ${completed ? `<span class="fund-complete-pill">已完成</span>` : ""}
              </div>
            </div>
          `
        });
      }).join("");
    }

    document.addEventListener("pointerdown", beginHabitDrag);
    document.addEventListener("pointerdown", beginSwipe);
    document.addEventListener("pointerdown", beginReviewPress);
    document.addEventListener("pointerdown", beginHeatmapPress);
    document.addEventListener("pointerdown", beginCalendarMonthSwipe);
    document.addEventListener("pointerdown", beginCalendarEventPress);
    document.addEventListener("pointermove", moveHabitDrag, { passive: false });
    document.addEventListener("pointermove", moveSwipe, { passive: false });
    document.addEventListener("pointermove", moveReviewPress, { passive: false });
    document.addEventListener("pointermove", moveHeatmapPress, { passive: false });
    document.addEventListener("pointermove", moveCalendarMonthSwipe, { passive: true });
    document.addEventListener("pointermove", moveCalendarEventPress, { passive: true });
    document.addEventListener("pointerup", endHabitDrag);
    document.addEventListener("pointerup", endSwipe);
    document.addEventListener("pointerup", endReviewPress);
    document.addEventListener("pointerup", endHeatmapPress);
    document.addEventListener("pointerup", endCalendarMonthSwipe);
    document.addEventListener("pointerup", endCalendarEventPress);
    document.addEventListener("pointercancel", cancelHabitDrag);
    document.addEventListener("pointercancel", endSwipe);
    document.addEventListener("pointercancel", endReviewPress);
    document.addEventListener("pointercancel", endHeatmapPress);
    document.addEventListener("pointercancel", endCalendarMonthSwipe);
    document.addEventListener("pointercancel", endCalendarEventPress);

    document.addEventListener("click", event => {
      const undoButton = event.target.closest("[data-undo-action]");
      const swipeActionButton = event.target.closest(".swipe-action");
      const swipeContent = event.target.closest("[data-swipe-content]");
      const editCard = event.target.closest("[data-edit-card]");
      const reviewCard = event.target.closest("[data-review-card]");
      const navButton = event.target.closest("[data-nav]");
      const exportDebugTarget = event.target.closest("[data-export-debug]");
      const openTaskButton = event.target.closest("[data-open-task]");
      const openPriorityButton = event.target.closest("[data-open-priority]");
      const openHabitButton = event.target.closest("[data-open-habit]");
      const openNoteButton = event.target.closest("[data-open-note]");
      const openRewardButton = event.target.closest("[data-open-reward]");
      const memoSummaryCard = event.target.closest("#memoSummaryCard");
      const toggleMemoButton = event.target.closest("[data-toggle-memo]");
      const editMemoTarget = event.target.closest("[data-edit-memo]");
      const deleteMemoButton = event.target.closest("[data-delete-memo]");
      const editTaskButton = event.target.closest("[data-edit-task]");
      const editHabitButton = event.target.closest("[data-edit-habit]");
      const editNoteButton = event.target.closest("[data-edit-note]");
      const editRewardButton = event.target.closest("[data-edit-reward]");
      const completeTaskButton = event.target.closest("[data-complete-task]");
      const completePriorityButton = event.target.closest("[data-complete-priority]");
      const failPriorityButton = event.target.closest("[data-fail-priority]");
      const startTaskButton = event.target.closest("[data-start-task]");
      const stopTaskButton = event.target.closest("[data-stop-task]");
      const completeHabitButton = event.target.closest("[data-complete-habit]");
      const scheduleHabitButton = event.target.closest("[data-schedule-habit]");
      const failTaskButton = event.target.closest("[data-fail-task]");
      const depositFundButton = event.target.closest("[data-deposit-fund]");
      const statsRangeButton = event.target.closest("[data-stats-range]");
      const heatMonthButton = event.target.closest("[data-heat-month]");
      const dayDetailButton = event.target.closest("[data-day-detail]");
      const deleteDayRecordButton = event.target.closest("[data-delete-day-record]");
      const openDayRecordButton = event.target.closest("[data-open-day-record]");
      const correctDayRecordButton = event.target.closest("[data-correct-day-record]");
      const deleteTaskButton = event.target.closest("[data-delete-task]");
      const deletePriorityButton = event.target.closest("[data-delete-priority]");
      const deleteHabitButton = event.target.closest("[data-delete-habit]");
      const deleteNoteButton = event.target.closest("[data-delete-note]");
      const deleteRewardButton = event.target.closest("[data-delete-reward]");
      const calendarTodayButton = event.target.closest("[data-calendar-today]");
      const calendarMonthButton = event.target.closest("[data-calendar-month]");
      const calendarDayTarget = event.target.closest("[data-calendar-day]");
      const calendarEventButton = event.target.closest("[data-calendar-event]");
      const calendarMoreButton = event.target.closest("[data-calendar-more]");
      const calendarAddSelectedButton = event.target.closest("[data-calendar-add-selected]");
      const calendarCategoryButton = event.target.closest("[data-calendar-category]");
      const calendarEditButton = event.target.closest("[data-calendar-edit]");
      const calendarDeleteButton = event.target.closest("[data-calendar-delete]");
      const calendarTaskButton = event.target.closest("[data-calendar-to-task]");
      const deleteCalendarEventButton = event.target.closest("[data-delete-calendar-event]");
      const scoreTrendPoint = event.target.closest("[data-score-trend-point]");

      if (undoButton) {
        undoLastAction();
        return;
      }
      if (scoreTrendPoint) {
        selectDailyScoreTrendPoint(scoreTrendPoint);
        return;
      }
      if (deleteDayRecordButton) {
        deleteDayRecord(deleteDayRecordButton.dataset.deleteDayRecord);
        return;
      }
      if (correctDayRecordButton) {
        const recordId = correctDayRecordButton.dataset.correctDayRecord;
        closeSheet();
        deleteDayRecord(recordId);
        return;
      }
      if (openDayRecordButton) {
        openDayTimelineRecord(openDayRecordButton.dataset.openDayRecord);
        return;
      }
      if (dayDetailButton) {
        openHeatmapDayDetail(dayDetailButton);
        return;
      }
      if (calendarTodayButton) {
        currentCalendarMonth = monthKey();
        selectedCalendarDate = dateKey();
        renderCalendar();
        return;
      }
      if (calendarCategoryButton) {
        const category = calendarCategoryButton.dataset.calendarCategory;
        const categoryInput = els.sheetForm.querySelector("input[name='category']");
        if (categoryInput) categoryInput.value = category;
        els.sheetForm.querySelectorAll("[data-calendar-category]").forEach(button => {
          button.classList.toggle("active", button === calendarCategoryButton);
        });
        return;
      }
      if (calendarMonthButton) {
        currentCalendarMonth = shiftMonthKey(
          currentCalendarMonth,
          calendarMonthButton.dataset.calendarMonth === "next" ? 1 : -1
        );
        selectedCalendarDate = dateKey(monthDateFromKey(currentCalendarMonth));
        renderCalendar();
        return;
      }
      if (calendarTaskButton) {
        addCalendarEventToTodayTask(calendarTaskButton.dataset.calendarToTask);
        return;
      }
      if (calendarDeleteButton || deleteCalendarEventButton) {
        deleteCalendarEvent(
          calendarDeleteButton?.dataset.calendarDelete || deleteCalendarEventButton?.dataset.deleteCalendarEvent
        );
        return;
      }
      if (calendarEditButton) {
        openCalendarEventSheet(calendarEditButton.dataset.calendarEdit);
        return;
      }
      if (calendarAddSelectedButton) {
        openCalendarEventSheet(null, { date: selectedCalendarDate });
        return;
      }
      if (calendarEventButton) {
        if (suppressCalendarEventTap) return;
        openCalendarEventSheet(calendarEventButton.dataset.calendarEvent);
        return;
      }
      if (calendarMoreButton) {
        selectedCalendarDate = normalizeCalendarDate(calendarMoreButton.dataset.calendarMore);
        renderCalendar();
        return;
      }
      if (calendarDayTarget) {
        if (suppressCalendarEventTap || suppressCalendarDateTap) return;
        openCalendarDateForCreate(calendarDayTarget.dataset.calendarDay);
        return;
      }
      if (!event.target.closest("[data-swipe-row]")) {
        closeOpenSwipeRows();
      }
      if (suppressNextCardTap && (swipeContent || editCard || reviewCard)) {
        suppressNextCardTap = false;
        return;
      }
      if (navButton) {
        syncLocalDateContext();
        switchView(navButton.dataset.nav);
        runAutomaticChecks();
        render();
        return;
      }
      if (reviewCard) {
        openReviewEditSheet(reviewCard.dataset.reviewCard);
        return;
      }
      if (exportDebugTarget) {
        exportDebugData();
        return;
      }
      if (openTaskButton) openTaskSheet();
      if (openPriorityButton) openPrioritySheet();
      if (openHabitButton) openHabitSheet();
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
      if (editNoteButton) openNoteSheet(editNoteButton.dataset.editNote);
      if (editRewardButton) openRewardSheet(editRewardButton.dataset.editReward);
      if (completeTaskButton) {
        completeTask(completeTaskButton.dataset.completeTask, completeTaskButton.closest("[data-task-card]"));
      }
      if (completePriorityButton) {
        completePriorityTask(completePriorityButton.dataset.completePriority, completePriorityButton.closest("[data-priority-card]"));
      }
      if (failPriorityButton) {
        failPriorityTask(failPriorityButton.dataset.failPriority, failPriorityButton.closest("[data-priority-card]"));
      }
      if (startTaskButton) {
        startTask(startTaskButton.dataset.startTask, startTaskButton.closest("[data-task-card]"));
      }
      if (stopTaskButton) {
        finishTask(stopTaskButton.dataset.stopTask, stopTaskButton.closest("[data-task-card]"));
      }
      if (scheduleHabitButton) {
        scheduleHabitAsTask(scheduleHabitButton.dataset.scheduleHabit, new Date());
        return;
      }
      if (completeHabitButton) {
        completeHabit(completeHabitButton.dataset.completeHabit, completeHabitButton.closest("[data-habit-card]"));
      }
      if (failTaskButton) {
        failTask(failTaskButton.dataset.failTask, failTaskButton.closest("[data-task-card]"));
      }
      if (depositFundButton) {
        depositFund(
          depositFundButton.dataset.depositFund,
          depositFundButton.closest("[data-reward-card]"),
          depositFundButton
        );
      }
      if (statsRangeButton) {
        currentStatsRange = statsRangeButton.dataset.statsRange;
        document.querySelectorAll("[data-stats-range]").forEach(button => {
          button.classList.toggle("active", button === statsRangeButton);
        });
        selectedDailyScoreTrendKey = null;
        renderDailyScoreTrend(buildDailyScoreTrend(currentStatsRange));
      }
      if (heatMonthButton) {
        currentHeatmapMonth = shiftMonthKey(
          currentHeatmapMonth,
          heatMonthButton.dataset.heatMonth === "next" ? 1 : -1
        );
        renderHeatmap();
      }
      if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
      if (deletePriorityButton) deletePriorityTask(deletePriorityButton.dataset.deletePriority);
      if (deleteHabitButton) deleteHabit(deleteHabitButton.dataset.deleteHabit);
      if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
      if (deleteRewardButton) deleteReward(deleteRewardButton.dataset.deleteReward);
    });

    els.sheetBackdrop.addEventListener("click", event => {
      if (event.target === els.sheetBackdrop) closeSheet();
    });
    els.closeSheetBtn?.addEventListener("click", closeSheet);
    els.dayDetailBackdrop.addEventListener("click", event => {
      if (event.target === els.dayDetailBackdrop) closeDayDetail();
    });
    els.closeDayDetailBtn?.addEventListener("click", closeDayDetail);
    els.memoBackdrop.addEventListener("click", event => {
      if (event.target === els.memoBackdrop) closeMemoSheet();
    });
    els.closeMemoBtn?.addEventListener("click", closeMemoSheet);
    els.confirmAcceptBtn.addEventListener("click", () => closeConfirm(true));
    els.confirmCancelBtn?.addEventListener("click", () => closeConfirm(false));
    els.confirmBackdrop.addEventListener("click", event => {
      if (event.target === els.confirmBackdrop) closeConfirm(false);
    });
    els.fundCelebrationDoneBtn?.addEventListener("click", closeFundCelebrationDialog);
    els.fundCelebrationBackdrop?.addEventListener("click", event => {
      if (event.target === els.fundCelebrationBackdrop) closeFundCelebrationDialog();
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
    document.addEventListener("input", event => {
      if (event.target?.matches?.("[data-daily-score]")) {
        syncDailyScoreControl(event.target, true);
      }
    });
    document.addEventListener("pointerdown", event => {
      if (!event.target?.matches?.("[data-daily-score]")) return;
      if (document.activeElement?.matches?.("textarea, input:not([type='range'])")) {
        document.activeElement.blur();
      }
    });
    els.dailyReviewForm.addEventListener("submit", event => {
      event.preventDefault();
      const formData = new FormData(els.dailyReviewForm);
      saveDailyReview({
        best: formData.get("best"),
        mistake: formData.get("mistake"),
        priority: formData.get("priority"),
        dailyScore: els.reviewDailyScore.dataset.hasValue === "true"
          ? formData.get("dailyScore")
          : null
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
      const reviewEditCard = event.target.closest?.("[data-review-card]");
      const memoEditTarget = event.target.closest?.("[data-edit-memo]");
      const heatmapDayButton = event.target.closest?.("[data-day-detail]");
      if (heatmapDayButton && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openHeatmapDayDetail(heatmapDayButton);
        return;
      }
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
      if (reviewEditCard && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openReviewEditSheet(reviewEditCard.dataset.reviewCard);
        return;
      }
      if (event.key === "Escape") {
        if (!els.fundCelebrationBackdrop?.classList.contains("hidden")) {
          closeFundCelebrationDialog();
          return;
        }
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

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const dateChanged = syncLocalDateContext();
      if (runAutomaticChecks() || dateChanged) render();
    });
    window.addEventListener("focus", () => {
      const dateChanged = syncLocalDateContext();
      if (runAutomaticChecks() || dateChanged) render();
    });

    installSheetViewportSync();
    runAutomaticChecks({ renderAfter: false });
    render();
