// Service for GitHub API operations using @octokit/rest
import { Octokit } from "@octokit/rest";

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function createRepo(
  token: string,
  name: string,
  description?: string,
) {
  const octokit = getOctokit(token);
  return await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: false,
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
) {
  const octokit = getOctokit(token);
  return await octokit.repos.listCommits({ owner, repo });
}
