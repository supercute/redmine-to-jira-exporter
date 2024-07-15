# Redmine Jira exporter

Exports issues and comments from Redmine and converts them to json for import into Jira

## Install:

cp .env.example .env

npm install or yarn install

## Run:


yarn users

yarn issues your-redmine-project-id your-jira-project-key


## Import:

Log in to Jira as a user with the Jira Administrators global permission.

Choose Administration > System. Select Import & Export > External System Import to open the Import external projects page.

Select JSON to open the JSON File import page.

Upload your JSON file.

Select Begin Import when you are ready to begin importing your JSON file into Jira. The importer will display updates as the import progresses, then a success message when the import is complete.



## ENV Description

REDMINE_URL - Redmine URL
REDMINE_API_KEY - Access token for Redmine
REDMINE_PARSE_ONLY_ACTIVE_USERS - Parses only active users with status 1
REDMINE_PARSE_WORKLOG - Parses the time spent on tasks, works only together with JIRA_USE_REDMINE_USERS

# TASKS
JIRA_USE_REDMINE_STATUSES - Use Redmine statuses in Jira instead of default (statuses must be added to Jira)
JIRA_USE_REDMINE_USERS - Uses Redmine users by login. It is assumed that Redmine Login = Jira Login

JIRA_DEFAULT_AUTHOR - Default author in Jira
JIRA_DEFAULT_STATUS - Default status in Jira
JIRA_DEFAULT_TYPE - Default task type in Jira
JIRA_DEFAULT_PRIORITY - Default task priority in Jira

# USERS

JIRA_DEFAULT_USER_GROUP - Default group to which users should be uploaded when importing to Jira


