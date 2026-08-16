function getReportData_(payload) {
  payload = payload || {};
  var type = adminString_(payload.reportType || "monthly", 40);
  if (["monthly", "top_attendees", "low_attendance"].indexOf(type) === -1) throw adminError_("unsupported_report", "That report is not available.");
  var filters = payload.filters || payload;
  var timezone = getRuntimeSettings_().Timezone;
  var month = adminString_(filters.month, 7) || Utilities.formatDate(new Date(), timezone, "yyyy-MM");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw adminError_("validation_error", "Choose a valid report month.", { month: "Use YYYY-MM." });
  var trainingType = adminString_(filters.trainingType, 80).toUpperCase();
  var counts = {}, names = {}, total = 0;
  readRuntimeRows_("_Raw_Attendance").forEach(function (row) {
    if (Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM") !== month || (trainingType && String(row.TrainingType).toUpperCase() !== trainingType)) return;
    var memberId = normalizeMemberId_(row.MemberID); total += 1; counts[memberId] = (counts[memberId] || 0) + 1; names[memberId] = { memberId: memberId, firstName: String(row.FirstName || ""), lastName: String(row.LastName || "") };
  });
  var top = Object.keys(counts).map(function (memberId) { return { memberId: memberId, firstName: names[memberId].firstName, lastName: names[memberId].lastName, attendanceCount: counts[memberId] }; }).sort(reportCountSort_).slice(0, 25);
  var threshold = boundedInteger_(filters.threshold, 0, 0, 100);
  var low = readRuntimeRows_("Members").filter(function (member) { return isRuntimeActive_(member.Status) && (counts[normalizeMemberId_(member.MemberID)] || 0) <= threshold; }).map(function (member) { return { memberId: normalizeMemberId_(member.MemberID), firstName: String(member.FirstName || ""), lastName: String(member.LastName || ""), attendanceCount: counts[normalizeMemberId_(member.MemberID)] || 0 }; }).sort(function (left, right) { return left.attendanceCount - right.attendanceCount || (left.lastName + left.firstName + left.memberId).localeCompare(right.lastName + right.firstName + right.memberId); }).slice(0, 100);
  return { month: month, totalCheckins: total, uniqueAttendees: Object.keys(counts).length, topAttendees: top, lowAttendance: low, threshold: threshold };
}

function reportCountSort_(left, right) {
  return right.attendanceCount - left.attendanceCount || (left.lastName + left.firstName + left.memberId).localeCompare(right.lastName + right.firstName + right.memberId);
}
