const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Redmine configuration
const redmineConfig = {
  baseURL: process.env.REDMINE_URL,
  apiKey: process.env.REDMINE_API_KEY,
  onlyActiveUsers: process.env.REDMINE_PARSE_ONLY_ACTIVE_USERS === "true",
};

const jiraConfig = {
  defaultProjectType: process.env.JIRA_DEFAULT_PROJECT_TYPE,
  defaultNotificationScheme: process.env.JIRA_DEFAULT_NOTIFICATION_SCHEME,
  defaultPermissionScheme: process.env.JIRA_DEFAULT_PERMISSION_SCHEME,
  defaultWorkflowScheme: process.env.JIRA_DEFAULT_WORKFLOW_SCHEME,
  defaultLead: process.env.JIRA_DEFAULT_LEAD,
};

// Get users from Redmine with pagination
async function getProjects() {
  let projects = [];
  let offset = 0;
  const limit = 25; // Adjust the limit as needed
  let totalCount = 0;

  const path = `/projects.json`;

  do {
    const response = await axios.get(path, {
      baseURL: redmineConfig.baseURL,
      headers: { "X-Redmine-API-Key": redmineConfig.apiKey },
      params: { limit, offset },
    });
    projects = projects.concat(response.data.projects);
    totalCount = response.data.total_count;
    offset += limit;
  } while (offset < totalCount);

  return projects;
}

// Transform projects to the specified format
function transformProjectsToCustomFormat(projects) {
  return projects.map((project) => {
    let projectKey = project.identifier.replace("-", "").replace("_", "").toUpperCase();
    if (projectKey.length > 10) {
        projectKey = projectKey.slice(0, 10);
    }
    return {
      assigneeType: "PROJECT_LEAD",
      projectTypeKey: jiraConfig.defaultProjectType,
      name: project.name,
      key: projectKey,
      lead: jiraConfig.defaultLead,
      notificationScheme: jiraConfig.defaultNotificationScheme,
      permissionScheme: jiraConfig.defaultPermissionScheme,
      workflowSchemeId: jiraConfig.defaultWorkflowScheme,
    };
  });
}

// Main function to export users
async function exportRedmineProjects() {
  const projects = await getProjects();

  const transformedUsers = transformProjectsToCustomFormat(projects);
  const fileName = path.join("projects", `jira_projects.json`);
  fs.mkdirSync("projects", { recursive: true });
  fs.writeFileSync(
    fileName,
    JSON.stringify({ projects: transformedUsers }, null, 2)
  );
  console.log(`Export completed. File ${fileName} has been created.`);
  console.log(`Total users processed: ${projects.length}`);
}

// Run export
exportRedmineProjects().catch(console.error);
