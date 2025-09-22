"use client";
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
  const renderTree = (nodes: FileNode[], base = "") =>
    nodes.map((node) => {
      const path = base ? `${base}/${node.name}` : node.name;
      if (node.type === "folder") {
        const isOpen = expandedFolders.has(path);
        return (
          <div key={path} className="pl-1">
            <div
              className="flex items-center gap-1 px-2 py-1 hover:bg-accent rounded cursor-pointer"
              onClick={() => {
                const s = new Set(expandedFolders);
                if (s.has(path)) {
                  s.delete(path);
                } else {
                  s.add(path);
                }
                setExpandedFolders(s);
              }}
            >
              {isOpen ? <VscChevronDown /> : <VscChevronRight />}
              {isOpen ? <VscFolderOpened /> : <VscFolder />}
              <span className="truncate">{node.name}</span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNode("file", path);
                  }}
                >
                  <VscNewFile />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNode("folder", path);
                  }}
                >
                  <VscNewFolder />
                </button>
                {path !== "root" && (
                  <button
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
            {isOpen && node.children && (
              <div className="ml-4 border-l border-border pl-2">
                {renderTree(node.children, path)}
              </div>
            )}
          </div>
        );
      }
      return (
        <div
          key={path}
          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer ${
            activeFile === path
              ? "bg-accent text-foreground"
              : "hover:bg-accent"
          }`}
          onClick={() => setActiveFile(path)}
        >
          <VscFile /> <span className="truncate">{node.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(path);
            }}
            className="ml-auto"
          >
            <VscTrash />
          </button>
        </div>
      );
    });

  return <div className="text-sm">{renderTree(fileTree)}</div>;
}
