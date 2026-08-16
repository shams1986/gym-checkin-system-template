var RUNTIME_WEEKDAYS = Object.freeze(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]);

function resolveCheckinSession_(member, now, settings) {
  var timezone = settings.Timezone;
  var today = Utilities.formatDate(now, timezone, "yyyy-MM-dd");
  var candidates = [];
  var categoryMismatch = false;

  readRuntimeRows_("Schedule").forEach(function (schedule) {
    if (!isRuntimeActive_(schedule.Active)) {
      return;
    }

    [-1, 0, 1].forEach(function (dayOffset) {
      var localDate = addLocalDays_(today, dayOffset);
      if (String(schedule.DayOfWeek).trim().toUpperCase() !== weekdayForLocalDate_(localDate)) {
        return;
      }

      var startMinutes = parseScheduleTime_(schedule.StartTime, timezone);
      if (startMinutes === null) {
        throw new Error("Invalid StartTime for schedule " + schedule.ScheduleID);
      }

      var start = localDateTimeToInstant_(localDate, startMinutes, timezone);
      var opens = new Date(start.getTime() - settings.CheckinMinutesBeforeStart * 60000);
      var closes = new Date(start.getTime() + settings.CheckinMinutesAfterStart * 60000);
      if (now.getTime() < opens.getTime() || now.getTime() > closes.getTime()) {
        return;
      }

      if (!scheduleAudienceMatches_(schedule.Audience, member.Category)) {
        categoryMismatch = true;
        return;
      }

      candidates.push({
        scheduleId: String(schedule.ScheduleID),
        trainingKey: localDate + "|" + String(schedule.ScheduleID),
        trainingType: String(schedule.TrainingType || ""),
        trainingName: String(schedule.DisplayName || schedule.TrainingType || ""),
        trainingStart: formatRuntimeInstant_(start, timezone),
        start: start,
      });
    });
  });

  candidates.sort(function (left, right) {
    var distance = Math.abs(left.start.getTime() - now.getTime()) - Math.abs(right.start.getTime() - now.getTime());
    return distance || left.scheduleId.localeCompare(right.scheduleId);
  });

  return {
    session: candidates.length > 0 ? candidates[0] : null,
    reason: categoryMismatch ? "category_not_eligible" : "no_open_training",
  };
}

function scheduleAudienceMatches_(audience, memberCategory) {
  var normalizedAudience = String(audience || "").trim().toUpperCase();
  return normalizedAudience === "" || normalizedAudience === "ALL" || normalizedAudience === String(memberCategory || "").trim().toUpperCase();
}

function parseScheduleTime_(value, timezone) {
  var text = value instanceof Date ? Utilities.formatDate(value, timezone, "HH:mm") : String(value || "").trim();
  var match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) {
    return null;
  }
  var hour = Number(match[1]);
  var minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function addLocalDays_(dateText, offset) {
  var parts = dateText.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset));
  return date.getUTCFullYear() + "-" + padRuntimeNumber_(date.getUTCMonth() + 1) + "-" + padRuntimeNumber_(date.getUTCDate());
}

function weekdayForLocalDate_(dateText) {
  var parts = dateText.split("-").map(Number);
  return RUNTIME_WEEKDAYS[new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()];
}

function localDateTimeToInstant_(dateText, minutes, timezone) {
  var parts = dateText.split("-").map(Number);
  var targetWallTime = Date.UTC(parts[0], parts[1] - 1, parts[2], Math.floor(minutes / 60), minutes % 60);
  var estimate = targetWallTime;

  for (var attempt = 0; attempt < 4; attempt += 1) {
    var observed = Utilities.formatDate(new Date(estimate), timezone, "yyyy-MM-dd-HH-mm").split("-").map(Number);
    var observedWallTime = Date.UTC(observed[0], observed[1] - 1, observed[2], observed[3], observed[4]);
    estimate += targetWallTime - observedWallTime;
  }
  return new Date(estimate);
}

function formatRuntimeInstant_(date, timezone) {
  var compact = Utilities.formatDate(date, timezone, "yyyy-MM-dd'T'HH:mm:ssZ");
  return compact.slice(0, -2) + ":" + compact.slice(-2);
}

function padRuntimeNumber_(value) {
  return value < 10 ? "0" + value : String(value);
}
