import React from "react";
import {
  VscChevronDown,
  VscChevronRight,
  VscFile,
  VscFolder,
  VscFolderOpened,
  VscNewFile,
  VscNewFolder,
  VscTrash,
} from "react-icons/vsc";
import type { FileNode } from "../types";

interface FileTreeProps {
  fileTree: FileNode[];
  setFileTree: React.Dispatch<React.SetStateAction<FileNode[]>>;
  activeFile: string;
  setActiveFile: (file: string) => void;
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  onAddNode: (type: "file" | "folder", parentPath: string) => void;
  onDeleteNode: (path: string) => void;
}

export function FileTree({
  fileTree,
  activeFile,
  setActiveFile,
  expandedFolders,
  setExpandedFolders,
  onAddNode,
  onDeleteNode,
}: FileTreeProps) {
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
                if (n.has(path)) {
                  n.delete(path);
                } else {
                  n.add(path);
                }
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
                    onAddNode("file", path);
                  }}
                >
                  <VscNewFile />
                </button>
                <button
                  className="text-gray-400 hover:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNode("folder", path);
                  }}
                >
                  <VscNewFolder />
                </button>
                {path !== "root" && (
                  <button
                    className="text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(path);
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
          className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded text-sm select-none ${
            activeFile === path
              ? "bg-gray-700 text-white"
              : "hover:bg-gray-700 text-gray-300"
          }`}
          onClick={() => setActiveFile(path)}
        >
          <VscFile />
          <span className="truncate">{node.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(path);
            }}
            className="ml-auto text-gray-400 hover:text-red-500"
          >
            <VscTrash />
          </button>
        </div>
      );
    });
  }

  return <div>{renderTree(fileTree)}</div>;
}
