    let settingsPage = "home";
    let settingsStatsScroll = 0;
    const SETTING_LABELS = {
      defaultTaskReward: "默认任务奖励", habitReward: "习惯完成奖励", penaltyMultiplier: "未完成惩罚",
      priorityReward: "重点事项完成奖励", priorityPenalty: "重点事项未完成惩罚"
    };

    function settingValueLabel(key, value) {
      if (key === "penaltyMultiplier") return `奖励 ×${value}`;
      if (key === "priorityPenalty") return `−${value} 金币`;
      return `${value} 金币`;
    }

    function renderSettings() {
      const titles = { home: "设置", economy: "金币与惩罚", settlement: "每日结算", data: "数据与备份", advanced: "高级", priority: "最重要的一件事" };
      const settings = currentSettings();
      document.getElementById("settingsTitle").textContent = titles[settingsPage];
      document.querySelector("[data-settings-back]").setAttribute("aria-label", settingsPage === "home" ? "返回统计" : "返回设置");
      document.querySelectorAll("[data-settings-panel]").forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== settingsPage; });
      document.querySelectorAll("[data-setting-readout]").forEach(el => {
        const key = el.dataset.settingReadout;
        el.textContent = settingValueLabel(key, settings.economy[key]);
      });
      document.querySelector("[data-priority-rules]").textContent = `+${settings.economy.priorityReward} / −${settings.economy.priorityPenalty}`;
      document.querySelectorAll("[data-settlement-toggle]").forEach(input => { input.checked = settings.settlement[input.dataset.settlementToggle]; });
    }

    function openSettingsPage(page = "home") {
      if (!["home", "economy", "settlement", "data", "advanced", "priority"].includes(page)) return;
      if (activeViewName() === "stats") settingsStatsScroll = window.scrollY;
      settingsPage = page;
      switchView("settings", { scrollTop: 0 });
      renderSettings();
    }

    function openSettingSelector(key) {
      if (!SETTINGS_CHOICES[key]) return;
      sheetMode = "settings";
      editingId = null;
      els.sheetTitle.textContent = SETTING_LABELS[key];
      els.sheetForm.innerHTML = `<div class="settings-selector" role="group" aria-label="${escapeAttr(SETTING_LABELS[key])}">
        ${SETTINGS_CHOICES[key].map(value => `<button type="button" class="settings-choice" data-setting-key="${key}" data-setting-value="${value}" aria-pressed="${currentSettings().economy[key] === value}">${settingValueLabel(key, value)}</button>`).join("")}
      </div>`;
      openSheet({ position: "bottom" });
      els.sheetForm.querySelector('[aria-pressed="true"]')?.focus();
    }

    function saveSettingFromUI(section, key, value) {
      const saved = updateLifeOSSetting(section, key, value);
      if (!saved) showToast("设置保存失败，请重试");
      renderSettings();
      scheduleTaskDeadlineCheck();
      return saved;
    }

    document.addEventListener("click", event => {
      if (event.target.closest("[data-open-settings]")) openSettingsPage();
      const page = event.target.closest("[data-settings-page]");
      if (page) openSettingsPage(page.dataset.settingsPage);
      if (event.target.closest("[data-settings-back]")) {
        if (settingsPage === "home") switchView("stats", { scrollTop: settingsStatsScroll });
        else openSettingsPage(settingsPage === "priority" ? "economy" : "home");
      }
      const selector = event.target.closest("[data-setting-select]");
      if (selector) openSettingSelector(selector.dataset.settingSelect);
      const choice = event.target.closest("[data-setting-value]");
      if (choice && saveSettingFromUI("economy", choice.dataset.settingKey, Number(choice.dataset.settingValue))) {
        const key = choice.dataset.settingKey;
        closeSheet();
        document.querySelector(`[data-setting-select="${key}"]`)?.focus({ preventScroll: true });
      }
    });
    document.addEventListener("change", event => {
      const input = event.target.closest("[data-settlement-toggle]");
      if (input) saveSettingFromUI("settlement", input.dataset.settlementToggle, input.checked);
    });
