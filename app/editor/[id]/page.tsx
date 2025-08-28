"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import io, { Socket } from "socket.io-client";
import { useParams } from "next/navigation";
import {
  VscChevronDown,
  VscChevronRight,
  VscFile,
  VscFolder,
  VscFolderOpened,
  VscNewFile,
  VscNewFolder,
} from "react-icons/vsc";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string | null; // only for files
}

type NodeAddedPayload = {
  type: "file" | "folder";
  parentPath: string;
  name: string;
};

export default function EditorPage() {
  const { id: projectId } = useParams() as { id: string };
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const editorRef = useRef<
    import("monaco-editor").editor.IStandaloneCodeEditor | null
  >(null);

  const [projectTitle, setProjectTitle] = useState("Loading...");
  const [activeFile, setActiveFile] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [filesContent, setFilesContent] = useState<Record<string, string>>({});

  function addNodeToTree(
    tree: FileNode[],
    payload: NodeAddedPayload,
    onFileInit?: (fullPath: string) => void,
  ): FileNode[] {
    const { type, parentPath, name } = payload;

    // deep clone
    const newTree: FileNode[] = JSON.parse(JSON.stringify(tree));

    function walk(nodes: FileNode[], currentPath: string): boolean {
      for (const node of nodes) {
        const nodePath = currentPath
          ? `${currentPath}/${node.name}`
          : node.name;

        if (nodePath === parentPath) {
          if (!node.children) node.children = [];
          if (type === "file") {
            node.children.push({ name, type: "file", content: "" });
            const fullPath = `${nodePath}/${name}`;
            onFileInit?.(fullPath);
          } else {
            node.children.push({ name, type: "folder", children: [] });
          }
          return true;
        }

        if (node.children && walk(node.children, nodePath)) return true;
      }
      return false;
    }

    walk(newTree, "");
    return newTree;
  }

  //socket connection

  useEffect(() => {
    if (!projectId) return;
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.emit("join-doc", projectId);

    newSocket.on(
      "remote-changes",
      ({ file, content }: { file: string; content: string }) => {
        setFilesContent((prev) => ({ ...prev, [file]: content }));
      },
    );

    // NEW: receive node-added from peers
    newSocket.on("node-added", (payload: NodeAddedPayload) => {
      setFileTree((prevTree) =>
        addNodeToTree(prevTree, payload, (fullPath) =>
          setFilesContent((prev) => ({ ...prev, [fullPath]: "" })),
        ),
      );
      // expand the parent folder so the new node is visible
      setExpandedFolders((prev) => new Set(prev).add(payload.parentPath));
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [projectId]);

  // load initial structure

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        setProjectTitle(data.title);
        const rootNode: FileNode = data.structure;

        const flatFiles: Record<string, string> = {};
        function flatten(node: FileNode, path = "") {
          const currentPath = path ? `${path}/${node.name}` : node.name;
          if (node.type === "file") {
            flatFiles[currentPath] = node.content ?? "";
          } else if (node.children) {
            node.children.forEach((child) => flatten(child, currentPath));
          }
        }
        flatten(rootNode);

        setFilesContent(flatFiles);
        setFileTree([rootNode]);

        const firstFile = Object.keys(flatFiles)[0];
        if (firstFile) setActiveFile(firstFile);

        setExpandedFolders(new Set([rootNode.name]));
      });
  }, [projectId]);

  // editor change handler

  const onEditorChange = (value?: string) => {
    if (value == null) return;
    setFilesContent((prev) => ({ ...prev, [activeFile]: value }));
    socket?.emit("editor-changes", { file: activeFile, content: value });
  };

  // folder toggle

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  //  tree rendering

  const renderTree = (nodes: FileNode[], basePath = "") =>
    nodes.map((node) => {
      const path = basePath ? `${basePath}/${node.name}` : node.name;

      if (node.type === "folder") {
        const isExpanded = expandedFolders.has(path);
        return (
          <div key={path} className="pl-2">
            <div
              className="cursor-pointer flex items-center gap-2 px-2 py-1 hover:bg-gray-700 rounded select-none"
              onClick={() => toggleFolder(path)}
            >
              {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
              {isExpanded ? <VscFolderOpened /> : <VscFolder />}
              <span className="truncate">{node.name}</span>
              <AddNodeButtons parentPath={path} onAdd={handleAddNode} />
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
          className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded text-sm select-none
            ${activeFile === path ? "bg-gray-700 text-white" : "hover:bg-gray-700 text-gray-300"}`}
          onClick={() => setActiveFile(path)}
        >
          <VscFile />
          <span className="truncate">{node.name}</span>
        </div>
      );
    });

  // create node (local + broadcast)

  function handleAddNode(type: "file" | "folder", parentPath: string) {
    const name = prompt(`Enter ${type} name`);
    if (!name) return;

    // 1) apply locally
    setFileTree((prevTree) =>
      addNodeToTree(prevTree, { type, parentPath, name }, (fullPath) =>
        setFilesContent((prev) => ({ ...prev, [fullPath]: "" })),
      ),
    );
    setExpandedFolders((prev) => new Set(prev).add(parentPath));

    // 2) notify peers
    socket?.emit("node-added", { type, parentPath, name } as NodeAddedPayload);
  }

  // save

  const handleSave = async () => {
    if (!projectId) return alert("No project ID!");
    const updatedStructure = reconstructTree(fileTree)[0];
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structure: updatedStructure }),
    });
    if (res.ok) {
      alert("Project saved!");
    } else {
      alert("Failed to save project");
    }
  };

  function reconstructTree(nodes: FileNode[], basePath = ""): FileNode[] {
    return nodes.map((node) => {
      const path = basePath ? `${basePath}/${node.name}` : node.name;
      if (node.type === "folder") {
        return {
          name: node.name,
          type: "folder",
          children: node.children ? reconstructTree(node.children, path) : [],
        };
      } else {
        return {
          name: node.name,
          type: "file",
          content: filesContent[path] || "",
        };
      }
    });
  }

  // UI

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 overflow-y-auto text-sm border-r border-gray-700">
        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
          {projectTitle}
        </h2>
        <div>{renderTree(fileTree)}</div>
        <button
          onClick={() => handleAddNode("folder", "root")}
          className="mt-4 bg-blue-800 hover:bg-blue-600 w-full py-1 rounded"
        >
          + New Folder
        </button>
        <button
          onClick={() => handleAddNode("file", "root")}
          className="mt-2 bg-blue-800 hover:bg-blue-600 w-full py-1 rounded"
        >
          + New File
        </button>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div>
            Editing: <strong>{activeFile || "No file selected"}</strong>
          </div>
          <button
            onClick={handleSave}
            className="bg-blue-800 hover:bg-blue-600 px-4 py-1 rounded"
          >
            Save Project
          </button>
        </div>

        <Editor
          height="100%"
          theme="vs-dark"
          defaultLanguage="javascript"
          value={filesContent[activeFile] || ""}
          onMount={(editor) => (editorRef.current = editor)}
          onChange={onEditorChange}
          options={{ minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}

// Add file/folder buttons shown on folder rows
function AddNodeButtons({
  parentPath,
  onAdd,
}: {
  parentPath: string;
  onAdd: (type: "file" | "folder", parentPath: string) => void;
}) {
  return (
    <div className="ml-auto flex gap-1 opacity-70 hover:opacity-100">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd("file", parentPath);
        }}
        title="Add File"
        className="text-gray-400 hover:text-gray-200"
      >
        <VscNewFile />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd("folder", parentPath);
        }}
        title="Add Folder"
        className="text-gray-400 hover:text-gray-200"
      >
        <VscNewFolder />
      </button>
    </div>
  );
}
