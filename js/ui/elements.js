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
      "plus.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="M12 8.6v6.8"></path>
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
      `,
      calendar: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M7.1 5.4h9.8a2.2 2.2 0 0 1 2.2 2.2v9.1a2.2 2.2 0 0 1-2.2 2.2H7.1a2.2 2.2 0 0 1-2.2-2.2V7.6a2.2 2.2 0 0 1 2.2-2.2Z"></path>
          <path d="M8.2 3.9v3.2"></path>
          <path d="M15.8 3.9v3.2"></path>
          <path d="M4.9 9h14.2"></path>
          <path d="M8.4 12.7h.1"></path>
          <path d="M12 12.7h.1"></path>
          <path d="M15.6 12.7h.1"></path>
        </svg>
      `,
      "shield.slash": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M12 4.5 18 6.7v4.8c0 3.7-2.25 6.2-6 8-3.75-1.8-6-4.3-6-8V6.7l6-2.2Z"></path>
          <path d="M5.3 5.2 18.7 18.8"></path>
        </svg>
      `,
      "book.closed": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M7.1 4.6h9.3a1.8 1.8 0 0 1 1.8 1.8v13H8a2.2 2.2 0 0 1-2.2-2.2V5.9a1.3 1.3 0 0 1 1.3-1.3Z"></path>
          <path d="M8 16.1h10.2"></path>
          <path d="M8 19.4h10.2"></path>
          <path d="M9.2 7.7h5.4"></path>
        </svg>
      `,
      target: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="7.5"></circle>
          <circle cx="12" cy="12" r="3.25"></circle>
          <path d="M12 3.8v2.1"></path>
          <path d="M12 18.1v2.1"></path>
          <path d="M3.8 12h2.1"></path>
          <path d="M18.1 12h2.1"></path>
        </svg>
      `,
      "chart.xyaxis.line": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="M5.2 18.8V5.2"></path>
          <path d="M5.2 18.8h13.6"></path>
          <path d="m7.4 15.4 3.1-3.2 2.6 2 4.1-6"></path>
          <path d="M17.2 8.2h-3"></path>
          <path d="M17.2 8.2v3"></path>
        </svg>
      `,
      "arrow.down.circle": `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8.25"></circle>
          <path d="M12 8.2v7.1"></path>
          <path d="m8.9 12.4 3.1 3.1 3.1-3.1"></path>
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
      priorityTaskCard: document.getElementById("priorityTaskCard"),
      nextStepCard: document.getElementById("nextStepCard"),
      nextStepTitle: document.getElementById("nextStepTitle"),
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
      achievementsList: document.getElementById("achievementsList"),
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
      confirmCancelBtn: document.getElementById("confirmCancelBtn"),
      confirmAcceptBtn: document.getElementById("confirmAcceptBtn"),
      fundCelebrationBackdrop: document.getElementById("fundCelebrationBackdrop"),
      fundCelebrationName: document.getElementById("fundCelebrationName"),
      fundCelebrationDoneBtn: document.getElementById("fundCelebrationDoneBtn"),
      toast: document.getElementById("toast")
    };

    hydrateIconButtons();
