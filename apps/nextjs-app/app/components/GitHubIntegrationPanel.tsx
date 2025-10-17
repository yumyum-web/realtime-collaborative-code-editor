"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  VscGithubInverted,
  VscRepo,
  VscCloudUpload,
  VscCloudDownload,
  VscCheck,
  VscCircleFilled,
  VscAdd,
} from "react-icons/vsc";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { GitHubConnectButton } from "@/app/components/GitHubConnectButton";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  default_branch: string;
  clone_url: string;
};

type LocalCommit = {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
};

type FileChange = {
  path: string;
  status: string;
};

interface GitHubIntegrationPanelProps {
  projectId: string;
}

const GitHubIntegrationPanel: React.FC<GitHubIntegrationPanelProps> = ({
  projectId,
}) => {
  // GitHub state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [token, setToken] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [newRepoName, setNewRepoName] = useState<string>("");
  const [newRepoDescription, setNewRepoDescription] = useState<string>("");

  // Local Git state
  const [repoPath, setRepoPath] = useState<string>("");
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [stagedFiles, setStagedFiles] = useState<FileChange[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<FileChange[]>([]);
  const [commitHistory, setCommitHistory] = useState<LocalCommit[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [newBranchName, setNewBranchName] = useState<string>("");

  // Check if local repo exists
  const [hasLocalRepo, setHasLocalRepo] = useState<boolean>(false);

  // Fetch repository path
  useEffect(() => {
    async function fetchRepoPath() {
      try {
        const res = await fetch(`/api/projects/${projectId}/repo-path`);
        if (res.ok) {
          const data = await res.json();
          setRepoPath(data.repoPath);
        }
      } catch (error) {
        console.error("Error fetching repo path:", error);
      }
    }
    fetchRepoPath();
  }, [projectId]);

  // Restore selected repository from localStorage
  const restoreSelectedRepo = useCallback(() => {
    const savedRepoId = localStorage.getItem(`github_repo_${projectId}`);
    if (savedRepoId && repos.length > 0) {
      const repo = repos.find((r) => r.id.toString() === savedRepoId);
      if (repo) {
        setSelectedRepo(repo);
        setStatus(`Connected to ${repo.full_name || repo.name}`);
      }
    }
  }, [projectId, repos]);

  // Load GitHub token and restore selected repo
  useEffect(() => {
    async function checkToken() {
      const res = await fetch(`/api/github?token=check&projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          setIsConnected(true);
          await loadRepos(data.token);
          return;
        }
      }
      // Fallback to localStorage
      const savedToken = localStorage.getItem(`github_token_${projectId}`);
      if (savedToken) {
        setToken(savedToken);
        setIsConnected(true);
        await loadRepos(savedToken);
      }
    }
    checkToken();
  }, [projectId]);

  // Restore selected repo when repos are loaded
  useEffect(() => {
    if (repos.length > 0) {
      restoreSelectedRepo();
    }
  }, [repos, restoreSelectedRepo]);

  // Load local Git status
  useEffect(() => {
    const checkRepoAsync = async () => {
      if (!projectId) return;

      try {
        // Use existing version control API instead of git/local
        await loadLocalGitStatus();
        await loadLocalBranches();
        await loadLocalCommitHistory();
        setHasLocalRepo(true);
      } catch (error) {
        setHasLocalRepo(false);
        console.error("Error loading git data:", error);
      }
    };
    checkRepoAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadLocalGitStatus = async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/status`,
      );

      if (!res.ok) {
        console.error("Failed to load git status:", res.status);
        return;
      }

      const data = await res.json();

      if (res.ok) {
        // Convert the status format to match our FileChange format
        const unstaged: FileChange[] = [
          ...(data.modified || []).map((path: string) => ({
            path,
            status: "M",
          })),
          ...(data.added || []).map((path: string) => ({ path, status: "A" })),
          ...(data.deleted || []).map((path: string) => ({
            path,
            status: "D",
          })),
          ...(data.untracked || []).map((path: string) => ({
            path,
            status: "??",
          })),
        ];
        setUnstagedFiles(unstaged);
        setStagedFiles([]); // Status API doesn't separate staged/unstaged
      }
    } catch (error) {
      console.error("Error loading git status:", error);
    }
  };

  const loadLocalBranches = async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch-git`,
      );

      if (!res.ok) {
        console.error("Failed to load branches:", res.status);
        return;
      }

      const data = await res.json();

      if (res.ok) {
        const branches = data.branches || [];
        setLocalBranches(branches);
        setCurrentBranch(data.activeBranch || branches[0] || "main");
      }
    } catch (error) {
      console.error("Error loading branches:", error);
    }
  };

  const loadLocalCommitHistory = async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/commit-git?branch=${currentBranch || "main"}`,
      );

      if (!res.ok) {
        console.error("Failed to load commit history:", res.status);
        return;
      }

      const data = await res.json();

      if (res.ok) {
        // Convert commit format
        const commits = (data.commits || []).map(
          (c: {
            hash?: string;
            _id?: string;
            author?: string;
            email?: string;
            timestamp?: string;
            date?: string;
            message?: string;
          }) => ({
            hash: c.hash || c._id || "",
            author: c.author || "Unknown",
            email: c.email || "",
            date: c.timestamp || c.date || new Date().toISOString(),
            message: c.message || "",
          }),
        );
        setCommitHistory(commits.slice(0, 10));
      }
    } catch (error) {
      console.error("Error loading commit history:", error);
    }
  };

  const loadRepos = async (authToken: string) => {
    setLoading(true);
    setStatus("Loading repositories...");
    try {
      const res = await fetch(`/api/github?token=${authToken}`);
      if (!res.ok) throw new Error("Failed to fetch repositories");

      const data: Repo[] = await res.json();
      setRepos(data);
      setStatus(`Loaded ${data.length} repositories`);
    } catch (error) {
      setStatus("Error loading repositories");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    if (!token.trim()) {
      setStatus("Please enter a valid GitHub token");
      return;
    }

    localStorage.setItem(`github_token_${projectId}`, token);
    setIsConnected(true);
    loadRepos(token);
  };

  const handleDisconnect = () => {
    localStorage.removeItem(`github_token_${projectId}`);
    setIsConnected(false);
    setToken("");
    setRepos([]);
    setSelectedRepo(null);
    setStatus("Disconnected from GitHub");
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) {
      setStatus("Please enter a repository name");
      return;
    }

    setLoading(true);
    setStatus("Creating repository...");
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: newRepoName,
          description: newRepoDescription,
        }),
      });

      if (!res.ok) throw new Error("Failed to create repository");

      const newRepo: Repo = await res.json();
      setStatus(`Repository "${newRepo.name}" created successfully`);
      setNewRepoName("");
      setNewRepoDescription("");
      loadRepos(token);
    } catch (error) {
      setStatus("Error creating repository");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (repo: Repo) => {
    setSelectedRepo(repo);
    localStorage.setItem(`github_repo_${projectId}`, repo.id.toString());
  };

  // Real Git operations
  const handleStageFile = async (filePath: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "stage",
            files: [filePath],
          }),
        },
      );

      if (res.ok) {
        await loadLocalGitStatus();
        setStatus(`Staged: ${filePath}`);
      }
    } catch (error) {
      setStatus("Error staging file");
      console.error(error);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unstage",
            files: [filePath],
          }),
        },
      );

      if (res.ok) {
        await loadLocalGitStatus();
        setStatus(`Unstaged: ${filePath}`);
      }
    } catch (error) {
      setStatus("Error unstaging file");
      console.error(error);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setStatus("Please enter a commit message");
      return;
    }

    setLoading(true);
    setStatus("Committing changes...");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/commit-git`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: commitMessage,
            branch: currentBranch || "main",
          }),
        },
      );

      const data = await res.json();

      if (res.ok) {
        setStatus(`✓ Committed: ${commitMessage}`);
        setCommitMessage("");
        await loadLocalGitStatus();
        await loadLocalCommitHistory();
      } else {
        setStatus(`Error: ${data.error || "Commit failed"}`);
      }
    } catch (error) {
      setStatus("Error committing changes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!selectedRepo) {
      setStatus("⚠️ Please select a GitHub repository first");
      return;
    }

    if (!currentBranch) {
      setStatus("⚠️ No active branch detected");
      return;
    }

    setLoading(true);
    setStatus(`Pushing '${currentBranch}' to GitHub...`);
    try {
      // First, ensure remote is set to the selected repo
      const remoteUrl = selectedRepo.clone_url.replace(
        "https://",
        `https://${token}@`,
      );

      const setRemoteRes = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "set-remote",
          remote: remoteUrl,
        }),
      });

      if (!setRemoteRes.ok) {
        console.warn("Failed to set remote, may already exist");
      }

      // Now push current branch
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "push",
          branch: currentBranch,
          remote: "origin",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`✓ Pushed to ${selectedRepo.full_name} successfully!`);
        await loadLocalCommitHistory();
      } else {
        setStatus(`Error: ${data.error || data.message || "Push failed"}`);
      }
    } catch (error) {
      setStatus("Error pushing to GitHub");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!currentBranch) {
      setStatus("⚠️ No active branch detected");
      return;
    }

    // Check if there are uncommitted changes
    if (unstagedFiles.length > 0) {
      const confirmed = window.confirm(
        `⚠️ You have ${unstagedFiles.length} uncommitted change(s).\n\n` +
          `Pulling from GitHub will:\n` +
          `- Fetch the latest code from branch '${currentBranch}'\n` +
          `- Update your local file structure\n` +
          `- Your uncommitted changes may be lost!\n\n` +
          `Do you want to commit your changes first?\n\n` +
          `Click OK to commit first, or Cancel to pull anyway (not recommended).`,
      );

      if (confirmed) {
        setStatus("⚠️ Please commit your changes before pulling");
        return;
      }
    }

    setLoading(true);
    setStatus(`Pulling '${currentBranch}' from GitHub...`);
    try {
      // Use git/local to pull current branch
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "pull",
          branch: currentBranch,
          remote: "origin",
        }),
      });

      const data = await res.json();

      if (res.ok || data.success) {
        setStatus(`✓ Pulled '${currentBranch}' from GitHub successfully!`);

        // Reload git status and commits
        await loadLocalGitStatus();
        await loadLocalCommitHistory();

        // Update file structure from Git
        try {
          const structureRes = await fetch(
            `/api/projects/${projectId}?branch=${currentBranch}`,
            {
              cache: "no-store",
              headers: { "Cache-Control": "no-cache" },
            },
          );

          if (structureRes.ok) {
            const structureData = await structureRes.json();
            if (structureData.structure) {
              setStatus(
                `✓ File structure updated from '${currentBranch}'. Refresh page to see all changes.`,
              );

              // Notify user to refresh
              setTimeout(() => {
                if (
                  window.confirm(
                    `File structure has been updated from GitHub.\n\nWould you like to refresh the page to see all changes?`,
                  )
                ) {
                  window.location.reload();
                }
              }, 1000);
            }
          }
        } catch (structureError) {
          console.warn("Could not update structure:", structureError);
        }
      } else {
        setStatus(`Error: ${data.error || data.message || "Pull failed"}`);
      }
    } catch (error) {
      setStatus("Error pulling from GitHub");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSwitch = async (branchName: string) => {
    setLoading(true);
    setStatus(`Switching to branch: ${branchName}...`);
    try {
      // Use version-control branch-git PUT endpoint
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch-git`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchName: branchName,
          }),
        },
      );

      if (res.ok) {
        setCurrentBranch(branchName);
        setStatus(`✓ Switched to branch: ${branchName}`);
        await loadLocalGitStatus();
        await loadLocalCommitHistory();
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error || "Failed to switch branch"}`);
      }
    } catch (error) {
      setStatus("Error switching branch");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setStatus("Please enter a branch name");
      return;
    }

    setLoading(true);
    try {
      // Use version-control branch-git POST endpoint
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch-git`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchName: newBranchName,
            baseBranch: currentBranch || "main",
          }),
        },
      );

      if (res.ok) {
        setStatus(`✓ Created branch: ${newBranchName}`);
        setNewBranchName("");
        setCurrentBranch(newBranchName);
        await loadLocalBranches();
        await loadLocalGitStatus();
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error || "Failed to create branch"}`);
      }
    } catch (error) {
      setStatus("Error creating branch");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status.includes("M")) return <Badge variant="outline">Modified</Badge>;
    if (status.includes("A")) return <Badge variant="outline">Added</Badge>;
    if (status.includes("D"))
      return <Badge variant="destructive">Deleted</Badge>;
    if (status === "??") return <Badge variant="secondary">Untracked</Badge>;
    return <Badge>{status}</Badge>;
  };

  if (!isConnected) {
    return (
      <Card className="w-full bg-gray-900 text-gray-100 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <VscGithubInverted className="w-5 h-5" />
            Connect to GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Connect Button */}
          <div className="space-y-2">
            <GitHubConnectButton
              projectId={projectId}
              mode="redirect"
              returnUrl={
                typeof window !== "undefined"
                  ? window.location.pathname
                  : undefined
              }
              variant="default"
              size="default"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            />
            <p className="text-xs text-center text-gray-500">or</p>
          </div>

          {/* Manual Token Input */}
          <div>
            <label className="text-sm font-medium mb-2 block text-gray-200">
              GitHub Personal Access Token
            </label>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mb-2 bg-gray-800 text-gray-100 border-gray-700 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-400">
              Create a token at{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                GitHub Settings
              </a>{" "}
              with repo permissions
            </p>
          </div>
          <Button
            onClick={handleConnect}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white"
          >
            <VscGithubInverted className="mr-2" />
            Connect with Token
          </Button>
          {status && <p className="text-sm text-gray-400">{status}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gray-900 text-gray-100 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-gray-100">
          <div className="flex items-center gap-2">
            <VscGithubInverted className="w-5 h-5" />
            GitHub Integration
          </div>
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            className="text-xs border-gray-700 text-gray-300"
          >
            Disconnect
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Branch */}
        {hasLocalRepo && currentBranch && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded p-2 text-xs">
            <div className="flex items-center gap-2">
              <VscRepo className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300">Current Branch:</span>
              <Badge variant="outline" className="text-blue-200">
                {currentBranch}
              </Badge>
            </div>
          </div>
        )}

        {/* Create New Repository */}
        <div className="border-b border-gray-800 pb-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-100">
            Create New Repository
          </h3>
          <Input
            placeholder="Repository name"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            className="mb-2 bg-gray-800 text-gray-100 border-gray-700"
          />
          <Input
            placeholder="Description (optional)"
            value={newRepoDescription}
            onChange={(e) => setNewRepoDescription(e.target.value)}
            className="mb-2 bg-gray-800 text-gray-100 border-gray-700"
          />
          <Button
            onClick={handleCreateRepo}
            disabled={loading || !newRepoName.trim()}
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <VscRepo className="mr-2" />
            Create Repository
          </Button>
        </div>

        {/* Select Repository */}
        <div className="border-b border-gray-800 pb-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-100">
            Select Repository
          </h3>
          <select
            value={selectedRepo?.id || ""}
            onChange={(e) => {
              const repo = repos.find(
                (r) => r.id.toString() === e.target.value,
              );
              if (repo) handleSelectRepo(repo);
            }}
            className="w-full border border-gray-700 rounded p-2 text-sm bg-gray-800 text-gray-100"
            disabled={loading}
          >
            <option value="">Choose a repository...</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.owner.login}/{repo.name}
              </option>
            ))}
          </select>
        </div>

        {/* Local Git Status */}
        {hasLocalRepo && (
          <>
            {/* Unstaged Files */}
            {unstagedFiles.length > 0 && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-100">
                  Unstaged Changes ({unstagedFiles.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {unstagedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-gray-800 p-2 rounded"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <VscCircleFilled className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                        <span className="truncate text-gray-300">
                          {file.path}
                        </span>
                        {getStatusIcon(file.status)}
                      </div>
                      <Button
                        onClick={() => handleStageFile(file.path)}
                        size="sm"
                        variant="outline"
                        className="ml-2 text-xs h-6 border-gray-700"
                      >
                        Stage
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staged Files */}
            {stagedFiles.length > 0 && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-100">
                  Staged Changes ({stagedFiles.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {stagedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-gray-800 p-2 rounded"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <VscCheck className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <span className="truncate text-gray-300">
                          {file.path}
                        </span>
                        {getStatusIcon(file.status)}
                      </div>
                      <Button
                        onClick={() => handleUnstageFile(file.path)}
                        size="sm"
                        variant="outline"
                        className="ml-2 text-xs h-6 border-gray-700"
                      >
                        Unstage
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commit */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-100">
                Commit Changes
              </h3>
              <Textarea
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={2}
                className="text-sm bg-gray-800 text-gray-100 border-gray-700 mb-2"
              />
              <Button
                onClick={handleCommit}
                disabled={
                  loading || !commitMessage.trim() || stagedFiles.length === 0
                }
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <VscCheck className="mr-2" />
                Commit ({stagedFiles.length} files)
              </Button>
            </div>

            {/* Push/Pull */}
            <div className="border-b border-gray-800 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-100">
                  Sync with GitHub
                </h3>
                {selectedRepo && (
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                    Branch: {currentBranch}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handlePush}
                  disabled={loading || !selectedRepo}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                  title={`Push '${currentBranch}' to GitHub`}
                >
                  <VscCloudUpload className="mr-2" />
                  Push
                </Button>
                <Button
                  onClick={handlePull}
                  disabled={loading || !selectedRepo}
                  variant="outline"
                  className="border-gray-700 text-gray-100 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                  title={`Pull '${currentBranch}' from GitHub`}
                >
                  <VscCloudDownload className="mr-2" />
                  Pull
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                💡 Push/pull works on any branch. Pull updates your local file
                structure.
              </p>
            </div>

            {/* Branch Management */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-100">
                Branch Management
              </h3>
              <select
                value={currentBranch}
                onChange={(e) => handleBranchSwitch(e.target.value)}
                className="w-full border border-gray-700 rounded p-2 text-sm bg-gray-800 text-gray-100 mb-2"
                disabled={loading}
              >
                {localBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="New branch name"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="bg-gray-800 text-gray-100 border-gray-700"
                />
                <Button
                  onClick={handleCreateBranch}
                  disabled={loading || !newBranchName.trim()}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <VscAdd className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Commit History */}
        {commitHistory.length > 0 && (
          <div className="border-b border-gray-800 pb-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-100">
              Recent Commits
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commitHistory.map((commit) => (
                <div
                  key={commit.hash}
                  className="text-xs border border-gray-700 rounded p-2 bg-gray-800"
                >
                  <p className="font-medium truncate text-gray-100">
                    {commit.message}
                  </p>
                  <p className="text-gray-400 mt-1">
                    {commit.author} •{" "}
                    {new Date(commit.date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-500 font-mono text-xs">
                    {commit.hash.substring(0, 7)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded p-2">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GitHubIntegrationPanel;
