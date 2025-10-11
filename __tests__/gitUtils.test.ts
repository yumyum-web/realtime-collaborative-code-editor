import {
  getRepoPath,
  filesToStructure,
  structureToFiles,
} from "@/app/lib/gitUtils";
import path from "path";

// Mock fs and simple-git
jest.mock("fs/promises");
jest.mock("simple-git", () => {
  return jest.fn(() => ({
    init: jest.fn(),
    addConfig: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    branchLocal: jest.fn(),
    revparse: jest.fn(),
    checkout: jest.fn(),
    branch: jest.fn(),
  }));
});

describe("gitUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRepoPath", () => {
    it("should return the correct repo path", () => {
      const projectId = "test-project";
      const expectedPath = path.join(process.cwd(), "repos", projectId);
      expect(getRepoPath(projectId)).toBe(expectedPath);
    });
  });

  describe("filesToStructure", () => {
    it("should convert flat files to structure", () => {
      const files = {
        "file1.txt": "content1",
        "folder/file2.txt": "content2",
      };

      const structure = filesToStructure(files);

      expect(structure.name).toBe("root");
      expect(structure.type).toBe("folder");
      expect(structure.children).toHaveLength(2);

      const file1 = structure.children!.find((c) => c.name === "file1.txt");
      expect(file1?.type).toBe("file");
      expect(file1?.content).toBe("content1");

      const folder = structure.children!.find((c) => c.name === "folder");
      expect(folder?.type).toBe("folder");
      expect(folder?.children).toHaveLength(1);
    });

    it("should handle empty files", () => {
      const files = {};
      const structure = filesToStructure(files);

      expect(structure.name).toBe("root");
      expect(structure.type).toBe("folder");
      expect(structure.children).toEqual([]);
    });
  });

  describe("structureToFiles", () => {
    it("should convert structure to flat files", () => {
      const structure = {
        name: "root",
        type: "folder" as const,
        children: [
          {
            name: "file1.txt",
            type: "file" as const,
            content: "content1",
          },
          {
            name: "folder",
            type: "folder" as const,
            children: [
              {
                name: "file2.txt",
                type: "file" as const,
                content: "content2",
              },
            ],
          },
        ],
      };

      const files = structureToFiles(structure);

      expect(files).toEqual({
        "file1.txt": "content1",
        "folder/file2.txt": "content2",
      });
    });

    it("should handle empty structure", () => {
      const structure = {
        name: "root",
        type: "folder" as const,
        children: [],
      };

      const files = structureToFiles(structure);
      expect(files).toEqual({});
    });
  });

  // Note: Async functions like getGitRepo, writeFilesToRepo, readFilesFromRepo
  // would require more complex mocking of fs and simple-git.
  // For unit tests, focus on synchronous functions and mock the async ones separately if needed.
});
