const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ProgressBar = require("progress");
require("dotenv").config();

// Redmine configuration
const redmineConfig = {
  baseURL: process.env.REDMINE_URL,
  apiKey: process.env.REDMINE_API_KEY,
  onlyActiveUsers: process.env.REDMINE_PARSE_ONLY_ACTIVE_USERS === "true",
  onlyActiveTasks: process.env.REDMINE_PARSE_ONLY_ACTIVE_TASKS === "true",
  parseWorkLog: process.env.REDMINE_PARSE_WORKLOG === "true",
};

const jiraConfig = {
  useRedmineStatuses: process.env.JIRA_USE_REDMINE_STATUSES === "true",
  useRedmineUsers: process.env.JIRA_USE_REDMINE_USERS === "true",
  defaultAuthor: process.env.JIRA_DEFAULT_AUTHOR,
  defaultStatus: process.env.JIRA_DEFAULT_STATUS,
  defaultType: process.env.JIRA_DEFAULT_TYPE,
  defaultPriority: process.env.JIRA_DEFAULT_PRIORITY,
};

// Get issues from Redmine with pagination
async function getRedmineIssues(projectId) {
  let issues = [];
  let offset = 0;
  const limit = 25;
  let totalCount = 0;

  const path = redmineConfig.onlyActiveTasks
    ? `/projects/${projectId}/issues.json`
    : `/projects/${projectId}/issues.json?status_id=*`;

  do {
    const response = await axios.get(path, {
      baseURL: redmineConfig.baseURL,
      headers: { "X-Redmine-API-Key": redmineConfig.apiKey },
      params: { offset, limit },
    });
    issues = issues.concat(response.data.issues);
    totalCount = response.data.total_count;
    offset += limit;
  } while (offset < totalCount);

  return issues;
}

// Get comments for an issue from Redmine
async function getRedmineIssueComments(issueId) {
  const response = await axios.get(`/issues/${issueId}.json?include=journals`, {
    baseURL: redmineConfig.baseURL,
    headers: { "X-Redmine-API-Key": redmineConfig.apiKey },
  });
  return response.data.issue.journals;
}

// Transform issues to Jira format
function transformIssuesToJiraFormat(issues) {
  return issues.map((issue) => ({
    priority: jiraConfig.defaultPriority,
    reporter: jiraConfig.defaultAuthor,
    description: issue.description,
    status: jiraConfig.useRedmineStatuses
      ? issue.status.name
      : jiraConfig.defaultStatus,
    issueType: jiraConfig.defaultType, // Default issue type
    created: new Date(issue.created_on).toISOString(),
    updated: new Date(issue.updated_on).toISOString(),
    summary: issue.subject,
    externalId: issue.id.toString(),
    originalEstimate: convertHoursToISO8601(issue.estimated_hours),
    comments: issue.comments
      .filter((comment) => comment.notes.trim() !== "") // Remove empty comments
      .map((comment) => ({
        body: comment.notes,
        created: comment.created_on,
      })),
  }));
}

function transformIssuesToJiraFormatWithUsers(issues, redmineUsers) {
  return issues.map((issue) => {
    const authorLogin = redmineUsers[issue.author.id]?.login;
    const assigneeLogin = issue.assigned_to?.id ? redmineUsers[issue.assigned_to.id]?.login : null;
    const comments = issue.comments
      .filter((comment) => comment?.notes?.trim() !== "") // Remove empty comments
      .map((comment) => {
        const commentLogin = redmineUsers[comment.user.id]?.login;
        return {
          body: comment.notes,
          author: commentLogin ?? null,
          created: new Date(comment.created_on).toISOString(),
        };
      });

    const worklogs = issue.worklogs.map((worklog) => {
      return {
        author: redmineUsers[worklog.user.id]?.login,
        timeSpent: convertHoursToISO8601(worklog.hours),
        startDate: new Date(worklog.spent_on).toISOString(),
        comment: worklog.comments ?? '',
      };
    });
     
    return {
      priority: jiraConfig.defaultPriority,
      reporter: authorLogin ?? jiraConfig.defaultAuthor,
      assignee: assigneeLogin,
      description: issue.description,
      status: jiraConfig.useRedmineStatuses
        ? issue.status.name
        : jiraConfig.defaultStatus,
      issueType: jiraConfig.defaultType, // Default issue type
      created: new Date(issue.created_on).toISOString(),
      updated: new Date(issue.updated_on).toISOString(),
      summary: issue.subject,
      externalId: issue.id.toString(),
      originalEstimate: convertHoursToISO8601(issue.estimated_hours),
      comments: comments,
      worklogs: worklogs,
    };
  });
}

