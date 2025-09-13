import type { FileNode, NodeAddedPayload, NodeDeletedPayload } from "../types";

export function addNode(
  tree: FileNode[],
  payload: NodeAddedPayload,
  onFileInit?: (full: string) => void,
): FileNode[] {
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

export function deleteNode(
  tree: FileNode[],
  payload: NodeDeletedPayload,
): FileNode[] {
  const { path } = payload;
  const newTree = JSON.parse(JSON.stringify(tree)) as FileNode[];

  function walk(nodes: FileNode[], curPath: string): FileNode[] {
    return nodes.filter((node) => {
      const nodePath = curPath ? `${curPath}/${node.name}` : node.name;
      if (nodePath === path) return false;
      if (node.children) node.children = walk(node.children, nodePath);
      return true;
    });
  }

  return walk(newTree, "");
}

export function reconstructTree(
  nodes: FileNode[],
  base = "",
  filesContent: Record<string, string> = {},
): FileNode[] {
  return nodes.map((n) => {
    const path = base ? `${base}/${n.name}` : n.name;
    if (n.type === "folder") {
      return {
        name: n.name,
        type: "folder",
        children: n.children
          ? reconstructTree(n.children, path, filesContent)
          : [],
      };
    }
    return { name: n.name, type: "file", content: filesContent[path] || "" };
  });
}

export function findFirstFile(nodes: FileNode[], base = ""): string | null {
  for (const node of nodes) {
    const path = base ? `${base}/${node.name}` : node.name;
    if (node.type === "file") return path;
    if (node.children) {
      const found = findFirstFile(node.children, path);
      if (found) return found;
    }
  }
  return null;
}
