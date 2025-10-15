import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  VscGitCommit,
  VscGitMerge,
  VscAdd,
  VscTrash,
  VscCheck,
  VscWarning,
  VscHistory,
  VscRepoPush,
  VscRepoPull,
} from "react-icons/vsc";
import { useVersionControlSocket } from "../hooks/useVersionControlSocket";

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

  // Setup version control socket listeners
  useVersionControlSocket(projectId, {
    onBranchCreated: (data) => {
      console.log("🌿 Remote branch created:", data.branchName);
      showToast(`Branch "${data.branchName}" was created`, "success");
      fetchBranches();
    },
    onBranchDeleted: (data) => {
      console.log("🗑️ Remote branch deleted:", data.branchName);
      showToast(`Branch "${data.branchName}" was deleted`, "success");
      fetchBranches();
    },
    onBranchSwitched: (data) => {
      const targetBranch = data.toBranch || data.branchName;
      console.log("🔀 Remote branch switched to:", targetBranch);
      // Only show toast if it's not our own switch
      if (targetBranch && targetBranch !== currentBranch) {
        showToast(
          `Another user switched to branch "${targetBranch}"`,
          "success",
        );
      }
    },
    onCommitCreated: (data) => {
      console.log("📝 Remote commit created:", data.commitHash);
      showToast(`New commit: ${data.message}`, "success");
      fetchCommits(currentBranch);
      fetchGitStatus();
    },
    onBranchMerged: (data) => {
      console.log(
        "🔀 Remote merge:",
        data.sourceBranch,
        "→",
        data.targetBranch,
      );
      showToast(
        `Branches merged: ${data.sourceBranch} → ${data.targetBranch}`,
        "success",
      );
      fetchCommits(currentBranch);
      fetchGitStatus();
    },
  });

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

  const deleteBranch = async (branchName: string, forceDelete = false) => {
    if (!forceDelete) {
      if (!confirm(`Delete branch "${branchName}"? This cannot be undone.`)) {
        return;
      }
    }

    await withLock(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch-git`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branchName, force: forceDelete }),
          },
        );
        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
          // If branch has unmerged commits, ask user if they want to force delete
          if (data.requiresForce && !forceDelete) {
            const shouldForce = confirm(
              `Branch "${branchName}" has unmerged commits.\n\nForce delete anyway? This will permanently lose those commits.`,
            );
            if (shouldForce) {
              await deleteBranch(branchName, true);
              return;
            }
          }
          showToast(data.error || "Failed to delete branch.", "error");
          return;
        }

        showToast(`Branch '${branchName}' deleted successfully.`, "success");

        // Refresh branch list
        await fetchBranches();
      } catch (err) {
        setLoading(false);
        console.error(err);
        showToast("Delete failed: " + (err as Error).message, "error");
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

    // Check for uncommitted changes and commit them
    if (uncommittedCount > 0) {
      const shouldCommit = confirm(
        `You have ${uncommittedCount} uncommitted change(s).\n\nCommit them before pushing?\n\nOK = Commit and push\nCancel = Abort`,
      );

      if (!shouldCommit) {
        return;
      }

      if (!commitMessage.trim()) {
        showToast("Please enter a commit message before pushing.", "error");
        return;
      }

      // Commit the changes first
      await handleCommit();
      // Wait for commit to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
              `Merge conflicts detected in: ${data.conflicts?.join(", ") || "files"}. Please resolve manually.`,
              "error",
            );
            // Optionally show conflicted files in the editor
            if (data.structure) {
              console.log("📦 Conflicted structure available for resolution");
            }
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

        // Step 3: Refresh metadata and commits
        await Promise.all([
          fetchBranches(),
          fetchGitStatus(),
          fetchCommits(currentBranch),
        ]);

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
              `Merge conflicts detected in: ${data.conflicts?.join(", ") || "files"}. Please resolve manually.`,
              "error",
            );

            // If conflicts exist, apply the conflicted structure for user to resolve
            if (data.structure) {
              console.log("📦 Applying conflicted structure for resolution");
              applyStructureToEditor(null);
              await new Promise((resolve) => setTimeout(resolve, 300));
              applyStructureToEditor(data.structure as StructureNode);
            }
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
          // Fetch structure separately if not in response
          const refRes = await fetch(
            `/api/projects/${projectId}?branch=${currentBranch}`,
          );
          const refData = await refRes.json();
          if (refRes.ok && refData.structure) {
            applyStructureToEditor(null);
            await new Promise((resolve) => setTimeout(resolve, 300));
            applyStructureToEditor(refData.structure as StructureNode);
          }
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
    <div className="h-full bg-sidebar text-gray-100 flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current Branch Status */}
        <div className="bg-card/50 border border-gray-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Current Branch
            </h3>
            <div className="flex items-center gap-2">
              <VscGitMerge className="w-3 h-3 text-green-400" />
              <span className="text-green-400 text-sm font-medium">
                {currentBranch}
              </span>
            </div>
          </div>

          {/* Git Status */}
          {gitStatus && (
            <div className="space-y-2">
              {gitStatus.isClean ? (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-2 py-1.5 rounded-lg">
                  <VscCheck className="w-3 h-3" />
                  <span>Working tree is clean</span>
                </div>
              ) : (
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded p-2">
                  <div className="flex items-center gap-2 text-xs text-yellow-400 mb-1.5">
                    <VscWarning className="w-3 h-3" />
                    <span>
                      {uncommittedCount} uncommitted change
                      {uncommittedCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {gitStatus.modified.length > 0 && (
                      <div className="text-orange-300">
                        • {gitStatus.modified.length} modified
                      </div>
                    )}
                    {gitStatus.added.length > 0 && (
                      <div className="text-green-300">
                        • {gitStatus.added.length} added
                      </div>
                    )}
                    {gitStatus.deleted.length > 0 && (
                      <div className="text-red-300">
                        • {gitStatus.deleted.length} deleted
                      </div>
                    )}
                    {gitStatus.untracked.length > 0 && (
                      <div className="text-blue-300">
                        • {gitStatus.untracked.length} untracked
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Branch */}
        <div className="bg-card/50 border border-gray-700 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
            Create Branch
          </h3>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <VscAdd className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                placeholder="New branch name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") createBranch();
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <button
              onClick={createBranch}
              disabled={loading || operationInProgress || !newBranchName.trim()}
              className="bg-gradient-primary disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-1.5"
            >
              <VscAdd className="w-3 h-3" />
              <span className="text-sm">Create</span>
            </button>
          </div>
        </div>

        {/* Branches */}
        <div className="bg-card/50 border border-gray-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Branches
            </h3>
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
              {branches.length}
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {branches.map((branch) => (
              <div
                key={branch}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                  branch === currentBranch
                    ? "bg-blue-600/20 border-blue-500/50"
                    : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <VscGitMerge
                    className={`w-3 h-3 ${branch === currentBranch ? "text-blue-400" : "text-gray-400"}`}
                  />
                  <span
                    className={`text-sm font-medium ${branch === currentBranch ? "text-blue-300" : "text-gray-300"}`}
                  >
                    {branch}
                  </span>
                  {branch === currentBranch && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-xl font-medium">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {branch !== currentBranch && (
                    <button
                      onClick={() => switchBranch(branch)}
                      disabled={loading || operationInProgress}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-1"
                    >
                      <VscGitMerge className="w-3 h-3" />
                      Switch
                    </button>
                  )}
                  {branch !== "main" && branch !== currentBranch && (
                    <button
                      onClick={() => deleteBranch(branch)}
                      disabled={loading || operationInProgress}
                      className="bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-1"
                    >
                      <VscTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Push/Pull Actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-600">
            <button
              onClick={handlePushToMain}
              disabled={
                currentBranch === "main" || loading || operationInProgress
              }
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-1.5"
            >
              <VscRepoPush className="w-3 h-3" />
              <span className="text-sm">Push to main</span>
              {/* <VscArrowRight className="w-3 h-3" /> */}
            </button>
            <button
              onClick={handlePullFromMain}
              disabled={
                currentBranch === "main" || loading || operationInProgress
              }
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-1.5"
            >
              {/* <VscArrowLeft className="w-3 h-3" /> */}
              <VscRepoPull className="w-3 h-3" />
              <span className="text-sm">Pull from main</span>
            </button>
          </div>
        </div>

        {/* Commit Section */}
        <div className="bg-card/50 border border-gray-700 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
            Create Commit
          </h3>
          <div className="space-y-2">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm text-white placeholder-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-none"
              rows={2}
            />
            <button
              onClick={handleCommit}
              disabled={loading || operationInProgress || !commitMessage.trim()}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-1.5"
            >
              <VscGitCommit className="w-3 h-3" />
              <span className="text-sm">Commit Changes</span>
            </button>
          </div>
        </div>

        {/* Commits History */}
        <div className="bg-card/50 border border-gray-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
              <VscHistory className="w-3 h-3" />
              Commit History
            </h3>
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
              {commits.length}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {commits.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <VscHistory className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No commits yet</p>
                <p className="text-xs mt-0.5">
                  Create your first commit to get started
                </p>
              </div>
            ) : (
              commits.map((commit) => (
                <div
                  key={commit._id || commit.message + commit.timestamp}
                  className="bg-gray-700/50 border border-gray-600 rounded-lg p-2 hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <VscGitCommit className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <h4 className="font-medium text-white text-xs leading-tight">
                          {commit.message}
                        </h4>
                      </div>
                      <div className="text-xs text-gray-400 ml-4.5">
                        <span className="font-medium">{commit.author}</span>
                        {commit.timestamp && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span>
                              {new Date(commit.timestamp).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        commit._id
                          ? restoreCommit(commit._id)
                          : showToast("Invalid commit ID", "error")
                      }
                      disabled={loading || operationInProgress}
                      className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-1 flex-shrink-0"
                    >
                      <VscHistory className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
