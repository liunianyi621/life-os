    function scheduleRender(delay = 320) {
      clearTimeout(scheduleRender.timer);
      scheduleRender.timer = setTimeout(render, delay);
    }

    function syncSheetViewport() {
      const viewport = window.visualViewport;
      const viewportHeight = Math.max(320, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight));
      const keyboardOffset = viewport
        ? Math.max(0, Math.round((window.innerHeight || viewportHeight) - viewport.height - viewport.offsetTop))
        : 0;
      document.documentElement.style.setProperty("--sheet-viewport-height", `${viewportHeight}px`);
      document.documentElement.style.setProperty("--sheet-keyboard-offset", `${keyboardOffset}px`);
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
      document.body.classList.toggle("modal-open", hasOpenModal());
    }

    function installSheetViewportSync() {
      const update = () => {
        if (document.body.classList.contains("modal-open")) syncSheetViewport();
        syncSnackbarPosition();
      };
      window.visualViewport?.addEventListener("resize", update);
      window.visualViewport?.addEventListener("scroll", update);
      window.addEventListener("resize", update);
      syncSheetViewport();
      syncSnackbarPosition();
    }

    function syncSnackbarPosition() {
      if (!els.toast) return;
      const nav = document.querySelector(".bottom-nav");
      const navRect = nav?.getClientRects?.().length ? nav.getBoundingClientRect() : null;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const bottom = navRect ? Math.max(0, viewportHeight - navRect.top) + 12 : 20;
      els.toast.style.setProperty("--snackbar-bottom", `${Math.round(bottom)}px`);
    }

    function hideSnackbar(clearContent = true) {
      if (!els.toast) return;
      els.toast.classList.remove("show", "updating");
      clearTimeout(hideSnackbar.timer);
      if (!clearContent) return;
      hideSnackbar.timer = window.setTimeout(() => {
        if (!els.toast.classList.contains("show")) els.toast.textContent = "";
      }, 180);
    }

    function renderSnackbar({ message, icon = "", tone = "neutral", actionLabel = "" }) {
      if (!els.toast) return;
      const wasVisible = els.toast.classList.contains("show");
      clearTimeout(hideSnackbar.timer);
      syncSnackbarPosition();
      els.toast.textContent = "";
      els.toast.className = `snackbar${actionLabel ? " interactive" : ""}`;

      const content = document.createElement("span");
      content.className = "snackbar-content";
      if (icon && actionIcons[icon]) {
        const iconEl = document.createElement("span");
        iconEl.className = `snackbar-icon action-icon ${tone}`;
        iconEl.setAttribute("aria-hidden", "true");
        iconEl.innerHTML = actionIcons[icon];
        content.append(iconEl);
      }

      const messageEl = document.createElement("span");
      messageEl.className = "snackbar-message";
      messageEl.textContent = message;
      content.append(messageEl);
      els.toast.append(content);

      if (actionLabel) {
        const action = document.createElement("button");
        action.type = "button";
        action.dataset.undoAction = "";
        action.className = "snackbar-action";
        action.textContent = actionLabel;
        els.toast.append(action);
      }

      if (wasVisible) {
        els.toast.classList.add("show", "updating");
        window.setTimeout(() => els.toast.classList.remove("updating"), 160);
        return;
      }
      window.requestAnimationFrame(() => els.toast.classList.add("show"));
    }

    function prepareActionCard(card) {
      if (!card) return;
      card.querySelectorAll("button").forEach(button => {
        button.disabled = true;
      });
    }

    function switchView(view) {
      document.querySelectorAll(".view").forEach(node => {
        node.classList.toggle("active", node.dataset.view === view);
      });
      document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.toggle("active", button.dataset.nav === view);
      });
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
      renderSnackbar({ message });
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => hideSnackbar(), duration);
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
