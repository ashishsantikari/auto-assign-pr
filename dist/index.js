"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const octokit = new rest_1.Octokit({
    auth: process.env.GITHUB_TOKEN,
});
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const teamSlug = "your-team-slug"; // Replace with your actual team slug
const stateFile = path.join(__dirname, "state.json");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const teamMembers = yield getTeamMembers(teamSlug);
            if (teamMembers.length === 0) {
                console.log("No team members found.");
                return;
            }
            const pullRequest = yield getPullRequest();
            if (!pullRequest) {
                console.log("No pull request found.");
                return;
            }
            // Switch between different algorithms here
            const nextAssignee = getNextAssigneeLeastRecentlyAssigned(teamMembers);
            // const nextAssignee = getNextAssigneeRoundRobin(teamMembers);
            yield assignPullRequest(pullRequest.number, nextAssignee);
            console.log(`Pull request #${pullRequest.number} assigned to ${nextAssignee}`);
        }
        catch (error) {
            console.error("Error assigning pull request:", error);
        }
    });
}
function getPullRequest() {
    return __awaiter(this, void 0, void 0, function* () {
        const { data: pullRequests } = yield octokit.pulls.list({
            owner,
            repo,
            state: "open",
            sort: "created",
            direction: "desc",
            per_page: 1,
        });
        return pullRequests.length > 0 ? pullRequests[0] : null;
    });
}
function getTeamMembers(teamSlug) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data: teamMembers } = yield octokit.teams.listMembersInOrg({
            org: owner,
            team_slug: teamSlug,
        });
        return teamMembers.map(member => member.login);
    });
}
function getNextAssigneeRoundRobin(teamMembers) {
    let state = { lastAssignedIndex: -1 };
    if (fs.existsSync(stateFile)) {
        state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    }
    const nextIndex = (state.lastAssignedIndex + 1) % teamMembers.length;
    state.lastAssignedIndex = nextIndex;
    fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");
    return teamMembers[nextIndex];
}
function getNextAssigneeLeastRecentlyAssigned(teamMembers) {
    let state = { assignmentCounts: {} };
    if (fs.existsSync(stateFile)) {
        state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    }
    else {
        teamMembers.forEach(member => state.assignmentCounts[member] = 0);
    }
    const nextAssignee = teamMembers.reduce((leastAssigned, member) => {
        return state.assignmentCounts[member] < state.assignmentCounts[leastAssigned] ? member : leastAssigned;
    });
    state.assignmentCounts[nextAssignee] += 1;
    fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");
    return nextAssignee;
}
function assignPullRequest(pullNumber, assignee) {
    return __awaiter(this, void 0, void 0, function* () {
        yield octokit.issues.addAssignees({
            owner,
            repo,
            issue_number: pullNumber,
            assignees: [assignee],
        });
    });
}
main();
