    function scheduleRender(delay = 320) {
      clearTimeout(scheduleRender.timer);
      scheduleRender.timer = setTimeout(render, delay);
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
      resolve(result);
    }

    function askForConfirmation({ title, message, confirmText }) {
      if (confirmResolver) closeConfirm(false);
      return new Promise(resolve => {
        confirmResolver = resolve;
        els.confirmTitle.textContent = title;
        els.confirmMessage.textContent = message;
        els.confirmAcceptBtn.textContent = confirmText || "确认";
        els.confirmBackdrop.classList.remove("hidden");
        els.confirmBackdrop.setAttribute("aria-hidden", "false");
        window.setTimeout(() => els.confirmAcceptBtn.focus(), 0);
      });
    }

    function showToast(message, duration = 1800) {
      clearPendingUndo(false);
      els.toast.textContent = message;
      els.toast.classList.remove("interactive");
      els.toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, duration);
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
