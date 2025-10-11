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
          <div key={path} className="pl-1">
            <div
              className="cursor-pointer flex items-center gap-2 px-2 py-1 hover:bg-gray-700 rounded-lg select-none"
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
              {isExpanded ? (
                <VscChevronDown className="text-amber-400" />
              ) : (
                <VscChevronRight className="text-amber-400" />
              )}
              {isExpanded ? (
                <VscFolderOpened className="text-amber-400" />
              ) : (
                <VscFolder className="text-amber-400" />
              )}
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
              <div className="pl-4 border-l border-gray-700 ml-1">
                {renderTree(node.children, path)}
              </div>
            )}
          </div>
        );
      }
      return (
        <div
          key={path}
          className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded-lg text-sm select-none ${
            activeFile === path
              ? "bg-gray-700 text-white"
              : "hover:bg-gray-700 text-gray-300"
          }`}
          onClick={() => setActiveFile(path)}
        >
          <VscFile className="text-blue-400" />
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

  return <div className="overflow-y-auto h-full">{renderTree(fileTree)}</div>;
}
