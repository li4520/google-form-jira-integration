// Placeholders
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const BEARER_TOKEN = SCRIPT_PROPERTIES.getProperty("jiraBearerToken"); // Get JIRA bear token
const JIRA_DOMAIN = SCRIPT_PROPERTIES.getProperty("jiraDomain"); // JIRA domain
const PROJECT_KEY = SCRIPT_PROPERTIES.getProperty("jiraProjectKey"); // JIRA project key
const ISSUE_TYPE = SCRIPT_PROPERTIES.getProperty("issueType"); // JIRA issue type
const FORM_ID = SCRIPT_PROPERTIES.getProperty("formId"); // Google Form ID
const REPORTER = SCRIPT_PROPERTIES.getProperty("jiraReporter"); // JIRA reporter username
const SPREADSHEET_ID = SCRIPT_PROPERTIES.getProperty("spreadsheetId"); // Google Spreadsheet ID
const SHEET_NAME = SCRIPT_PROPERTIES.getProperty("sheetName"); // Google Spreadsheet's sheet name to capture JIRA response


// Jira Custom Field IDs
const JIRA_CUSTOM_FIELDS = {
    epic: "customfield_10001",
    email: "customfield_10002",
    preferredContactName: "customfield_10003",
    brandCategory: "customfield_10004", // select list (cascading) in Jira - need to populate category + brand
    campaignName: "customfield_10005",
    requestDescription: "customfield_10006",
    // Additional custom fields here
};

// Function to handle form submission
function onFormSubmit(e) {

    if (!e) {
        Logger.log("No event object received");
        return;
    }

    var formResponse = e.response;
    Logger.log("FormResponse received");

    // Get respondent's email address
    var respondentEmail = formResponse.getRespondentEmail();
    Logger.log("Respondent's email: " + respondentEmail);

    // Get all item responses
    var itemResponses = formResponse.getItemResponses();
    var preferredContactName = "";
    var brandCategory = "";
    var campaignName = "";
    var requestDescription = "";
    // Additional variables to capture here

    // Extract responses
    for (var i = 0; i < itemResponses.length; i++) {
        var itemResponse = itemResponses[i];
        var title = itemResponse.getItem().getTitle();
        var response = itemResponse.getResponse();
        Logger.log("Response for item " + title + ": " + response);

        if (title === "Preferred Contact Name") {
            preferredContactName = response;
        }
        else if (title === "Brand Category") {
            brandCategory = response;
        }
        else if (["Home Care Brand", "Oral Care Brand", "Personal Care Brand", "Pet Nutrition Brand", "Skin Health Brand"].includes(title)) {
            brand = response;
        }
        else if (title === "Campaign Name") {
            campaignName = response;
        }
        else if (title === "Description of Request") {
            requestDescription = response;
        }
        // Additional responses to capture here
    }

    // Create the jiraEpic and jiraSummary variables
    var jiraEpic = `${brandCategory} | ${campaignName}`;
    var jiraSummary = jiraEpic; // Same value as jiraEpic for now

    // Check all required values for Jira - Epic and Summary
    if (jiraEpic && jiraSummary) {

        createJiraTicket({
            jiraEpic,
            jiraSummary,
            respondentEmail,
            preferredContactName,
            brandCategory,
            campaignName,
            requestDescription,
            // Additional variables to capture here
        });
    
    } else {
        Logger.log("jiraEpic or jiraSummary not found");
    }
}


function createJiraTicket(data) {

    // Construct the divisionHub field dynamically based on whether localMarket is populated
    var divisionHubField = {
        value: data.divisionHub
    };

    // Add child value to the field if localMarket is populated, otherwise set child to null. JSON structure for jira cascading field is weird like this.
    if (data.localMarket) {
        divisionHubField.child = {
            value: data.localMarket
        };
    } else {
        divisionHubField.child = null;
    }
    
    // Jira JSON payload
    var payload = {
        fields: {
            project: {
                key: PROJECT_KEY,
            },
            [JIRA_CUSTOM_FIELDS.epic]: data.jiraEpic,
            summary: data.jiraSummary,
            issuetype: {
                name: ISSUE_TYPE,
            },
            description: data.requestDescription,
            [JIRA_CUSTOM_FIELDS.preferredContactName]: data.preferredContactName,
            [JIRA_CUSTOM_FIELDS.brandCategory]: {
                value: data.brandCategory,
                child: {
                    value: data.brand
                }
            },
            [JIRA_CUSTOM_FIELDS.campaignName]: data.campaignName,
            // Additional fields to capture here

        }
    };

    Logger.log("Payload: " + JSON.stringify(payload, null, 2)); // Pretty print the payload

    var options = {
        method: "post",
        contentType: "application/json",
        headers: {
            Authorization: "Bearer " + BEARER_TOKEN,
        },
        payload: JSON.stringify(payload),
    };

    var url = JIRA_DOMAIN + "/rest/api/2/issue";

    try {
        var response = UrlFetchApp.fetch(url, options);
        Logger.log("Response: " + response.getContentText());
        
        // Parse the response to get the JIRA issue key
        var jiraIssueKey = JSON.parse(response.getContentText()).key;
        
        // Capture the JIRA issue key in the Google Sheet
        captureJiraResponse(jiraIssueKey);

    } catch (error) {
        Logger.log("Error: " + error.toString());

        // Capture the JIRA error in the Google Sheet
        captureJiraResponse("Error: " + error.toString());
    }
}

// Capture the JIRA response in the Google Sheet
function captureJiraResponse(jiraResponse) {

    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME); 

    // Get the row to the last form submission
    var formRow = sheet.getLastRow(); // Gets the last row, which should correspond to the new submission

    // Record the JIRA response in the last row and first column
    sheet.getRange(formRow, 1).setValue(jiraResponse);
}
