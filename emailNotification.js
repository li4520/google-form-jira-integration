/**
 * Sends a generic error email to the configured recipients.
 * errorEmailRecipients script property should contain comma-separated emails.
 *
 * @param {Object} details
 * @param {string} details.errorText - Full error text describing the failure or exception.
 * @param {string} [details.payload] - JSON payload or context data related to the error (pretty-printed).
 */
function emailNotification(details) {
  var recipients = (PropertiesService.getScriptProperties().getProperty("errorEmailRecipients") || "").trim();
  if (!recipients) {
    Logger.log("errorEmailRecipients script property not configured. Skipping alert email.");
    return;
  }

  var safeDetails = details || {};
  var errorText = safeDetails.errorText || "No error text provided.";
  var payload = safeDetails.payload || "";

  var messageParts = [
    "An automated process encountered an error.",
    "Error:\n" + errorText
  ];

  if (payload) {
    messageParts.push("Original JSON Payload:\n" + payload);
  }

  var subject = "[System Alert] Error Notification";
  var body = messageParts.join("\n\n");
  MailApp.sendEmail(recipients, subject, body);
  Logger.log("Sent error notification email to: " + recipients);

  
}
