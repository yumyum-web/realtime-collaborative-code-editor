"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type StructureNode = {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: StructureNode[];
};

type Props = {
  projectId: string;
  user: { email: string; username?: string };
  onClose?: () => void;
  showToast: (message: string, type: "success" | "error") => void;
  applyStructureToEditor: (structure: StructureNode | null) => void;
  buildStructure: () => StructureNode | null;
  currentBranch: string;
  setCurrentBranch: (branch: string) => void;
};

type Commit = {
  _id: string | null;
  message: string;
  author: string;
  timestamp?: string;
};

export default function VersionControlPanel({
  projectId,
  user,
  onClose,
  showToast,
  applyStructureToEditor,
  buildStructure,
  currentBranch,
  setCurrentBranch,
}: Props) {
  const [branches, setBranches] = useState<string[]>([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [uncommittedCount, setUncommittedCount] = useState(0);
  const [gitStatus, setGitStatus] = useState<{
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
    isClean: boolean;
  } | null>(null);

  const localKey = useRef((b: string) => `vc_autosave:${projectId}:${b}`);

  // Operation locking wrapper
  const withLock = useCallback(
    async (operation: () => Promise<void>) => {
      if (operationInProgress) {
        showToast("Please wait for current operation to complete", "error");
        return;
      }

      setOperationInProgress(true);
      try {
        await operation();
      } catch (err) {
        console.error("Operation error:", err);
        showToast("Operation failed", "error");
      } finally {
        setOperationInProgress(false);
      }
    },
    [operationInProgress, showToast],
  );

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch-git`,
      );
      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        showToast(data.error || "Failed to fetch branches.", "error");
        return;
      }
      setBranches(data.branches || ["main"]);
      setCurrentBranch(data.activeBranch || "main");
    } catch (err) {
      console.error("fetchBranches error", err);
      showToast("Network error fetching branches.", "error");
    }
  }, [projectId, showToast, setCurrentBranch]);

  const fetchGitStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/status`,
      );
      const data = await res.json();
      if (res.ok) {
        setGitStatus(data);
        const count =
          (data.modified?.length || 0) +
          (data.added?.length || 0) +
          (data.deleted?.length || 0) +
          (data.untracked?.length || 0);
        setUncommittedCount(count);
      }
    } catch (err) {
      console.error("fetchGitStatus error", err);
    }
  }, [projectId]);

  const fetchCommits = useCallback(
    async (branchName?: string) => {
      try {
        const b = branchName || currentBranch;
        const res = await fetch(
          `/api/projects/${projectId}/version-control/commit-git?branch=${encodeURIComponent(b)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          console.error(data);
          showToast(data.error || "Failed to fetch commits.", "error");
          return;
        }
        setCommits(data.commits || []);
      } catch (err) {
        console.error("fetchCommits error", err);
        showToast("Network error fetching commits.", "error");
      }
    },
    [currentBranch, projectId, showToast],
  );

  useEffect(() => {
    fetchBranches();
    fetchGitStatus();
  }, [fetchBranches, fetchGitStatus]);

  useEffect(() => {
    if (currentBranch) fetchCommits(currentBranch);
  }, [currentBranch, fetchCommits]);

  // Poll git status every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchGitStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchGitStatus]);

  const createBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return showToast("Enter a valid branch name.", "error");

    await withLock(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch-git`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchName: name,
              baseBranch: currentBranch,
            }),
          },
        );
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
          showToast(data.error || "Failed to create branch.", "error");
          return;
        }
        setNewBranchName("");
        showToast(`Branch '${name}' created successfully.`, "success");
        await fetchBranches();
      } catch (err) {
        setLoading(false);
        console.error(err);
        showToast("Failed to create branch.", "error");
      }
    });
  };

  const handleCommit = async () => {
    if (!commitMessage.trim())
      return showToast("Enter a commit message.", "error");

    // Build current structure
    const structure = buildStructure();
    if (!structure) {
      return showToast("Failed to build project structure.", "error");
    }

    await withLock(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/commit-git`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: commitMessage,
              author: `${user.username || user.email} <${user.email}>`,
              branchName: currentBranch,
              structure,
            }),
          },
        );
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
          showToast(data.error || "Commit failed.", "error");
          return;
        }
        setCommitMessage("");
        await Promise.all([fetchCommits(currentBranch), fetchGitStatus()]);
        localStorage.removeItem(localKey.current(currentBranch));
        showToast("Committed successfully.", "success");
      } catch (err) {
        setLoading(false);
        console.error(err);
        showToast("Network error during commit.", "error");
      }
    });
  };

  const switchBranch = async (target: string) => {
    if (target === currentBranch) return;

    await withLock(async () => {
      setLoading(true);

      try {
        // Step 1: Check for uncommitted changes
        if (uncommittedCount > 0) {
          const action = confirm(
            `You have ${uncommittedCount} uncommitted change(s) in branch "${currentBranch}".\n\nOK = Commit before switching\nCancel = Discard changes and switch`,
          );
          if (action) {
            if (!commitMessage.trim()) {
              showToast(
                "Please enter a commit message before switching",
                "error",
              );
              setLoading(false);
              return;
            }
            await handleCommit();
            // Wait a bit for commit to complete
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        // Step 2: Check for autosaved work
        const autosaveKey = localKey.current(currentBranch);
        const saved = localStorage.getItem(autosaveKey);
        if (saved) {
          localStorage.removeItem(autosaveKey);
        }

        // Step 3: Signal Yjs to disconnect (critical!)
        console.log("[SWITCH] Signaling Yjs disconnect...");
        applyStructureToEditor(null); // This will clear activeFile and trigger Yjs cleanup

        // Step 4: Wait for Yjs cleanup to complete
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Step 5: Call the API to switch the branch on the server
        console.log(
          `[SWITCH] Calling PUT /api/.../branch-git to switch to ${target}`,
        );
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch-git`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branchName: target }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to switch branch on server.");
        }

        console.log("[SWITCH] Server responded OK.", data);

        // Step 6: Update the frontend state
        setCurrentBranch(target);

        // Step 7: Apply the new file structure
        if (data.structure) {
          console.log("[SWITCH] Applying structure from response.");
          // Wait a bit before applying to ensure Yjs is fully disconnected
          await new Promise((resolve) => setTimeout(resolve, 200));
          applyStructureToEditor(data.structure as StructureNode);
          // Cache the new structure
          localStorage.setItem(
            `vc_structure:${projectId}:${target}`,
            JSON.stringify(data.structure),
          );
        } else {
          console.warn(
            "[SWITCH] No structure in response, fetching separately.",
          );
          const refRes = await fetch(
            `/api/projects/${projectId}?branch=${target}`,
          );
          const refData = await refRes.json();
          if (refRes.ok && refData.structure) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            applyStructureToEditor(refData.structure as StructureNode);
          } else {
            throw new Error("Failed to load branch structure after switch.");
          }
        }

        // Step 8: Refresh auxiliary data
        await Promise.all([
          fetchBranches(),
          fetchCommits(target),
          fetchGitStatus(),
        ]);

        showToast(`Switched to branch "${target}".`, "success");
      } catch (err) {
        console.error("❌ switchBranch error", err);
        showToast((err as Error).message, "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const deleteBranch = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"? This cannot be undone.`)) {
      return;
    }

    await withLock(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch-git`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branchName }),
          },
        );
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
          showToast(data.error || "Failed to delete branch.", "error");
          return;
        }
        showToast(`Branch '${branchName}' deleted.`, "success");
        await fetchBranches();
      } catch (err) {
        setLoading(false);
        console.error(err);
        showToast("Delete failed.", "error");
      }
    });
  };

  const restoreCommit = async (commitId: string) => {
    if (
      !confirm(
        "Restore this commit? This will overwrite your current working copy.",
      )
    ) {
      return;
    }

    await withLock(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/commit-git`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              commitHash: commitId,
              branchName: currentBranch,
            }),
          },
        );
        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
          showToast(data.error || "Restore failed.", "error");
          return;
        }

        console.log("Commit restore response:", data);

        if (data.structure) {
          applyStructureToEditor(data.structure as StructureNode);

          localStorage.setItem(
            `vc_load:${projectId}`,
            JSON.stringify({
              structure: data.structure,
              branch: currentBranch,
              message: "Commit restored successfully",
            }),
          );
        }

        showToast(
          "Commit restored successfully. Workspace updated.",
          "success",
        );
        await Promise.all([fetchCommits(currentBranch), fetchGitStatus()]);
      } catch (err) {
        setLoading(false);
        console.error(err);
        showToast("Restore failed.", "error");
      }
    });
  };

  const handlePushToMain = async () => {
    if (currentBranch === "main")
      return showToast("You're already on main.", "error");

    // Check for uncommitted changes
    if (uncommittedCount > 0) {
      showToast("Please commit your changes before pushing to main.", "error");
      return;
    }

    if (
      !confirm(
        `Push branch "${currentBranch}" into main? This will merge your branch into main.`,
      )
    ) {
      return;
    }

    // Build current structure to send to server
    const structure = buildStructure();
    if (!structure) {
      showToast("Failed to build project structure.", "error");
      return;
    }

    await withLock(async () => {
      setLoading(true);

      try {
        console.log(`[PUSH] Starting push from ${currentBranch} to main`);

        // Step 1: Merge current branch into main
        const res = await fetch(
          `/api/projects/${projectId}/version-control/merge-git`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceBranch: currentBranch,
              targetBranch: "main",
              commitMessage: `Merge ${currentBranch} into main`,
              structure, // Send current structure
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          setLoading(false);
          if (data.hasConflicts) {
            showToast(
              "Merge conflicts detected. Please resolve manually.",
              "error",
            );
          } else {
            showToast(data.error || "Push failed.", "error");
          }
          return;
        }

        console.log("✅ Push response:", data);

        // Step 2: Clear cached structures
        try {
          const keys = Object.keys(localStorage);
          keys.forEach((key) => {
            if (
              key.startsWith(`vc_structure:${projectId}`) ||
              key.startsWith(`vc_autosave:${projectId}`)
            ) {
              localStorage.removeItem(key);
            }
          });
        } catch (err) {
          console.error("Failed to clear cache", err);
        }

        // Step 3: Refresh metadata
        await Promise.all([fetchBranches(), fetchGitStatus()]);

        setLoading(false);
        showToast(
          `Successfully pushed ${currentBranch} to main. You're still on ${currentBranch}.`,
          "success",
        );
      } catch (err) {
        setLoading(false);
        console.error("Push error:", err);
        showToast("Push failed: " + (err as Error).message, "error");
      }
    });
  };

  const handlePullFromMain = async () => {
    if (currentBranch === "main")
      return showToast("Pull not needed on main.", "error");

    // Check for uncommitted changes
    if (uncommittedCount > 0) {
      const shouldContinue = confirm(
        `You have ${uncommittedCount} uncommitted change(s).\n\nCommit them before pulling from main?\n\nOK = Commit first\nCancel = Abort pull`,
      );

      if (shouldContinue) {
        if (!commitMessage.trim()) {
          showToast("Please enter a commit message before pulling.", "error");
          return;
        }
        // Commit first
        await handleCommit();
        // Wait for commit to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        return;
      }
    }

    if (
      !confirm(
        `Pull main into "${currentBranch}"? This will merge main's changes into your current branch.`,
      )
    ) {
      return;
    }

    // Build current structure to send to server
    const structure = buildStructure();
    if (!structure) {
      showToast("Failed to build project structure.", "error");
      return;
    }

    await withLock(async () => {
      setLoading(true);

      try {
        console.log(`[PULL] Starting pull from main to ${currentBranch}`);

        // Step 1: Merge main into current branch
        const res = await fetch(
          `/api/projects/${projectId}/version-control/merge-git`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceBranch: "main",
              targetBranch: currentBranch,
              commitMessage: `Merge main into ${currentBranch}`,
              structure, // Send current structure
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          setLoading(false);
          if (data.hasConflicts) {
            showToast(
              "Merge conflicts detected. Please resolve manually.",
              "error",
            );
          } else {
            showToast(data.error || "Pull failed.", "error");
          }
          return;
        }

        console.log("✅ Pull response:", data);

        // Step 2: Apply structure to editor if available
        if (data.structure) {
          console.log("📦 Applying pulled structure to editor");

          // Clear old cache
          localStorage.removeItem(`vc_structure:${projectId}:${currentBranch}`);
          localStorage.removeItem(`vc_autosave:${projectId}:${currentBranch}`);

          // Signal Yjs to disconnect
          applyStructureToEditor(null);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Apply new structure
          applyStructureToEditor(data.structure as StructureNode);

          // Cache the new structure
          localStorage.setItem(
            `vc_structure:${projectId}:${currentBranch}`,
            JSON.stringify(data.structure),
          );
        } else {
          console.warn("⚠️ No structure in pull response");
        }

        // Step 3: Refresh metadata
        await Promise.all([fetchCommits(currentBranch), fetchGitStatus()]);

        setLoading(false);
        showToast(
          "Pulled from main successfully. Workspace updated.",
          "success",
        );
      } catch (err) {
        setLoading(false);
        console.error("Pull error:", err);
        showToast("Pull failed: " + (err as Error).message, "error");
      }
    });
  };

  return (
    <div className="p-4 h-full text-gray-200 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold text-purple-400">
          Version Control
        </h3>
        <div className="flex gap-2">
          {operationInProgress && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <span className="animate-spin">⚙️</span> Working...
            </span>
          )}
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mb-4 pb-2 border-b border-gray-700">
        <div className="mb-2">
          <strong>Active Branch:</strong>{" "}
          <span className="text-green-400">{currentBranch}</span>
        </div>

        {/* Git Status Indicator */}
        {gitStatus && (
          <div className="mb-2 text-xs">
            {gitStatus.isClean ? (
              <span className="text-green-400">✓ Working tree clean</span>
            ) : (
              <div className="text-yellow-400">
                <div>⚠️ {uncommittedCount} uncommitted change(s):</div>
                {gitStatus.modified.length > 0 && (
                  <div className="ml-2">
                    • {gitStatus.modified.length} modified
                  </div>
                )}
                {gitStatus.added.length > 0 && (
                  <div className="ml-2">• {gitStatus.added.length} added</div>
                )}
                {gitStatus.deleted.length > 0 && (
                  <div className="ml-2">
                    • {gitStatus.deleted.length} deleted
                  </div>
                )}
                {gitStatus.untracked.length > 0 && (
                  <div className="ml-2">
                    • {gitStatus.untracked.length} untracked
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <input
            placeholder="New branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") createBranch();
            }}
            className="flex-1 bg-gray-700 p-2 rounded text-white placeholder-gray-400"
          />
          <button
            onClick={createBranch}
            disabled={loading || operationInProgress || !newBranchName.trim()}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Create"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold mb-2">Branches ({branches.length})</h4>
        <div className="space-y-2 max-h-36 overflow-y-auto mb-3 border border-gray-700 p-2 rounded">
          {branches.map((b) => (
            <div
              key={b}
              className="flex justify-between items-center bg-gray-800/50 p-2 rounded"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${b === currentBranch ? "bg-green-700" : "bg-gray-700"}`}
                >
                  {b}
                </span>
              </div>
              <div className="flex gap-2">
                {b !== currentBranch && (
                  <button
                    onClick={() => switchBranch(b)}
                    disabled={loading || operationInProgress}
                    className="text-sm bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Switch
                  </button>
                )}
                {b !== "main" && b !== currentBranch && (
                  <button
                    onClick={() => deleteBranch(b)}
                    disabled={loading || operationInProgress}
                    className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handlePushToMain}
            className="flex-1 bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              currentBranch === "main" || loading || operationInProgress
            }
          >
            Push → main
          </button>
          <button
            onClick={handlePullFromMain}
            className="flex-1 bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              currentBranch === "main" || loading || operationInProgress
            }
          >
            Pull ← main
          </button>
        </div>
      </div>

      <div className="mb-4 pt-4 border-t border-gray-700">
        <h4 className="font-semibold mb-2">Create Commit</h4>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message"
          className="w-full bg-gray-700 p-2 rounded mb-2 text-white placeholder-gray-400"
          rows={3}
        />
        <button
          onClick={handleCommit}
          className="w-full bg-green-600 hover:bg-green-700 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || operationInProgress || !commitMessage.trim()}
        >
          {loading ? "Working..." : "Commit to branch"}
        </button>
      </div>

      <div className="flex-1 pt-4 border-t border-gray-700 overflow-y-auto">
        <div>
          <h4 className="font-semibold mb-2">
            Commits ({commits.length}) - {currentBranch}
          </h4>
          <div className="space-y-3">
            {commits.length === 0 && (
              <div className="text-gray-400 text-sm">No commits yet.</div>
            )}
            {commits.map((c) => (
              <div
                key={c._id || c.message + c.timestamp}
                className="bg-gray-800 p-3 rounded border border-gray-700 flex justify-between items-start"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {c.message}
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.author} •{" "}
                    {c.timestamp ? new Date(c.timestamp).toLocaleString() : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1 ml-4">
                  <button
                    onClick={() =>
                      c._id
                        ? restoreCommit(c._id)
                        : showToast("Invalid commit ID", "error")
                    }
                    disabled={loading || operationInProgress}
                    className="text-xs bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
