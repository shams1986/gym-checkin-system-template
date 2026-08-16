function getDashboardData_(filters) {
  filters = filters || {};
  var settings = getRuntimeSettings_();
  var timezone = settings.Timezone;
  var date = adminString_(filters.date, 10) || Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw adminError_("validation_error", "Choose a valid dashboard date.", { date: "Use YYYY-MM-DD." });
  }
  var trainingId = adminString_(filters.trainingId, 80);
  var attendance = readRuntimeRows_("_Raw_Attendance").filter(function (row) {
    var localDate = Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM-dd");
    var keyMatches = !trainingId || String(row.TrainingKey).slice(-trainingId.length - 1) === "|" + trainingId;
    return localDate === date && keyMatches;
  });
  attendance.sort(function (left, right) { return new Date(right.Timestamp).getTime() - new Date(left.Timestamp).getTime(); });

  var sessions = scheduleForLocalDate_(date, timezone);
  var now = new Date();
  var current = null;
  var next = null;
  sessions.forEach(function (session) {
    if (!current && now.getTime() >= session.startInstant.getTime() && now.getTime() <= session.endInstant.getTime()) current = session;
    if (!next && now.getTime() < session.startInstant.getTime()) next = session;
  });
  return {
    gymName: String(settings.GymName || "Demo Gym"),
    date: date,
    checkinCount: attendance.length,
    activeMemberCount: readRuntimeRows_("Members").filter(function (member) { return isRuntimeActive_(member.Status); }).length,
    currentTraining: current ? serializeAdminSchedule_(current.row, timezone) : null,
    nextTraining: next ? serializeAdminSchedule_(next.row, timezone) : null,
    trainings: sessions.map(function (session) { return serializeAdminSchedule_(session.row, timezone); }),
    recentCheckins: attendance.slice(0, 10).map(function (row) { return serializeAttendance_(row, timezone); }),
  };
}

function scheduleForLocalDate_(date, timezone) {
  var weekday = weekdayForLocalDate_(date);
  return readRuntimeRows_("Schedule").filter(function (row) {
    return isRuntimeActive_(row.Active) && String(row.DayOfWeek).toUpperCase() === weekday;
  }).map(function (row) {
    var startMinutes = parseScheduleTime_(row.StartTime, timezone);
    var endMinutes = parseScheduleTime_(row.EndTime, timezone);
    if (startMinutes === null || endMinutes === null) return null;
    var endDate = endMinutes <= startMinutes ? addLocalDays_(date, 1) : date;
    return { row: row, startInstant: localDateTimeToInstant_(date, startMinutes, timezone), endInstant: localDateTimeToInstant_(endDate, endMinutes, timezone) };
  }).filter(Boolean).sort(function (left, right) { return left.startInstant.getTime() - right.startInstant.getTime(); });
}
