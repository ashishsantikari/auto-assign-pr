import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = process.env.GITHUB_REPOSITORY!.split("/");
const teamSlug = "your-team-slug"; // Replace with your actual team slug
const stateFile = path.join(__dirname, "state.json");

interface State {
  lastAssignedIndex?: number;
  assignmentCounts?: { [key: string]: number };
}

async function main() {
  try {
    const teamMembers = await getTeamMembers(teamSlug);
    if (teamMembers.length === 0) {
      console.log("No team members found.");
      return;
    }

    const pullRequest = await getPullRequest();
    if (!pullRequest) {
      console.log("No pull request found.");
      return;
    }

    // Switch between different algorithms here
    const nextAssignee = getNextAssigneeLeastRecentlyAssigned(teamMembers);
    // const nextAssignee = getNextAssigneeRoundRobin(teamMembers);

    await assignPullRequest(pullRequest.number, nextAssignee);
    console.log(`Pull request #${pullRequest.number} assigned to ${nextAssignee}`);
  } catch (error) {
    console.error("Error assigning pull request:", error);
  }
}

async function getPullRequest() {
  const { data: pullRequests } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "created",
    direction: "desc",
    per_page: 1,
  });

  return pullRequests.length > 0 ? pullRequests[0] : null;
}

async function getTeamMembers(teamSlug: string): Promise<string[]> {
  const { data: teamMembers } = await octokit.teams.listMembersInOrg({
    org: owner,
    team_slug: teamSlug,
  });

  return teamMembers.map(member => member.login);
}

function getNextAssigneeRoundRobin(teamMembers: string[]): string {
  let state: State = { lastAssignedIndex: -1 };
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  }

  const nextIndex = (state.lastAssignedIndex! + 1) % teamMembers.length;
  state.lastAssignedIndex = nextIndex;
  fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");

  return teamMembers[nextIndex];
}

function getNextAssigneeLeastRecentlyAssigned(teamMembers: string[]): string {
  let state: State = { assignmentCounts: {} };
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } else {
    teamMembers.forEach(member => state.assignmentCounts![member] = 0);
  }

  const nextAssignee = teamMembers.reduce((leastAssigned, member) => {
    return state.assignmentCounts![member] < state.assignmentCounts![leastAssigned] ? member : leastAssigned;
  });

  state.assignmentCounts![nextAssignee] += 1;
  fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");

  return nextAssignee;
}

async function assignPullRequest(pullNumber: number, assignee: string) {
  await octokit.issues.addAssignees({
    owner,
    repo,
    issue_number: pullNumber,
    assignees: [assignee],
  });
}

main();
