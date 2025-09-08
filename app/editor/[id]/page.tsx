"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";
import { useParams } from "next/navigation";
import { Resizable } from "re-resizable";
import {
  VscChevronDown,
  VscChevronRight,
  VscFile,
  VscFolder,
  VscFolderOpened,
  VscNewFile,
  VscNewFolder,
  VscTrash,
  VscComment,
} from "react-icons/vsc";

type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string | null;
};
type ChatMessage = {
  senderEmail: string;
  senderUsername: string;
  message: string;
  timestamp: number;
};
type NodeAddedPayload = {
  type: "file" | "folder";
  parentPath: string;
  name: string;
};
type NodeDeletedPayload = { path: string };

export default function EditorPage() {
  const { id: projectId } = useParams() as { id: string };

  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const monacoBindingRef = useRef<any | null>(null);

  const socketRef = useRef<typeof Socket | null>(null);

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [filesContent, setFilesContent] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [projectTitle, setProjectTitle] = useState("Loading...");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [presence, setPresence] = useState<
    {
      clientId: number;
      user?: { name?: string; email?: string; color?: string };
      cursor?: { line: number; column: number };
    }[]
  >([]);
  const [user, setUser] = useState<{ email: string; username?: string } | null>(
    null,
  );

  // ---------- Monaco worker ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    type MonacoEnv = {
      MonacoEnvironment?: {
        getWorker?: (moduleId: string, label: string) => Worker;
      };
    };
    (window as MonacoEnv).MonacoEnvironment =
      (window as MonacoEnv).MonacoEnvironment || {};
    ((window as MonacoEnv).MonacoEnvironment as any).getWorker = function (
      moduleId: string,
      label: string,
    ) {
      if (label === "json")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "css" || label === "scss" || label === "less")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/css/css.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "html" || label === "handlebars" || label === "razor")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/html/html.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "typescript" || label === "javascript")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/typescript/ts.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      return new Worker(
        new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url),
        { type: "module" },
      );
    };
  }, []);

  // ---------- load logged-in user ----------
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser({
          email: parsed.email,
          username: parsed.username || parsed.email,
        });
      } catch {
        setUser({ email: "anonymous@local" });
      }
    } else setUser({ email: "anonymous@local" });
  }, []);

  // ---------- socket.io (chat + tree only) ----------
  useEffect(() => {
    if (!projectId) return;
    const s = io("http://localhost:3001");
    socketRef.current = s;
    s.emit("join-doc", projectId);

    s.on("chat-history", (msgs: ChatMessage[]) => setChatMessages(msgs));
    s.on("chat-message", (m: ChatMessage) => setChatMessages((p) => [...p, m]));
    s.on("node-added", (payload: NodeAddedPayload) => {
      setFileTree((prev) =>
        addNode(prev, payload, (full) =>
          setFilesContent((p) => ({ ...p, [full]: "" })),
        ),
      );
      setExpandedFolders((p) => new Set(p).add(payload.parentPath));
    });
    s.on("node-deleted", (payload: NodeDeletedPayload) => {
      if (payload.path === "root") return;
      setFileTree((prev) => deleteNode(prev, payload.path));
      setFilesContent((prev) => {
        const c = { ...prev };
        delete c[payload.path];
        return c;
      });
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  // ---------- load project ----------
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        const root: FileNode = data.structure ?? data;
        setProjectTitle(data.title ?? "Untitled");
        const flat: Record<string, string> = {};
        function walk(node: FileNode, path = "") {
          const cur = path ? `${path}/${node.name}` : node.name;
          if (node.type === "file") flat[cur] = node.content ?? "";
          else node.children?.forEach((c) => walk(c, cur));
        }
        walk(root);
        setFilesContent(flat);
        setFileTree([root]);
        const firstFile = Object.keys(flat)[0];
        if (firstFile) setActiveFile(firstFile);
        setExpandedFolders(new Set([root.name]));
      })
      .catch(console.error);
  }, [projectId]);

  // ---------- utils ----------
  function colorFromString(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    const hex = ((h >>> 0) & 0xffffff).toString(16).padStart(6, "0");
    return `#${hex}`;
  }
  function hexToRgba(hex: string, alpha = 0.2) {
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ---------- remote cursors ----------
  const decorationsRef = useRef<string[]>([]);
  const updateRemoteCursorDecorations = useCallback(
    (
      states: {
        clientId: number;
        user?: { name?: string; email?: string; color?: string };
        cursor?: { line: number; column: number };
      }[],
    ) => {
      if (!editorRef.current || !monacoRef.current) return;
      const m = monacoRef.current;
      const editor = editorRef.current;
      const myClientId = providerRef.current?.awareness?.clientID;
      const decs: Monaco.editor.IModelDeltaDecoration[] = [];
      states.forEach((s) => {
        if (!s.cursor || s.clientId === myClientId) return;
        const line = s.cursor.line ?? 1;
        const col = s.cursor.column ?? 1;
        decs.push({
          range: new m.Range(line, col, line, col),
          options: {
            className: undefined,
            isWholeLine: false,
            stickiness:
              m.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: {
              value: `**${s.user?.name ?? s.user?.email ?? "user"}**`,
            },
            inlineClassName: `remoteCursor_${s.clientId}`,
          },
        });
      });
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        decs,
      );

      // CSS for remote cursors
      const styleId = "remote-cursors-styles";
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = states
        .map((s) => {
          if (!s.user) return "";
          const color =
            s.user.color ??
            colorFromString(s.user.email ?? s.user.name ?? "unknown");
          return `.monaco-editor .remoteCursor_${s.clientId} { background: ${hexToRgba(color, 0.12)}; border-left: 2px solid ${color}; }`;
        })
        .join("\n");
    },
    [],
  );

  // ---------- Yjs + Monaco binding ----------
  useEffect(() => {
    if (!activeFile || !user || !editorRef.current || !monacoRef.current)
      return;

    let cleanup: (() => void) | null = null;
    let destroyed = false;

    async function setupYjsForFile() {
      // destroy previous objects
      if (monacoBindingRef.current) {
        try {
          monacoBindingRef.current.destroy?.();
        } catch {}
        monacoBindingRef.current = null;
      }
      if (providerRef.current) {
        try {
          providerRef.current.destroy?.();
        } catch {}
        providerRef.current = null;
      }
      if (ydocRef.current) {
        try {
          ydocRef.current.destroy?.();
        } catch {}
        ydocRef.current = null;
      }

      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      const safeFile = activeFile.replace(/[\/\\]/g, "--").replace(/\./g, "-");
      const docName = `${projectId}-${safeFile}`;
      const provider = new WebsocketProvider(
        "ws://localhost:1234",
        docName,
        ydoc,
      );
      providerRef.current = provider;

      const m = monacoRef.current!;
      const uri = m.Uri.parse(`inmemory:///${projectId}/${safeFile}`);
      let model = m.editor.getModel(uri);
      if (!model)
        model = m.editor.createModel(
          filesContent[activeFile] ?? "",
          "javascript",
          uri,
        );
      modelRef.current = model;
      if (editorRef.current) {
        editorRef.current.setModel(model);
      }

      const ytext = ydoc.getText("monaco");
      const { MonacoBinding } = await import("y-monaco");
      const binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorRef.current!].filter(Boolean)),
        provider.awareness,
      );
      monacoBindingRef.current = binding;

      // Awareness setup
      const awareness = provider.awareness;
      function randomColor() {
        const colors = ["#ff6b6b", "#6bc1ff", "#51d88a", "#fbbf24", "#9b5de5"];
        return colors[Math.floor(Math.random() * colors.length)];
      }
      if (user) {
        awareness.setLocalStateField("user", {
          name: user.username ?? user.email ?? "unknown",
          email: user.email,
          color: randomColor(),
          cursor: null,
        });
      }

      const onAwarenessChange = () => {
        const states = Array.from(awareness.getStates().entries()).map(
          ([clientId, state]: any) => ({
            clientId: Number(clientId),
            user: state?.user,
            cursor: state?.cursor,
          }),
        );
        setPresence(states);
        updateRemoteCursorDecorations(states);
      };
      awareness.on("change", onAwarenessChange);

      const cursorListener = editorRef.current?.onDidChangeCursorPosition(
        (e) => {
          awareness.setLocalStateField("cursor", {
            line: e.position.lineNumber,
            column: e.position.column,
          });
        },
      );

      const modelListener = model.onDidChangeContent(() => {
        try {
          const text = model.getValue();
          setFilesContent((p) => ({ ...p, [activeFile]: text }));
        } catch {}
      });

      onAwarenessChange();

      cleanup = () => {
        if (destroyed) return;
        destroyed = true;
        try {
          modelListener.dispose();
        } catch {}
        try {
          cursorListener?.dispose();
        } catch {}
        try {
          awareness.off("change", onAwarenessChange);
        } catch {}
        try {
          binding.destroy?.();
        } catch {}
        try {
          provider.destroy?.();
        } catch {}
        try {
          ydoc.destroy?.();
        } catch {}
      };
    }

    setupYjsForFile();
    return () => {
      if (cleanup) cleanup();
    };
  }, [activeFile, user, projectId, updateRemoteCursorDecorations]);

  // ---------- file tree helpers ----------
  function addNode(
    tree: FileNode[],
    payload: NodeAddedPayload,
    onFileInit?: (full: string) => void,
  ) {
    const { type, parentPath, name } = payload;
    const newTree = JSON.parse(JSON.stringify(tree)) as FileNode[];
    function walk(nodes: FileNode[], curPath: string): boolean {
      for (const node of nodes) {
        const nodePath = curPath ? `${curPath}/${node.name}` : node.name;
        if (nodePath === parentPath) {
          if (!node.children) node.children = [];
          if (type === "file") {
            node.children.push({ name, type: "file", content: "" });
            onFileInit?.(`${nodePath}/${name}`);
          } else node.children.push({ name, type: "folder", children: [] });
          return true;
        }
        if (node.children && walk(node.children, nodePath)) return true;
      }
      return false;
    }
    walk(newTree, "");
    return newTree;
  }

  function deleteNode(tree: FileNode[], path: string) {
    const newTree = JSON.parse(JSON.stringify(tree)) as FileNode[];
    function walk(nodes: FileNode[], curPath: string) {
      return nodes.filter((node) => {
        const nodePath = curPath ? `${curPath}/${node.name}` : node.name;
        if (nodePath === path) return false;
        if (node.children) node.children = walk(node.children, nodePath);
        return true;
      });
    }
    return walk(newTree, "");
  }

  function handleSaveProject() {
    if (!projectId) return;
    const structure = reconstructTree(fileTree)[0];
    fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structure }),
    }).then((res) => {
      if (res.ok) alert("Project saved");
      else alert("Save failed");
    });
  }

  function reconstructTree(nodes: FileNode[], base = ""): FileNode[] {
    return nodes.map((n) => {
      const path = base ? `${base}/${n.name}` : n.name;
      if (n.type === "folder")
        return {
          name: n.name,
          type: "folder",
          children: n.children ? reconstructTree(n.children, path) : [],
        };
      return { name: n.name, type: "file", content: filesContent[path] || "" };
    });
  }

  function handleDelete(path: string) {
    if (path === "root") return alert("Root cannot be deleted.");
    if (!confirm(`Delete ${path}?`)) return;
    setFileTree((p) => deleteNode(p, path));
    socketRef.current?.emit("node-deleted", { path });
    setFilesContent((prev) => {
      const copy = { ...prev };
      delete copy[path];
      return copy;
    });
  }

  function promptAdd(type: "file" | "folder", parentPath: string) {
    const name = prompt(`Enter ${type} name`);
    if (!name) return;
    setFileTree((p) =>
      addNode(p, { type, parentPath, name }, (full) =>
        setFilesContent((s) => ({ ...s, [full]: "" })),
      ),
    );
    setExpandedFolders((p) => new Set(p).add(parentPath));
    socketRef.current?.emit("node-added", { type, parentPath, name });
  }

  // ---------- render file tree ----------
  function renderTree(nodes: FileNode[], base = "") {
    return nodes.map((node) => {
      const path = base ? `${base}/${node.name}` : node.name;
      if (node.type === "folder") {
        const isExpanded = expandedFolders.has(path);
        return (
          <div key={path} className="pl-2">
            <div
              className="cursor-pointer flex items-center gap-2 px-2 py-1 hover:bg-gray-700 rounded select-none"
              onClick={() => {
                const n = new Set(expandedFolders);
                n.has(path) ? n.delete(path) : n.add(path);
                setExpandedFolders(n);
              }}
            >
              {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
              {isExpanded ? <VscFolderOpened /> : <VscFolder />}
              <span className="truncate">{node.name}</span>
              <div className="ml-auto flex gap-1">
                <button
                  className="text-gray-400 hover:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    promptAdd("file", path);
                  }}
                >
                  <VscNewFile />
                </button>
                <button
                  className="text-gray-400 hover:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    promptAdd("folder", path);
                  }}
                >
                  <VscNewFolder />
                </button>
                {path !== "root" && (
                  <button
                    className="text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(path);
                    }}
                  >
                    <VscTrash />
                  </button>
                )}
              </div>
            </div>
            {isExpanded && node.children && (
              <div className="pl-6 border-l border-gray-700 ml-2">
                {renderTree(node.children, path)}
              </div>
            )}
          </div>
        );
      }
      return (
        <div
          key={path}
          className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded text-sm select-none ${activeFile === path ? "bg-gray-700 text-white" : "hover:bg-gray-700 text-gray-300"}`}
          onClick={() => setActiveFile(path)}
        >
          <VscFile />
          <span className="truncate">{node.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(path);
            }}
            className="ml-auto text-gray-400 hover:text-red-500"
          >
            <VscTrash />
          </button>
        </div>
      );
    });
  }

  // ---------- editor mount ----------
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
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
    modelRef.current = model;
    editor.setModel(model);
  };

  function sendChat() {
    if (!newMessage.trim() || !user) return;
    const payload: ChatMessage = {
      senderEmail: user.email,
      senderUsername: user.username ?? user.email,
      message: newMessage.trim(),
      timestamp: Date.now(),
    };
    fetch(`/api/projects/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(console.error);
    socketRef.current?.emit("chat-message", payload);
    setNewMessage("");
  }

  // ---------- JSX ----------
  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
      <aside
        className={`w-64 bg-gray-800 p-4 overflow-y-auto text-sm border-r border-gray-700 ${chatOpen ? "hidden md:block" : ""}`}
      >
        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
          {projectTitle}
        </h2>
        <div>{renderTree(fileTree)}</div>
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 bg-blue-800 hover:bg-blue-700 py-1 rounded"
            onClick={() => promptAdd("folder", "root")}
          >
            + Folder
          </button>
          <button
            className="flex-1 bg-blue-800 hover:bg-blue-700 py-1 rounded"
            onClick={() => promptAdd("file", "root")}
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
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">Active</h4>
          <div className="space-y-2">
            {presence.map((p) => (
              <div key={p.clientId} className="flex items-center gap-2">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: p.user?.color ?? "#888",
                    borderRadius: 3,
                  }}
                />
                <div>
                  <div className="font-medium text-sm">
                    {p.user?.name ?? p.user?.email ?? "unknown"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {p.cursor
                      ? `Line ${p.cursor.line}, Col ${p.cursor.column}`
                      : ""}
                  </div>
                </div>
              </div>
            ))}
            {presence.length === 0 && (
              <div className="text-xs text-gray-400">No collaborators yet</div>
            )}
          </div>
        </div>
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
        <Resizable
          defaultSize={{ width: 320 }}
          minWidth={220}
          maxWidth={600}
          enable={{ left: true }}
        >
          <aside className="h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Chat</h3>
              <button
                className="text-gray-400 hover:text-gray-200"
                onClick={() => setChatOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mb-2 space-y-3">
              {chatMessages.map((m, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        background: colorFromString(m.senderEmail),
                        borderRadius: 3,
                      }}
                    />
                    <div className="font-semibold text-xs text-blue-300">
                      {m.senderUsername ?? m.senderEmail}
                    </div>
                    <div className="text-xs text-gray-500 ml-auto">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="ml-4">{m.message}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 p-2 rounded bg-gray-700 text-white"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button onClick={sendChat} className="bg-blue-700 px-3 rounded">
                Send
              </button>
            </div>
          </aside>
        </Resizable>
      )}
    </div>
  );
}
