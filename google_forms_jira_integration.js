/**
 * Google Form to Jira Integration (Boilerplate)
 * * CORE FEATURES:
 * 1. Creates Jira Issues from Google Form submissions.
 * 2. Handles Jira Cloud "Atlassian Document Format" (ADF) automatically.
 * 3. Writes the Jira Issue Key back to the Google Sheet.
 * 4. Uses Timestamp lookup to ensure race-conditions don't write to the wrong row.
 * * SETUP INSTRUCTIONS:
 * 1. Attach this script to the Google Sheet linked to your Form.
 * 2. Set up the following in File > Project Settings > Script Properties:
 * - jiraDomain (e.g., https://yourcompany.atlassian.net)
 * - jiraEmail (The email you use to log into Jira)
 * - jiraApiToken (Generate at id.atlassian.com)
 * - jiraProjectKey (e.g., MKT, IT, OPS)
 * - jiraReporterId (The Atlassian Account ID of the "reporter" bot user)
 * - sheetName (The specific tab name, e.g., "Form Responses 1")
 * * 3. Create a Trigger: Edit > Current Project's Triggers > Add Trigger > onFormSubmit > From form.
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// Jira Auth & Environment
const JIRA_DOMAIN      = SCRIPT_PROPERTIES.getProperty("jiraDomain");
const JIRA_EMAIL       = SCRIPT_PROPERTIES.getProperty("jiraEmail"); 
const JIRA_API_TOKEN   = SCRIPT_PROPERTIES.getProperty("jiraApiToken");
const PROJECT_KEY      = SCRIPT_PROPERTIES.getProperty("jiraProjectKey");
const REPORTER_ID      = SCRIPT_PROPERTIES.getProperty("jiraReporterId"); 
const ISSUE_TYPE       = "Task"; // Change to "Story", "Bug", or "Epic" as needed

// Spreadsheet Config
const SHEET_NAME        = SCRIPT_PROPERTIES.getProperty("sheetName") || "Form Responses 1";
const TIMESTAMP_COL     = 1;  // Usually Column A
const JIRA_KEY_COL      = 1;  // Where to write the Jira Key? (1 = Column A, overwrites timestamp? Better to use a new column index)
// NOTE: It is recommended to create a dedicated column for "Jira Key" in your sheet (e.g., Col 10) and update this number.

// Jira Custom Field IDs (Map your specific Jira fields here)
// Find these by visiting: [Jira URL]/rest/api/3/field
const JIRA_FIELDS = {
    department: "customfield_10001", // Example: Single Select
    requestType: "customfield_10002", // Example: Dropdown
    dueDate: "customfield_10003",     // Example: Date Picker
    budgetCode: "customfield_10004"   // Example: Text Field
};

// ==========================================
// 2. MAIN TRIGGER
// ==========================================

function onFormSubmit(e) {
    if (!e) { Logger.log("No event object. Run via Trigger."); return; }

    var formResponse = e.response;
    var submissionTs = formResponse.getTimestamp(); 
    var respondentEmail = formResponse.getRespondentEmail();

    Logger.log("New Submission: " + respondentEmail + " at " + submissionTs);

    // --- 2a. Parse Form Data ---
    var formData = parseFormResponses(formResponse);

    // --- 2b. Locate Sheet Row (For Write-back) ---
    var targetRow = null;
    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
        targetRow = findRowByTimestamp(sheet, submissionTs, TIMESTAMP_COL);
    } catch (err) {
        Logger.log("⚠ Row lookup failed: " + err);
        // We continue anyway to ensure the ticket is created even if write-back fails
    }

    // --- 2c. Create Jira Ticket ---
    if (formData.summary) {
        createJiraTicket(formData, respondentEmail, targetRow);
    } else {
        Logger.log("❌ Error: Summary missing. Ticket not created.");
    }
}

// ==========================================
// 3. DATA MAPPING (CUSTOMIZE THIS)
// ==========================================

function parseFormResponses(formResponse) {
    var itemResponses = formResponse.getItemResponses();
    
    // Initialize data object
    var data = {
        summary: "",
        description: "",
        department: null,
        requestType: [],
        dueDate: null,
        budgetCode: ""
    };

    // Loop through form questions
    for (var i = 0; i < itemResponses.length; i++) {
        var item = itemResponses[i];
        var title = item.getItem().getTitle(); // The exact Question Title on Google Form
        var response = item.getResponse();

        // >>> MAP YOUR QUESTIONS HERE <<<
        switch (title) {
            case "Short Request Summary":
                data.summary = response;
                break;

            case "Detailed Description":
                data.description = response;
                break;

            case "Which Department is this for?": 
                // Handling Single Selects
                data.department = response; 
                break;

            case "Request Type":
                // Handling Multi-Select (Checkboxes)
                // Ensure it's always an array for the payload builder
                data.requestType = Array.isArray(response) ? response : [response];
                break;

            case "Desired Due Date":
                // Ensure date format YYYY-MM-DD
                data.dueDate = response; 
                break;
                
            case "Budget Code":
                data.budgetCode = response;
                break;
                
            // Add more cases here matching your Form Question Titles
        }
    }

    // Fallback: If no summary provided, generate one
    if (!data.summary) {
        data.summary = "New Request from " + formResponse.getRespondentEmail();
    }

    return data;
}

// ==========================================
// 4. PAYLOAD BUILDER
// ==========================================

function buildJiraPayload(data, respondentEmail) {
    
    var payloadObj = {
        fields: {
            project: { key: PROJECT_KEY },
            issuetype: { name: ISSUE_TYPE },
            summary: data.summary,
            description: toADF(data.description), // Converts text to Jira Cloud Format
            reporter: { accountId: REPORTER_ID }, // The API user/bot
            
            // Standard Jira Field: Labels (Optional)
            labels: ["google-form-generated"],

            // --- Custom Fields Mapping ---
            
            // Example 1: Text Field
            [JIRA_FIELDS.budgetCode]: data.budgetCode,

            // Example 2: Date Field
            [JIRA_FIELDS.dueDate]: data.dueDate,

            // Example 3: Single Select Dropdown
            // Note: Use { value: "Option" } or { id: "100" }
            [JIRA_FIELDS.department]: data.department ? { value: data.department } : null,

            // Example 4: Multi-Select Checkboxes
            // Must map array of strings to array of objects: [{value: "A"}, {value: "B"}]
            [JIRA_FIELDS.requestType]: data.requestType.map(function(val) { 
                return { value: val }; 
            })
        }
    };

    // Clean up undefined fields to prevent API errors
    // (Optional utility to remove keys with null values if your Jira setup is strict)
    
    return payloadObj;
}

// ==========================================
// 5. API INTERACTION
// ==========================================

function createJiraTicket(data, respondentEmail, targetRow) {
    var payload = buildJiraPayload(data, respondentEmail);
    var payloadString = JSON.stringify(payload);

    Logger.log("Sending Payload: " + payloadString);

    var url = JIRA_DOMAIN + "/rest/api/3/issue";
    var options = {
        method: "post",
        contentType: "application/json",
        headers: {
            "Authorization": "Basic " + Utilities.base64Encode(JIRA_EMAIL + ":" + JIRA_API_TOKEN),
            "Accept": "application/json"
        },
        payload: payloadString,
        muteHttpExceptions: true
    };

    try {
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();
        var responseBody = response.getContentText();

        if (responseCode >= 200 && responseCode < 300) {
            var responseJson = JSON.parse(responseBody);
            var issueKey = responseJson.key;
            Logger.log("✅ Created: " + issueKey);
            
            // Write back to sheet
            if (targetRow) {
                writeToSheet(targetRow, issueKey);
            }
        } else {
            Logger.log("❌ Jira Error (" + responseCode + "): " + responseBody);
            if (targetRow) writeToSheet(targetRow, "Error: " + responseCode);
            sendErrorEmail("Jira API Error", responseBody, payloadString);
        }
    } catch (e) {
        Logger.log("❌ System Error: " + e.toString());
        sendErrorEmail("Script Runtime Error", e.toString(), payloadString);
    }
}

// ==========================================
// 6. HELPER FUNCTIONS
// ==========================================

// Write Jira Key back to the sheet
function writeToSheet(row, value) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    // Assuming you want to write this to a specific column. 
    // If you used the original script's logic, it overwrote Column 1. 
    // It is safer to use a dedicated column, e.g., Column 10 (J).
    var OUTPUT_COLUMN = 10; 
    sheet.getRange(row, OUTPUT_COLUMN).setValue(value);
}

// Convert plain text to Atlassian Document Format (ADF) - REQUIRED for Jira Cloud
function toADF(text) {
    if (!text) return undefined;
    var safeText = String(text);
    var paragraphs = safeText.split(/\r?\n/).map(function(line) {
        return {
            type: "paragraph",
            content: line.trim() ? [{ type: "text", text: line }] : []
        };
    });
    return { type: "doc", version: 1, content: paragraphs };
}

// Scans sheet from bottom up to find the exact submission row based on timestamp
function findRowByTimestamp(sheet, ts, colIndex) {
    if (!(ts instanceof Date)) throw new Error("Invalid Timestamp");
    
    var lastRow = sheet.getLastRow();
    var lookback = 20; // Only check last 20 rows for performance
    var startRow = Math.max(1, lastRow - lookback);
    var numRows = lastRow - startRow + 1;
    
    if (numRows < 1) return null;

    var values = sheet.getRange(startRow, colIndex, numRows, 1).getValues();
    var targetTime = ts.getTime();

    // Loop backwards
    for (var i = values.length - 1; i >= 0; i--) {
        var cellDate = values[i][0];
        if (cellDate instanceof Date && Math.abs(cellDate.getTime() - targetTime) < 1000) {
            // allowing 1 second variance just in case, usually exact match works
            return startRow + i; 
        }
    }
    throw new Error("Row not found for timestamp: " + ts);
}

// Simple Error Alert
function sendErrorEmail(subject, errorDetails, payload) {
    // You can hardcode an email here or use a Script Property
    var adminEmail = SCRIPT_PROPERTIES.getProperty("adminEmail"); 
    if (adminEmail) {
        MailApp.sendEmail({
            to: adminEmail,
            subject: "Alert: Jira Integration Failed - " + subject,
            body: "Error Details:\n" + errorDetails + "\n\nPayload Attempted:\n" + payload
        });
    }
}
