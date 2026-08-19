var ADMIN_ACTIONS = Object.freeze({
  getAdminSession: getAdminSession_,
  getDashboardData: getDashboardData_,
  listMembers: listMembers_,
  getMember: getMember_,
  getMemberAttendance: getMemberAttendance_,
  getAttendance: getAttendance_,
  getReportData: getReportData_,
  getMemberFormOptions: getMemberFormOptions_,
  createMember: createMember_,
  updateMember: updateMember_,
  setMemberStatus: setMemberStatus_,
  listSchedule: listSchedule_,
  createScheduleEntry: createScheduleEntry_,
  updateScheduleEntry: updateScheduleEntry_,
  setScheduleStatus: setScheduleStatus_,
  deleteScheduleEntry: deleteScheduleEntry_,
  saveScheduleOrder: saveScheduleOrder_,
  createTrainingType: createTrainingType_,
  updateTrainingType: updateTrainingType_,
  deleteTrainingType: deleteTrainingType_,
  getSettings: getAdminSettings_,
  updateSettings: updateAdminSettings_,
  testCardConfiguration: testCardConfiguration_,
  listBasicMessages: listBasicMessages_,
  saveBasicMessage: saveBasicMessage_,
  deleteBasicMessage: deleteBasicMessage_,
  listMemberCards: listMemberCards_,
  generateMemberCard: generateMemberCard_,
  regenerateMemberCard: regenerateMemberCard_,
  generateMissingMemberCards: generateMissingMemberCards_,
});

function adminApi(action, payload) {
  var requestId = Utilities.getUuid();
  try {
    var admin = authorizeAdmin_();
    var handler = ADMIN_ACTIONS[String(action || "")];
    if (!handler) {
      throw adminError_("unsupported_action", "That admin action is not available.");
    }
    return { ok: true, data: handler(payload || {}, admin), error: null };
  } catch (error) {
    logCheckinFailure_("admin:" + truncateRuntimeText_(action, 40), "", error, requestId);
    return {
      ok: false,
      data: null,
      error: {
        code: error.adminCode || "system_error",
        message: error.adminCode ? error.message : "The request could not be completed. Please try again.",
        fields: error.adminFields || null,
        requestId: requestId,
      },
    };
  }
}

function getAdminSession_(payload, admin) {
  return { email: admin.email };
}
