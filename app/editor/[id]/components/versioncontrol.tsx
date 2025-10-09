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
  currentBranch,
  setCurrentBranch,
}: Props) {
  const [branches, setBranches] = useState<string[]>([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);

  const localKey = useRef((b: string) => `vc_autosave:${projectId}:${b}`);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch`,
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

  const fetchCommits = useCallback(
    async (branchName?: string) => {
      try {
        const b = branchName || currentBranch;
        const res = await fetch(
          `/api/projects/${projectId}/version-control/commit?branch=${encodeURIComponent(b)}`,
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
  }, [fetchBranches]);

  useEffect(() => {
    if (currentBranch) fetchCommits(currentBranch);
  }, [currentBranch, fetchCommits]);

  const createBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return showToast("Enter a valid branch name.", "error");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchName: name, baseBranch: currentBranch }),
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
  };

  const handleCommit = async () => {
    if (!commitMessage.trim())
      return showToast("Enter a commit message.", "error");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: commitMessage,
            author: user.email,
            branchName: currentBranch,
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
      await fetchCommits(currentBranch);
      localStorage.removeItem(localKey.current(currentBranch));
      showToast("Committed successfully.", "success");
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast("Network error during commit.", "error");
    }
  };

  // --- Switch branch with proper structure reload ---
  const switchBranch = async (target: string) => {
    if (target === currentBranch) return;

    const autosaveKey = localKey.current(currentBranch);
    const saved = localStorage.getItem(autosaveKey);

    if (saved) {
      const keep = confirm(
        `You have unsaved work in branch "${currentBranch}". Commit before switching? OK=Commit & switch, Cancel=Discard & switch.`,
      );
      if (keep) {
        await handleCommit();
      } else {
        localStorage.removeItem(autosaveKey);
      }
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchName: target }),
        },
      );

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        showToast(data.error || "Switch failed.", "error");
        return;
      }

      // Apply structure immediately
      if (data.structure) {
        applyStructureToEditor(data.structure as StructureNode);
      } else {
        // 🔁 Fallback: force re-fetch project structure if not in response
        const refRes = await fetch(
          `/api/projects/${projectId}/version-control/structure?branch=${target}`,
        );
        const refData = await refRes.json();
        if (refRes.ok && refData.structure) {
          applyStructureToEditor(refData.structure as StructureNode);
        }
      }

      // Clear any existing cached structure of previous branch
      localStorage.removeItem(`vc_structure:${projectId}:${currentBranch}`);

      // Cache current branch structure
      if (data.structure) {
        localStorage.setItem(
          `vc_structure:${projectId}:${target}`,
          JSON.stringify(data.structure),
        );
      }

      setCurrentBranch(target);
      showToast(
        `Switched to branch "${target}". Workspace updated.`,
        "success",
      );

      // Refetch metadata (branches + commits)
      await Promise.all([fetchBranches(), fetchCommits(target)]);
    } catch (err) {
      setLoading(false);
      console.error("switchBranch error", err);
      showToast("Switch failed.", "error");
    }
  };

  const deleteBranch = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"? This cannot be undone.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/branch`,
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
  };

  // Restore commit with immediate structure reload
  const restoreCommit = async (commitId: string) => {
    if (
      !confirm(
        "Restore this commit? This will overwrite your current working copy.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/commit`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commitId, branchName: currentBranch }),
        },
      );
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        showToast(data.error || "Restore failed.", "error");
        return;
      }

      // CRITICAL: Apply structure immediately to update the editor
      if (data.structure) {
        applyStructureToEditor(data.structure as StructureNode);
      }

      // Store in localStorage as backup
      localStorage.setItem(
        `vc_load:${projectId}`,
        JSON.stringify({
          structure: data.structure,
          branch: currentBranch,
          message: "Commit restored successfully",
        }),
      );

      showToast("Commit restored successfully. Workspace updated.", "success");
      await fetchCommits(currentBranch);
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast("Restore failed.", "error");
    }
  };

  const handlePushToMain = async () => {
    if (currentBranch === "main")
      return showToast("You're already on main.", "error");
    if (
      !confirm(
        `Push branch "${currentBranch}" into main? This will overwrite main's working tree.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "push",
            sourceBranch: currentBranch,
            targetBranch: "main",
            author: user.email,
          }),
        },
      );
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        showToast(data.error || "Push failed.", "error");
        return;
      }
      showToast("Pushed to main successfully.", "success");
      await fetchBranches();
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast("Push failed.", "error");
    }
  };

  const handlePullFromMain = async () => {
    if (currentBranch === "main")
      return showToast("Pull not needed on main.", "error");
    if (
      !confirm(
        `Pull main into "${currentBranch}"? This will overwrite ${currentBranch}'s working tree.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/version-control/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pull",
            sourceBranch: "main",
            targetBranch: currentBranch,
            author: user.email,
          }),
        },
      );
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        showToast(data.error || "Pull failed.", "error");
        return;
      }

      // CRITICAL: Apply structure immediately to update the editor
      if (data.structure) {
        applyStructureToEditor(data.structure as StructureNode);
      }

      // Store in localStorage as backup
      localStorage.setItem(
        `vc_load:${projectId}`,
        JSON.stringify({
          structure: data.structure,
          branch: currentBranch,
          message: "Pulled from main successfully",
        }),
      );

      showToast("Pulled from main successfully. Workspace updated.", "success");
      await fetchCommits(currentBranch);
    } catch (err) {
      setLoading(false);
      console.error(err);
      showToast("Pull failed.", "error");
    }
  };

  return (
    <div className="p-4 h-full text-gray-200 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold text-purple-400">
          Version Control
        </h3>
        <div className="flex gap-2">
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
            disabled={loading || !newBranchName.trim()}
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
                    disabled={loading}
                    className="text-sm bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Switch
                  </button>
                )}
                {b !== "main" && b !== currentBranch && (
                  <button
                    onClick={() => deleteBranch(b)}
                    disabled={loading}
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
            disabled={currentBranch === "main" || loading}
          >
            Push → main
          </button>
          <button
            onClick={handlePullFromMain}
            className="flex-1 bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentBranch === "main" || loading}
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
          disabled={loading || !commitMessage.trim()}
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
                    disabled={loading}
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
