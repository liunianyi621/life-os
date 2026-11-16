    /* Lucide icon geometry: https://github.com/lucide-icons/lucide
     * ISC License - Copyright (c) 2026 Lucide Icons and Contributors
     * Permission to use, copy, modify, and/or distribute this software for any
     * purpose with or without fee is hereby granted, provided that the above
     * copyright notice and this permission notice appear in all copies.
     * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
     * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
     * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
     * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
     * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
     * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
     * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     *
     * Clock and target derive from Feather, under the MIT License:
     * Copyright (c) 2013-present Cole Bemis
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     */
    function lucideIconSvg(name,paths){
      return `<svg class="sf-icon lucide lucide-${name}" data-lucide="${name}" viewBox="0 0 24 24" focusable="false" aria-hidden="true">${paths}</svg>`;
    }
    const actionIcons = {
      hand: lucideIconSvg('hand','<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
      sun: lucideIconSvg('sun','<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
      coffee: lucideIconSvg('coffee','<path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2"/>'),
      clock: lucideIconSvg('clock','<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
      'list-checks': lucideIconSvg('list-checks','<path d="M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4"/>'),
      'book-open': lucideIconSvg('book-open','<path d="M12 5v16M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>'),
      'chart-no-axes-column': lucideIconSvg('chart-no-axes-column','<path d="M5 21v-6M12 21V3M19 21V9"/>'),
      gearshape: `<svg class="sf-icon" viewBox="0 0 24 24" focusable="false"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path><path d="m9 3-.6 2.2-2 .9-2.1-.6L2.5 8.6l1.6 1.6v2.4l-1.6 1.6 1.8 3.1 2.1-.6 2 .9L9 20h4l.6-2.4 2-.9 2.1.6 1.8-3.1-1.6-1.6v-2.4l1.6-1.6-1.8-3.1-2.1.6-2-.9L13 3Z"></path></svg>`,
      "arrow.left": `<svg class="sf-icon" viewBox="0 0 24 24" focusable="false"><path d="m12 5-7 7 7 7M5 12h14"></path></svg>`,
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
      xmark: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <path d="m7.4 7.4 9.2 9.2"></path>
          <path d="m16.6 7.4-9.2 9.2"></path>
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
      checklist: `
        <svg class="sf-icon" viewBox="0 0 24 24" focusable="false">
          <rect x="5.2" y="4.6" width="13.6" height="14.8" rx="2.2"></rect>
          <path d="m8.1 9.1 1.2 1.2 2-2.2"></path>
          <path d="M12.8 9.5h2.7"></path>
          <path d="m8.1 14.2 1.2 1.2 2-2.2"></path>
          <path d="M12.8 14.6h2.7"></path>
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
      target: lucideIconSvg('target','<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
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
      homeMemoCount: document.getElementById("homeMemoCount"),
      homeMemoList: document.getElementById("homeMemoList"),
      priorityTaskCard: document.getElementById("priorityTaskCard"),
      nextStepCard: document.getElementById("nextStepCard"),
      nextStepTitle: document.getElementById("nextStepTitle"),
      habitCount: document.getElementById("habitCount"),
      habitList: document.getElementById("habitList"),
      todayTaskCount: document.getElementById("todayTaskCount"),
      todayTaskList: document.getElementById("todayTaskList"),
      calendarMonthLabel: document.getElementById("calendarMonthLabel"),
      calendarYearLabel: document.getElementById("calendarYearLabel"),
      calendarGrid: document.getElementById("calendarGrid"),
      calendarSelectedDateLabel: document.getElementById("calendarSelectedDateLabel"),
      calendarSelectedPlans: document.getElementById("calendarSelectedPlans"),
      noteCount: document.getElementById("noteCount"),
      noteList: document.getElementById("noteList"),
      reviewDate: document.getElementById("reviewDate"),
      reviewDateButton: document.getElementById("reviewDateButton"),
      reviewDateInput: document.getElementById("reviewDateInput"),
      dailyReviewForm: document.getElementById("dailyReviewForm"),
      reviewBest: document.getElementById("reviewBest"),
      reviewMistake: document.getElementById("reviewMistake"),
      reviewDailyScore: document.getElementById("reviewDailyScore"),
      reviewDailyScoreValue: document.getElementById("reviewDailyScoreValue"),
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
      dailyScoreTrendChart: document.getElementById("dailyScoreTrendChart"),
      resetAllBtn: document.getElementById("resetAllBtn"),
      sheetBackdrop: document.getElementById("sheetBackdrop"),
      sheetTitle: document.getElementById("sheetTitle"),
      sheetForm: document.getElementById("sheetForm"),
      closeSheetBtn: document.getElementById("closeSheetBtn"),
      dayDetailBackdrop: document.getElementById("dayDetailBackdrop"),
      dayDetailTitle: document.getElementById("dayDetailTitle"),
      dayDetailContent: document.getElementById("dayDetailContent"),
      closeDayDetailBtn: document.getElementById("closeDayDetailBtn"),
      memoBackdrop: document.getElementById("memoBackdrop"),
      memoForm: document.getElementById("memoForm"),
      memoInput: document.getElementById("memoInput"),
      saveMemoBtn: document.getElementById("saveMemoBtn"),
      memoList: document.getElementById("memoList"),
      closeMemoBtn: document.getElementById("closeMemoBtn"),
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
