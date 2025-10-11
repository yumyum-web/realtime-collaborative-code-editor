"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useParams } from "next/navigation";
import { VscComment } from "react-icons/vsc";
import { VscGitCommit, VscHistory, VscGitMerge } from "react-icons/vsc";

import type {
  ChatMessage,
  NodeAddedPayload,
  NodeDeletedPayload,
} from "./types";

import { useUser } from "./hooks/useUser";
import { useSocket } from "./hooks/useSocket";
import { useFileTree } from "./hooks/useFileTree";
import { useYjs } from "./hooks/useYjs";
import { useMonaco } from "./hooks/useMonaco";

import { addNode, deleteNode, reconstructTree } from "./utils/fileTreeHelpers";
import { FileTree } from "./components/FileTree";
import { ChatPanel } from "./components/ChatPanel";
import { PresenceList } from "./components/PresenceList";
import VersionControlPanel from "./components/versioncontrol";

// --- Minimal Local Toast Implementation ---
type ToastMessage = {
  message: string;
  type: "success" | "error";
};

const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      if (toastRef.current !== null) {
        clearTimeout(toastRef.current);
      }
      setToast({ message, type });
      toastRef.current = window.setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  return { toast, showToast };
};

type StructureNode = {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: StructureNode[];
};

type GitCommit = {
  hash: string;
  message: string;
  author: string;
  date: string;
};

type GitStatus = {
  commits: GitCommit[];
  // Add other properties as needed
};

