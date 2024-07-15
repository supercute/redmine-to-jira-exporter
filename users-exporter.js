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
  defaultGroup: process.env.JIRA_DEFAULT_USER_GROUP,
};

// Get users from Redmine with pagination
async function getRedmineUsers(status) {
  let users = [];
  let offset = 0;
  const limit = 25; // Adjust the limit as needed
  let totalCount = 0;

  if (!status) {
    status = 1;
  }

  const path = `/users.json?status=${status}`;

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

async function getActiveRedmineUsers() {
  return await getRedmineUsers(1);
}

async function getLockedRedmineUsers() {
  return await getRedmineUsers(3);
}

// Transform users to the specified format
function transformUsersToCustomFormat(users) {
  return users.map((user) => ({
    name: user.login,
    groups: [jiraConfig.defaultGroup], // Default group
    active: user.status ?? true,
    email: user.mail,
    fullname: `${user.lastname} ${user.firstname}`,
  }));
}

// Main function to export users
async function exportRedmineUsers() {
  let users = [];
  if (redmineConfig.onlyActiveUsers) {
    users = await getRedmineUsers();
  } else {
    const activeUsers = await getActiveRedmineUsers();
    const lockedUsers = await getLockedRedmineUsers();
    const lockedUsersWithStatus = lockedUsers.map((user) => {
      return {
        ...user,
        status: false,
      };
    });
    const activeUsersWithStatus = activeUsers.map((user) => {
      return {
        ...user,
        status: true,
      };
    });

    users = [...activeUsersWithStatus, ...lockedUsersWithStatus];
  }

  const transformedUsers = transformUsersToCustomFormat(users);
  const fileName = path.join("users", `jira_users.json`);
  fs.mkdirSync("users", { recursive: true });
  fs.writeFileSync(
    fileName,
    JSON.stringify({ users: transformedUsers }, null, 2)
  );
  console.log(`Export completed. File ${fileName} has been created.`);
  console.log(`Total users processed: ${users.length}`);
}

// Run export
exportRedmineUsers().catch(console.error);
