    function scheduleRender(delay = 320) {
      clearTimeout(scheduleRender.timer);
      scheduleRender.timer = setTimeout(render, delay);
    }

    function syncSheetViewport() {
      const viewport = window.visualViewport;
      const viewportHeight = Math.max(320, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight));
      const viewportTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
      const layoutHeight = Math.max(viewportHeight, Math.round(window.innerHeight || document.documentElement.clientHeight || viewportHeight));
      const activeElement = document.activeElement;
      const editableFocused = activeElement instanceof HTMLElement
        && activeElement.matches("input:not([type='hidden']), textarea, select");
      const reviewFormFocused = editableFocused && Boolean(activeElement.closest?.(".review-keyboard-form"));
      syncSheetViewport.stableHeight = Math.max(syncSheetViewport.stableHeight || 0, layoutHeight);
      const viewportKeyboardOffset = viewport
        ? Math.max(0, Math.round((window.innerHeight || viewportHeight) - viewport.height - viewport.offsetTop))
        : 0;
      const stableKeyboardOffset = editableFocused
        ? Math.max(0, syncSheetViewport.stableHeight - viewportHeight - viewportTop)
        : 0;
      const keyboardOffset = Math.max(viewportKeyboardOffset, stableKeyboardOffset);
      document.documentElement.style.setProperty("--app-visible-height", `${viewportHeight}px`);
      document.documentElement.style.setProperty("--review-viewport-height", `${viewportHeight}px`);
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardOffset}px`);
      document.documentElement.style.setProperty("--viewport-offset-top", `${viewportTop}px`);
      document.body.classList.toggle("keyboard-open", keyboardOffset > 80 && (hasOpenModal() || reviewFormFocused));
    }

    function ensureFocusedFormFieldVisible(target = document.activeElement) {
      if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) return;
      if (target.closest(".review-keyboard-form")) return;
      const body = target.closest(".keyboard-form-sheet__body");
      if (body) {
        const fieldRect = target.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const topLimit = bodyRect.top + 8;
        const bottomLimit = bodyRect.bottom - 8;
        if (fieldRect.top < topLimit) {
          body.scrollBy({ top: fieldRect.top - topLimit, behavior: "smooth" });
        } else if (fieldRect.bottom > bottomLimit) {
          body.scrollBy({ top: fieldRect.bottom - bottomLimit, behavior: "smooth" });
        }
        return;
      }
    }

    function hasOpenModal() {
      return [
        els.sheetBackdrop,
        els.dayDetailBackdrop,
        els.memoBackdrop,
        els.confirmBackdrop,
        els.fundCelebrationBackdrop
      ].some(backdrop => backdrop && !backdrop.classList.contains("hidden"));
    }

    function syncModalState() {
      syncSheetViewport();
      const modalOpen = hasOpenModal();
      document.body.classList.toggle("modal-open", modalOpen);
      if (typeof UndoController !== "undefined") {
        if (modalOpen) {
          UndoController.onContextUnavailable();
          UndoController.pause();
        } else {
          UndoController.resume();
        }
      }
    }

    function installSheetViewportSync() {
      if (installSheetViewportSync.installed) return;
      installSheetViewportSync.installed = true;
      const update = () => {
        if (
          document.body.classList.contains("modal-open")
          || document.querySelector(".q-review-page.active")
          || document.activeElement?.closest?.(".review-keyboard-form")
        ) {
          syncSheetViewport();
        }
        syncContextualUndoPosition();
        window.requestAnimationFrame(() => ensureFocusedFormFieldVisible());
      };
      const updateOrientation = () => {
        syncSheetViewport.stableHeight = 0;
        update();
      };
      window.visualViewport?.addEventListener("resize", update);
      window.visualViewport?.addEventListener("scroll", update);
      window.addEventListener("resize", update);
      window.addEventListener("orientationchange", updateOrientation);
      document.addEventListener("focusin", event => {
        if (event.target?.matches?.(".keyboard-form-sheet input, .keyboard-form-sheet textarea, .keyboard-form-sheet select, .review-keyboard-form input, .review-keyboard-form textarea")) {
          syncSheetViewport();
          window.requestAnimationFrame(() => ensureFocusedFormFieldVisible(event.target));
        }
      });
      document.addEventListener("focusout", event => {
        if (event.target?.closest?.(".review-keyboard-form")) {
          window.requestAnimationFrame(syncSheetViewport);
        }
      });
      syncSheetViewport();
      syncContextualUndoPosition();
    }

    function syncContextualUndoPosition() {
      if (!els.toast) return;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const balance = document.querySelector(".view.active .home-coin-balance");
      const balanceRect = balance?.getClientRects?.().length ? balance.getBoundingClientRect() : null;
      if (balanceRect) {
        const centeredTop = balanceRect.top + Math.max(0, (balanceRect.height - 40) / 2);
        els.toast.style.setProperty("--contextual-undo-top", `${Math.round(centeredTop)}px`);
        els.toast.style.setProperty("--contextual-undo-right", `${Math.max(16, Math.round(viewportWidth - balanceRect.right))}px`);
        return;
      }
      const safeTop = Math.max(16, Math.round(window.visualViewport?.offsetTop || 0) + 16);
      els.toast.style.setProperty("--contextual-undo-top", `${safeTop}px`);
      els.toast.style.setProperty("--contextual-undo-right", "20px");
    }

    function hideTopNotice(clearContent = true) {
      if (!els.toast) return;
      els.toast.classList.remove("show");
      clearTimeout(hideTopNotice.timer);
      if (!clearContent) return;
      hideTopNotice.timer = window.setTimeout(() => {
        if (!els.toast.classList.contains("show")) els.toast.textContent = "";
      }, 180);
    }

    function renderTopNotice({ message, tone = "neutral", undo = false }) {
      if (!els.toast) return;
      clearTimeout(hideTopNotice.timer);
      syncContextualUndoPosition();
      els.toast.textContent = "";
      els.toast.className = "contextual-undo-host";
      const capsule = document.createElement(undo ? "button" : "div");
      if (undo) {
        capsule.type = "button";
        capsule.dataset.contextualUndo = "";
        capsule.setAttribute("aria-label", "撤回上一步操作");
      } else {
        capsule.setAttribute("role", tone === "error" ? "alert" : "status");
      }
      capsule.className = `contextual-undo-capsule${undo ? " is-undo" : " is-notice"}${tone === "error" ? " is-error" : ""}`;
      capsule.textContent = message;
      els.toast.append(capsule);
      window.requestAnimationFrame(() => els.toast.classList.add("show"));
    }

    const UNDO_WINDOW_MS = 3500;

    const UndoController = (() => {
      let current = null;
      let expiryTimer = null;
      let exitTimer = null;

      function refreshAnchor() {
        if (typeof renderTasks === "function" && activeViewName?.() === "today") renderTasks();
      }

      function clearTimers() {
        window.clearTimeout(expiryTimer);
        window.clearTimeout(exitTimer);
        expiryTimer = null;
        exitTimer = null;
      }

      function renderGlobal() {
        if (!current || current.mode !== "global") return;
        const label = current.amountLabel ? `${current.amountLabel} · 撤回` : "撤回";
        renderTopNotice({ message: label, undo: true });
        els.toast.classList.toggle("is-exiting", Boolean(current.exiting));
      }

      function renderCurrent() {
        if (!current) return;
        if (current.mode === "anchor") {
          hideTopNotice();
          refreshAnchor();
        } else {
          renderGlobal();
        }
      }

      function expire() {
        if (!current) return;
        const onExpire = current.onExpire;
        const hadAnchor = current.mode === "anchor";
        current = null;
        clearTimers();
        hideTopNotice();
        if (hadAnchor) refreshAnchor();
        onExpire?.();
      }

      function schedule(remaining = null) {
        if (!current) return;
        clearTimers();
        const duration = Math.max(0, remaining ?? (current.expiresAt - Date.now()));
        current.remaining = duration;
        current.exiting = false;
        exitTimer = window.setTimeout(() => {
          if (!current || current.paused) return;
          current.exiting = true;
          renderCurrent();
        }, Math.max(0, duration - 180));
        expiryTimer = window.setTimeout(expire, duration);
      }

      function clear({ refresh = true } = {}) {
        const hadAnchor = current?.mode === "anchor";
        current = null;
        clearTimers();
        hideTopNotice();
        if (refresh && hadAnchor) refreshAnchor();
      }

      function show({ actionId, label, amountLabel = "", tone = "neutral", anchor = null, undo, onExpire }) {
        clear();
        const canAnchor = anchor?.kind === "task"
          && anchor.task
          && typeof activeViewName === "function"
          && activeViewName() === "today";
        const now = Date.now();
        current = {
          actionId,
          label,
          amountLabel,
          tone,
          anchor: canAnchor ? anchor : null,
          mode: canAnchor ? "anchor" : "global",
          undo,
          onExpire,
          expiresAt: now + UNDO_WINDOW_MS,
          remaining: UNDO_WINDOW_MS,
          paused: false,
          exiting: false
        };
        schedule(UNDO_WINDOW_MS);
        renderCurrent();
      }

      function performUndo() {
        if (!current?.undo) return;
        const callback = current.undo;
        try {
          callback();
        } catch (error) {
          clear();
          renderTopNotice({ message: "撤回失败，请重试", tone: "error" });
          clearTimeout(showToast.timer);
          showToast.timer = window.setTimeout(() => hideTopNotice(), 2200);
        }
      }

      function pause() {
        if (!current || current.paused) return;
        current.remaining = Math.max(0, current.expiresAt - Date.now());
        current.paused = true;
        current.exiting = false;
        clearTimers();
        renderCurrent();
      }

      function resume() {
        if (!current?.paused) return;
        current.paused = false;
        current.expiresAt = Date.now() + current.remaining;
        schedule(current.remaining);
        renderCurrent();
      }

      function moveToGlobal() {
        if (!current || current.mode !== "anchor") return;
        current.remaining = Math.max(0, current.expiresAt - Date.now());
        current.mode = "global";
        current.anchor = null;
        current.expiresAt = Date.now() + current.remaining;
        schedule(current.remaining);
        refreshAnchor();
        renderGlobal();
      }

      function onViewChange(view) {
        if (view === "today") return;
        moveToGlobal();
      }

      function onContextUnavailable() {
        moveToGlobal();
      }

      function taskPresentation(taskId) {
        if (!current || current.mode !== "anchor" || current.anchor?.kind !== "task") return null;
        if (String(current.anchor.id) !== String(taskId)) return null;
        return {
          label: current.label,
          amountLabel: current.amountLabel,
          tone: current.tone,
          exiting: current.exiting
        };
      }

      function taskAnchor() {
        if (!current || current.mode !== "anchor" || current.anchor?.kind !== "task") return null;
        return current.anchor;
      }

      return {
        show,
        clear,
        performUndo,
        pause,
        resume,
        onViewChange,
        onContextUnavailable,
        taskPresentation,
        taskAnchor
      };
    })();

    function prepareActionCard(card) {
      if (!card) return;
      card.querySelectorAll("button").forEach(button => {
        button.disabled = true;
      });
    }

    function switchView(view) {
      const activeElement = document.activeElement;
      if (view !== "review" && activeElement?.closest?.(".review-keyboard-form")) {
        activeElement.blur();
      }
      document.querySelectorAll(".view").forEach(node => {
        node.classList.toggle("active", node.dataset.view === view);
      });
      document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.toggle("active", button.dataset.nav === view);
      });
      document.body.classList.toggle("review-editing", view === "review");
      UndoController.onViewChange(view);
      syncSheetViewport();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeConfirm(result = false) {
      if (!confirmResolver) return;
      const resolve = confirmResolver;
      confirmResolver = null;
      els.confirmBackdrop.classList.add("hidden");
      els.confirmBackdrop.setAttribute("aria-hidden", "true");
      syncModalState();
      resolve(result);
    }

    function askForConfirmation({ title, message, confirmText }) {
      if (confirmResolver) closeConfirm(false);
      return new Promise(resolve => {
        confirmResolver = resolve;
        els.confirmTitle.textContent = title;
        els.confirmMessage.textContent = message;
        els.confirmAcceptBtn.textContent = confirmText || "确认";
        els.confirmAcceptBtn.setAttribute("aria-label", confirmText || "确认");
        els.confirmBackdrop.classList.remove("hidden");
        els.confirmBackdrop.setAttribute("aria-hidden", "false");
        syncModalState();
        window.setTimeout(() => els.confirmAcceptBtn.focus(), 0);
      });
    }

    function openFundCelebrationDialog(fundName) {
      if (!els.fundCelebrationBackdrop) return;
      if (els.fundCelebrationName) els.fundCelebrationName.textContent = fundName || "主线基金";
      els.fundCelebrationBackdrop.classList.remove("hidden");
      els.fundCelebrationBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
      window.setTimeout(() => els.fundCelebrationDoneBtn?.focus(), 0);
    }

    function closeFundCelebrationDialog() {
      if (!els.fundCelebrationBackdrop) return;
      els.fundCelebrationBackdrop.classList.add("hidden");
      els.fundCelebrationBackdrop.setAttribute("aria-hidden", "true");
      syncModalState();
    }

    function showToast(message, duration = 1800) {
      if (pendingUndo) return;
      clearPendingUndo(false);
      renderTopNotice({ message });
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => hideTopNotice(), duration);
    }

    function showReviewSavedStatus() {
      els.reviewSaveStatus.classList.add("show");
      clearTimeout(showReviewSavedStatus.timer);
      showReviewSavedStatus.timer = setTimeout(() => {
        els.reviewSaveStatus.classList.remove("show");
      }, 2000);
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
