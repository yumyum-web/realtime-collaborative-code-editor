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

import { useMonacoSetup } from "./utils/monacoSetup";
import { addNode, deleteNode, reconstructTree } from "./utils/fileTreeHelpers";

import { FileTree } from "./components/FileTree";
import { ChatPanel } from "./components/ChatPanel";
import { PresenceList } from "./components/PresenceList";

export default function EditorPage() {
  const { id: projectId } = useParams() as { id: string };

  useMonacoSetup();

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
    filesContent,
    setFilesContent,
    updateFileContent,
    projectTitle,
    getFirstFile,
  } = useFileTree(projectId);

  const [activeFile, setActiveFile] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const [chatOpen, setChatOpen] = useState(false);

  const { presence, setEditor, setMonaco } = useYjs(
    activeFile,
    user,
    projectId,
    filesContent,
    updateFileContent,
  );

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
      setFileTree((prev) =>
        addNode(prev, payload, (full) =>
          setFilesContent((p) => ({ ...p, [full]: "" })),
        ),
      );
      setExpandedFolders((p) => new Set(p).add(payload.parentPath));
    };

    const handleNodeDeleted = (payload: NodeDeletedPayload) => {
      if (payload.path === "root") return;
      setFileTree((prev) => deleteNode(prev, payload));
      setFilesContent((prev) => {
        const c = { ...prev };
        delete c[payload.path];
        return c;
      });
    };

    socket.on("node-added", handleNodeAdded);
    socket.on("node-deleted", handleNodeDeleted);

    return () => {
      socket.off("node-added", handleNodeAdded);
      socket.off("node-deleted", handleNodeDeleted);
    };
  }, [socket, setFileTree, setFilesContent]);

  const handleSaveProject = useCallback(() => {
    if (!projectId) return;
    const structure = reconstructTree(fileTree)[0];
    fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structure }),
    })
      .then((res) => {
        if (res.ok) alert("Project saved");
        else alert("Save failed");
      })
      .catch(() => alert("Save failed"));
  }, [projectId, fileTree]);

  const handleAddNode = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      const name = prompt(`Enter ${type} name`);
      if (!name) return;
      setFileTree((p) =>
        addNode(p, { type, parentPath, name }, (full) =>
          setFilesContent((s) => ({ ...s, [full]: "" })),
        ),
      );
      setExpandedFolders((p) => new Set(p).add(parentPath));
      emitNodeAdded({ type, parentPath, name });
    },
    [setFileTree, setFilesContent, emitNodeAdded],
  );

  const handleDeleteNode = useCallback(
    (path: string) => {
      if (path === "root") return alert("Root cannot be deleted.");
      if (!confirm(`Delete ${path}?`)) return;
      setFileTree((p) => deleteNode(p, { path }));
      emitNodeDeleted({ path });
      setFilesContent((prev) => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
    },
    [setFileTree, emitNodeDeleted, setFilesContent],
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
      if (!activeFile) return;
      const safe = activeFile.replace(/[\/\\]/g, "--").replace(/\./g, "-");
      const uri = monaco.Uri.parse(`inmemory:///${projectId}/${safe}`);
      let model = monaco.editor.getModel(uri);
      if (!model)
        model = monaco.editor.createModel(
          filesContent[activeFile] ?? "",
          "javascript",
          uri,
        );
      editor.setModel(model);
    },
    [activeFile, projectId, filesContent, setEditor, setMonaco],
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
    </div>
  );
}
