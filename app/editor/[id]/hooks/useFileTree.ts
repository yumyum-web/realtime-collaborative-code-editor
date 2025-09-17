import { useEffect, useState } from "react";
import type { FileNode } from "../types";
import { findFirstFile } from "../utils/fileTreeHelpers";

export function useFileTree(projectId: string) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [filesContent, setFilesContent] = useState<Record<string, string>>({});
  const [projectTitle, setProjectTitle] = useState("Loading...");

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        const root = data.structure ?? data;
        setProjectTitle(data.title ?? "Untitled");

        const flat: Record<string, string> = {};
        function walk(node: FileNode & { content?: string }, path = "") {
          const cur = path ? `${path}/${node.name}` : node.name;
          if (node.type === "file") flat[cur] = node.content ?? "";
          else node.children?.forEach((c) => walk(c, cur));
        }
        walk(root);

        setFilesContent(flat);
        setFileTree([root]);
      })
      .catch(console.error);
  }, [projectId]);

  const getFirstFile = () => findFirstFile(fileTree);

  return {
    fileTree,
    setFileTree,
    filesContent,
    setFilesContent,
    projectTitle,
    getFirstFile,
  };
}
