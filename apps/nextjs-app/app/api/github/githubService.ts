// Service for GitHub API operations using @octokit/rest
import { Octokit } from "@octokit/rest";

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function createRepo(
  token: string,
  name: string,
  description?: string,
  isPrivate?: boolean,
) {
  const octokit = getOctokit(token);
  return await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate || false,
  });
}

export async function listRepos(token: string) {
  const octokit = getOctokit(token);
  return await octokit.repos.listForAuthenticatedUser();
}

export async function getCommitHistory(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
) {
  const octokit = getOctokit(token);
  const params: { owner: string; repo: string; sha?: string } = { owner, repo };
  if (branch) {
    params.sha = branch;
  }
  return await octokit.repos.listCommits(params);
}

// Branch operations
export async function listBranches(token: string, owner: string, repo: string) {
  const octokit = getOctokit(token);
  return await octokit.repos.listBranches({ owner, repo });
}

export async function getBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
) {
  const octokit = getOctokit(token);
  return await octokit.repos.getBranch({ owner, repo, branch });
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  sha: string,
) {
  const octokit = getOctokit(token);
  return await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

// Pull Request operations
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(token);
  return await octokit.pulls.list({ owner, repo, state: "all" });
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string,
) {
  const octokit = getOctokit(token);
  return await octokit.pulls.create({
    owner,
    repo,
    title,
    head,
    base,
    body,
  });
}

// Commit operations
export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  tree: string,
  parents: string[],
) {
  const octokit = getOctokit(token);
  return await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree,
    parents,
  });
}

export async function updateReference(
  token: string,
  owner: string,
  repo: string,
  ref: string,
  sha: string,
) {
  const octokit = getOctokit(token);
  return await octokit.git.updateRef({
    owner,
    repo,
    ref,
    sha,
    force: false,
  });
}

export async function getRepoContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
) {
  const octokit = getOctokit(token);
  return await octokit.repos.getContent({
    owner,
    repo,
    path,
  });
}
