function renderAdminApp_() {
  var template = HtmlService.createTemplateFromFile("Admin");
  template.oauthClientIdJson = JSON.stringify(getConfiguredAdminClientId_());
  return template.evaluate()
    .setTitle("Gym Check-in Admin")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function includeAdminFile_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
