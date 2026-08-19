function renderAdminApp_() {
  var template = HtmlService.createTemplateFromFile("Admin");
  return template.evaluate()
    .setTitle("Gym Check-in Admin")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function includeAdminFile_(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

function includeAdminScript_(filename) {
  return includeAdminFile_(filename).replace(/<\//g, "<\\/");
}
