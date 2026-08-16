function checkIn_(memberId, requestMeta) {
  requestMeta = requestMeta || {};
  var normalizedId = normalizeMemberId_(memberId);
  var requestId = truncateRuntimeText_(requestMeta.requestId, 80);
  var settings = {};

  if (!normalizedId) {
    return createScannerResponse_("error", "invalid_payload", {}, settings);
  }

  try {
    settings = getRuntimeSettings_();
    var member = findMemberById_(normalizedId);
    if (!member) {
      return createScannerResponse_("not_found", "member_not_found", { memberId: normalizedId }, settings);
    }
    if (!isRuntimeActive_(member.Status)) {
      return createScannerResponse_("inactive", "member_inactive", { memberId: normalizedId }, settings);
    }

    var now = requestMeta.now instanceof Date ? requestMeta.now : new Date();
    var resolution = resolveCheckinSession_(member, now, settings);
    if (!resolution.session) {
      return createScannerResponse_("outside_window", resolution.reason, {
        memberId: normalizedId,
        firstName: String(member.FirstName || "") || null,
      }, settings);
    }

    var session = resolution.session;
    var context = {
      memberId: normalizedId,
      firstName: String(member.FirstName || "") || null,
      trainingType: session.trainingType,
      trainingName: session.trainingName,
      trainingStart: session.trainingStart,
    };
    var message = selectCheckinMessage_(session.trainingType, member.Category);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      throw new Error("Check-in lock timeout");
    }

    try {
      if (findAttendanceForTraining_(normalizedId, session.trainingKey)) {
        return createScannerResponse_("duplicate", "already_checked_in", context, settings);
      }

      var attendance = {
        attendanceId: Utilities.getUuid(),
        timestamp: now,
        memberId: normalizedId,
        firstName: String(member.FirstName || ""),
        lastName: String(member.LastName || ""),
        memberCategory: String(member.Category || ""),
        trainingKey: session.trainingKey,
        trainingType: session.trainingType,
        trainingName: session.trainingName,
        trainingStart: session.trainingStart,
        messageId: message.id,
        source: truncateRuntimeText_(requestMeta.source || "scanner", 40),
        createdAt: new Date(),
      };
      var appendedRow = appendAttendance_(attendance);
      try {
        upsertCheckinState_(attendance);
      } catch (stateError) {
        rollbackAttendance_(appendedRow, attendance.attendanceId);
        throw stateError;
      }
      context.message = message.text;
      return createScannerResponse_("success", "attendance_recorded", context, settings);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    logCheckinFailure_("checkin", normalizedId, error, requestId);
    return createScannerResponse_("error", "backend_error", { memberId: normalizedId }, settings);
  }
}
