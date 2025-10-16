import React, { useState, useEffect } from "react";
import {
  VscGithubInverted,
  VscRepo,
  VscSync,
  VscCloudUpload,
  VscCloudDownload,
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
}

const GitHubIntegrationPanel: React.FC<GitHubIntegrationPanelProps> = ({
  projectId,
  onPush,
  onPull,
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

  // Load saved token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(`github_token_${projectId}`);
    const savedRepoId = localStorage.getItem(`github_repo_${projectId}`);

    if (savedToken) {
      setToken(savedToken);
      setIsConnected(true);
      loadRepos(savedToken, savedRepoId);
    }
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

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VscGithubInverted className="w-5 h-5" />
            Connect to GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              GitHub Personal Access Token
            </label>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mb-2"
            />
            <p className="text-xs text-gray-500">
              Create a token at{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                GitHub Settings
              </a>{" "}
              with repo permissions
            </p>
          </div>
          <Button onClick={handleConnect} className="w-full">
            <VscGithubInverted className="mr-2" />
            Connect GitHub
          </Button>
          {status && <p className="text-sm text-gray-600">{status}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <VscGithubInverted className="w-5 h-5" />
            GitHub Integration
            <Badge variant="outline" className="ml-2">
              Connected
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create New Repository */}
        <div className="border-b pb-4">
          <h3 className="text-sm font-semibold mb-2">Create New Repository</h3>
          <div className="space-y-2">
            <Input
              placeholder="Repository name"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newRepoDescription}
              onChange={(e) => setNewRepoDescription(e.target.value)}
            />
            <Button
              onClick={handleCreateRepo}
              disabled={loading || !newRepoName.trim()}
              size="sm"
              className="w-full"
            >
              <VscRepo className="mr-2" />
              Create Repository
            </Button>
          </div>
        </div>

        {/* Select Repository */}
        <div className="border-b pb-4">
          <h3 className="text-sm font-semibold mb-2">Select Repository</h3>
          <select
            value={selectedRepo?.id || ""}
            onChange={(e) => {
              const repo = repos.find(
                (r) => r.id.toString() === e.target.value,
              );
              if (repo) handleSelectRepo(repo);
            }}
            className="w-full border rounded p-2 text-sm"
            disabled={loading}
          >
            <option value="">Choose a repository...</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.owner.login}/{repo.name}
              </option>
            ))}
          </select>
          {selectedRepo && (
            <a
              href={selectedRepo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline mt-1 block"
            >
              View on GitHub →
            </a>
          )}
        </div>

        {/* Push/Pull Actions */}
        {selectedRepo && (
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold mb-2">
              Version Control Actions
            </h3>
            <div className="space-y-2">
              <Textarea
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handlePush}
                  disabled={loading || !commitMessage.trim()}
                  className="flex-1"
                  size="sm"
                >
                  <VscCloudUpload className="mr-2" />
                  Push
                </Button>
                <Button
                  onClick={handlePull}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  <VscCloudDownload className="mr-2" />
                  Pull
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
            <h3 className="text-sm font-semibold mb-2">Recent Commits</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commitHistory.map((commit) => (
                <div
                  key={commit.sha}
                  className="text-xs border rounded p-2 bg-gray-50"
                >
                  <p className="font-medium truncate">
                    {commit.commit.message}
                  </p>
                  <p className="text-gray-500 mt-1">
                    {commit.commit.author.name} •{" "}
                    {new Date(commit.commit.author.date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-400 font-mono">
                    {commit.sha.substring(0, 7)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="text-xs text-gray-600 bg-gray-100 rounded p-2">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GitHubIntegrationPanel;
