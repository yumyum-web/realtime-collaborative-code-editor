"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useParams } from "next/navigation";
import { VscComment } from "react-icons/vsc";

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

  const {
    fileTree,
    setFileTree,
    initialFiles,
    filesRef,
    projectTitle,
    getFirstFile,
    isLoading,
  } = useFileTree(projectId, currentBranch);

  // CRITICAL: Pass currentBranch to useYjs - only after loading completes
  const { presence, setEditor, setMonaco } = useYjs(
    isLoading ? "" : activeFile, // Don't initialize Yjs until files are loaded
    user,
    projectId,
    initialFiles,
    filesRef.current,
    currentBranch,
  );

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
      if (!structure) {
        showToast("Invalid structure received.", "error");
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

        // Step 3: Set new active file after a delay
        setTimeout(() => {
          const firstFile = Object.keys(newFilesRef)[0];
          if (firstFile) {
            setActiveFile(firstFile);
            // Safer editor reload
            setEditorMounting(true);
            setTimeout(() => {
              setEditorKey((prev) => prev + 1);
              setEditorMounting(false);
            }, 50);
            console.log(`📄 Active file set to: ${firstFile}`);
          }
          showToast("Project structure updated.", "success");
        }, 100);
      }, 100);
    },
    [setFileTree, filesRef, showToast],
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

  // ---- Clear active file when branch changes to force reload ----
  useEffect(() => {
    console.log(`🔄 Branch changed to: ${currentBranch}, clearing active file`);
    setActiveFile(""); // This will force useYjs to reinitialize

    // Safer editor reload with proper cleanup timing
    setEditorMounting(true);
    setTimeout(() => {
      setEditorKey((prev) => prev + 1);
      setEditorMounting(false);
    }, 100);
  }, [currentBranch]);

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

  const openChat = () => {
    setChatOpen(true);
    setVcOpen(false);
  };

  const openVc = () => {
    setVcOpen(true);
    setChatOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
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

      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 overflow-y-auto text-sm border-r border-gray-700 flex-shrink-0">
        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
          {projectTitle}
        </h2>
        <div className="mb-2 text-xs text-gray-400">
          Branch:{" "}
          <span className="text-blue-400 font-semibold">{currentBranch}</span>
        </div>

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
          onClick={() => (chatOpen ? setChatOpen(false) : openChat())}
        >
          <VscComment /> Chat
        </button>

        <button
          className="mt-2 w-full flex items-center gap-2 px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded"
          onClick={() => (vcOpen ? setVcOpen(false) : openVc())}
        >
          🕒 Version Control
        </button>

        <PresenceList presence={presence} />
      </aside>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700 z-10">
          <div className="truncate">
            Editing: <strong>{activeFile || "No file selected"}</strong>
          </div>
          <button
            className="bg-blue-800 hover:bg-blue-600 px-4 py-1 rounded whitespace-nowrap ml-4 flex-shrink-0"
            onClick={handleSaveProject}
          >
            Save Project
          </button>
        </div>

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
                // Add these options to prevent DOM-related errors
                readOnly: false,
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="w-96 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          <ChatPanel
            chatMessages={chatMessages}
            user={user}
            onSendMessage={handleSendChatMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {/* Version Control Panel */}
      {vcOpen && (
        <div className="w-96 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          {user && (
            <VersionControlPanel
              projectId={projectId}
              user={user}
              onClose={() => setVcOpen(false)}
              showToast={showToast}
              applyStructureToEditor={applyStructureToEditor}
              currentBranch={currentBranch}
              setCurrentBranch={setCurrentBranch}
            />
          )}
        </div>
      )}
    </div>
  );
}
