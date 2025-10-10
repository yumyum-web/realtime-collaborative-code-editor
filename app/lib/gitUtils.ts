import simpleGit, { SimpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";
import { FileEntity } from "@/app/models/project";

const REPOS_BASE_PATH = path.join(process.cwd(), "repos");

/**
 * Get or initialize Git repository for a project
 */
export async function getGitRepo(projectId: string): Promise<SimpleGit> {
  const repoPath = path.join(REPOS_BASE_PATH, projectId);

  // Ensure repos directory exists
  await fs.mkdir(REPOS_BASE_PATH, { recursive: true });

  // Check if repo exists
  const gitPath = path.join(repoPath, ".git");
  const repoExists = await fs
    .access(gitPath)
    .then(() => true)
    .catch(() => false);

  if (!repoExists) {
    // Initialize new Git repo
    await fs.mkdir(repoPath, { recursive: true });
    const git = simpleGit(repoPath);
    await git.init();
    await git.addConfig("user.name", "Collaborative Editor");
    await git.addConfig("user.email", "editor@example.com");

    // Create initial commit
    const readmePath = path.join(repoPath, "README.md");
    await fs.writeFile(
      readmePath,
      "# Project\n\nInitialized by Collaborative Editor",
    );
    await git.add(".");
    await git.commit("Initial commit");

    console.log(`✅ Initialized Git repo for project ${projectId}`);
  }

  return simpleGit(repoPath);
}

/**
 * Get the repository path for a project
 */
export function getRepoPath(projectId: string): string {
  return path.join(REPOS_BASE_PATH, projectId);
}

/**
 * Write files from structure to Git repository
 */
export async function writeFilesToRepo(
  projectId: string,
  structure: FileEntity,
): Promise<void> {
  const repoPath = getRepoPath(projectId);

  // Ensure root directory exists
  const rootPath = path.join(repoPath, "root");
  await fs.mkdir(rootPath, { recursive: true });

  async function writeNode(node: FileEntity, currentPath: string) {
    const nodePath = path.join(currentPath, node.name);

    if (node.type === "file") {
      // Write file content
      await fs.mkdir(path.dirname(nodePath), { recursive: true });
      await fs.writeFile(nodePath, node.content || "");
    } else if (node.type === "folder" && node.children) {
      // Create directory and process children
      await fs.mkdir(nodePath, { recursive: true });
      for (const child of node.children) {
        await writeNode(child, nodePath);
      }
    }
  }

  // Clear existing files (except .git)
  const entries = await fs.readdir(repoPath);
  for (const entry of entries) {
    if (entry !== ".git") {
      await fs.rm(path.join(repoPath, entry), { recursive: true, force: true });
    }
  }

  // Write new structure
  if (structure.type === "folder" && structure.children) {
    for (const child of structure.children) {
      await writeNode(child, repoPath);
    }
  }
}

/**
 * Read files from Git repository and convert to structure
 */
export async function readFilesFromRepo(
  projectId: string,
): Promise<FileEntity> {
  const repoPath = getRepoPath(projectId);

  async function readNode(
    nodePath: string,
    relativePath: string,
  ): Promise<FileEntity> {
    const stats = await fs.stat(nodePath);
    const name = path.basename(nodePath);

    if (stats.isDirectory()) {
      const entries = await fs.readdir(nodePath);
      const children: FileEntity[] = [];

      for (const entry of entries) {
        if (entry === ".git") continue; // Skip .git directory
        const childPath = path.join(nodePath, entry);
        const childRelativePath = path.join(relativePath, entry);
        children.push(await readNode(childPath, childRelativePath));
      }

      return {
        name,
        type: "folder",
        children,
      };
    } else {
      const content = await fs.readFile(nodePath, "utf-8");
      return {
        name,
        type: "file",
        content,
      };
    }
  }

  // Read from root or from repo base
  const rootPath = path.join(repoPath, "root");
  const useRootPath = await fs
    .access(rootPath)
    .then(() => true)
    .catch(() => false);

  if (useRootPath) {
    const entries = await fs.readdir(rootPath);
    const children: FileEntity[] = [];

    for (const entry of entries) {
      const childPath = path.join(rootPath, entry);
      children.push(await readNode(childPath, entry));
    }

    return {
      name: "root",
      type: "folder",
      children,
    };
  } else {
    return await readNode(repoPath, "");
  }
}

/**
 * Convert flat files object to structure
 */
export function filesToStructure(files: Record<string, string>): FileEntity {
  const root: FileEntity = {
    name: "root",
    type: "folder",
    children: [],
  };

  for (const [filePath, content] of Object.entries(files)) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        // It's a file
        current.children = current.children || [];
        current.children.push({
          name: part,
          type: "file",
          content,
        });
      } else {
        // It's a folder
        current.children = current.children || [];
        let folder = current.children.find(
          (c) => c.name === part && c.type === "folder",
        );

        if (!folder) {
          folder = {
            name: part,
            type: "folder",
            children: [],
          };
          current.children.push(folder);
        }

        current = folder;
      }
    }
  }

  return root;
}

/**
 * Convert structure to flat files object
 */
export function structureToFiles(
  structure: FileEntity,
  basePath = "",
): Record<string, string> {
  const files: Record<string, string> = {};

  function traverse(node: FileEntity, currentPath: string) {
    if (node.type === "file") {
      files[currentPath] = node.content || "";
    } else if (node.type === "folder" && node.children) {
      for (const child of node.children) {
        const childPath = currentPath
          ? `${currentPath}/${child.name}`
          : child.name;
        traverse(child, childPath);
      }
    }
  }

  if (structure.type === "folder" && structure.children) {
    for (const child of structure.children) {
      const childPath = basePath ? `${basePath}/${child.name}` : child.name;
      traverse(child, childPath);
    }
  }

  return files;
}
