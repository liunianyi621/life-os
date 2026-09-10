    const LIFEOS_BACKUP_VERSION = 1;
    const LIFEOS_BEFORE_IMPORT_KEY = `${STORAGE_KEY}-before-import`;
    const BACKUP_MAX_BYTES = 25 * 1024 * 1024;

    function backupObject(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function validateLifeOSBackup(backup) {
      const invalid = () => { throw new Error("备份格式或版本不受支持，当前数据未更改"); };
      if (!backupObject(backup) || backup.app !== "LifeOS" || backup.version !== LIFEOS_BACKUP_VERSION
        || backup.schemaVersion !== 1 || !Number.isFinite(Date.parse(backup.exportedAt))) invalid();
      const data = backup.data;
      if (!backupObject(data) || !Number.isFinite(data.coins)
        || data.pastCoinHistoryScaleMigrationVersion !== PAST_COIN_HISTORY_SCALE_MIGRATION_VERSION) invalid();
      // Require every current state container, including settlement markers; never fill missing history.
      for (const [key, value] of Object.entries(emptyState)) {
        if (!(key in data)) invalid();
        if (Array.isArray(value) && !Array.isArray(data[key])) invalid();
        if (backupObject(value) && !backupObject(data[key])) invalid();
        if (typeof value === "number" && !Number.isFinite(data[key])) invalid();
      }
      const visit = value => {
        if (typeof value === "number" && !Number.isFinite(value)) invalid();
        if (!value || typeof value !== "object") return;
        for (const [key, child] of Object.entries(value)) {
          if (["__proto__", "prototype", "constructor"].includes(key)) invalid();
          visit(child);
        }
      };
      visit(data);
      for (const key of ["tasks", "habits", "badHabits", "calendarEvents", "notes", "memos", "rewards", "achievements", "history"]) {
        const ids = new Set();
        for (const record of data[key]) {
          if (!backupObject(record)) invalid();
          if (key === "history" && record.id == null) continue;
          if (typeof record.id !== "string" || !record.id || ids.has(record.id)) invalid();
          ids.add(record.id);
        }
      }
      for (const [key, field] of [["tasks", "name"], ["habits", "name"], ["memos", "text"], ["calendarEvents", "title"], ["rewards", "name"]]) {
        if (data[key].some(record => typeof record[field] !== "string")) invalid();
      }
      for (const key of Object.keys(emptyState.totals)) {
        if (!Number.isFinite(data.totals[key])) invalid();
      }
      for (const key of ["settledThroughDate", "fixedRewardRulesSince"]) {
        if (typeof data[key] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data[key])
          || dateKey(dateFromKey(data[key])) !== data[key]) invalid();
      }
      for (const key of ["dailyReviews", "priorityTaskByDate", "completions", "taskResults", "habitCompletions", "habitFailures", "taskAutoFailures"]) {
        if (Object.values(data[key]).some(value => !backupObject(value))) invalid();
      }
      for (const review of Object.values(data.dailyReviews)) {
        if (review.dailyScore != null && (!Number.isInteger(review.dailyScore) || review.dailyScore < 1 || review.dailyScore > 10)) invalid();
        if (["best", "mistake", "priority"].some(key => review[key] != null && typeof review[key] !== "string")) invalid();
      }
      if (Object.values(data.scheduledHabitIdsByDate).some(ids => !Array.isArray(ids) || ids.some(id => typeof id !== "string"))) invalid();
      return JSON.parse(JSON.stringify(data));
    }

    function createLifeOSBackup() {
      return {
        app: "LifeOS", version: LIFEOS_BACKUP_VERSION, schemaVersion: 1,
        appVersion: "0.1.0", exportedAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(state))
      };
    }

    function exportLifeOSBackup() {
      const backup = createLifeOSBackup();
      validateLifeOSBackup(backup);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `LifeOS-Backup-${dateKey()}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function restoreLifeOSBackup(backup) {
      const candidate = validateLifeOSBackup(backup);
      const serialized = JSON.stringify(candidate);
      const previous = JSON.stringify(state);
      // Both writes must succeed before memory changes. setItem is atomic for the main key.
      localStorage.setItem(LIFEOS_BEFORE_IMPORT_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
      state = candidate;
    }

    async function importLifeOSBackup(file) {
      if (!file) return;
      try {
        if (file.size > BACKUP_MAX_BYTES) throw new Error("备份文件过大，当前数据未更改");
        const backup = JSON.parse(await file.text());
        validateLifeOSBackup(backup);
        const confirmed = await askForConfirmation({
          title: "恢复 LifeOS 备份？",
          message: "备份将替换本机当前数据。建议先导出当前备份；恢复前也会保留一份本机快照。",
          confirmText: "恢复备份"
        });
        if (!confirmed) return;
        restoreLifeOSBackup(backup);
        pendingUndo = null;
        UndoController.clear({ refresh: false });
        render();
        showToast("备份已恢复");
      } catch (error) {
        showToast(error instanceof SyntaxError ? "备份不是有效 JSON，当前数据未更改" : "恢复失败，请检查备份格式与存储空间");
      }
    }
