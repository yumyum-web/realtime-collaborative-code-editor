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
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { presence, setEditor, setMonaco } = useYjs(
    activeFile,
    user,
    projectId,
    initialFiles,
    filesRef.current,
  );

  // Responsive handling
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      // Auto-hide chat on very small screens
      if (width < 1024 && chatOpen) {
        setChatOpen(false);
      }
      // Auto-collapse sidebar on small screens
      if (width < 640) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chatOpen]);

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
    <div className="flex h-screen bg-gray-900 text-gray-200 overflow-hidden">
      {/* Sidebar - File Tree */}
      <aside
        className={`${
          sidebarCollapsed ? "w-12" : "w-64"
        } bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${
          isMobile && chatOpen ? "hidden" : ""
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between min-h-[60px]">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-bold truncate">{projectTitle}</h2>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
              />
            </svg>
          </button>
        </div>

        {/* File Tree Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!sidebarCollapsed && (
            <>
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

              {/* File Operations */}
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
                  onClick={() => handleAddNode("folder", "root")}
                >
                  + Folder
                </button>
                <button
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
                  onClick={() => handleAddNode("file", "root")}
                >
                  + File
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {!sidebarCollapsed && (
            <>
              <PresenceList presence={presence} />
            </>
          )}
        </div>
      </aside>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Navigation Bar */}
        <div className="flex justify-between items-center bg-gray-800 px-4 py-3 border-b border-gray-700 min-h-[60px] flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="md:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Toggle sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="text-sm text-gray-300 truncate">
              <span className="text-gray-400">Editing:</span>{" "}
              <strong className="text-white">
                {activeFile || "No file selected"}
              </strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              onClick={handleInitGit}
            >
              Init Git
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              onClick={handleSaveProject}
            >
              Save Project
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 relative">
          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 14,
              lineHeight: 1.5,
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div
        className={`fixed z-30 transition-all duration-300 ${
          chatOpen || showGitPanel
            ? "bottom-6 right-[340px] flex flex-col gap-4 mb-2"
            : "bottom-6 right-6 flex flex-col gap-4 mb-2"
        }`}
      >
        {/* Chat Button */}
        <button
          className={`w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95 flex items-center justify-center group ${
            chatOpen ? "ring-2 ring-blue-400" : ""
          }`}
          onClick={() => {
            setChatOpen(true);
            setShowGitPanel(false);
          }}
          title="Open Chat"
        >
          <VscComment className="w-5 h-5" />
        </button>

        {/* Git History Button */}
        {gitStatus && (
          <button
            className={`w-12 h-12 bg-orange-600 hover:bg-orange-500 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95 flex items-center justify-center group ${
              showGitPanel ? "ring-2 ring-orange-400" : ""
            }`}
            onClick={() => {
              setShowGitPanel(true);
              setChatOpen(false);
            }}
            title="Git History"
          >
            <VscHistory className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Right Sidebar Panel */}
      {(chatOpen || showGitPanel) && (
        <aside
          className={`w-80 bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${
            isMobile ? "fixed right-0 top-0 h-full z-50" : ""
          }`}
        >
          {chatOpen && (
            <ChatPanel
              chatMessages={chatMessages}
              user={user}
              onSendMessage={handleSendChatMessage}
              onClose={() => setChatOpen(false)}
            />
          )}

          {showGitPanel && gitStatus && (
            <div className="h-full flex flex-col">
              {/* Git Panel Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-700 min-h-[60px] flex-shrink-0">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <VscHistory className="w-5 h-5" />
                  Git History
                </h3>
                <button
                  onClick={() => setShowGitPanel(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Git Panel Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {gitStatus?.commits && gitStatus.commits.length > 0 ? (
                  <div className="space-y-4">
                    {gitStatus.commits.map((commit: GitCommit) => (
                      <div
                        key={commit.hash}
                        className="bg-gray-900 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <VscGitCommit className="text-green-500 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate mb-2">
                              {commit.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>{commit.author}</span>
                              <span>
                                {new Date(commit.date).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-2">
                              {commit.hash.substring(0, 7)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : gitStatus?.initialized === false ? (
                  <div className="text-center py-12">
                    <div className="mb-6">
                      <VscHistory className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 mb-4">
                        Git is not initialized for this project
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleInitGit();
                        setShowGitPanel(false);
                      }}
                      className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                    >
                      Initialize Git
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <VscHistory className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No commits yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
