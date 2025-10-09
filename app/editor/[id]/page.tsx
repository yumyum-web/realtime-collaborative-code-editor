"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
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

// --- Minimal Local Toast Implementation (To replace disruptive alerts) ---
type ToastMessage = { message: string; type: "success" | "error" };

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
// ------------------------------------------------------------------------

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
  // chatOpen and vcOpen are mutually exclusive: when opening one, close the other
  const [chatOpen, setChatOpen] = useState(false);
  const [vcOpen, setVcOpen] = useState(false);

  const { presence, setEditor, setMonaco } = useYjs(
    activeFile,
    user,
    projectId,
    initialFiles,
    filesRef.current,
  );

  // ---- Helpers to convert structure <-> filesRef/fileTree ----
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

  const applyStructureToEditor = useCallback(
    (structure: StructureNode | null) => {
      if (!structure) return;
      const newFilesRef: Record<string, string> = {};
      const traverse = (node: StructureNode, currentPath: string) => {
        const path = currentPath ? `${currentPath}/${node.name}` : node.name;
        if (node.type === "file") {
          newFilesRef[path] = node.content ?? "";
        } else if (node.type === "folder" && Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child, path);
          }
        }
      };

      if (structure.type === "folder") {
        const rootPath = structure.name || "";
        if (Array.isArray(structure.children)) {
          for (const child of structure.children) traverse(child, rootPath);
        }
        setFileTree([structure as StructureNode]);
      } else {
        traverse(structure, "");
        setFileTree([structure as StructureNode]);
      }

      filesRef.current = { ...filesRef.current, ...newFilesRef };

      if (!activeFile) {
        const first = Object.keys(newFilesRef)[0];
        if (first) setActiveFile(first);
      }
    },
    [filesRef, setFileTree, activeFile],
  );

  // ---- On mount: check for vc_load (branch switch) and apply structure if present ----
  useEffect(() => {
    try {
      const item = localStorage.getItem(`vc_load:${projectId}`);
      if (item) {
        const parsed = JSON.parse(item);
        const structure = parsed.structure as StructureNode | undefined;
        if (structure) {
          applyStructureToEditor(structure);
          showToast("Loaded changes from version control.", "success");
        }
        localStorage.removeItem(`vc_load:${projectId}`);
      }
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ---- Socket handlers (unchanged) ----
  useEffect(() => {
    if (!socket) return;

    const handleNodeAdded = (payload: NodeAddedPayload) => {
      setFileTree((prev) => addNode(prev, payload));
      if (payload.type === "file") {
        setActiveFile((f) => f || `${payload.parentPath}/${payload.name}`);
        filesRef.current[`${payload.parentPath}/${payload.name}`] = "";
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
      setActiveFile((f) => (f === payload.path ? "" : f));
    };

    socket.on("node-added", handleNodeAdded);
    socket.on("node-deleted", handleNodeDeleted);

    return () => {
      socket.off("node-added", handleNodeAdded);
      socket.off("node-deleted", handleNodeDeleted);
    };
  }, [socket, setFileTree, filesRef, showToast]);

  // ---- Save logic: if active branch is main => save Project; else update branch.lastStructure ----
  const handleSaveProject = useCallback(async () => {
    if (!projectId) return;

    const structure = buildStructure();
    if (!structure) return;

    try {
      const branchRes = await fetch(
        `/api/projects/${projectId}/version-control/branch`,
      );
      const branchInfo = await branchRes.json();
      const active = branchInfo.activeBranch || "main";

      if (active === "main") {
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
            body: JSON.stringify({ branchName: active, structure }),
          },
        );
        if (res.ok) {
          showToast(`Working copy saved to branch "${active}".`, "success");
          localStorage.removeItem(`vc_autosave:${projectId}:${active}`);
        } else {
          const data = await res.json();
          showToast(data.error || "Branch working copy save failed.", "error");
        }
      }
    } catch (err) {
      console.error("handleSaveProject error", err);
      showToast("An unexpected error occurred during save.", "error");
    }
  }, [projectId, buildStructure, showToast]);

  // ---- Autosave to localStorage every 10s (safety) ----
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      try {
        const branchRes = await fetch(
          `/api/projects/${projectId}/version-control/branch`,
        );
        const branchInfo = await branchRes.json();
        const active = branchInfo.activeBranch || "main";

        const structure = buildStructure();
        if (!structure) return;

        localStorage.setItem(
          `vc_autosave:${projectId}:${active}`,
          JSON.stringify({ structure, updatedAt: Date.now() }),
        );
      } catch {
        // ignore autosave errors
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      mounted = false;
    };
  }, [projectId, buildStructure]);

  // ---- Warn on unload if there is autosave (unsaved changes) ----
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
      } catch (err) {
        // ignore
      }
      return;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [projectId]);

  // ---- Editor mount ----
  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      setEditor(editor);
      setMonaco(monaco);
    },
    [setEditor, setMonaco],
  );

  // ---- UI rendering ----
  useEffect(() => {
    if (fileTree.length > 0 && !activeFile) {
      const firstFile = getFirstFile();
      if (firstFile) {
        setActiveFile(firstFile);
        setExpandedFolders(new Set([fileTree[0].name]));
      }
    }
  }, [fileTree, activeFile, getFirstFile]);

  const handleAddNode = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      const name = prompt(`Enter ${type} name`);
      if (!name) {
        showToast("Operation cancelled.", "error");
        return;
      }
      setFileTree((p) => addNode(p, { type, parentPath, name }));
      if (type === "file") {
        setActiveFile((f) => f || `${parentPath}/${name}`);
        filesRef.current[`${parentPath}/${name}`] = "";
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
    [setFileTree, filesRef, emitNodeAdded, showToast],
  );

  const handleDeleteNode = useCallback(
    (path: string) => {
      if (path === "root") {
        showToast("Root cannot be deleted.", "error");
        return;
      }
      if (!confirm(`Delete ${path}? This action cannot be undone.`)) {
        showToast("Delete cancelled.", "error");
        return;
      }
      setFileTree((p) => deleteNode(p, { path }));
      emitNodeDeleted({ path });
      delete filesRef.current[path];
      showToast(`Deleted ${path}.`, "success");
    },
    [setFileTree, emitNodeDeleted, filesRef, showToast],
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

  // ensure only one right panel is open at a time
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
      {/* --- TOAST NOTIFICATION AREA --- */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-xl text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
      {/* --------------------------------- */}

      {/* Sidebar */}
      <aside
        className={`w-64 bg-gray-800 p-4 overflow-y-auto text-sm border-r border-gray-700`}
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
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div>
            Editing: <strong>{activeFile || "No file selected"}</strong>
          </div>
          <div className="flex gap-2">
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

      {/* Right-side sliding area (chat OR version control) */}
      {/* Shared placement: fixed right side, responsive width */}
      {chatOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-gray-800 z-40 border-l border-gray-700 overflow-y-auto">
          <ChatPanel
            chatMessages={chatMessages}
            user={user}
            onSendMessage={handleSendChatMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {vcOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-gray-800 z-40 border-l border-gray-700 overflow-y-auto">
          {user && (
            <VersionControlPanel
              projectId={projectId}
              user={user}
              onClose={() => setVcOpen(false)}
              showToast={showToast}
              applyStructureToEditor={applyStructureToEditor}
            />
          )}
        </div>
      )}
    </div>
  );
}
