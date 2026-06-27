    function parseTimeValue(value) {
      const raw = String(value || "").trim();
      const twelveHour = raw.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i);
      if (twelveHour) {
        const hour = Number(twelveHour[1]);
        if (hour >= 1 && hour <= 12) {
          return {
            hour: String(hour),
            minute: twelveHour[2],
            period: twelveHour[3].toUpperCase()
          };
        }
      }

      const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (twentyFourHour) {
        return timePartsFrom24Hour(Number(twentyFourHour[1]), twentyFourHour[2]);
      }

      return null;
    }

    function timePartsFrom24Hour(hour24, minute = "00") {
      const normalizedHour = ((Number(hour24) % 24) + 24) % 24;
      const hour = normalizedHour % 12 || 12;
      return {
        hour: String(hour),
        minute: String(minute).padStart(2, "0"),
        period: normalizedHour >= 12 ? "PM" : "AM"
      };
    }

    function timePartsFromMinutes(minutes) {
      const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
      return timePartsFrom24Hour(Math.floor(normalized / 60), String(normalized % 60).padStart(2, "0"));
    }

    function nextWholeHourTime() {
      const now = new Date();
      return timePartsFrom24Hour(now.getHours() + 1, "00");
    }

    function shiftTimeParts(parts, minutes) {
      const baseMinutes = timePartsToMinutes(parts);
      return timePartsFromMinutes((baseMinutes ?? 0) + minutes);
    }

    function shiftTimeValue(value, minutes) {
      const parts = parseTimeValue(value);
      return parts ? formatTimeParts(shiftTimeParts(parts, minutes)) : "";
    }

    function defaultTaskTimeRange() {
      const start = nextWholeHourTime();
      const end = shiftTimeParts(start, 60);
      return {
        start: formatTimeParts(start),
        end: formatTimeParts(end)
      };
    }

    function formatTimeParts(parts) {
      if (!parts) return "";
      const minutes = timePartsToMinutes(parts);
      if (minutes == null) return "";
      return minutesToClockLabel(minutes);
    }

    function timeOptionButtons(type, selected) {
      const values = {
        hour: Array.from({ length: 12 }, (_, index) => String(index + 1)),
        minute: Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")),
        period: ["AM", "PM"]
      }[type] || [];
      const selectedValue = selected == null ? "" : String(selected);
      return values.map(value => {
        const selectedClass = value === selectedValue ? " selected" : "";
        return `<button class="time-option${selectedClass}" type="button" data-time-${type}="${value}">${value}</button>`;
      }).join("");
    }

    function initTimePicker(initialValue = "") {
      els.sheetForm.querySelectorAll("[data-time-picker]").forEach((picker, index) => {
        initSingleTimePicker(picker, index === 0 ? initialValue : "");
      });
    }

    function initSingleTimePicker(picker, fallbackValue = "") {
      const hiddenInput = picker.querySelector("input[type='hidden']");
      const valueLabel = picker.querySelector("[data-time-value]");
      const hourWheel = picker.querySelector("[data-time-wheel='hour']");
      const minuteWheel = picker.querySelector("[data-time-wheel='minute']");
      const periodWheel = picker.querySelector("[data-time-wheel='period']");
      const initial = parseTimeValue(hiddenInput?.value || fallbackValue);
      let userWheelIntent = false;
      if (!hiddenInput || !valueLabel) return;

      function datasetKey(type) {
        return `time${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      }

      function selectedValueFor(type, parts) {
        if (type === "hour") return parts.hour;
        if (type === "minute") return parts.minute;
        return parts.period;
      }

      function vibrateTimeChange() {
        try {
          if (navigator.vibrate) navigator.vibrate(10);
        } catch (error) {
          // Haptics are a best-effort touch nicety.
        }
      }

      function currentTimeParts() {
        return parseTimeValue(hiddenInput.value) || nextWholeHourTime();
      }

      function findWheelOption(wheel, type, value) {
        return Array.from(wheel.querySelectorAll(".time-option")).find(option => (
          option.dataset[datasetKey(type)] === String(value)
        ));
      }

      function scrollWheelTo(type, value, behavior = "smooth") {
        const wheel = picker.querySelector(`[data-time-wheel='${type}']`);
        if (!wheel) return;
        findWheelOption(wheel, type, value)?.scrollIntoView({ block: "center", behavior });
      }

      function setTime(parts, options = {}) {
        const nextParts = {
          hour: String(Number(parts.hour) || 12),
          minute: String(parts.minute || "00").padStart(2, "0"),
          period: parts.period === "PM" ? "PM" : "AM"
        };
        const previousValue = hiddenInput.value;
        const nextValue = formatTimeParts(nextParts);
        picker.dataset.hour = nextParts.hour;
        picker.dataset.minute = nextParts.minute;
        picker.dataset.period = nextParts.period;
        delete picker.dataset.timeCleared;
        hiddenInput.value = nextValue;
        valueLabel.textContent = nextValue;
        picker.querySelectorAll(".time-option").forEach(option => {
          const type = option.closest("[data-time-wheel]")?.dataset.timeWheel;
          option.classList.toggle("selected", Boolean(type) && option.dataset[datasetKey(type)] === selectedValueFor(type, nextParts));
        });
        if (options.vibrate && previousValue !== nextValue) vibrateTimeChange();
      }

      function clearTime() {
        delete picker.dataset.hour;
        delete picker.dataset.minute;
        delete picker.dataset.period;
        picker.dataset.timeCleared = "true";
        userWheelIntent = false;
        hiddenInput.value = "";
        valueLabel.textContent = "未设置";
        picker.querySelectorAll(".time-option").forEach(option => option.classList.remove("selected"));
      }

      if (initial) {
        setTime(initial);
        requestAnimationFrame(() => {
          scrollWheelTo("hour", initial.hour, "auto");
          scrollWheelTo("minute", initial.minute, "auto");
          scrollWheelTo("period", initial.period, "auto");
        });
      } else {
        clearTime();
      }

      picker.addEventListener("click", event => {
        const hourButton = event.target.closest("[data-time-hour]");
        const minuteButton = event.target.closest("[data-time-minute]");
        const periodButton = event.target.closest("[data-time-period]");
        const clearButton = event.target.closest("[data-clear-time]");

        if (clearButton) {
          clearTime();
          return;
        }

        if (hourButton || minuteButton || periodButton) {
          const next = currentTimeParts();
          if (hourButton) next.hour = hourButton.dataset.timeHour;
          if (minuteButton) next.minute = minuteButton.dataset.timeMinute;
          if (periodButton) next.period = periodButton.dataset.timePeriod;
          setTime(next, { vibrate: true });
          if (hourButton) scrollWheelTo("hour", next.hour);
          if (minuteButton) scrollWheelTo("minute", next.minute);
          if (periodButton) scrollWheelTo("period", next.period);
        }
      });

      function attachWheelScroll(wheel, type) {
        if (!wheel) return;
        let scrollTimer;
        const markUserWheelIntent = () => {
          userWheelIntent = true;
        };
        const settleWheel = () => {
          if (!hiddenInput.value && picker.dataset.timeCleared === "true" && !userWheelIntent) return;
          const wheelRect = wheel.getBoundingClientRect();
          const center = wheelRect.top + wheelRect.height / 2;
          const options = Array.from(wheel.querySelectorAll(".time-option"));
          const nearest = options.reduce((closest, option) => {
            const rect = option.getBoundingClientRect();
            const distance = Math.abs(rect.top + rect.height / 2 - center);
            return !closest || distance < closest.distance ? { option, distance } : closest;
          }, null)?.option;
          if (!nearest) return;
          const next = currentTimeParts();
          next[type] = nearest.dataset[datasetKey(type)];
          setTime(next, { vibrate: true });
          userWheelIntent = false;
        };

        wheel.addEventListener("pointerdown", markUserWheelIntent, { passive: true });
        wheel.addEventListener("touchstart", markUserWheelIntent, { passive: true });
        wheel.addEventListener("wheel", markUserWheelIntent, { passive: true });
        wheel.addEventListener("scroll", () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(settleWheel, 90);
        }, { passive: true });
        wheel.addEventListener("scrollend", settleWheel, { passive: true });
      }

      attachWheelScroll(hourWheel, "hour");
      attachWheelScroll(minuteWheel, "minute");
      attachWheelScroll(periodWheel, "period");
    }
