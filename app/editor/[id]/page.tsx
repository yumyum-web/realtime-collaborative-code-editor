"use client";

import React, { useCallback, useEffect, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { VscComment, VscGitCommit, VscHistory } from "react-icons/vsc";
import { useParams } from "next/navigation";

import type {
  ChatMessage,
  NodeAddedPayload,
  NodeDeletedPayload,
} from "./types";

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

interface GitStatus {
  initialized: boolean;
  status: {
    modified: string[];
    created: string[];
    deleted: string[];
  } | null;
  commits: GitCommit[];
  branches: Array<{ name: string; current: boolean }>;
}

import { useUser } from "./hooks/useUser";
import { useSocket } from "./hooks/useSocket";
import { useFileTree } from "./hooks/useFileTree";
import { useYjs } from "./hooks/useYjs";

import { useMonaco } from "./hooks/useMonaco";
import { addNode, deleteNode, reconstructTree } from "./utils/fileTreeHelpers";

import { FileTree } from "./components/FileTree";
import { ChatPanel } from "./components/ChatPanel";
import { PresenceList } from "./components/PresenceList";

export default function EditorPage() {
  const { id: projectId } = useParams() as { id: string };

  useMonaco();

  const user = useUser();

  const {
    socket,
    chatMessages,
    emitNodeAdded,
    emitNodeDeleted,
    emitChatMessage,
  } = useSocket(projectId);

  const {
    fileTree,
    setFileTree,
    initialFiles,
    filesRef,
    projectTitle,
    getFirstFile,
  } = useFileTree(projectId);

  const [activeFile, setActiveFile] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const [chatOpen, setChatOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [showGitPanel, setShowGitPanel] = useState(false);

  const { presence, setEditor, setMonaco } = useYjs(
    activeFile,
    user,
    projectId,
    initialFiles,
    filesRef.current,
  );

  const handleGetGitStatus = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/git?userEmail=${user.email}`,
      );
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
        console.log("Git status:", data);
      } else {
        setGitStatus(null);
      }
    } catch (error) {
      console.error("Error getting Git status:", error);
      setGitStatus(null);
    }
  }, [projectId, user?.email]);

  const handleInitGit = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.email }),
      });
      if (res.ok) {
        alert("Git initialized");
        handleGetGitStatus();
      } else {
        alert("Failed to initialize Git");
      }
    } catch (error) {
      console.error("Error initializing Git:", error);
      alert("Error initializing Git");
    }
  }, [projectId, user?.email, handleGetGitStatus]);

  useEffect(() => {
    handleGetGitStatus();
  }, [handleGetGitStatus]);

  useEffect(() => {
    if (fileTree.length > 0 && !activeFile) {
      const firstFile = getFirstFile();
      if (firstFile) {
        setActiveFile(firstFile);
        setExpandedFolders(new Set([fileTree[0].name]));
      }
    }
  }, [fileTree, activeFile, getFirstFile]);

  useEffect(() => {
    if (!socket) return;

    const handleNodeAdded = (payload: NodeAddedPayload) => {
      setFileTree((prev) => addNode(prev, payload));
      if (payload.type === "file") {
        setActiveFile((f) => f || `${payload.parentPath}/${payload.name}`);
        filesRef.current[`${payload.parentPath}/${payload.name}`] = "";
      }
      setExpandedFolders((p) => new Set(p).add(payload.parentPath));
    };

    const handleNodeDeleted = (payload: NodeDeletedPayload) => {
      if (payload.path === "root") return;
      setFileTree((prev) => deleteNode(prev, payload));
      delete filesRef.current[payload.path];
      setActiveFile((f) => (f === payload.path ? "" : f));
    };

    socket.on("node-added", handleNodeAdded);
    socket.on("node-deleted", handleNodeDeleted);

    return () => {
      socket.off("node-added", handleNodeAdded);
      socket.off("node-deleted", handleNodeDeleted);
    };
  }, [socket, setFileTree, filesRef]);

  const handleSaveProject = useCallback(async () => {
    if (!projectId) return;

    const structure = reconstructTree(fileTree, "", filesRef.current)[0];
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure }),
      });
      if (!res.ok) {
        alert("Save failed");
        return;
      }

      // If Git is initialized, sync files to repo and commit
      if (gitStatus) {
        await fetch(`/api/projects/${projectId}/git/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: user?.email,
            message: "Save project",
            files: filesRef.current,
          }),
        });
      }

      alert("Project saved");
    } catch (error) {
      console.error("Save error:", error);
      alert("Save failed");
    }
  }, [projectId, fileTree, filesRef, gitStatus, user?.email]);

  const handleAddNode = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      const name = prompt(`Enter ${type} name`);
      if (!name) return;
      setFileTree((p) => addNode(p, { type, parentPath, name }));
      if (type === "file") {
        setActiveFile((f) => f || `${parentPath}/${name}`);
        filesRef.current[`${parentPath}/${name}`] = "";
      }
      setExpandedFolders((p) => new Set(p).add(parentPath));
      emitNodeAdded({ type, parentPath, name });
    },
    [setFileTree, filesRef, emitNodeAdded],
  );

  const handleDeleteNode = useCallback(
    (path: string) => {
      if (path === "root") return alert("Root cannot be deleted.");
      if (!confirm(`Delete ${path}?`)) return;
      setFileTree((p) => deleteNode(p, { path }));
      emitNodeDeleted({ path });
      delete filesRef.current[path];
    },
    [setFileTree, emitNodeDeleted, filesRef],
  );

  const handleSendChatMessage = useCallback(
    (message: ChatMessage) => {
      fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }).catch(console.error);
      emitChatMessage(message);
    },
    [projectId, emitChatMessage],
  );

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      setEditor(editor);
      setMonaco(monaco);
    },
    [setEditor, setMonaco],
  );

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
      <aside
        className={`w-64 bg-gray-800 p-4 overflow-y-auto text-sm border-r border-gray-700 ${
          chatOpen ? "hidden md:block" : ""
        }`}
      >
        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
          {projectTitle}
        </h2>
        <FileTree
          fileTree={fileTree}
          setFileTree={setFileTree}
          activeFile={activeFile}
          setActiveFile={setActiveFile}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          onAddNode={handleAddNode}
          onDeleteNode={handleDeleteNode}
        />
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 bg-blue-800 hover:bg-blue-700 py-1 rounded"
            onClick={() => handleAddNode("folder", "root")}
          >
            + Folder
          </button>
          <button
            className="flex-1 bg-blue-800 hover:bg-blue-700 py-1 rounded"
            onClick={() => handleAddNode("file", "root")}
          >
            + File
          </button>
        </div>
        <button
          className="mt-4 w-full flex items-center gap-2 px-2 py-1 bg-green-700 hover:bg-green-600 rounded"
          onClick={() => setChatOpen((s) => !s)}
        >
          <VscComment /> Chat
        </button>
        {gitStatus && (
          <button
            className="mt-2 w-full flex items-center gap-2 px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded"
            onClick={() => setShowGitPanel((s) => !s)}
          >
            <VscHistory /> Git History
          </button>
        )}
        <PresenceList presence={presence} />
      </aside>

      <div
        className={`flex-1 flex flex-col ${chatOpen ? "md:w-2/3" : "w-full"}`}
      >
        <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div>
            Editing: <strong>{activeFile || "No file selected"}</strong>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-purple-800 hover:bg-purple-600 px-4 py-1 rounded"
              onClick={handleInitGit}
            >
              Init Git
            </button>
            <button
              className="bg-blue-800 hover:bg-blue-600 px-4 py-1 rounded"
              onClick={handleSaveProject}
            >
              Save Project
            </button>
          </div>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            onMount={handleMount}
            options={{ minimap: { enabled: false }, automaticLayout: true }}
          />
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          chatMessages={chatMessages}
          user={user}
          onSendMessage={handleSendChatMessage}
          onClose={() => setChatOpen(false)}
        />
      )}

      {showGitPanel && gitStatus && (
        <aside className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <VscGitCommit /> Git History
            </h3>
            <button
              className="text-gray-400 hover:text-white"
              onClick={() => setShowGitPanel(false)}
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-gray-400">
                Repository Status
              </h4>
              <div className="text-xs space-y-1">
                <p>
                  Branch:{" "}
                  <span className="text-green-400">
                    {gitStatus?.branches?.find((b) => b.current)?.name ||
                      "master"}
                  </span>
                </p>
                {gitStatus?.status?.modified &&
                  gitStatus.status.modified.length > 0 && (
                    <p className="text-yellow-400">
                      Modified: {gitStatus.status.modified.length} files
                    </p>
                  )}
                {gitStatus?.status?.created &&
                  gitStatus.status.created.length > 0 && (
                    <p className="text-green-400">
                      New: {gitStatus.status.created.length} files
                    </p>
                  )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-gray-400">
                Commit History
              </h4>
              {gitStatus?.commits && gitStatus.commits.length > 0 ? (
                <div className="space-y-3">
                  {gitStatus.commits.map((commit: GitCommit) => (
                    <div
                      key={commit.hash}
                      className="bg-gray-900 p-3 rounded border border-gray-700"
                    >
                      <div className="flex items-start gap-2">
                        <VscGitCommit className="text-green-500 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {commit.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {commit.author}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(commit.date).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 font-mono mt-1">
                            {commit.hash.substring(0, 7)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : gitStatus?.initialized === false ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400 mb-4">
                    Git is not initialized for this project
                  </p>
                  <button
                    onClick={handleInitGit}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Initialize Git
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No commits yet</p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
