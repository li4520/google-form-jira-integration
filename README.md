# Google Form to Jira Cloud Integration (Boilerplate)

## Overview
This script automates the creation of Jira Cloud issues based on Google Form submissions. It is designed as a robust starting point (boilerplate) that handles complex requirements out of the box, including:

* **Concurrency Handling:** Uses timestamp matching to ensure the correct spreadsheet row is updated, even if multiple forms are submitted simultaneously.
* **Jira Cloud Formatting:** Automatically converts text to "Atlassian Document Format" (ADF), required for Jira Cloud Descriptions and Paragraph fields.
* **Write-Back:** Writes the generated Jira Issue Key (e.g., `MKT-123`) back to the Google Sheet.
* **Error Alerting:** Sends email alerts if the integration fails.

---

## Prerequisites

Before configuring the script, gather the following information:

1.  **Jira URL:** (e.g., `https://yourcompany.atlassian.net`)
2.  **Jira Email:** The email address used to log in to Jira.
3.  **Jira API Token:**
    * Go to [id.atlassian.com/manage/api-tokens](https://id.atlassian.com/manage/api-tokens).
    * Click **Create API token**.
    * Label it "GoogleFormIntegration" and copy the secret string.
4.  **Project Key:** The prefix of your Jira project (e.g., `IT`, `MKT`, `OPS`).
5.  **Reporter Account ID:**
    * The "Reporter" cannot be set by email in newer Jira API versions. You need the **Atlassian Account ID** (a long alphanumeric string).
    * *Tip:* Navigate to the user's profile in Jira and look at the URL: `/jira/people/[ACCOUNT_ID]`.

---

## Part 1: Mapping Guide (Pre-Work)

Before touching the code, fill out this table to map your Google Form Questions to your Jira Custom Fields.

**How to find Jira Custom Field IDs:**
1.  Go to **Jira Settings** (Gear Icon) > **Issues** > **Custom Fields**.
2.  Find your field, click **...** (three dots) > **View/Edit**.
3.  Look at the URL in your browser address bar. You will see `?id=10045`. The ID is `customfield_10045`.

| Google Form Question Title | Logic (If any) | Jira Field Name | Jira Field ID | Field Type |
| :--- | :--- | :--- | :--- | :--- |
| *e.g. Short Summary* | *Direct Map* | *Summary* | *System Field* | *Text* |
| *e.g. Request Type* | *Array Map* | *Category* | *customfield_10021* | *Multi-Select* |
| *e.g. Due Date* | *Format Date* | *Target End* | *customfield_10045* | *Date Picker* |
| *e.g. Department* | *Direct Map* | *Dept* | *customfield_11000* | *Dropdown* |
| | | | | |

---

## Part 2: Installation & Setup

### 1. Set up the Google Sheet
1.  Open the Google Sheet connected to your Form.
2.  Go to **Extensions** > **Apps Script**.
3.  Delete any code in `Code.gs` and paste the provided **Boilerplate Script**.
4.  Create a column in your Spreadsheet (e.g., Column J) named **"Jira Key"**. Note the column number (A=1, B=2, ... J=10).

### 2. Configure Environment Variables
Instead of hardcoding passwords, we use Script Properties.
1.  In the Apps Script editor, click **Project Settings** (Gear Icon on the left).
2.  Scroll to **Script Properties**.
3.  Click **Add script property** for each of the following:

| Property | Value Example |
| :--- | :--- |
| `jiraDomain` | `https://acme.atlassian.net` (No trailing slash) |
| `jiraEmail` | `bot@acme.com` |
| `jiraApiToken` | `ATATT3xFf...` (The token generated in Prerequisites) |
| `jiraProjectKey` | `OPS` |
| `jiraReporterId` | `557058:3f20a6...` |
| `sheetName` | `Form Responses 1` |
| `adminEmail` | `your.email@acme.com` (For error alerts) |

### 3. Update the Code
1.  **Update Config:** At the top of the script, update `TIMESTAMP_COL` (usually 1) and `OUTPUT_COLUMN` (the column number where the Jira Key will be written).
2.  **Update IDs:** In the `JIRA_FIELDS` object, replace the example IDs with the ones from your **Mapping Guide**.
3.  **Update Logic:**
    * Go to `parseFormResponses()`: Update the `switch (title)` cases to match your **Google Form Question Titles**.
    * Go to `buildJiraPayload()`: Ensure the variables map correctly to the Jira Fields.

### 4. Create the Trigger
The script needs to run automatically when a form is submitted.
1.  In Apps Script, click **Triggers** (Alarm clock icon on the left).
2.  Click **+ Add Trigger**.
3.  Configure:
    * **Function to run:** `onFormSubmit`
    * **Deployment:** `Head`
    * **Event source:** `From spreadsheet`
    * **Event type:** `On form submit`
4.  Click **Save**. You will be asked to authorize permissions.

---

## Part 3: Troubleshooting

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **Script runs but no Jira ticket** | Invalid Auth or Payload | Check `View` > `Executions` logs. Look for "HTTP 400" or "HTTP 401". |
| **HTTP 400 Error** | Bad Payload Format | Usually a Select/Dropdown field mismatch. Jira expects exact case-sensitive matches for options. |
| **HTTP 401 Error** | Auth Failure | Check your Email and API Token in Script Properties. Ensure no extra spaces. |
| **"Summary is missing"** | Form Title Mismatch | The `case "Question Title"` in the script must match the Google Form question exactly (including spaces). |
| **Jira Key written to wrong row** | Timestamp Mismatch | Ensure the Sheet is sorted by timestamp or that the `findRowByTimestamp` lookback limit is high enough. |

---

## Developer Notes

* **ADF Conversion:** Jira Cloud deprecated "Wiki Markup" for descriptions. The `toADF()` function in this script converts plain text into the required JSON block format.
* **Permissions:** The script runs as the user who set up the trigger. Ensure that user has "Create Issue" permissions in the target Jira project.
