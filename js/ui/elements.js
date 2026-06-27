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
      "play.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="M10.2 8.7v6.6l5.2-3.3Z"></path>
        </svg>
      `,
      "stop.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="M9.2 9.2h5.6v5.6H9.2Z"></path>
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
      `,
      trash: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M8.2 8.9v9.3"></path>
          <path d="M12 8.9v9.3"></path>
          <path d="M15.8 8.9v9.3"></path>
          <path d="M6.7 6.6h10.6"></path>
          <path d="M10 4.7h4"></path>
          <path d="M7.7 6.6l.7 13.1h7.2l.7-13.1"></path>
        </svg>
      `,
      plus: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M12 5.8v12.4"></path>
          <path d="M5.8 12h12.4"></path>
        </svg>
      `
    };

    function actionIconHtml(icon) {
      return `<span class="action-icon" aria-hidden="true">${actionIcons[icon] || ""}</span>`;
    }

    function iconActionButtonHtml({ className = "icon-button", type = "button", icon, label, attrs = "", disabled = false }) {
      const disabledAttr = disabled ? " disabled" : "";
      return `
        <button class="${className}" type="${type}" ${attrs}${disabledAttr} aria-label="${escapeAttr(label)}">
          ${actionIconHtml(icon)}
        </button>
      `;
    }

    function hydrateIconButtons(root = document) {
      root.querySelectorAll("[data-icon-button]").forEach(button => {
        button.innerHTML = actionIconHtml(button.dataset.iconButton);
      });
    }

    const els = {
      todayDate: document.getElementById("todayDate"),
      homeCoins: document.getElementById("homeCoins"),
      homeStreak: document.getElementById("homeStreak"),
      memoSummaryCard: document.getElementById("memoSummaryCard"),
      homeMemoCount: document.getElementById("homeMemoCount"),
      habitCount: document.getElementById("habitCount"),
      habitList: document.getElementById("habitList"),
      todayTaskCount: document.getElementById("todayTaskCount"),
      todayTaskList: document.getElementById("todayTaskList"),
      badCoins: document.getElementById("badCoins"),
      badHabitCount: document.getElementById("badHabitCount"),
      badHabitList: document.getElementById("badHabitList"),
      noteCount: document.getElementById("noteCount"),
      noteList: document.getElementById("noteList"),
      reviewDate: document.getElementById("reviewDate"),
      reviewDateButton: document.getElementById("reviewDateButton"),
      reviewDateInput: document.getElementById("reviewDateInput"),
      dailyReviewForm: document.getElementById("dailyReviewForm"),
      reviewBest: document.getElementById("reviewBest"),
      reviewMistake: document.getElementById("reviewMistake"),
      reviewPriority: document.getElementById("reviewPriority"),
      reviewSaveStatus: document.getElementById("reviewSaveStatus"),
      reviewHistoryCount: document.getElementById("reviewHistoryCount"),
      reviewHistoryList: document.getElementById("reviewHistoryList"),
      rewardCoins: document.getElementById("rewardCoins"),
      rewardCount: document.getElementById("rewardCount"),
      rewardList: document.getElementById("rewardList"),
      statStreak: document.getElementById("statStreak"),
      statCompleted: document.getElementById("statCompleted"),
      statCoins: document.getElementById("statCoins"),
      statFocusDuration: document.getElementById("statFocusDuration"),
      statSpent: document.getElementById("statSpent"),
      statPenalty: document.getElementById("statPenalty"),
      heatmapMonthLabel: document.getElementById("heatmapMonthLabel"),
      heatmapChart: document.getElementById("heatmapChart"),
      habitTrendChart: document.getElementById("habitTrendChart"),
      resetAllBtn: document.getElementById("resetAllBtn"),
      sheetBackdrop: document.getElementById("sheetBackdrop"),
      sheetTitle: document.getElementById("sheetTitle"),
      sheetForm: document.getElementById("sheetForm"),
      dayDetailBackdrop: document.getElementById("dayDetailBackdrop"),
      dayDetailTitle: document.getElementById("dayDetailTitle"),
      dayDetailContent: document.getElementById("dayDetailContent"),
      memoBackdrop: document.getElementById("memoBackdrop"),
      memoForm: document.getElementById("memoForm"),
      memoInput: document.getElementById("memoInput"),
      saveMemoBtn: document.getElementById("saveMemoBtn"),
      memoList: document.getElementById("memoList"),
      confirmBackdrop: document.getElementById("confirmBackdrop"),
      confirmTitle: document.getElementById("confirmTitle"),
      confirmMessage: document.getElementById("confirmMessage"),
      confirmAcceptBtn: document.getElementById("confirmAcceptBtn"),
      toast: document.getElementById("toast")
    };

    hydrateIconButtons();