export default function EditorPage() {
  const { id: projectId } = useParams() as { id: string };
  useMonaco();

  const user = useUser();
  const { toast, showToast } = useToast();

  const {
    socket,
    chatMessages,
    emitNodeAdded,
    emitNodeDeleted,
    emitChatMessage,
  } = useSocket(projectId);

  const [activeFile, setActiveFile] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [vcOpen, setVcOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [forceRefresh, setForceRefresh] = useState<number>(0);

  // New UI state variables
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [gitStatus] = useState<GitStatus | null>(null);

  const {
    fileTree,
    setFileTree,
    initialFiles,
    filesRef,
    projectTitle,
    getFirstFile,
    isLoading,
    // fetchProjectForBranch, // Expose the fetch function
  } = useFileTree(projectId);

  // CRITICAL: Pass currentBranch to useYjs - only after loading completes
  const { presence, setEditor, setMonaco } = useYjs(
    isLoading ? "" : activeFile, // Don't initialize Yjs until files are loaded
    user,
    projectId,
    initialFiles,
    filesRef.current,
    currentBranch,
    forceRefresh,
  );

  // Responsive handling
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      // Auto-hide panels on very small screens
      if (width < 1024 && (chatOpen || vcOpen || showGitPanel)) {
        setChatOpen(false);
        setVcOpen(false);
        setShowGitPanel(false);
      }
      // Auto-collapse sidebar on small screens
      if (width < 640) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chatOpen, vcOpen, showGitPanel]);

  // Force editor to reload when activeFile, filesRef, OR currentBranch changes
  const [editorKey, setEditorKey] = useState(0);
  const [editorMounting, setEditorMounting] = useState(false);

  // ---- Build structure from current editor state ----
  const buildStructure = useCallback((): StructureNode | null => {
    try {
      const root = reconstructTree(fileTree, "", filesRef.current)[0];
      return root as StructureNode;
    } catch (err) {
      console.error("buildStructure error", err);
      showToast("Failed to build project structure.", "error");
      return null;
    }
  }, [fileTree, filesRef, showToast]);

  // ---- Apply structure to editor (complete replacement) ----
  const applyStructureToEditor = useCallback(
    (structure: StructureNode | null) => {
      // Handle null structure (branch switch signal - clear editor)
      if (!structure) {
        console.log("🔄 Clearing editor for branch switch");
        setActiveFile(""); // This triggers Yjs cleanup
        setEditorMounting(true);
        return;
      }

      console.log("🔄 Applying structure to editor:", structure);

      // Step 1: Clear active file to trigger Yjs cleanup
      setActiveFile("");

      // Step 2: Wait for cleanup to complete
      setTimeout(() => {
        // Full hard reset
        setFileTree([]);
        filesRef.current = {};
        setExpandedFolders(new Set());

        const newFilesRef: Record<string, string> = {};
        const newExpanded = new Set<string>();

        const traverse = (node: StructureNode, path: string) => {
          const fullPath = path ? `${path}/${node.name}` : node.name;
          if (node.type === "file") {
            newFilesRef[fullPath] = node.content ?? "";
          } else if (node.type === "folder" && node.children) {
            newExpanded.add(fullPath);
            node.children.forEach((child) => traverse(child, fullPath));
          }
        };

        if (structure.type === "folder" && Array.isArray(structure.children)) {
          traverse(structure, "");
        }

        // Apply all changes
        filesRef.current = newFilesRef;
        setFileTree([structure]);
        setExpandedFolders(newExpanded);

        console.log(
          `✅ Applied structure: ${Object.keys(newFilesRef).length} files`,
        );

        // Step 3: Set new active file after a delay and trigger force refresh
        setTimeout(() => {
          const firstFile = Object.keys(newFilesRef)[0];
          if (firstFile) {
            setActiveFile(firstFile);
            // Trigger force refresh to ensure Yjs uses the new content
            setForceRefresh(Date.now());
            // Safer editor reload
            setEditorMounting(true);
            setTimeout(() => {
              setEditorKey((prev) => prev + 1);
              setEditorMounting(false);
            }, 50);
            console.log(
              `📄 Active file set to: ${firstFile} with force refresh`,
            );
          }
          showToast("Project structure updated.", "success");
        }, 100);
      }, 100);
    },
    [setFileTree, filesRef, showToast, setForceRefresh],
  );

  // ---- Load current branch on mount ----
  useEffect(() => {
    if (isLoading) return; // Wait for initial load to complete

    const loadCurrentBranch = async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch`,
        );
        if (res.ok) {
          const data = await res.json();
          const branch = data.activeBranch || "main";
          console.log(`🔀 Setting current branch to: ${branch}`);
          setCurrentBranch(branch);
        }
      } catch (err) {
        console.error("Failed to load current branch:", err);
      }
    };
    loadCurrentBranch();
  }, [projectId, isLoading]);

  // ---- Check for vc_load flag ----
  useEffect(() => {
    const checkVcLoad = () => {
      try {
        const item = localStorage.getItem(`vc_load:${projectId}`);
        if (item) {
          const parsed = JSON.parse(item);
          const structure = parsed.structure as StructureNode | undefined;
          const branch = parsed.branch as string | undefined;

          if (structure) {
            if (branch && branch !== currentBranch) {
              setCurrentBranch(branch);
            }
            // Small delay to ensure branch state is updated
            setTimeout(() => {
              applyStructureToEditor(structure);
              showToast(
                parsed.message || "Loaded changes from version control.",
                "success",
              );
            }, 100);
          }

          localStorage.removeItem(`vc_load:${projectId}`);
        }
      } catch (err) {
        console.error("Error checking vc_load:", err);
      }
    };

    checkVcLoad();
    const interval = setInterval(checkVcLoad, 500);
    return () => clearInterval(interval);
  }, [projectId, currentBranch, applyStructureToEditor, showToast]);

  // ---- Socket handlers ----
  useEffect(() => {
    if (!socket) return;

    const handleNodeAdded = (payload: NodeAddedPayload) => {
      setFileTree((prev) => addNode(prev, payload));
      if (payload.type === "file") {
        const filePath = `${payload.parentPath}/${payload.name}`;
        filesRef.current[filePath] = "";
        if (!activeFile) setActiveFile(filePath);
      }
      setExpandedFolders((p) => {
        const n = new Set(p);
        n.add(payload.parentPath);
        return n;
      });
    };

    const handleNodeDeleted = (payload: NodeDeletedPayload) => {
      if (payload.path === "root") {
        showToast("Root cannot be deleted.", "error");
        return;
      }
      setFileTree((prev) => deleteNode(prev, payload));
      delete filesRef.current[payload.path];
      if (activeFile === payload.path) {
        const remainingFiles = Object.keys(filesRef.current);
        setActiveFile(remainingFiles.length > 0 ? remainingFiles[0] : "");
      }
    };

    socket.on("node-added", handleNodeAdded);
    socket.on("node-deleted", handleNodeDeleted);

    return () => {
      socket.off("node-added", handleNodeAdded);
      socket.off("node-deleted", handleNodeDeleted);
    };
  }, [socket, setFileTree, filesRef, activeFile, showToast]);

  // ---- Save project ----
  const handleSaveProject = useCallback(async () => {
    if (!projectId) return;
    const structure = buildStructure();
    if (!structure) return;

    try {
      if (currentBranch === "main") {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ structure }),
        });
        if (res.ok) {
          showToast("Project saved to main.", "success");
          localStorage.removeItem(`vc_autosave:${projectId}:main`);
        } else {
          showToast("Save to main failed.", "error");
        }
      } else {
        const res = await fetch(
          `/api/projects/${projectId}/version-control/branch/update`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branchName: currentBranch, structure }),
          },
        );
        if (res.ok) {
          showToast(
            `Working copy saved to branch "${currentBranch}".`,
            "success",
          );
          localStorage.removeItem(`vc_autosave:${projectId}:${currentBranch}`);
        } else {
          const data = await res.json();
          showToast(data.error || "Branch working copy save failed.", "error");
        }
      }
    } catch (err) {
      console.error("handleSaveProject error", err);
      showToast("An unexpected error occurred during save.", "error");
    }
  }, [projectId, currentBranch, buildStructure, showToast]);

  // ---- Autosave to localStorage every 10s ----
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      try {
        const structure = buildStructure();
        if (!structure) return;
        localStorage.setItem(
          `vc_autosave:${projectId}:${currentBranch}`,
          JSON.stringify({ structure, updatedAt: Date.now() }),
        );
      } catch (err) {
        console.error("Autosave error:", err);
      }
    }, 10000);
    return () => {
      clearInterval(interval);
      mounted = false;
    };
  }, [projectId, currentBranch, buildStructure]);

  // ---- Warn on unload ----
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        const prefix = `vc_autosave:${projectId}:`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            e.preventDefault();
            e.returnValue = "";
            return "";
          }
        }
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [projectId]);

  // ---- Editor mount ----
  const handleMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      console.log("🎯 Monaco Editor mounted");
      setEditor(editor);
      setMonaco(monaco);

      // Add error handler to prevent crashes
      if (editor) {
        editor.onDidDispose(() => {
          console.log("📤 Monaco Editor disposed");
          setEditor(null);
          setMonaco(null);
        });
      }
    },
    [setEditor, setMonaco],
  ); // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      console.log("🛑 Editor page unmounting");
      // Cleanup will be handled by useYjs
    };
  }, []);

  // ---- Set initial active file ----
  useEffect(() => {
    if (isLoading || fileTree.length === 0 || activeFile) return;

    const firstFile = getFirstFile();
    if (firstFile) {
      console.log(`📄 Setting initial active file: ${firstFile}`);
      setActiveFile(firstFile);
      if (fileTree[0] && fileTree[0].name) {
        setExpandedFolders(new Set([fileTree[0].name]));
      }
    }
  }, [fileTree, activeFile, getFirstFile, isLoading]);

  // ---- Node operations ----
  const handleAddNode = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      const name = prompt(`Enter ${type} name`);
      if (!name) {
        showToast("Operation cancelled.", "error");
        return;
      }

      setFileTree((p) => addNode(p, { type, parentPath, name }));
      const newPath = `${parentPath}/${name}`;

      if (type === "file") {
        filesRef.current[newPath] = "";
        if (!activeFile) setActiveFile(newPath);
      }

      setExpandedFolders((p) => {
        const n = new Set(p);
        n.add(parentPath);
        return n;
      });

      emitNodeAdded({ type, parentPath, name });
      showToast(
        `${type === "file" ? "File" : "Folder"} "${name}" added.`,
        "success",
      );
    },
    [setFileTree, filesRef, activeFile, emitNodeAdded, showToast],
  );

  const handleDeleteNode = useCallback(
    (path: string) => {
      if (path === "root") {
        showToast("Root cannot be deleted.", "error");
        return;
      }
      if (!confirm(`Delete ${path}? This action cannot be undone.`)) return;

      setFileTree((p) => deleteNode(p, { path }));
      emitNodeDeleted({ path });
      delete filesRef.current[path];

      if (activeFile === path) {
        const remainingFiles = Object.keys(filesRef.current);
        setActiveFile(remainingFiles.length > 0 ? remainingFiles[0] : "");
      }
      showToast(`Deleted ${path}.`, "success");
    },
    [setFileTree, emitNodeDeleted, filesRef, activeFile, showToast],
  );

  const handleSendChatMessage = useCallback(
    (message: ChatMessage) => {
      fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }).catch((err) => {
        console.error(err);
        showToast("Failed to send chat message.", "error");
      });
      emitChatMessage(message);
    },
    [projectId, emitChatMessage, showToast],
  );

  const handleRestoreCommit = useCallback(
    async (commitHash: string) => {
      if (
        !user?.email ||
        !confirm(
          "Are you sure you want to restore this commit? This will overwrite your current changes.",
        )
      ) {
        return;
      }

      try {
        showToast("Restoring commit...", "success");

        const response = await fetch(
          `/api/projects/${projectId}/version-control/restore`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail: user.email,
              commitHash,
              branch: currentBranch,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();

          // Apply the restored structure to the editor
          if (data.structure) {
            applyStructureToEditor(data.structure);
          }

          showToast(
            `Successfully restored commit ${commitHash.substring(0, 7)}`,
            "success",
          );
        } else {
          const error = await response.json();
          showToast(error.error || "Failed to restore commit", "error");
        }
      } catch (error) {
        console.error("Restore commit error:", error);
        showToast("Failed to restore commit", "error");
      }
    },
    [projectId, user?.email, currentBranch, showToast, applyStructureToEditor],
  );

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 overflow-hidden">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-xl text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Sidebar - File Tree */}
      <aside
        className={`${
          sidebarCollapsed ? "w-12" : "w-64"
        } bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${
          isMobile && (chatOpen || vcOpen || showGitPanel) ? "hidden" : ""
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
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              onClick={handleSaveProject}
            >
              Save Project
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 relative">
          {isLoading || editorMounting ? (
            <div className="flex items-center justify-center h-full bg-gray-900">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-400">
                  {isLoading ? "Loading project..." : "Switching branch..."}
                </p>
              </div>
            </div>
          ) : (
            <Editor
              key={editorKey}
              height="100%"
              theme="vs-dark"
              defaultLanguage="javascript"
              path={activeFile}
              value={filesRef.current[activeFile] || ""}
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
          )}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div
        className={`fixed z-30 transition-all duration-300 ${
          chatOpen || vcOpen || showGitPanel
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
            setChatOpen(!chatOpen);
            setVcOpen(false);
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
              setShowGitPanel(!showGitPanel);
              setChatOpen(false);
              setVcOpen(false);
            }}
            title="Git History"
          >
            <VscHistory className="w-5 h-5" />
          </button>
        )}

        {/* Version Control Button */}
        <button
          className={`w-12 h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95 flex items-center justify-center group ${
            vcOpen ? "ring-2 ring-purple-400" : ""
          }`}
          onClick={() => {
            setVcOpen(!vcOpen);
            setChatOpen(false);
            setShowGitPanel(false);
          }}
          title="Version Control"
        >
          <VscGitMerge className="w-5 h-5" />
        </button>
      </div>

      {/* Right Sidebar Panel */}
      {(chatOpen || vcOpen || showGitPanel) && (
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

          {vcOpen && (
            <div className="h-full flex flex-col">
              {/* Version Control Panel Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-700 min-h-[60px] flex-shrink-0">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <VscGitMerge className="w-5 h-5" />
                  Version Control
                </h3>
                <button
                  onClick={() => setVcOpen(false)}
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

              {/* Version Control Panel Content */}
              <div className="flex-1 overflow-y-auto">
                {user && (
                  <VersionControlPanel
                    projectId={projectId}
                    user={user}
                    onClose={() => setVcOpen(false)}
                    showToast={showToast}
                    applyStructureToEditor={applyStructureToEditor}
                    buildStructure={buildStructure}
                    currentBranch={currentBranch}
                    setCurrentBranch={setCurrentBranch}
                  />
                )}
              </div>
            </div>
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
                            <button
                              onClick={() => handleRestoreCommit(commit.hash)}
                              className="mt-2 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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
