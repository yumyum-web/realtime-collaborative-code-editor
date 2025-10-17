"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Upload,
  Download,
  Plus,
  RefreshCw,
  FolderGit2,
} from "lucide-react";

type Repo = {
  id: number;
  name: string;
  owner: { login: string };
  default_branch: string;
};

type Branch = {
  name: string;
  commit: {
    sha: string;
  };
};

type Commit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
};

type PullRequest = {
  id: number;
  number: number;
  title: string;
  state: string;
  head: { ref: string };
  base: { ref: string };
};

const GitHubVersionControl: React.FC = () => {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commitHistory, setCommitHistory] = useState<Commit[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [newBranchName, setNewBranchName] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [mergeBranch, setMergeBranch] = useState<string>("");
  const [showCreateBranchModal, setShowCreateBranchModal] =
    useState<boolean>(false);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Save token to localStorage
  const saveToken = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("github_token", newToken);
  };

  // Connect to GitHub and list repos
  const handleListRepos = async () => {
    if (!token) {
      setStatus("Please enter a GitHub token first.");
      return;
    }
    setStatus("Loading repositories...");
    try {
      const res = await fetch(`/api/github/repos?token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setRepos(data);
        setStatus(`Loaded ${data.length} repositories.`);
      } else {
        setStatus(data.message || "Failed to load repositories.");
      }
    } catch {
      setStatus("Error loading repositories.");
    }
  };

  // Navigate to create repository page
  const handleNavigateToCreateRepo = () => {
    router.push("/create-repository");
  };

  // Get branches for selected repo
  const handleGetBranches = async () => {
    if (!selectedRepo || !token) {
      setStatus("Select a repository first.");
      return;
    }
    setStatus("Loading branches...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch(
        `/api/github/branches?token=${token}&owner=${repoObj.owner.login}&repo=${selectedRepo}`,
      );
      const data = await res.json();
      if (res.ok) {
        setBranches(data);
        if (data.length > 0 && !currentBranch) {
          setCurrentBranch(repoObj.default_branch || data[0].name);
        }
        setStatus(`Loaded ${data.length} branches.`);
      } else {
        setStatus(data.message || "Failed to load branches.");
      }
    } catch {
      setStatus("Error loading branches.");
    }
  };

  // Create a new branch
  const handleCreateBranch = async () => {
    if (!selectedRepo || !token || !newBranchName || !currentBranch) {
      setStatus("Please select a repository and enter a branch name.");
      return;
    }
    setStatus("Creating branch...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch("/api/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          owner: repoObj.owner.login,
          repo: selectedRepo,
          branchName: newBranchName,
          fromBranch: currentBranch,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Branch "${newBranchName}" created successfully!`);
        setNewBranchName("");
        setShowCreateBranchModal(false);
        handleGetBranches();
      } else {
        setStatus(data.message || "Failed to create branch.");
      }
    } catch {
      setStatus("Error creating branch.");
    }
  };

  // Switch branch
  const handleSwitchBranch = async (branchName: string) => {
    setCurrentBranch(branchName);
    setStatus(`Switched to branch: ${branchName}`);
    // Reload commits for the new branch
    handleGetCommits();
  };

  // Get commit history
  const handleGetCommits = async () => {
    if (!selectedRepo || !token) {
      setStatus("Select a repository first.");
      return;
    }
    setStatus("Loading commit history...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch(
        `/api/github/commits?token=${token}&owner=${repoObj.owner.login}&repo=${selectedRepo}&branch=${currentBranch || repoObj.default_branch}`,
      );
      const data = await res.json();
      if (res.ok) {
        setCommitHistory(data);
        setStatus(`Loaded ${data.length} commits.`);
      } else {
        setStatus(data.message || "Failed to load commits.");
      }
    } catch {
      setStatus("Error loading commits.");
    }
  };

  // Get pull requests
  const handleGetPullRequests = async () => {
    if (!selectedRepo || !token) {
      setStatus("Select a repository first.");
      return;
    }
    setStatus("Loading pull requests...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch(
        `/api/github/pull-requests?token=${token}&owner=${repoObj.owner.login}&repo=${selectedRepo}`,
      );
      const data = await res.json();
      if (res.ok) {
        setPullRequests(data);
        setStatus(`Loaded ${data.length} pull requests.`);
      } else {
        setStatus(data.message || "Failed to load pull requests.");
      }
    } catch {
      setStatus("Error loading pull requests.");
    }
  };

  // Create a pull request (merge branches)
  const handleCreatePullRequest = async () => {
    if (!selectedRepo || !token || !currentBranch || !mergeBranch) {
      setStatus("Please select branches to merge.");
      return;
    }
    setStatus("Creating pull request...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch("/api/github/pull-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          owner: repoObj.owner.login,
          repo: selectedRepo,
          title: `Merge ${currentBranch} into ${mergeBranch}`,
          head: currentBranch,
          base: mergeBranch,
          body: commitMessage || `Merging ${currentBranch} into ${mergeBranch}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Pull request created successfully!`);
        setShowMergeModal(false);
        setCommitMessage("");
        handleGetPullRequests();
      } else {
        setStatus(data.message || "Failed to create pull request.");
      }
    } catch {
      setStatus("Error creating pull request.");
    }
  };

  // Push changes (simulated)
  const handlePush = async () => {
    if (!selectedRepo || !token || !commitMessage) {
      setStatus("Please select a repository and enter a commit message.");
      return;
    }
    setStatus("Pushing changes...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          owner: repoObj.owner.login,
          repo: selectedRepo,
          branch: currentBranch,
          message: commitMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("Changes pushed successfully!");
        setCommitMessage("");
        handleGetCommits();
      } else {
        setStatus(data.message || "Failed to push changes.");
      }
    } catch {
      setStatus("Error pushing changes.");
    }
  };

  // Pull changes (simulated)
  const handlePull = async () => {
    if (!selectedRepo || !token) {
      setStatus("Please select a repository.");
      return;
    }
    setStatus("Pulling latest changes...");
    const repoObj = repos.find((r) => r.name === selectedRepo);
    if (!repoObj) return;

    try {
      const res = await fetch(
        `/api/github/pull?token=${token}&owner=${repoObj.owner.login}&repo=${selectedRepo}&branch=${currentBranch}`,
      );
      const data = await res.json();
      if (res.ok) {
        setStatus("Successfully pulled latest changes!");
        handleGetCommits();
      } else {
        setStatus(data.message || "Failed to pull changes.");
      }
    } catch {
      setStatus("Error pulling changes.");
    }
  };

  // Handle repo selection
  const handleRepoSelect = (repoName: string) => {
    setSelectedRepo(repoName);
    const repo = repos.find((r) => r.name === repoName);
    if (repo) {
      setCurrentBranch(repo.default_branch);
    }
    setCommitHistory([]);
    setBranches([]);
    setPullRequests([]);
  };

  return (
    <div className="p-6 border rounded-lg shadow-lg bg-white max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FolderGit2 className="w-6 h-6" />
        GitHub Version Control
      </h2>

      {/* Token Input Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium mb-2">
          GitHub Personal Access Token
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Enter your GitHub token"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleListRepos}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Load Repos
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Create a token at: github.com/settings/tokens
        </p>
      </div>

      {/* Repository Management Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Repository</h3>
          <button
            onClick={handleNavigateToCreateRepo}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Repository
          </button>
        </div>

        {/* Repository Selector */}
        <select
          value={selectedRepo}
          onChange={(e) => handleRepoSelect(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a repository</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.name}>
              {repo.owner.login}/{repo.name}
            </option>
          ))}
        </select>

        {selectedRepo && (
          <button
            onClick={handleGetBranches}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Load branches
          </button>
        )}
      </div>

      {/* Branch Management Section */}
      {selectedRepo && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Branches
            </h3>
            <button
              onClick={() => setShowCreateBranchModal(!showCreateBranchModal)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Branch
            </button>
          </div>

          {/* Create Branch Modal/Form */}
          {showCreateBranchModal && (
            <div className="mb-4 p-4 bg-white border border-purple-200 rounded-lg">
              <h4 className="font-medium mb-3">Create New Branch</h4>
              <input
                type="text"
                placeholder="Branch name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-sm text-gray-600 mb-2">
                From: {currentBranch}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateBranch}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                >
                  Create Branch
                </button>
                <button
                  onClick={() => setShowCreateBranchModal(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Current Branch Display */}
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-medium">
              Current Branch:{" "}
              <span className="text-blue-700">{currentBranch}</span>
            </p>
          </div>

          {/* Branch Selector */}
          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Switch to branch:
              </label>
              <select
                value={currentBranch}
                onChange={(e) => handleSwitchBranch(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Git Operations Section */}
      {selectedRepo && currentBranch && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Git Operations
          </h3>

          {/* Commit Message Input */}
          <div className="mb-3">
            <label className="block text-sm font-medium mb-2">
              Commit Message
            </label>
            <input
              type="text"
              placeholder="Enter commit message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={handlePush}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Push
            </button>
            <button
              onClick={handlePull}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Pull
            </button>
            <button
              onClick={handleGetCommits}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <GitCommit className="w-4 h-4" />
              View Commits
            </button>
            <button
              onClick={() => setShowMergeModal(!showMergeModal)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <GitMerge className="w-4 h-4" />
              Merge
            </button>
          </div>

          {/* Merge Modal/Form */}
          {showMergeModal && (
            <div className="mt-4 p-4 bg-white border border-indigo-200 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <GitMerge className="w-5 h-5" />
                Create Pull Request
              </h4>
              <p className="text-sm text-gray-600 mb-2">
                From:{" "}
                <span className="font-medium text-indigo-700">
                  {currentBranch}
                </span>
              </p>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Into (base branch):
                </label>
                <select
                  value={mergeBranch}
                  onChange={(e) => setMergeBranch(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select target branch</option>
                  {branches
                    .filter((b) => b.name !== currentBranch)
                    .map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Pull Request Description:
                </label>
                <textarea
                  placeholder="Describe your changes..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePullRequest}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  Create Pull Request
                </button>
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* View Pull Requests */}
          <button
            onClick={handleGetPullRequests}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            View Pull Requests
          </button>
        </div>
      )}

      {/* Status Display */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <span className="font-medium">Status:</span> {status || "Ready"}
      </div>

      {/* Pull Requests Display */}
      {pullRequests.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Pull Requests
          </h3>
          <div className="space-y-2">
            {pullRequests.map((pr) => (
              <div
                key={pr.id}
                className="p-3 bg-white border border-gray-200 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      #{pr.number} - {pr.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {pr.head.ref} → {pr.base.ref}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      pr.state === "open"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {pr.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit History Display */}
      {commitHistory.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Commit History
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {commitHistory.map((commit) => (
              <div
                key={commit.sha}
                className="p-3 bg-white border border-gray-200 rounded"
              >
                <p className="font-medium text-sm">{commit.commit.message}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-600">
                    {commit.commit.author.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(commit.commit.author.date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {commit.sha.substring(0, 7)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubVersionControl;
