function getAttendance_(filters) {
  filters = filters || {};
  var timezone = getRuntimeSettings_().Timezone;
  var today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  var from = attendanceDateFilter_(filters.from || today, "from");
  var to = attendanceDateFilter_(filters.to || today, "to");
  if (from > to) throw adminError_("validation_error", "The from date must not be after the to date.", { from: "Choose an earlier date.", to: "Choose a later date." });
  var trainingType = adminString_(filters.trainingType, 80).toUpperCase();
  var trainingName = adminString_(filters.trainingName, 120).toUpperCase();
  var query = adminString_(filters.query, 100).toUpperCase();
  var allRows = readRuntimeRows_("_Raw_Attendance");
  var options = attendanceFilterOptions_(allRows);
  var rows = allRows.filter(function (row) {
    var localDate = Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM-dd");
    var memberText = [row.MemberID, row.FirstName, row.LastName].join(" ").toUpperCase();
    return localDate >= from && localDate <= to && (!trainingType || String(row.TrainingType).toUpperCase() === trainingType) && (!trainingName || String(row.TrainingName).toUpperCase() === trainingName) && (!query || memberText.indexOf(query) !== -1);
  }).sort(function (left, right) { return new Date(right.Timestamp).getTime() - new Date(left.Timestamp).getTime(); });
  var page = adminPage_(filters.page, 1);
  var pageSize = adminPageSize_(filters.pageSize, 50);
  var offset = (page - 1) * pageSize;
  return { items: rows.slice(offset, offset + pageSize).map(function (row) { return serializeAttendance_(row, timezone); }), total: rows.length, page: page, pageSize: pageSize, from: from, to: to, trainingTypes: options.trainingTypes, trainingNames: options.trainingNames };
}

function getMemberAttendance_(payload) {
  payload = payload || {};
  var memberId = normalizeMemberId_(payload.memberId);
  if (!findMemberById_(memberId)) throw adminError_("member_not_found", "Member not found.");
  var filters = payload.filters || payload;
  var timezone = getRuntimeSettings_().Timezone;
  var period = adminString_(filters.period, 10);
  var today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  var from = filters.from ? attendanceDateFilter_(filters.from, "from") : "";
  var to = filters.to ? attendanceDateFilter_(filters.to, "to") : "";
  if (period === "30" || period === "90") { from = addLocalDays_(today, -Number(period)); to = today; }
  if (period === "year") { from = today.slice(0, 4) + "-01-01"; to = today; }
  var lowerBound = from || "0000-01-01", upperBound = to || "9999-12-31";
  if (from && to && from > to) throw adminError_("validation_error", "The from date must not be after the to date.");
  var rows = readRuntimeRows_("_Raw_Attendance").filter(function (row) {
    var localDate = Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM-dd");
    return normalizeMemberId_(row.MemberID) === memberId && localDate >= lowerBound && localDate <= upperBound;
  }).sort(function (left, right) { return new Date(right.Timestamp).getTime() - new Date(left.Timestamp).getTime(); });
  var page = adminPage_(filters.page, 1), pageSize = adminPageSize_(filters.pageSize, 25), offset = (page - 1) * pageSize;
  return { items: rows.slice(offset, offset + pageSize).map(function (row) { return serializeAttendance_(row, timezone); }), total: rows.length, page: page, pageSize: pageSize, from: from, to: to };
}

function attendanceDateFilter_(value, field) {
  var text = adminString_(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw adminError_("validation_error", "Choose valid attendance dates.", (function () { var result = {}; result[field] = "Use YYYY-MM-DD."; return result; })());
  var parsed = new Date(text + "T00:00:00Z");
  if (isNaN(parsed.getTime()) || Utilities.formatDate(parsed, "Etc/UTC", "yyyy-MM-dd") !== text) throw adminError_("validation_error", "Choose valid attendance dates.");
  return text;
}

function attendanceFilterOptions_(rows) {
  var types = {}, names = {};
  rows.forEach(function (row) { if (row.TrainingType) types[String(row.TrainingType)] = true; if (row.TrainingName) names[String(row.TrainingName)] = true; });
  return { trainingTypes: Object.keys(types).sort(), trainingNames: Object.keys(names).sort() };
}
