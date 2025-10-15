import {
  addNode,
  deleteNode,
  reconstructTree,
  findFirstFile,
} from "@/app/editor/[id]/utils/fileTreeHelpers";
import type { FileNode } from "@/app/editor/[id]/types";
import { describe, it, expect } from "@jest/globals";

type FileNodeWithContent = FileNode & { content?: string };

describe("fileTreeHelpers", () => {
  describe("addNode", () => {
    it("should add file to root level", () => {
      const tree: FileNode[] = [];
      const payload = {
        type: "file" as const,
        parentPath: "",
        name: "newfile.txt",
      };

      const result = addNode(tree, payload);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("newfile.txt");
      expect(result[0].type).toBe("file");
    });

    it("should add folder to root level", () => {
      const tree: FileNode[] = [];
      const payload = {
        type: "folder" as const,
        parentPath: "",
        name: "newfolder",
      };

      const result = addNode(tree, payload);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("newfolder");
      expect(result[0].type).toBe("folder");
      expect(result[0].children).toEqual([]);
    });

    it("should add file to existing folder", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [],
        },
      ];
      const payload = {
        type: "file" as const,
        parentPath: "src",
        name: "index.js",
      };

      const result = addNode(tree, payload);

      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe("index.js");
      expect(result[0].children![0].type).toBe("file");
    });

    it("should add nested folder", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [],
        },
      ];
      const payload = {
        type: "folder" as const,
        parentPath: "src",
        name: "components",
      };

      const result = addNode(tree, payload);

      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe("components");
      expect(result[0].children![0].type).toBe("folder");
      expect(result[0].children![0].children).toEqual([]);
    });

    it("should handle deep nesting", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            {
              name: "components",
              type: "folder" as const,
              children: [],
            },
          ],
        },
      ];
      const payload = {
        type: "file" as const,
        parentPath: "src/components",
        name: "Button.tsx",
      };

      const result = addNode(tree, payload);

      expect(result[0].children![0].children).toHaveLength(1);
      expect(result[0].children![0].children![0].name).toBe("Button.tsx");
    });
  });

  describe("deleteNode", () => {
    it("should delete file from root level", () => {
      const tree: FileNode[] = [
        { name: "file1.txt", type: "file" as const },
        { name: "file2.txt", type: "file" as const },
      ];
      const payload = { path: "file1.txt" };

      const result = deleteNode(tree, payload);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("file2.txt");
    });

    it("should delete folder from root level", () => {
      const tree: FileNode[] = [
        { name: "folder1", type: "folder" as const, children: [] },
        { name: "file1.txt", type: "file" as const },
      ];
      const payload = { path: "folder1" };

      const result = deleteNode(tree, payload);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("file1.txt");
    });

    it("should delete nested file", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            { name: "file1.txt", type: "file" as const },
            { name: "file2.txt", type: "file" as const },
          ],
        },
      ];
      const payload = { path: "src/file1.txt" };

      const result = deleteNode(tree, payload);

      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe("file2.txt");
    });

    it("should delete nested folder", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            { name: "components", type: "folder" as const, children: [] },
            { name: "utils", type: "folder" as const, children: [] },
          ],
        },
      ];
      const payload = { path: "src/components" };

      const result = deleteNode(tree, payload);

      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe("utils");
    });

    it("should handle non-existent path", () => {
      const tree: FileNode[] = [{ name: "file1.txt", type: "file" as const }];
      const payload = { path: "nonexistent.txt" };

      const result = deleteNode(tree, payload);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("file1.txt");
    });
  });

  describe("findFirstFile", () => {
    it("should find first file in flat structure", () => {
      const tree: FileNode[] = [
        { name: "file1.txt", type: "file" as const },
        { name: "file2.txt", type: "file" as const },
      ];

      const result = findFirstFile(tree);
      expect(result).toBe("file1.txt");
    });

    it("should find first file in nested structure", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            { name: "file1.txt", type: "file" as const },
            { name: "file2.txt", type: "file" as const },
          ],
        },
      ];

      const result = findFirstFile(tree);
      expect(result).toBe("src/file1.txt");
    });

    it("should find first file in deeply nested structure", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            {
              name: "components",
              type: "folder" as const,
              children: [
                { name: "Button.tsx", type: "file" as const },
                { name: "Input.tsx", type: "file" as const },
              ],
            },
          ],
        },
      ];

      const result = findFirstFile(tree);
      expect(result).toBe("src/components/Button.tsx");
    });

    it("should return empty string if no files found", () => {
      const tree: FileNode[] = [
        {
          name: "src",
          type: "folder" as const,
          children: [
            {
              name: "components",
              type: "folder" as const,
              children: [],
            },
          ],
        },
      ];

      const result = findFirstFile(tree);
      expect(result).toBe("");
    });

    it("should return empty string for empty tree", () => {
      const tree: FileNode[] = [];

      const result = findFirstFile(tree);
      expect(result).toBe("");
    });
  });

  describe("reconstructTree", () => {
    it("should reconstruct tree from flat files object", () => {
      const files = {
        "file1.txt": "content1",
        "src/file2.txt": "content2",
        "src/components/Button.tsx": "content3",
      };
      // First create a basic tree structure
      const nodes: FileNode[] = [
        { name: "file1.txt", type: "file" },
        {
          name: "src",
          type: "folder",
          children: [
            { name: "file2.txt", type: "file" },
            {
              name: "components",
              type: "folder",
              children: [{ name: "Button.tsx", type: "file" }],
            },
          ],
        },
      ];

      const result = reconstructTree(nodes, "", files);
      expect((result[0] as FileNodeWithContent).content).toBe("content1");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("file1.txt");
      expect(result[0].type).toBe("file");
      expect((result[0] as FileNodeWithContent).content).toBe("content1");

      const src = result[1];
      expect(src.name).toBe("src");
      expect(src.type).toBe("folder");
      expect(src.children).toHaveLength(2);
    });

    it("should handle empty files object", () => {
      const nodes: FileNode[] = [{ name: "file1.txt", type: "file" }];
      const files = {};

      const result = reconstructTree(nodes, "", files);

      expect(result).toHaveLength(1);
      expect((result[0] as FileNodeWithContent).content).toBe("");
    });
  });
});
