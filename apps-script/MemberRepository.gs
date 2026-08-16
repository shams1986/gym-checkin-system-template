function findMemberById_(memberId) {
  var members = readRuntimeRows_("Members");
  for (var index = 0; index < members.length; index += 1) {
    if (normalizeMemberId_(members[index].MemberID) === memberId) {
      return members[index];
    }
  }
  return null;
}
