function getReportData_(payload) {
  payload = payload || {};
  var filters = payload.filters || payload;
  var timezone = getRuntimeSettings_().Timezone;
  var today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  var from = attendanceDateFilter_(filters.from || today.slice(0, 8) + "01", "from");
  var to = attendanceDateFilter_(filters.to || today, "to");
  if (from > to) throw adminError_("validation_error", "The from date must not be after the to date.", { from: "Choose an earlier date.", to: "Choose a later date." });
  var trainingType = adminString_(filters.trainingType, 80).toUpperCase();
  var counts = {}, names = {}, lastCheckins = {}, total = 0, types = {};
  readRuntimeRows_("Training_Types").forEach(function (row) { if (row.TrainingType) types[String(row.TrainingType)] = String(row.DisplayName || row.TrainingType); });
  readRuntimeRows_("_Raw_Attendance").forEach(function (row) {
    var localDate = Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM-dd");
    if (row.TrainingType && !types[String(row.TrainingType)]) types[String(row.TrainingType)] = String(row.TrainingType);
    if (localDate < from || localDate > to || (trainingType && String(row.TrainingType).toUpperCase() !== trainingType)) return;
    var memberId = normalizeMemberId_(row.MemberID), timestamp = new Date(row.Timestamp);
    total += 1;
    counts[memberId] = (counts[memberId] || 0) + 1;
    names[memberId] = { memberId: memberId, firstName: String(row.FirstName || ""), lastName: String(row.LastName || "") };
    if (!lastCheckins[memberId] || timestamp.getTime() > lastCheckins[memberId].getTime()) lastCheckins[memberId] = timestamp;
  });
  var top = Object.keys(counts).map(function (memberId) { return { memberId: memberId, firstName: names[memberId].firstName, lastName: names[memberId].lastName, attendanceCount: counts[memberId], lastCheckin: adminInstantText_(lastCheckins[memberId], timezone) }; }).sort(reportCountSort_).slice(0, 100);
  var trainingTypes = Object.keys(types).sort(function (left, right) { return types[left].localeCompare(types[right]); }).map(function (key) { return { value: key, label: types[key] }; });
  return { from: from, to: to, trainingType: trainingType, trainingTypes: trainingTypes, totalCheckins: total, uniqueAttendees: Object.keys(counts).length, topAttendees: top };
}

function reportCountSort_(left, right) {
  return right.attendanceCount - left.attendanceCount || (left.lastName + left.firstName + left.memberId).localeCompare(right.lastName + right.firstName + right.memberId);
}
