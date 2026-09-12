    let activeHeatmapPress = null;
    let activeCalendarMonthSwipe = null;
    let activeCalendarEventPress = null;
    let activeHabitDrag = null;
    let habitTouchListenersInstalled = false;
    let suppressCalendarEventTap = false;
    let suppressCalendarDateTap = false;
    const HABIT_DRAG_LONG_PRESS_MS = 400;
    const HABIT_DRAG_SCROLL_THRESHOLD = 8;
    const HABIT_TOUCH_LISTENER_OPTIONS = { passive: false, capture: true };

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

    function taskTimelineDropSlots() {
      return Array.from(document.querySelectorAll("[data-task-timeline-slot]"));
    }

    function taskTimelineSlotAt(x, y) {
      return taskTimelineDropSlots().find(slot => pointInsideElement(slot, x, y)) || null;
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
      const slot = taskTimelineSlotAt(x, y);
      drag.dropSlotStart = slot?.dataset.taskTimelineSlot || null;
      drag.overDropZone = Boolean(slot);
      dropZone?.classList.toggle("habit-drop-active", drag.overDropZone);
      taskTimelineDropSlots().forEach(item => {
        item.classList.toggle("task-hour-slot-drop-active", item === slot);
      });
    }

    function touchWithIdentifier(touchList, identifier) {
      return Array.from(touchList || []).find(touch => touch.identifier === identifier) || null;
    }

    function habitDragTargetFromEvent(event) {
      const row = event.target.closest?.("[data-habit-card], [data-memo-card], [data-reschedule-task]");
      if (!row || event.target.closest?.("input, textarea, select, a")) return null;
      if (row.dataset.rescheduleTask) {
        if (event.target.closest?.("button, [role='button']")) return null;
        const task = state.tasks.find(item => item.id === row.dataset.rescheduleTask);
        return task && !taskIsSettled(task)
          ? { row, card: row, sourceType: "TASK", sourceId: task.id, sourceName: task.name }
          : null;
      }
      if (row.dataset.memoCard) {
        const memo = memoItems().find(item => item.id === row.dataset.memoCard);
        return memo && memoIsActive(memo)
          ? { row, card: row, sourceType: "MEMO", sourceId: memo.id, sourceName: memo.text, memo }
          : null;
      }
      const habit = state.habits.find(item => item.id === row.dataset.habitCard);
      return habit
        ? { row, card: row, sourceType: "HABIT", sourceId: habit.id, sourceName: habit.name, habit }
        : null;
    }

    function createHabitDragState({ target, inputMode, inputId, clientX, clientY }) {
      return {
        row: target.row,
        card: target.card,
        sourceType: target.sourceType,
        sourceId: target.sourceId,
        sourceName: target.sourceName,
        habitId: target.habit?.id || null,
        memoId: target.memo?.id || null,
        inputMode,
        pointerId: inputMode === "pointer" ? inputId : null,
        touchIdentifier: inputMode === "touch" ? inputId : null,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastY: clientY,
        moved: false,
        dragging: false,
        phase: "pressing",
        overDropZone: false,
        dropSlotStart: null,
        preview: null,
        previewStartX: null,
        previewStartY: null,
        coordinateUpdates: 0,
        touchMoveEvents: 0,
        timer: null,
        developmentTimer: null,
        scrollLock: null
      };
    }

    function installHabitTouchListeners() {
      if (habitTouchListenersInstalled) return;
      habitTouchListenersInstalled = true;
      document.addEventListener("touchmove", moveHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
      document.addEventListener("touchend", endHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
      document.addEventListener("touchcancel", cancelHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
    }

    function removeHabitTouchListeners() {
      if (!habitTouchListenersInstalled) return;
      habitTouchListenersInstalled = false;
      document.removeEventListener("touchmove", moveHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
      document.removeEventListener("touchend", endHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
      document.removeEventListener("touchcancel", cancelHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
    }

    function lockHabitDragScroll(drag) {
      const scrollTarget = document.scrollingElement || document.documentElement;
      const isDocumentScroll = scrollTarget === document.documentElement || scrollTarget === document.body;
      drag.scrollLock = {
        scrollTarget,
        isDocumentScroll,
        scrollTop: isDocumentScroll ? window.scrollY : scrollTarget.scrollTop,
        targetOverflow: scrollTarget.style.overflow,
        targetOverscrollBehavior: scrollTarget.style.overscrollBehavior
      };
      scrollTarget.style.overflow = "hidden";
      scrollTarget.style.overscrollBehavior = "none";
      document.documentElement.classList.add("habit-dragging");
      document.body.classList.add("habit-dragging");
      holdHabitDragScroll(drag);
    }

    function holdHabitDragScroll(drag) {
      const lock = drag?.scrollLock;
      if (!lock) return;
      lock.scrollTarget.scrollTop = lock.scrollTop;
    }

    function restoreHabitDragScroll(drag) {
      const lock = drag?.scrollLock;
      if (!lock) return;
      lock.scrollTarget.style.overflow = lock.targetOverflow;
      lock.scrollTarget.style.overscrollBehavior = lock.targetOverscrollBehavior;
      if (lock.isDocumentScroll) {
        window.scrollTo(0, lock.scrollTop);
      } else {
        lock.scrollTarget.scrollTop = lock.scrollTop;
      }
    }

    function activateHabitDrag(drag) {
      if (!drag || activeHabitDrag !== drag || drag.moved) return;
      drag.phase = "dragging";
      drag.dragging = true;
      suppressNextCardTap = true;
      if (drag.inputMode === "pointer") drag.card.setPointerCapture?.(drag.pointerId);
      lockHabitDragScroll(drag);
      drag.row.classList.add("habit-drag-source");
      document.getSelection?.()?.removeAllRanges();
      habitTaskDropZone()?.classList.add("habit-drop-available");
      const preview = document.createElement("div");
      preview.className = "habit-drag-preview";
      preview.setAttribute("aria-hidden", "true");
      preview.innerHTML = "<strong></strong><span>安排到今日任务</span>";
      preview.querySelector("strong").textContent = drag.sourceName;
      document.body.appendChild(preview);
      drag.preview = preview;
      drag.previewStartX = drag.lastX;
      drag.previewStartY = drag.lastY;
      positionHabitDragPreview(drag, drag.lastX, drag.lastY);
      updateHabitDropState(drag, drag.lastX, drag.lastY);
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        drag.developmentTimer = window.setTimeout(() => {
          if (activeHabitDrag !== drag || !drag.dragging) return;
          if (drag.touchMoveEvents > 0 && drag.coordinateUpdates === 0) {
            console.warn("Habit drag entered dragging state but touch coordinates are not updating.");
          }
        }, 160);
      }
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
      clearTimeout(drag.developmentTimer);
      removeHabitTouchListeners();
      if (drag.inputMode === "pointer") drag.card?.releasePointerCapture?.(drag.pointerId);
      restoreHabitDragScroll(drag);
      drag.row?.classList.remove("habit-drag-source");
      drag.preview?.remove();
      document.documentElement.classList.remove("habit-dragging");
      document.body.classList.remove("habit-dragging");
      const dropZone = habitTaskDropZone();
      dropZone?.classList.remove("habit-drop-available", "habit-drop-active");
      taskTimelineDropSlots().forEach(slot => slot.classList.remove("task-hour-slot-drop-active"));
      if (drag.dragging) renderTasks();
      return drag;
    }

    function beginHabitPointerDrag(event) {
      if (event.pointerType === "touch") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = habitDragTargetFromEvent(event);
      if (!target || activeHabitDrag) return;

      activeHabitDrag = createHabitDragState({
        target,
        inputMode: "pointer",
        inputId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      });
      const drag = activeHabitDrag;
      drag.timer = window.setTimeout(() => activateHabitDrag(drag), HABIT_DRAG_LONG_PRESS_MS);
    }

    function moveHabitPointerDrag(event) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "pointer") return;
      if (event.pointerId !== activeHabitDrag.pointerId) return;
      const drag = activeHabitDrag;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (drag.phase === "pressing" && distance > HABIT_DRAG_SCROLL_THRESHOLD) {
        drag.moved = true;
        clearHabitDrag();
        return;
      }
      if (!drag.dragging) return;
      if (event.cancelable) event.preventDefault();
      positionHabitDragPreview(drag, event.clientX, event.clientY);
      updateHabitDropState(drag, event.clientX, event.clientY);
    }

    function beginHabitTouchDrag(event) {
      if (activeHabitDrag) return;
      const target = habitDragTargetFromEvent(event);
      if (!target || event.touches.length !== 1) return;
      const touch = event.changedTouches[0] || event.touches[0];
      if (!touch) return;

      activeHabitDrag = createHabitDragState({
        target,
        inputMode: "touch",
        inputId: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      installHabitTouchListeners();
      const drag = activeHabitDrag;
      drag.timer = window.setTimeout(() => activateHabitDrag(drag), HABIT_DRAG_LONG_PRESS_MS);
    }

    function moveHabitTouchDrag(event) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "touch") return;
      const drag = activeHabitDrag;
      const touch = touchWithIdentifier(event.touches, drag.touchIdentifier);
      if (!touch) return;
      drag.touchMoveEvents += 1;
      drag.lastX = touch.clientX;
      drag.lastY = touch.clientY;
      const distance = Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY);

      if (drag.phase === "pressing" && distance > HABIT_DRAG_SCROLL_THRESHOLD) {
        clearTimeout(drag.timer);
        drag.moved = true;
        drag.phase = "scrolling";
        return;
      }
      if (drag.phase !== "dragging") return;

      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      holdHabitDragScroll(drag);
      positionHabitDragPreview(drag, touch.clientX, touch.clientY);
      updateHabitDropState(drag, touch.clientX, touch.clientY);
      drag.coordinateUpdates += 1;
      document.getSelection?.()?.removeAllRanges();
    }

    function endHabitPointerDrag(event, cancelled = false) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "pointer") return;
      if (event.pointerId !== activeHabitDrag.pointerId) return;
      const drag = activeHabitDrag;
      const slot = drag.dragging && !cancelled ? taskTimelineSlotAt(event.clientX, event.clientY) : null;
      const scheduledSlotStart = slot?.dataset.taskTimelineSlot || null;
      const shouldSchedule = Boolean(drag.dragging && !cancelled && scheduledSlotStart);
      clearHabitDrag();
      if (!drag.dragging) return;
      window.setTimeout(() => {
        suppressNextCardTap = false;
      }, 220);
      if (shouldSchedule) dropTaskMaterial(drag, scheduledSlotStart);
    }

    function endHabitTouchDrag(event, cancelled = false) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "touch") return;
      const drag = activeHabitDrag;
      const touch = touchWithIdentifier(event.changedTouches, drag.touchIdentifier);
      if (!touch) return;
      drag.lastX = touch.clientX;
      drag.lastY = touch.clientY;
      const wasDragging = drag.phase === "dragging";
      const slot = wasDragging && !cancelled ? taskTimelineSlotAt(touch.clientX, touch.clientY) : null;
      const scheduledSlotStart = slot?.dataset.taskTimelineSlot || null;
      const shouldSchedule = Boolean(wasDragging && !cancelled && scheduledSlotStart);
      if (wasDragging) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      }
      clearHabitDrag();
      if (!wasDragging) return;
      window.setTimeout(() => {
        suppressNextCardTap = false;
      }, 220);
      if (shouldSchedule) dropTaskMaterial(drag, scheduledSlotStart);
    }

    function dropTaskMaterial(drag, scheduledSlotStart) {
      if (drag.sourceType === "TASK") return rescheduleTask(drag.sourceId, scheduledSlotStart);
      if (drag.sourceType === "MEMO") return scheduleMemoAsTask(drag.memoId, new Date(), scheduledSlotStart);
      return scheduleHabitAsTask(drag.habitId, new Date(), scheduledSlotStart);
    }

    function cancelHabitPointerDrag(event) {
      if (activeHabitDrag?.inputMode === "touch") return;
      endHabitPointerDrag(event, true);
    }

    function cancelHabitTouchDrag(event) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "touch") return;
      const wasDragging = activeHabitDrag.phase === "dragging";
      if (wasDragging) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      }
      clearHabitDrag();
      if (wasDragging) {
        window.setTimeout(() => {
          suppressNextCardTap = false;
        }, 220);
      }
    }

    function handleHabitDragLostPointerCapture(event) {
      if (!activeHabitDrag || activeHabitDrag.inputMode !== "pointer") return;
      if (event.pointerId !== activeHabitDrag.pointerId) return;
      clearHabitDrag();
    }

    function beginSwipe(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      const card = event.target.closest("[data-edit-card]");
      if (!card) return;
      if (card.closest("[data-habit-card], [data-reschedule-task]")) return;
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
      calendarHasSelection = false;
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
        els.todayDate.textContent = journalDateLabel(dateKey());
        renderMemoSummary();
        renderPriorityTask();
        renderNextStepCard();
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
      if (view === "settings") renderSettings();
    }

    function render() {
      scheduleTaskDeadlineCheck();
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
              <h2>今日重点</h2>
              <p>+${priorityTaskSettlementAmount("done")} / −${priorityTaskSettlementAmount("failed")}</p>
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
          <div class="card-main priority-main">
            <div class="title-wrap">
              <span class="priority-label">今日重点</span>
              <h3>${escapeHtml(task.title)}</h3>
              <div class="meta-row">
                <span class="pill">+${priorityTaskSettlementAmount("done")} / −${priorityTaskSettlementAmount("failed")}</span>
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

      const habits = visibleHabitsToday();
      if (!habits.length) {
        els.habitList.innerHTML = `
          <div class="empty-state">
            <strong>${state.habits.some(habit => habitActiveOnDate(habit, dateKey()) && !habitCompletedToday(habit.id) && !habitFailedOnDate(habit.id, dateKey())) ? "已全部安排" : "今日已处理"}</strong>
          </div>
        `;
        return;
      }

      els.habitList.innerHTML = habits.map(habit => `
        <button
          class="habit-template-chip"
          type="button"
          data-habit-card="${escapeAttr(habit.id)}"
          data-edit-habit="${escapeAttr(habit.id)}"
          aria-label="待完成习惯「${escapeAttr(habit.name)}」，点击查看或安排"
        >
          <span class="habit-template-chip__name">${escapeHtml(habit.name)}</span>
        </button>
      `).join("");
    }

    function taskMetaHtml(task) {
      return `<span class="pill coin-pill">+${Number(taskRewardAmount(task))}</span>`;
    }

    function taskActionsHtml(task) {
      const taskId = escapeAttr(task.id);
      return actionButtonHtml({ tone: "green", icon: "checkmark.circle", label: "完成任务", attrs: `data-complete-task="${taskId}"` })
        + actionButtonHtml({ tone: "red", icon: "xmark.circle", label: "任务未完成", attrs: `data-fail-task="${taskId}"` });
    }

    function taskTimelineRowsHtml(tasks, { showPlan = false } = {}) {
      return tasks.map(task => {
        const undoPresentation = typeof UndoController !== "undefined"
          ? UndoController.taskPresentation(task.id)
          : null;
        if (undoPresentation) {
          const icon = undoPresentation.tone === "negative" ? "xmark.circle" : "checkmark.circle";
          return `
            <article class="task-contextual-undo-row${undoPresentation.exiting ? " is-exiting" : ""}" data-task-card="${escapeAttr(task.id)}">
              <span class="task-contextual-undo-row__icon ${escapeAttr(undoPresentation.tone)}" aria-hidden="true">${actionIconHtml(icon)}</span>
              <div class="task-contextual-undo-row__content">
                <h3>${escapeHtml(task.name)}</h3>
                <p>
                  <span>${escapeHtml(undoPresentation.label)}</span>
                  ${undoPresentation.amountLabel ? `<span class="task-contextual-undo-row__amount ${escapeAttr(undoPresentation.tone)}">${escapeHtml(undoPresentation.amountLabel)}</span>` : ""}
                </p>
              </div>
              <button class="task-contextual-undo-row__action" type="button" data-contextual-undo aria-label="撤回上一步操作">撤回</button>
            </article>
          `;
        }
        const status = taskStatusToday(task);
        return swipeRowHtml({
          attrs: `data-task-card="${escapeAttr(task.id)}" data-reschedule-task="${escapeAttr(task.id)}"`,
          actionWidth: 168,
          editType: "task",
          editId: task.id,
          actions: taskActionsHtml(task, status),
          content: `
            <div class="card-main">
              <div class="title-wrap">
                <h3>${escapeHtml(task.name)}</h3>
                <div class="meta-row">
                  ${showPlan && taskScheduledStartDate(task) ? `<span class="pill">${escapeHtml(hourlyTimelineLabel(taskScheduledStartDate(task)))}</span>` : ""}
                  ${taskMetaHtml(task, status)}
                </div>
              </div>
            </div>
          `
        });
      }).join("");
    }

    function taskHourSlotHtml(group, { droppable = false } = {}) {
      const hasStart = group.start instanceof Date && !Number.isNaN(group.start.getTime());
      const label = group.label || "未定";
      const slotAttr = droppable && hasStart
        ? ` data-task-timeline-slot="${escapeAttr(group.start.toISOString())}"`
        : "";
      const timeAttr = hasStart ? ` datetime="${escapeAttr(group.start.toISOString())}"` : "";
      return `
        <div class="task-hour-slot${group.tasks.length ? " has-tasks" : " is-empty"}"${slotAttr}>
          <time class="task-hour-slot__time"${timeAttr}>${escapeHtml(label)}</time>
          <div class="task-hour-slot__content">
            ${group.tasks.length
              ? `<div class="task-hour-slot__tasks">${taskTimelineRowsHtml(group.tasks)}</div>`
              : `<span class="task-hour-slot__empty">空闲</span>`}
            ${droppable ? `<span class="task-hour-slot__drop-hint">安排到 ${escapeHtml(label.replace(/^明天\s+/, ""))}</span>` : ""}
          </div>
        </div>
      `;
    }

    function taskTimelineSectionHtml(title, groups, options = {}) {
      if (!groups.length) return "";
      return `
        <section class="task-timeline-section task-timeline-section-${options.tone || "default"}">
          ${title ? `<h3 class="task-timeline-section__title">${escapeHtml(title)}</h3>` : ""}
          <div class="task-timeline-section__slots">
            ${groups.map(group => taskHourSlotHtml(group, options)).join("")}
          </div>
        </section>
      `;
    }

    function renderTasks() {
      scheduleTaskDeadlineCheck();
      // Keep the active touch target mounted until drag cleanup.
      if (activeHabitDrag?.dragging) return;
      const tasksForToday = todayTasks();
      const activeTasks = tasksForToday.filter(task => {
        const status = taskStatusToday(task);
        return !["completed", "failed"].includes(status);
      });
      const undoAnchor = typeof UndoController !== "undefined" ? UndoController.taskAnchor() : null;
      if (undoAnchor?.task && !activeTasks.some(task => task.id === undoAnchor.id)) {
        activeTasks.push(undoAnchor.task);
      }
      const timeline = hourlyTaskTimeline(activeTasks);
      const taskListSection = (title, tasks, showPlan = false) => tasks.length ? `
        <section class="task-timeline-section">
          <h3 class="task-timeline-section__title">${escapeHtml(title)}</h3>
          <div class="task-hour-slot__tasks">${taskTimelineRowsHtml(tasks, { showPlan })}</div>
        </section>` : "";
      els.todayTaskList.classList.add("task-hourly-timeline");
      els.todayTaskList.innerHTML = [
        taskTimelineSectionHtml("", timeline.upcoming, { droppable: true, tone: "upcoming" }),
        taskListSection("其他安排", timeline.other, true),
        taskListSection("未排期", timeline.unscheduled)
      ].join("");
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
      return `${dateLabel}，已有${eventCount}个计划，${calendarHasSelection && day === selectedCalendarDate ? "再次点击新增计划" : "选择日期"}`;
    }

    let calendarHasSelection = false;
    function openCalendarDateForCreate(day) {
      const create = calendarHasSelection && selectedCalendarDate === normalizeCalendarDate(day);
      selectedCalendarDate = normalizeCalendarDate(day);
      calendarHasSelection = true;
      renderCalendar();
      if (create) openCalendarEventSheet(null, { date: selectedCalendarDate });
    }

    function buildWeeklyEventSegments(days, events) {
      const occupied = [];
      return events.filter(event => event.startDate <= days[6] && event.endDate >= days[0])
        .slice().sort((a,b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id))
        .map(event => {
          const start = Math.max(0, days.findIndex(day => day >= event.startDate));
          const end = days.findLastIndex(day => day <= event.endDate);
          let lane = 0;
          while (occupied[lane]?.some(([a,b]) => start <= b && end >= a)) lane++;
          (occupied[lane] ||= []).push([start,end]);
          return {event,start,end,lane,startsHere:event.startDate === days[start]};
        });
    }

    function renderCalendarWeek(days, activeMonth, eventsByDate) {
      const events = [...new Map(days.flatMap(day => eventsByDate.get(day) || []).map(event => [event.id,event])).values()];
      const segments = buildWeeklyEventSegments(days,events);
      return `<div class="calendar-week">
        <div class="calendar-week-days">${days.map(day => {
          const events = eventsByDate.get(day) || [];
          return `<article class="calendar-day-cell${day.slice(0,7) === activeMonth ? "" : " outside-month"}${day === dateKey() ? " today" : ""}${calendarHasSelection && day === selectedCalendarDate ? " selected" : ""}" data-calendar-day="${escapeAttr(day)}">
            <button class="calendar-day-number" type="button" data-calendar-day="${escapeAttr(day)}" aria-label="${escapeAttr(calendarDayAccessibilityLabel(day, events.length))}" aria-pressed="${calendarHasSelection && day === selectedCalendarDate}">${Number(day.slice(-2))}</button>
          </article>`;
        }).join("")}</div>
        <div class="calendar-week-events">${segments.filter(s => s.lane < 3).map(s => `<button type="button" class="calendar-event-segment calendar-event-range calendar-event-${escapeAttr(s.event.category)}${s.startsHere ? " event-origin" : " event-continuation"}" style="grid-column:${s.start+1}/${s.end+2};grid-row:${s.lane+1}" data-calendar-event="${escapeAttr(s.event.id)}" aria-label="编辑计划：${escapeAttr(s.event.title)}">${escapeHtml(s.event.title)}</button>`).join("")}
        ${days.map((day,col) => { const count=segments.filter(s=>s.lane>=3 && s.start<=col && s.end>=col).length;return count ? `<button class="calendar-more-events" style="grid-column:${col+1};grid-row:4" data-calendar-more="${escapeAttr(day)}" aria-label="查看其他${count}个计划">+${count}</button>` : ""; }).join("")}</div>
      </div>`;
    }

    function renderCalendar() {
      if (!els.calendarGrid || !els.calendarMonthLabel) return;
      const activeMonth = currentCalendarMonth || monthKey();
      const gridDays = calendarGridDays(activeMonth);
      const eventsByDate = calendarEventsForDates(gridDays);
      els.calendarMonthLabel.textContent = calendarMonthLabel(activeMonth);
      if (els.calendarYearLabel) els.calendarYearLabel.textContent = calendarYearLabel(activeMonth);
      const weeks = [];
      for (let i=0;i<gridDays.length;i+=7) weeks.push(gridDays.slice(i,i+7));
      els.calendarGrid.innerHTML = weeks.map(days => renderCalendarWeek(days,activeMonth,eventsByDate)).join("");
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

      els.reviewDate.textContent = journalDateLabel(reviewDate);
      if (els.reviewDateInput) {
        els.reviewDateInput.value = reviewDate;
        els.reviewDateInput.max = today;
      }
      els.reviewBest.value = shouldClearInputs ? "" : selectedReview.best || "";
      els.reviewMistake.value = shouldClearInputs ? "" : selectedReview.mistake || "";
      els.reviewPriority.value = shouldClearInputs ? "" : reviewPriorityInputValue(reviewDate, selectedReview);
      els.reviewDailyScore.value = String(dailyScore ?? 5);
      syncDailyScoreControl(els.reviewDailyScore, scoreHasValue);

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
        const summary = review.best || review.mistake || "未填写";
        const score = normalizeDailyScore(review.dailyScore);
        return `
        <article class="card review-card q-list-row" data-review-card="${escapeAttr(day)}" data-edit-card="review" data-edit-id="${escapeAttr(day)}" role="button" tabindex="0" aria-label="打开复盘">
          <div class="review-card-header">
            <div class="review-date">
              <span class="review-date-main">${escapeHtml(journalDateLabel(day))}</span>
              <span class="review-row-summary ${summary === "未填写" ? "empty" : ""}">${escapeHtml(summary)}</span>
              ${review.priority ? `<span class="review-row-next">明日 → ${escapeHtml(review.priority)}</span>` : ""}
            </div>
            <span class="review-row-score ${score === null ? "missing" : score >= 8 ? "positive" : score <= 4 ? "negative" : "neutral"}" aria-label="${score === null ? "未评分" : `评分 ${score} / 10`}">${score === null ? "—" : score}</span>
            <span class="review-row-chevron" aria-hidden="true">›</span>
          </div>
        </article>
      `;
      }).join("");
    }

    function journalDateLabel(day) {
      const date = dateFromKey(day);
      const year = date.getFullYear() === new Date().getFullYear() ? "" : `${date.getFullYear()}年`;
      const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
      return `${year}${date.getMonth() + 1}月${date.getDate()}日 · ${weekday}`;
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
            <strong>还没有基金</strong>
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
          extraClass: completed ? "fund-completed" : percent >= 90 ? "fund-near-goal" : "",
          editType: "reward",
          editId: reward.id,
          actions: actionButtonHtml({
            tone: completed ? "green" : "blue",
            icon: completed ? "checkmark.circle" : "plus",
            label: completed ? "已达成" : `存入「${reward.name}」`,
            attrs: completed ? "" : `data-deposit-fund="${escapeAttr(reward.id)}"`,
            disabled: completed
          }),
          content: `
            <div class="card-main">
              <div class="title-wrap">
                <div class="fund-heading">
                  <h3>${escapeHtml(reward.name)}</h3>
                  <strong class="fund-percentage">${formatNumber(percent)}%</strong>
                </div>
                <div class="fund-progress-meta">
                  <span>${formatFundCoins(currentCoins)} / ${formatFundCoins(totalCoins)} 金币</span>
                </div>
                <div class="fund-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${escapeAttr(totalCoins)}" aria-valuenow="${escapeAttr(currentCoins)}" aria-label="${escapeAttr(`${reward.name} 进度`)}">
                  <span class="fund-progress-fill" style="width: ${percent}%;"></span>
                </div>
                <span class="fund-goal-status">${completed ? "已达成" : `还差 ${formatFundCoins(Math.max(0, totalCoins - currentCoins))} 金币`}</span>
              </div>
            </div>
          `
        });
      }).join("");
    }

    document.addEventListener("touchstart", beginHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS);
    document.addEventListener("pointerdown", beginHabitPointerDrag);
    document.addEventListener("pointerdown", beginSwipe);
    document.addEventListener("pointerdown", beginReviewPress);
    document.addEventListener("pointerdown", beginHeatmapPress);
    document.addEventListener("pointerdown", beginCalendarMonthSwipe);
    document.addEventListener("pointerdown", beginCalendarEventPress);
    document.addEventListener("pointermove", moveHabitPointerDrag, { passive: false });
    document.addEventListener("pointermove", moveSwipe, { passive: false });
    document.addEventListener("pointermove", moveReviewPress, { passive: false });
    document.addEventListener("pointermove", moveHeatmapPress, { passive: false });
    document.addEventListener("pointermove", moveCalendarMonthSwipe, { passive: true });
    document.addEventListener("pointermove", moveCalendarEventPress, { passive: true });
    document.addEventListener("pointerup", endHabitPointerDrag);
    document.addEventListener("pointerup", endSwipe);
    document.addEventListener("pointerup", endReviewPress);
    document.addEventListener("pointerup", endHeatmapPress);
    document.addEventListener("pointerup", endCalendarMonthSwipe);
    document.addEventListener("pointerup", endCalendarEventPress);
    document.addEventListener("pointercancel", cancelHabitPointerDrag);
    document.addEventListener("lostpointercapture", handleHabitDragLostPointerCapture, true);
    document.addEventListener("pointercancel", endSwipe);
    document.addEventListener("pointercancel", endReviewPress);
    document.addEventListener("pointercancel", endHeatmapPress);
    document.addEventListener("pointercancel", endCalendarMonthSwipe);
    document.addEventListener("pointercancel", endCalendarEventPress);

    document.addEventListener("click", event => {
      if (event.target.closest("[data-export-backup]")) {
        try { exportLifeOSBackup(); } catch { showToast("备份导出失败，请重试"); }
        return;
      }
      if (event.target.closest("[data-import-backup]")) {
        document.getElementById("lifeosBackupFile").click();
        return;
      }
      const undoButton = event.target.closest("[data-contextual-undo]");
      const arrangeMemoButton = event.target.closest("[data-arrange-memo]");
      const arrangeSlotButton = event.target.closest("[data-arrange-slot]");
      if (arrangeMemoButton) {
        openArrangementSheet("MEMO", arrangeMemoButton.dataset.arrangeMemo);
        return;
      }
      if (arrangeSlotButton) {
        const { arrangeSource, arrangeOrigin, arrangeSlot } = arrangeSlotButton.dataset;
        const schedule = arrangeSource === "HABIT" ? scheduleHabitAsTask : scheduleMemoAsTask;
        closeSheet();
        schedule(arrangeOrigin, new Date(), arrangeSlot);
        return;
      }
      const swipeActionButton = event.target.closest(".swipe-action");
      const swipeContent = event.target.closest("[data-swipe-content]");
      const editCard = event.target.closest("[data-edit-card]");
      const habitCard = event.target.closest("[data-habit-card]");
      const memoCard = event.target.closest("[data-memo-card]");
      const reviewCard = event.target.closest("[data-review-card]");
      const navButton = event.target.closest("[data-nav]");
      const exportDebugTarget = event.target.closest("[data-export-debug]");
      const openTaskButton = event.target.closest("[data-open-task]");
      const openPriorityButton = event.target.closest("[data-open-priority]");
      const openHabitButton = event.target.closest("[data-open-habit]");
      const openNoteButton = event.target.closest("[data-open-note]");
      const openRewardButton = event.target.closest("[data-open-reward]");
      const openMemoButton = event.target.closest("[data-open-memo]");
      const homeMemoCard = event.target.closest("[data-home-memo-card]");
      const toggleMemoButton = event.target.closest("[data-toggle-memo]");
      const editMemoTarget = event.target.closest("[data-edit-memo]");
      const deleteMemoButton = event.target.closest("[data-delete-memo]");
      const editTaskButton = event.target.closest("[data-edit-task]");
      const editHabitButton = event.target.closest("[data-edit-habit]");
      const editNoteButton = event.target.closest("[data-edit-note]");
      const editRewardButton = event.target.closest("[data-edit-reward]");
      const completeTaskButton = event.target.closest("[data-complete-task]");
      const completeHabitButton = event.target.closest("[data-complete-habit]");
      const completePriorityButton = event.target.closest("[data-complete-priority]");
      const failPriorityButton = event.target.closest("[data-fail-priority]");
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
        UndoController.performUndo();
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
        calendarHasSelection = true;
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
        calendarHasSelection = false;
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
        calendarHasSelection = true;
        openCalendarEventSheet(null, { date: selectedCalendarDate });
        return;
      }
      if (calendarEventButton) {
        if (suppressCalendarEventTap) return;
        openCalendarEventSheet(calendarEventButton.dataset.calendarEvent);
        return;
      }
      if (calendarMoreButton) {
        calendarHasSelection = true;
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
      if (suppressNextCardTap && (swipeContent || editCard || reviewCard || habitCard || memoCard)) {
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
      if (openMemoButton) {
        openMemoSheet();
        return;
      }
      if (homeMemoCard) {
        openMemoSheet(homeMemoCard.dataset.homeMemoCard);
        return;
      }
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
      if (editCard?.dataset.editCard === "task" && !event.target.closest("button, input, textarea, select, a")) {
        handleEditCardTap(editCard);
        return;
      }
      if (editTaskButton) openTaskSheet(editTaskButton.dataset.editTask);
      if (editHabitButton) openHabitSheet(editHabitButton.dataset.editHabit);
      if (editNoteButton) openNoteSheet(editNoteButton.dataset.editNote);
      if (editRewardButton) openRewardSheet(editRewardButton.dataset.editReward);
      if (completeTaskButton) {
        completeTask(completeTaskButton.dataset.completeTask, completeTaskButton.closest("[data-task-card]"));
      }
      if (completeHabitButton) {
        completeHabit(completeHabitButton.dataset.completeHabit);
        closeSheet();
      }
      if (completePriorityButton) {
        completePriorityTask(completePriorityButton.dataset.completePriority, completePriorityButton.closest("[data-priority-card]"));
      }
      if (failPriorityButton) {
        failPriorityTask(failPriorityButton.dataset.failPriority, failPriorityButton.closest("[data-priority-card]"));
      }
      if (scheduleHabitButton) {
        openArrangementSheet("HABIT", scheduleHabitButton.dataset.scheduleHabit);
        return;
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

    document.addEventListener("pointerdown", event => {
      if (event.target.closest("[data-contextual-undo]")) UndoController.pause();
    });
    document.addEventListener("pointerup", event => {
      if (event.target.closest("[data-contextual-undo]")) UndoController.resume();
    });
    document.addEventListener("pointercancel", () => {
      UndoController.resume();
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
        message: "这会永久清除当前设备上的 LifeOS 数据。建议先导出备份。",
        confirmText: "重置所有数据"
      });
      if (confirmed) resetAllData();
    });

    document.getElementById("lifeosBackupFile").addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      importLifeOSBackup(file);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && activeHabitDrag) {
        clearHabitDrag();
        return;
      }
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

    let taskDeadlineTimer = null;

    function scheduleTaskDeadlineCheck({ retry = false } = {}) {
      clearTimeout(taskDeadlineTimer);
      taskDeadlineTimer = null;
      if (document.visibilityState !== "visible") return;
      const deadlines = state.tasks.filter(task => !taskIsSettled(task) && taskAutomaticFailureEnabled(task)).map(taskSlotDeadline).filter(Boolean);
      const today = dateKey();
      if (currentSettings().settlement.autoFailHabitsDaily && state.habits.some(habit =>
        habitActiveOnDate(habit, today) && !habitCompletedOnDate(habit.id, today) && !habitFailedOnDate(habit.id, today))) {
        deadlines.push(settlementDayEnd(today));
      }
      if (!deadlines.length) return;
      const remaining = Math.min(...deadlines.map(deadline => deadline.getTime())) - Date.now();
      // Retry a failed save gently; this is one deadline wake-up, not a running task timer.
      const delay = remaining <= 0 ? (retry ? 30000 : 0) : Math.min(remaining, 2147483647);
      taskDeadlineTimer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        const dateChanged = syncLocalDateContext();
        const changed = runAutomaticChecks();
        if ((changed && activeViewName() !== "review") || dateChanged) render();
        else scheduleTaskDeadlineCheck({ retry: !changed });
      }, delay);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        clearHabitDrag();
        clearTimeout(taskDeadlineTimer);
        return;
      }
      const dateChanged = syncLocalDateContext();
      if ((runAutomaticChecks() && activeViewName() !== "review") || dateChanged) render();
      scheduleTaskDeadlineCheck();
    });
    window.addEventListener("focus", () => {
      const dateChanged = syncLocalDateContext();
      if ((runAutomaticChecks() && activeViewName() !== "review") || dateChanged) render();
      scheduleTaskDeadlineCheck();
    });
    window.addEventListener("blur", clearHabitDrag);
    window.addEventListener("pagehide", clearHabitDrag);
    window.addEventListener("pagehide", () => clearTimeout(taskDeadlineTimer));
    window.addEventListener("pageshow", () => {
      const dateChanged = syncLocalDateContext();
      if ((runAutomaticChecks() && activeViewName() !== "review") || dateChanged) render();
      scheduleTaskDeadlineCheck();
    });

    document.addEventListener("selectstart", event => {
      if (event.target.closest?.("[data-habit-card], [data-reschedule-task]")) event.preventDefault();
    });
    document.addEventListener("selectionchange", () => {
      if (activeHabitDrag?.phase === "dragging") document.getSelection?.()?.removeAllRanges();
    });
    document.addEventListener("contextmenu", event => {
      if (event.target.closest?.("[data-habit-card], [data-reschedule-task]")) event.preventDefault();
    });
    document.addEventListener("dragstart", event => {
      if (event.target.closest?.("[data-habit-card], [data-reschedule-task]")) event.preventDefault();
    });

    installSheetViewportSync();
    runAutomaticChecks({ renderAfter: false });
    render();
