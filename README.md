
# Google Forms to JIRA Integration

This project automates the process of capturing Google Forms submissions and creating corresponding tickets in JIRA. The script uses Google Apps Script to extract form responses, construct a JIRA API payload, and send the data to JIRA to create a new issue.

## Features

- **Form Integration:** Captures responses from a linked Google Form.
- **JIRA Ticket Creation:** Automatically creates JIRA issues with the collected data.
- **Cascading Fields Handling:** Dynamically constructs and populates JIRA custom fields, including select list cascading fields.
- **Customizable:** Easily configurable to add more fields or modify existing logic.
- **Logs and Captures JIRA API Responses:** Logs the JIRA issue key and captures responses in a linked Google Sheet.

## Prerequisites

- **Google Workspace:** Access to Google Forms and Google Sheets.
- **JIRA Access:** JIRA account with API access and appropriate permissions to create issues.

## Setup

1. **Clone the Repository**  
   Clone the repository or create a Google Apps Script project and copy the contents of the script into the editor.

2. **Update the Script Properties**  
   Set up the following properties in Project Settings > Script Properities
   - **bearerToken:** The JIRA API bearer token. 
   - **jiraDomain:** The domain URL of your JIRA instance.
   - **jiraProjectKey:** The JIRA project key where issues will be created.
   - **issueType:** The JIRA issue type to be created (e.g., Task, Bug).
   - **formId:** The Google Form ID that will trigger this script.
   - **jiraReporter:** The reporter name in JIRA (optional).
   - **spreadsheetId:** The ID of the linked Google Sheet where responses are captured.
   - **sheetName:** The name of the sheet within the Google Sheet where JIRA responses are logged.

3. **Customize Jira Custom Field IDs**  
   Update the custom field IDs in the script to match the custom field IDs in your JIRA instance.

4. **Customize Form Fields**
   To add or modify fields being captured from the form, update the logic inside the `onFormSubmit` function. The script uses the form field titles to map responses to variables. Ensure the form field titles match exactly as referenced in the script.

5. **Customizing JIRA Payload**
   If you need to add or remove fields in the JIRA issue payload, modify the `createJiraTicket` function accordingly. Ensure you have the correct custom field IDs and values as per your JIRA configuration.

6. In the Apps Script editor, go to `Deploy` > `Manage Deployments` > `New Deployment`. Deploy the script as a Web App and authorize the necessary permissions.


## Usage

1. **Form Submission**  
   When a user submits the linked Google Form, the script is triggered automatically.

2. **JIRA Issue Creation**  
   The script processes the form submission, extracts the relevant data, constructs a JIRA API payload, and creates a new issue in the configured JIRA project.

3. **Logs and Captures Response**  
   The script logs JIRA responses and captures the JIRA issue key or error message in the linked Google Sheet for tracking purposes.



