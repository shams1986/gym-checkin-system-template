function listMembers_(filters) {
  filters = filters || {};
  var settings = getRuntimeSettings_();
  var timezone = settings.Timezone;
  var query = adminString_(filters.query, 100).toUpperCase();
  var status = adminString_(filters.status || "Active", 20).toUpperCase();
  var category = adminString_(filters.category, 80).toUpperCase();
  var attendanceByMember = latestAttendanceByMember_();
  var cardByMember = cardStateByMember_();
  var allMembers = readRuntimeRows_("Members");
  var categories = [];

  var items = allMembers.filter(function (member) {
    var memberCategory = String(member.Category || "").trim();
    if (memberCategory && categories.indexOf(memberCategory) === -1) {
      categories.push(memberCategory);
    }
    var haystack = [member.MemberID, member.FirstName, member.LastName].join(" ").toUpperCase();
    var statusMatches = status === "ALL" || String(member.Status).toUpperCase() === status;
    var categoryMatches = !category || memberCategory.toUpperCase() === category;
    return (!query || haystack.indexOf(query) !== -1) && statusMatches && categoryMatches;
  }).map(function (member) {
    var memberId = normalizeMemberId_(member.MemberID);
    return serializeMember_(member, timezone, attendanceByMember[memberId], cardByMember[memberId]);
  });

  items.sort(function (left, right) {
    return (left.lastName + " " + left.firstName + " " + left.memberId).localeCompare(right.lastName + " " + right.firstName + " " + right.memberId);
  });
  categories.sort();
  var page = adminPage_(filters.page, 1);
  var pageSize = adminPageSize_(filters.pageSize, 25);
  var offset = (page - 1) * pageSize;
  return { items: items.slice(offset, offset + pageSize), total: items.length, page: page, pageSize: pageSize, categories: categories };
}

function getMember_(payload) {
  var memberId = normalizeMemberId_(payload.memberId);
  var member = findMemberById_(memberId);
  if (!member) {
    throw adminError_("member_not_found", "Member not found.");
  }
  var timezone = getRuntimeSettings_().Timezone;
  return serializeMember_(member, timezone, latestAttendanceByMember_()[memberId], cardStateByMember_()[memberId]);
}

function getMemberFormOptions_() {
  var settings = getRuntimeSettings_();
  var categories = readRuntimeRows_("Members").map(function (row) { return String(row.Category || "").trim(); }).filter(Boolean);
  categories = categories.filter(function (value, index, all) { return all.indexOf(value) === index; }).sort();
  return {
    categories: categories,
    statuses: ["Active", "Inactive"],
    today: Utilities.formatDate(new Date(), settings.Timezone, "yyyy-MM-dd"),
    memberIdNotice: "Member ID will be generated automatically",
  };
}

function createMember_(data) {
  var input = validateMemberInput_(data, false);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw adminError_("busy", "Member creation is busy. Please try again.");
  }
  try {
    var settings = getRuntimeSettings_();
    var prefix = validateMemberPrefix_(settings.MemberIdPrefix || "GYM");
    var width = boundedInteger_(settings.MemberIdNumberWidth, 4, 1, 10);
    var internalSheet = getRuntimeSheet_("_Internal_Config");
    var sequenceRow = findRowByValue_(internalSheet, 1, "NextMemberNumber");
    if (!sequenceRow) {
      throw new Error("NextMemberNumber is missing");
    }
    var sequence = Math.max(1, Number(internalSheet.getRange(sequenceRow, 2).getValue()) || 1);
    var memberId = "";
    for (var attempt = 0; attempt < 100; attempt += 1) {
      var candidate = prefix + String(sequence).padStart(width, "0");
      if (!findMemberById_(candidate)) {
        memberId = candidate;
        break;
      }
      sequence += 1;
    }
    if (!memberId) {
      throw new Error("Could not allocate a unique member ID");
    }

    var members = getRuntimeSheet_("Members");
    members.appendRow(memberValues_(memberId, input));
    var appendedRow = members.getLastRow();
    try {
      internalSheet.getRange(sequenceRow, 2, 1, 2).setValues([[sequence + 1, new Date()]]);
    } catch (error) {
      if (String(members.getRange(appendedRow, 1).getDisplayValue()) === memberId) {
        members.deleteRow(appendedRow);
      }
      throw error;
    }
    return savedMemberResponse_(memberId, input, "");
  } finally {
    lock.releaseLock();
  }
}

function updateMember_(payload) {
  var memberId = normalizeMemberId_(payload.memberId);
  var existing = findMemberById_(memberId);
  if (!existing) {
    throw adminError_("member_not_found", "Member not found.");
  }
  var input = validateMemberInput_(payload.data || payload, true);
  replaceRuntimeRow_("Members", existing._rowNumber, memberValues_(memberId, input, existing.CardURL));
  return savedMemberResponse_(memberId, input, existing.CardURL);
}

