import { useEffect, useRef, useState } from "react";
import type { FileNode } from "../types";
import { findFirstFile } from "../utils/fileTreeHelpers";

export function useFileTree(projectId: string, currentBranch?: string) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [initialFiles, setInitialFiles] = useState<Record<string, string>>({});
  const filesRef = useRef<Record<string, string>>({});
  const [projectTitle, setProjectTitle] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      setIsLoading(true);

      // Clear current state when branch changes
      setFileTree([]);
      setInitialFiles({});
      filesRef.current = {};

      try {
        // Use the currentBranch prop if provided, otherwise detect from API
        let activeBranch = currentBranch || "main";

        if (!currentBranch) {
          try {
            const branchRes = await fetch(
              `/api/projects/${projectId}/version-control/branch`,
            );
            if (branchRes.ok) {
              const branchData = await branchRes.json();
              activeBranch = branchData.activeBranch || "main";
              console.log(`📂 Active branch detected: ${activeBranch}`);
            }
          } catch (err) {
            console.warn(
              "Could not fetch active branch, defaulting to main:",
              err,
            );
          }
        }

        // Fetch project data with branch context
        console.log(`📡 Fetching project data for branch: ${activeBranch}`);
        const projectRes = await fetch(
          `/api/projects/${projectId}?branch=${activeBranch}`,
        );

        if (!projectRes.ok) {
          throw new Error("Failed to fetch project");
        }

        const data = await projectRes.json();
        console.log(`📦 Received project data:`, data);

        const root = data.structure ?? data;
        setProjectTitle(data.title ?? "Untitled");

        console.log(`� Loading structure for branch: ${activeBranch}`, root);

        const flat: Record<string, string> = {};
        function walk(node: FileNode & { content?: string }, path = "") {
          const cur = path ? `${path}/${node.name}` : node.name;
          if (node.type === "file") {
            flat[cur] = node.content ?? "";
          } else if (node.children) {
            node.children.forEach((c) => walk(c, cur));
          }
        }
        walk(root);

        setInitialFiles(flat);
        filesRef.current = flat;
        setFileTree([root]);

        console.log(
          `✅ Loaded ${Object.keys(flat).length} files for ${activeBranch}`,
        );
      } catch (err) {
        console.error("Failed to load project:", err);
        setProjectTitle("Error loading project");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const getFirstFile = () => findFirstFile(fileTree);

  return {
    fileTree,
    setFileTree,
    initialFiles,
    filesRef,
    projectTitle,
    getFirstFile,
    isLoading,
  };
}