// Get users from Redmine with pagination
async function getRedmineUsers() {
  let users = [];
  let offset = 0;
  const limit = 25; // Adjust the limit as needed
  let totalCount = 0;
  const path = redmineConfig.onlyActiveUsers
    ? `/users.json`
    : `/users.json?status=`;
  do {
    const response = await axios.get(path, {
      baseURL: redmineConfig.baseURL,
      headers: { "X-Redmine-API-Key": redmineConfig.apiKey },
      params: { limit, offset },
    });
    users = users.concat(response.data.users);
    totalCount = response.data.total_count;
    offset += limit;
  } while (offset < totalCount);

  return users;
}

async function getRedmineTimeEntries(projectId, issueId) {
  let timeEntries = [];
  let offset = 0;
  const limit = 25;
  let totalCount = 0;

  do {
    const response = await axios.get(
      `/projects/${projectId}/time_entries.json?issue_id=${issueId}`,
      {
        baseURL: redmineConfig.baseURL,
        headers: { "X-Redmine-API-Key": redmineConfig.apiKey },
        params: { offset, limit },
      }
    );
    timeEntries = timeEntries.concat(response.data.time_entries);
    totalCount = response.data.total_count;
    offset += limit;
  } while (offset < totalCount);

  return timeEntries;
}

// Main function to export issues
async function exportRedmineIssuesToJira(projectId, jiraProjectKey) {
  if (redmineConfig.parseWorkLog && !jiraConfig.useRedmineUsers) {
    console.error(
      "REDMINE_PARSE_WORKLOG works only together with JIRA_USE_REDMINE_USERS"
    );
    process.exit(1);
  }
  const issues = await getRedmineIssues(projectId);
  const bar = new ProgressBar("[:bar] :percent :etas", {
    total: issues.length,
  });

  for (const issue of issues) {
    issue.comments = await getRedmineIssueComments(issue.id);
    if (jiraConfig.useRedmineUsers && redmineConfig.parseWorkLog) {
      issue.worklogs = (await getRedmineTimeEntries(projectId, issue.id)) ?? [];
    } else {
      issue.worklogs = [];
    }
    bar.tick();
  }

  let jiraIssues = [];

  if (jiraConfig.useRedmineUsers) {
    const redmineUsers = await getRedmineUsers();
    const redmineUsersById = redmineUsers.reduce(
      (acc, user) => ({ ...acc, [user.id]: user }),
      {}
    );
    jiraIssues = transformIssuesToJiraFormatWithUsers(issues, redmineUsersById);
  } else {
    jiraIssues = transformIssuesToJiraFormat(issues);
  }

  const fileName = path.join("issues", `jira_issues_${projectId}.json`);
  fs.mkdirSync("issues", { recursive: true });
  fs.writeFileSync(
    fileName,
    JSON.stringify(
      {
        projects: [
          {
            key: jiraProjectKey,
            issues: jiraIssues,
          },
        ],
      },
      null,
      2
    )
  );
  console.log(`Export completed. File ${fileName} has been created.`);
  console.log(`Total issues processed: ${issues.length}`);
}

function convertHoursToISO8601(hours) {
  if (!hours || hours === 0) {
    return "PT0M";
  }
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `PT${h > 0 ? h + "H" : ""}${m > 0 ? m + "M" : ""}`;
}

// Get project ID and Jira project key from command line arguments
const projectId = process.argv[2];
const jiraProjectKey = process.argv[3];
if (!projectId || !jiraProjectKey) {
  console.error("Please specify the Redmine project id and Jira project key.");
  process.exit(1);
}

// Run export for the specified project
exportRedmineIssuesToJira(projectId, jiraProjectKey).catch(console.error);
