/**
 * Test to verify the improved writeFilesToRepo function
 * This test demonstrates that only changed files are written
 */

import { writeFilesToRepo } from "@/app/lib/gitUtils";
import { FileEntity } from "@repo/database";
import fs from "fs/promises";
import path from "path";
import { describe, beforeAll, afterAll, it, expect } from "@jest/globals";

describe("gitUtils - File Change Tracking", () => {
  const testProjectId = "test_project_tracking";
  const repoPath = path.join(process.cwd(), "repos", testProjectId);

  beforeAll(async () => {
    // Clean up any existing test repo
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up test repo
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should only write modified files, not replace entire structure", async () => {
    // Initial structure with 3 files
    const initialStructure: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "file1.txt",
          type: "file",
          content: "Initial content of file 1",
        },
        {
          name: "file2.txt",
          type: "file",
          content: "Initial content of file 2",
        },
        {
          name: "file3.txt",
          type: "file",
          content: "Initial content of file 3",
        },
      ],
    };

    // Write initial structure
    await writeFilesToRepo(testProjectId, initialStructure);

    // Get modification times of files
    const file1Path = path.join(repoPath, "file1.txt");
    const file2Path = path.join(repoPath, "file2.txt");
    const file3Path = path.join(repoPath, "file3.txt");

    const initialStats1 = await fs.stat(file1Path);
    const initialStats2 = await fs.stat(file2Path);
    const initialStats3 = await fs.stat(file3Path);

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modified structure - only file2 is changed
    const modifiedStructure: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "file1.txt",
          type: "file",
          content: "Initial content of file 1", // UNCHANGED
        },
        {
          name: "file2.txt",
          type: "file",
          content: "MODIFIED content of file 2", // CHANGED
        },
        {
          name: "file3.txt",
          type: "file",
          content: "Initial content of file 3", // UNCHANGED
        },
      ],
    };

    // Write modified structure
    await writeFilesToRepo(testProjectId, modifiedStructure);

    // Get new modification times
    const newStats1 = await fs.stat(file1Path);
    const newStats2 = await fs.stat(file2Path);
    const newStats3 = await fs.stat(file3Path);

    // file1 and file3 should NOT have been rewritten (same mtime)
    expect(newStats1.mtimeMs).toBe(initialStats1.mtimeMs);
    expect(newStats3.mtimeMs).toBe(initialStats3.mtimeMs);

    // file2 SHOULD have been rewritten (different mtime)
    expect(newStats2.mtimeMs).toBeGreaterThan(initialStats2.mtimeMs);

    // Verify content is correct
    const content1 = await fs.readFile(file1Path, "utf-8");
    const content2 = await fs.readFile(file2Path, "utf-8");
    const content3 = await fs.readFile(file3Path, "utf-8");

    expect(content1).toBe("Initial content of file 1");
    expect(content2).toBe("MODIFIED content of file 2");
    expect(content3).toBe("Initial content of file 3");
  });

  it("should properly delete removed files", async () => {
    const structureWithFile: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "keep.txt",
          type: "file",
          content: "Keep this file",
        },
        {
          name: "delete.txt",
          type: "file",
          content: "Delete this file",
        },
      ],
    };

    await writeFilesToRepo(testProjectId, structureWithFile);

    // Verify both files exist
    const keepPath = path.join(repoPath, "keep.txt");
    const deletePath = path.join(repoPath, "delete.txt");

    expect(
      await fs
        .access(keepPath)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(deletePath)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    // Remove one file from structure
    const structureWithoutFile: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "keep.txt",
          type: "file",
          content: "Keep this file",
        },
        // delete.txt is removed
      ],
    };

    await writeFilesToRepo(testProjectId, structureWithoutFile);

    // Verify keep.txt still exists and delete.txt is gone
    expect(
      await fs
        .access(keepPath)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(deletePath)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it("should properly create new files", async () => {
    const structureWithoutNewFile: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "existing.txt",
          type: "file",
          content: "Existing file",
        },
      ],
    };

    await writeFilesToRepo(testProjectId, structureWithoutNewFile);

    // Add a new file
    const structureWithNewFile: FileEntity = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "existing.txt",
          type: "file",
          content: "Existing file",
        },
        {
          name: "new.txt",
          type: "file",
          content: "New file content",
        },
      ],
    };

    await writeFilesToRepo(testProjectId, structureWithNewFile);

    // Verify both files exist
    const existingPath = path.join(repoPath, "existing.txt");
    const newPath = path.join(repoPath, "new.txt");

    expect(
      await fs
        .access(existingPath)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    // Verify new file content
    const newContent = await fs.readFile(newPath, "utf-8");
    expect(newContent).toBe("New file content");
  });
});
