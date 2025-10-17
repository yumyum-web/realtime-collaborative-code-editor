"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  GitCommit,
  Upload,
  Download,
  Plus,
  FolderGit2,
  FileText,
  CheckCircle2,
  Circle,
  Folder,
} from "lucide-react";

type FileChange = {
  path: string;
  status: string; // M, A, D, ??, etc.
};

type LocalCommit = {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
};

const LocalGitPanel: React.FC<{
  repoPath: string;
  onClose?: () => void;
}> = ({ repoPath }) => {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [stagedFiles, setStagedFiles] = useState<FileChange[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<FileChange[]>([]);
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [commitHistory, setCommitHistory] = useState<LocalCommit[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [remoteUrl, setRemoteUrl] = useState<string>("");
  const [newBranchName, setNewBranchName] = useState<string>("");
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load git status on mount
  useEffect(() => {
    const loadAll = async () => {
      await loadGitStatus();
      await loadBranches();
      await loadCommitHistory();
      await loadRemotes();
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  // Parse git status output
  const parseGitStatus = (statusOutput: string) => {
    const lines = statusOutput.trim().split("\n").filter(Boolean);
    const staged: FileChange[] = [];
    const unstaged: FileChange[] = [];

    lines.forEach((line) => {
      const status = line.substring(0, 2);
      const path = line.substring(3);

      const change: FileChange = { path, status };

      if (status[0] !== " " && status[0] !== "?") {
        staged.push(change);
      }
      if (status[1] !== " " && status !== "??") {
        unstaged.push(change);
      }
      if (status === "??") {
        unstaged.push(change);
      }
    });

    return { staged, unstaged };
  };

  // Load git status
  const loadGitStatus = async () => {
    try {
      const res = await fetch(
        `/api/git/local?repoPath=${encodeURIComponent(repoPath)}&action=status`,
      );
      const data = await res.json();

      if (res.ok) {
        setCurrentBranch(data.currentBranch);
        const { staged, unstaged } = parseGitStatus(data.changes);
        setStagedFiles(staged);
        setUnstagedFiles(unstaged);
        setChanges([...staged, ...unstaged]);
      } else {
        setStatus(data.message || "Failed to load git status");
      }
    } catch {
      setStatus("Error loading git status");
    }
  };

  // Load branches
  const loadBranches = async () => {
    try {
      const res = await fetch(
        `/api/git/local?repoPath=${encodeURIComponent(repoPath)}&action=branches`,
      );
      const data = await res.json();

      if (res.ok) {
        const local = data.local
          .split("\n")
          .map((b: string) => b.trim().replace("* ", ""))
          .filter(Boolean);
        setLocalBranches(local);
      }
    } catch {
      setStatus("Error loading branches");
    }
  };

  // Load commit history
  const loadCommitHistory = async () => {
    try {
      const res = await fetch(
        `/api/git/local?repoPath=${encodeURIComponent(repoPath)}&action=log`,
      );
      const data = await res.json();

      if (res.ok) {
        setCommitHistory(data.commits);
      }
    } catch {
      setStatus("Error loading commit history");
    }
  };

  // Load remotes
  const loadRemotes = async () => {
    try {
      const res = await fetch(
        `/api/git/local?repoPath=${encodeURIComponent(repoPath)}&action=remotes`,
      );
      const data = await res.json();

      if (res.ok) {
        const lines = data.remotes.split("\n");
        const originLine = lines.find((l: string) => l.startsWith("origin"));
        if (originLine) {
          const url = originLine.split(/\s+/)[1];
          setRemoteUrl(url);
        }
      }
    } catch {
      setStatus("Error loading remotes");
    }
  };

  // Stage files
  const handleStage = async (files: string[]) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "stage",
          files,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Files staged");
        await loadGitStatus();
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error staging files");
    } finally {
      setIsLoading(false);
    }
  };

  // Unstage files
  const handleUnstage = async (files: string[]) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "unstage",
          files,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Files unstaged");
        await loadGitStatus();
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error unstaging files");
    } finally {
      setIsLoading(false);
    }
  };

  // Commit changes
  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setStatus("❌ Please enter a commit message");
      return;
    }

    setIsLoading(true);
    setStatus("Committing changes...");

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "commit",
          message: commitMessage,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Committed successfully");
        setCommitMessage("");
        await loadGitStatus();
        await loadCommitHistory();
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error committing changes");
    } finally {
      setIsLoading(false);
    }
  };

  // Push changes
  const handlePush = async () => {
    setIsLoading(true);
    setStatus("Pushing to remote...");

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "push",
          branchName: currentBranch,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Pushed successfully");
      } else {
        setStatus(`❌ Push failed: ${data.message}`);
      }
    } catch {
      setStatus("❌ Error pushing changes");
    } finally {
      setIsLoading(false);
    }
  };

  // Pull changes
  const handlePull = async () => {
    setIsLoading(true);
    setStatus("Pulling from remote...");

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "pull",
          branchName: currentBranch,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Pulled successfully");
        await loadGitStatus();
        await loadCommitHistory();
      } else {
        setStatus(`❌ Pull failed: ${data.message}`);
      }
    } catch {
      setStatus("❌ Error pulling changes");
    } finally {
      setIsLoading(false);
    }
  };

  // Switch branch
  const handleSwitchBranch = async (branchName: string) => {
    setIsLoading(true);
    setStatus(`Switching to ${branchName}...`);

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "checkout",
          branchName,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Switched to ${branchName}`);
        setCurrentBranch(branchName);
        await loadGitStatus();
        await loadCommitHistory();
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error switching branch");
    } finally {
      setIsLoading(false);
    }
  };

  // Create new branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setStatus("❌ Please enter a branch name");
      return;
    }

    setIsLoading(true);
    setStatus(`Creating branch ${newBranchName}...`);

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "create-branch",
          branchName: newBranchName,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Created and switched to ${newBranchName}`);
        setCurrentBranch(newBranchName);
        setNewBranchName("");
        setShowBranchModal(false);
        await loadBranches();
        await loadGitStatus();
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error creating branch");
    } finally {
      setIsLoading(false);
    }
  };

  // Set remote URL
  const handleSetRemote = async () => {
    if (!remoteUrl.trim()) {
      setStatus("❌ Please enter a remote URL");
      return;
    }

    setIsLoading(true);
    setStatus("Configuring remote...");

    try {
      const res = await fetch("/api/git/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          action: "set-remote",
          remote: remoteUrl,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Remote configured");
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch {
      setStatus("❌ Error configuring remote");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (statusCode: string) => {
    if (statusCode.includes("M")) return "📝";
    if (statusCode.includes("A")) return "➕";
    if (statusCode.includes("D")) return "❌";
    if (statusCode === "??") return "❓";
    return "📄";
  };

  return (
    <div className="p-6 border rounded-lg shadow-lg bg-white max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FolderGit2 className="w-6 h-6" />
          Local Git Control
        </h2>
        <button
          onClick={() => router.push("/create-repository")}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Repository
        </button>
      </div>

      {/* Repository Path */}
      <div className="mb-4 p-3 bg-gray-100 rounded flex items-center gap-2">
        <Folder className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-mono text-gray-700">{repoPath}</span>
      </div>

      {/* Current Branch */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-700" />
            <span className="font-medium text-blue-900">
              Current Branch: <span className="font-bold">{currentBranch}</span>
            </span>
          </div>
          <button
            onClick={() => setShowBranchModal(!showBranchModal)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
        </div>

        {/* Branch Selector */}
        {localBranches.length > 0 && (
          <select
            value={currentBranch}
            onChange={(e) => handleSwitchBranch(e.target.value)}
            disabled={isLoading}
            className="w-full mt-2 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {localBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        )}

        {/* Create Branch Modal */}
        {showBranchModal && (
          <div className="mt-4 p-4 bg-white border border-purple-200 rounded-lg">
            <h4 className="font-medium mb-3">Create New Branch</h4>
            <input
              type="text"
              placeholder="feature/my-feature"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateBranch}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
              >
                Create
              </button>
              <button
                onClick={() => setShowBranchModal(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Changes Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Changes ({changes.length})
        </h3>

        {/* Staged Files */}
        {stagedFiles.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Staged Changes ({stagedFiles.length})
            </h4>
            <div className="space-y-1">
              {stagedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>{getStatusIcon(file.status)}</span>
                    <span className="font-mono">{file.path}</span>
                  </span>
                  <button
                    onClick={() => handleUnstage([file.path])}
                    disabled={isLoading}
                    className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                  >
                    Unstage
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unstaged Files */}
        {unstagedFiles.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-2">
              <Circle className="w-4 h-4" />
              Unstaged Changes ({unstagedFiles.length})
            </h4>
            <div className="space-y-1">
              {unstagedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>{getStatusIcon(file.status)}</span>
                    <span className="font-mono">{file.path}</span>
                  </span>
                  <button
                    onClick={() => handleStage([file.path])}
                    disabled={isLoading}
                    className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                  >
                    Stage
                  </button>
                </div>
              ))}
            </div>
            {unstagedFiles.length > 0 && (
              <button
                onClick={() => handleStage(unstagedFiles.map((f) => f.path))}
                disabled={isLoading}
                className="mt-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
              >
                Stage All
              </button>
            )}
          </div>
        )}

        {changes.length === 0 && (
          <p className="text-gray-500 text-sm">No changes detected</p>
        )}
      </div>

      {/* Commit Section */}
      {stagedFiles.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Commit Changes
          </h3>
          <textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <button
            onClick={handleCommit}
            disabled={isLoading || !commitMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
          >
            Commit
          </button>
        </div>
      )}

      {/* Git Operations */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Git Operations</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePush}
            disabled={isLoading}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Push
          </button>
          <button
            onClick={handlePull}
            disabled={isLoading}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Pull
          </button>
        </div>

        {/* Remote URL Configuration */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">
            Remote URL (origin)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://github.com/user/repo.git"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSetRemote}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
              Set
            </button>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <span className="font-medium">Status:</span> {status || "Ready"}
      </div>

      {/* Commit History */}
      {commitHistory.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Commit History
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {commitHistory.map((commit) => (
              <div
                key={commit.hash}
                className="p-3 bg-white border border-gray-200 rounded"
              >
                <p className="font-medium text-sm">{commit.message}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-600">{commit.author}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(commit.date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {commit.hash.substring(0, 7)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalGitPanel;
