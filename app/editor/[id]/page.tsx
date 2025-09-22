"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/app/components/ui/button";

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

  const [activeFile, setActiveFile] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [chatOpen, setChatOpen] = useState(false);

  const { presence, setEditor, setMonaco } = useYjs(
    activeFile,
    user,
    projectId,
    initialFiles,
    filesRef.current,
  );

  /* ----------------- File-tree & sockets ------------------ */
  useEffect(() => {
    if (fileTree.length > 0 && !activeFile) {
      const first = getFirstFile();
      if (first) {
        setActiveFile(first);
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

  /* ----------------- Actions ------------------ */
  const handleSaveProject = useCallback(() => {
    const structure = reconstructTree(fileTree, "", filesRef.current)[0];
    fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structure }),
    })
      .then((r) => (r.ok ? alert("Project saved") : alert("Save failed")))
      .catch(() => alert("Save failed"));
  }, [projectId, fileTree, filesRef]);

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

  /* ----------------- Layout ------------------ */
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`w-64 bg-muted/40 border-r border-border p-4 overflow-y-auto ${
          chatOpen ? "hidden md:block" : ""
        }`}
      >
        <h2 className="text-lg font-semibold mb-4">{projectTitle}</h2>
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
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleAddNode("folder", "root")}
          >
            + Folder
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleAddNode("file", "root")}
          >
            + File
          </Button>
        </div>

        <Button
          variant="secondary"
          className="mt-4 w-full flex items-center gap-2"
          onClick={() => setChatOpen((s) => !s)}
        >
          <VscComment /> Chat
        </Button>

        <PresenceList presence={presence} />
      </aside>

      {/* Editor */}
      <main
        className={`flex-1 flex flex-col ${chatOpen ? "md:w-2/3" : "w-full"}`}
      >
        <header className="flex justify-between items-center border-b border-border px-4 py-2 bg-muted/30">
          <div>
            Editing: <strong>{activeFile || "No file selected"}</strong>
          </div>
          <Button onClick={handleSaveProject}>Save Project</Button>
        </header>
        <div className="flex-1">
          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            onMount={handleMount}
            options={{ minimap: { enabled: false }, automaticLayout: true }}
          />
        </div>
      </main>

      {/* Chat Drawer */}
      {chatOpen && (
        <ChatPanel
          chatMessages={chatMessages}
          user={user}
          onSendMessage={handleSendChatMessage}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