function setMemberStatus_(payload) {
  var memberId = normalizeMemberId_(payload.memberId);
  var member = findMemberById_(memberId);
  if (!member) {
    throw adminError_("member_not_found", "Member not found.");
  }
  var active = adminBoolean_(payload.active, null);
  if (active === null) {
    throw adminError_("validation_error", "Choose a valid member status.", { active: "Required" });
  }
  getRuntimeSheet_("Members").getRange(member._rowNumber, 4).setValue(active ? "Active" : "Inactive");
  return { memberId: memberId, status: active ? "Active" : "Inactive" };
}

function getMemberAttendance_(payload) {
  var memberId = normalizeMemberId_(payload.memberId);
  if (!findMemberById_(memberId)) {
    throw adminError_("member_not_found", "Member not found.");
  }
  var filters = payload.filters || payload;
  var settings = getRuntimeSettings_();
  var timezone = settings.Timezone;
  var from = adminString_(filters.from, 10);
  var to = adminString_(filters.to, 10);
  var rows = readRuntimeRows_("_Raw_Attendance").filter(function (row) {
    var localDate = Utilities.formatDate(new Date(row.Timestamp), timezone, "yyyy-MM-dd");
    return normalizeMemberId_(row.MemberID) === memberId && (!from || localDate >= from) && (!to || localDate <= to);
  }).map(function (row) { return serializeAttendance_(row, timezone); });
  rows.sort(function (left, right) { return right.timestamp.localeCompare(left.timestamp); });
  return { items: rows.slice(0, 100), total: rows.length };
}

function validateMemberInput_(data) {
  data = data || {};
  var fields = {};
  var firstName = adminString_(data.firstName, 80);
  var lastName = adminString_(data.lastName, 80);
  if (!firstName) fields.firstName = "First name is required.";
  if (!lastName) fields.lastName = "Last name is required.";
  var joinedAt = adminString_(data.joinedAt, 10);
  if (joinedAt && !/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) fields.joinedAt = "Use YYYY-MM-DD.";
  if (Object.keys(fields).length) throw adminError_("validation_error", "Check the highlighted fields.", fields);
  return {
    firstName: firstName,
    lastName: lastName,
    status: adminBoolean_(data.active, String(data.status).toUpperCase() !== "INACTIVE") ? "Active" : "Inactive",
    category: adminString_(data.category, 80),
    joinedAt: joinedAt,
    notes: adminString_(data.notes, 500),
  };
}

function memberValues_(memberId, input, cardUrl) {
  return [memberId, input.firstName, input.lastName, input.status, input.category, input.joinedAt, input.notes, cardUrl || ""];
}

function savedMemberResponse_(memberId, input, cardUrl) {
  return { memberId: memberId, firstName: input.firstName, lastName: input.lastName, status: input.status, category: input.category, joinedAt: input.joinedAt, notes: input.notes, lastAttendance: "", card: { status: cardUrl ? "generated" : "missing", url: String(cardUrl || ""), generatedAt: "" } };
}

function validateMemberPrefix_(value) {
  var prefix = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,16}$/.test(prefix)) throw new Error("Invalid MemberIdPrefix setting");
  return prefix;
}

function latestAttendanceByMember_() {
  var latest = {};
  readRuntimeRows_("_Raw_Attendance").forEach(function (row) {
    var memberId = normalizeMemberId_(row.MemberID);
    var instant = row.Timestamp instanceof Date ? row.Timestamp : new Date(row.Timestamp);
    if (!latest[memberId] || instant.getTime() > new Date(latest[memberId].Timestamp).getTime()) latest[memberId] = row;
  });
  return latest;
}

function cardStateByMember_() {
  var states = {};
  readRuntimeRows_("_Card_State").forEach(function (row) { states[normalizeMemberId_(row.MemberID)] = row; });
  return states;
}

function serializeMember_(member, timezone, attendance, card) {
  return {
    memberId: normalizeMemberId_(member.MemberID), firstName: String(member.FirstName || ""), lastName: String(member.LastName || ""),
    status: String(member.Status || ""), category: String(member.Category || ""), joinedAt: adminDateText_(member.JoinedAt, timezone),
    notes: String(member.Notes || ""), lastAttendance: attendance ? adminInstantText_(attendance.Timestamp, timezone) : "",
    card: { status: card && card.CardURL ? "generated" : card && card.LastError ? "failed" : "missing", url: card ? String(card.CardURL || "") : "", generatedAt: card ? adminInstantText_(card.GeneratedAt, timezone) : "" },
  };
}

function serializeAttendance_(row, timezone) {
  return { timestamp: adminInstantText_(row.Timestamp, timezone), memberId: normalizeMemberId_(row.MemberID), firstName: String(row.FirstName || ""), lastName: String(row.LastName || ""), trainingType: String(row.TrainingType || ""), trainingName: String(row.TrainingName || ""), trainingStart: String(row.TrainingStart || "") };
}
