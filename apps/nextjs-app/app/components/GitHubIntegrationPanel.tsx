import React, { useState, useEffect } from "react";
import {
  VscGithubInverted,
  VscRepo,
  VscSync,
  VscCloudUpload,
  VscCloudDownload,
  VscGitMerge,
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
  owner: { login: string };
  html_url: string;
  default_branch: string;
};

type Commit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
};

interface GitHubIntegrationPanelProps {
  projectId: string;
  onPush?: (message: string) => void;
  onPull?: () => void;
  onMerge?: () => void;
}

const GitHubIntegrationPanel: React.FC<GitHubIntegrationPanelProps> = ({
  projectId,
  onPush,
  onPull,
  onMerge,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [token, setToken] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [commitHistory, setCommitHistory] = useState<Commit[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [newRepoName, setNewRepoName] = useState<string>("");
  const [newRepoDescription, setNewRepoDescription] = useState<string>("");

  // Load token from cookie via API, fallback to localStorage
  useEffect(() => {
    async function checkToken() {
      const res = await fetch(`/api/github?token=check&projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          setIsConnected(true);
          const savedRepoId = localStorage.getItem(`github_repo_${projectId}`);
          loadRepos(data.token, savedRepoId);

          // Check if we just returned from OAuth
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("github_connected") === "true") {
              setStatus("✓ Successfully connected to GitHub!");
              // Clean up URL
              const newUrl = window.location.pathname;
              window.history.replaceState({}, "", newUrl);
            }
            // Check for OAuth errors
            const githubError = urlParams.get("github_error");
            if (githubError) {
              const errorDetails = urlParams.get("details");
              const errorStatus = urlParams.get("status");
              let errorMessage = "Failed to connect to GitHub: ";

              switch (githubError) {
                case "token_exchange_failed":
                  errorMessage += errorDetails
                    ? `Token exchange failed - ${decodeURIComponent(errorDetails)}`
                    : `Token exchange failed${errorStatus ? ` (Status: ${errorStatus})` : ""}. Check your GitHub OAuth app settings.`;
                  break;
                case "missing_credentials":
                  errorMessage +=
                    "GitHub OAuth credentials not configured in environment variables.";
                  break;
                case "no_code":
                  errorMessage += "No authorization code received from GitHub.";
                  break;
                default:
                  errorMessage += githubError;
              }

              setStatus(`❌ ${errorMessage}`);
              // Clean up URL
              const newUrl = window.location.pathname;
              window.history.replaceState({}, "", newUrl);
            }
          }
          return;
        }
      }
      // Fallback to localStorage
      const savedToken = localStorage.getItem(`github_token_${projectId}`);
      const savedRepoId = localStorage.getItem(`github_repo_${projectId}`);
      if (savedToken) {
        setToken(savedToken);
        setIsConnected(true);
        loadRepos(savedToken, savedRepoId);
      }
    }
    checkToken();

    // Listen for postMessage from OAuth popup to refresh token
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === "GITHUB_CONNECTED") {
        checkToken();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadRepos = async (authToken: string, savedRepoId?: string | null) => {
    setLoading(true);
    setStatus("Loading repositories...");
    try {
      const res = await fetch(`/api/github?token=${authToken}`);
      if (!res.ok) throw new Error("Failed to fetch repositories");

      const data: Repo[] = await res.json();
      setRepos(data);
      setStatus(`Loaded ${data.length} repositories`);

      // Auto-select previously selected repo
      if (savedRepoId) {
        const repo = data.find((r) => r.id.toString() === savedRepoId);
        if (repo) {
          setSelectedRepo(repo);
          loadCommitHistory(authToken, repo);
        }
      }
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
    localStorage.removeItem(`github_repo_${projectId}`);
    setIsConnected(false);
    setToken("");
    setRepos([]);
    setSelectedRepo(null);
    setCommitHistory([]);
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

      // Refresh repo list
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
    loadCommitHistory(token, repo);
  };

  const loadCommitHistory = async (authToken: string, repo: Repo) => {
    setLoading(true);
    setStatus("Loading commit history...");
    try {
      const res = await fetch(
        `/api/github?commits=true&token=${authToken}&owner=${repo.owner.login}&repo=${repo.name}`,
      );

      if (!res.ok) throw new Error("Failed to fetch commit history");

      const data: Commit[] = await res.json();
      setCommitHistory(data.slice(0, 10)); // Show last 10 commits
      setStatus(`Loaded ${data.length} commits`);
    } catch (error) {
      setStatus("Error loading commit history");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = () => {
    if (!commitMessage.trim()) {
      setStatus("Please enter a commit message");
      return;
    }

    setStatus(`Pushing changes: "${commitMessage}"`);
    onPush?.(commitMessage);
    setCommitMessage("");

    // Refresh commit history after push
    if (selectedRepo) {
      setTimeout(() => loadCommitHistory(token, selectedRepo), 1000);
    }
  };

  const handlePull = () => {
    setStatus("Pulling latest changes from GitHub...");
    onPull?.();

    // Refresh commit history after pull
    if (selectedRepo) {
      setTimeout(() => loadCommitHistory(token, selectedRepo), 1000);
    }
  };

  const handleMerge = () => {
    setStatus("Merging changes...");
    onMerge?.();

    // Refresh commit history after merge
    if (selectedRepo) {
      setTimeout(() => loadCommitHistory(token, selectedRepo), 1000);
    }
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <VscGithubInverted className="w-5 h-5" />
            GitHub Integration
            <Badge
              variant="outline"
              className="ml-2 border-green-600 text-green-400"
            >
              Connected
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100"
          >
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create New Repository */}
        <div className="border-b border-gray-800 pb-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-100">
            Create New Repository
          </h3>
          <div className="space-y-2">
            <Input
              placeholder="Repository name"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              className="bg-gray-800 text-gray-100 border-gray-700 placeholder:text-gray-500"
            />
            <Input
              placeholder="Description (optional)"
              value={newRepoDescription}
              onChange={(e) => setNewRepoDescription(e.target.value)}
              className="bg-gray-800 text-gray-100 border-gray-700 placeholder:text-gray-500"
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

        {/* Open in GitHub Button */}
        {selectedRepo && (
          <div className="border-b border-gray-800 pb-4">
            <Button
              onClick={() => window.open(selectedRepo.html_url, "_blank")}
              variant="outline"
              className="w-full border-gray-700 text-gray-100 bg-gray-800 hover:bg-gray-700"
              size="sm"
            >
              <VscGithubInverted className="mr-2" />
              Open in GitHub
            </Button>
          </div>
        )}

        {/* Push/Pull/Merge Actions */}
        {selectedRepo && (
          <div className="border-b border-gray-800 pb-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-100">
              Version Control Actions
            </h3>
            <div className="space-y-2">
              <Textarea
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={2}
                className="text-sm bg-gray-800 text-gray-100 border-gray-700 placeholder:text-gray-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handlePush}
                  disabled={loading || !commitMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  <VscCloudUpload className="mr-2" />
                  Push
                </Button>
                <Button
                  onClick={handlePull}
                  disabled={loading}
                  variant="outline"
                  className="border-gray-700 text-gray-100 bg-gray-800 hover:bg-gray-700"
                  size="sm"
                >
                  <VscCloudDownload className="mr-2" />
                  Pull
                </Button>
                <Button
                  onClick={handleMerge}
                  disabled={loading}
                  variant="outline"
                  className="border-gray-700 text-gray-100 bg-gray-800 hover:bg-gray-700"
                  size="sm"
                >
                  <VscGitMerge className="mr-2" />
                  Merge
                </Button>
                <Button
                  onClick={() =>
                    selectedRepo && loadCommitHistory(token, selectedRepo)
                  }
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  <VscSync className="mr-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Commit History */}
        {commitHistory.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-100">
              Recent Commits
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commitHistory.map((commit) => (
                <div
                  key={commit.sha}
                  className="text-xs border border-gray-700 rounded p-2 bg-gray-800 text-gray-100"
                >
                  <p className="font-medium truncate text-gray-100">
                    {commit.commit.message}
                  </p>
                  <p className="text-gray-400 mt-1">
                    {commit.commit.author.name} •{" "}
                    {new Date(commit.commit.author.date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-500 font-mono text-xs">
                    {commit.sha.substring(0, 7)}
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
