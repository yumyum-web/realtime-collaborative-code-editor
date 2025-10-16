import React, { useState } from "react";

type Repo = {
  id: number;
  name: string;
  owner: { login: string };
};

type Commit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string };
  };
};

const GitHubVersionControl: React.FC = () => {
  const [token, setToken] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [commitHistory, setCommitHistory] = useState<Commit[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");

  // Connect to GitHub and list repos
  const handleListRepos = async () => {
    setStatus("Loading repositories...");
    const res = await fetch(`/api/github?token=${token}`);
    const data: Repo[] = await res.json();
    setRepos(data);
    setStatus("Repositories loaded.");
  };

  // Create a new repo
  const handleCreateRepo = async () => {
    setStatus("Creating repository...");
    const res = await fetch("/api/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: repoName }),
    });
    const data = await res.json();
    setStatus(data.message || "Repository created.");
    handleListRepos();
  };

  // Get commit history
  const handleGetCommits = async () => {
    setStatus("Loading commit history...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) {
      setStatus("Select a repository first.");
      return;
    }
    const res = await fetch(
      `/api/github?commits=true&token=${token}&owner=${repoObj.owner.login}&repo=${selectedRepo}`,
    );
    const data: Commit[] = await res.json();
    setCommitHistory(data);
    setStatus("Commit history loaded.");
  };

  // Placeholder for push/pull actions
  const handlePush = () => {
    setStatus("Push action not implemented yet.");
  };
  const handlePull = () => {
    setStatus("Pull action not implemented yet.");
  };

  return (
    <div className="p-4 border rounded shadow-md bg-white">
      <h2 className="text-xl font-bold mb-2">GitHub Version Control</h2>
      <div className="mb-2">
        <input
          type="text"
          placeholder="GitHub OAuth Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="border p-1 mr-2"
        />
        <button
          onClick={handleListRepos}
          className="bg-blue-500 text-white px-2 py-1 rounded"
        >
          List Repos
        </button>
      </div>
      <div className="mb-2">
        <input
          type="text"
          placeholder="New Repo Name"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          className="border p-1 mr-2"
        />
        <button
          onClick={handleCreateRepo}
          className="bg-green-500 text-white px-2 py-1 rounded"
        >
          Create Repo
        </button>
      </div>
      <div className="mb-2">
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="border p-1 mr-2"
        >
          <option value="">Select Repo</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.name}>
              {repo.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleGetCommits}
          className="bg-purple-500 text-white px-2 py-1 rounded"
        >
          View Commits
        </button>
      </div>
      <div className="mb-2">
        <input
          type="text"
          placeholder="Commit Message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="border p-1 mr-2"
        />
        <button
          onClick={handlePush}
          className="bg-yellow-500 text-white px-2 py-1 rounded"
        >
          Push
        </button>
        <button
          onClick={handlePull}
          className="bg-gray-500 text-white px-2 py-1 rounded ml-2"
        >
          Pull
        </button>
      </div>
      <div className="mb-2 text-sm text-gray-700">{status}</div>
      <div>
        <h3 className="font-semibold">Commit History</h3>
        <ul>
          {commitHistory.map((commit) => (
            <li key={commit.sha}>
              {commit.commit.message} - {commit.commit.author.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GitHubVersionControl;
