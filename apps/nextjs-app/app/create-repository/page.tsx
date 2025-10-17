"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, ArrowLeft, Plus } from "lucide-react";

export default function CreateRepositoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [repoDescription, setRepoDescription] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
    } else {
      setStatus("Please connect to GitHub first by providing your token.");
    }
  }, []);

  // Create a new repo
  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setStatus("Please enter your GitHub token first.");
      return;
    }

    if (!repoName) {
      setStatus("Please enter a repository name.");
      return;
    }

    setIsLoading(true);
    setStatus("Creating repository...");

    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: repoName,
          description: repoDescription,
          private: isPrivate,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Repository "${repoName}" created successfully!`);
        // Save token if not already saved
        localStorage.setItem("github_token", token);

        // Redirect back to GitHub version control page after 2 seconds
        setTimeout(() => {
          router.push("/github-version-control-page");
        }, 2000);
      } else {
        setStatus(
          `❌ Failed: ${data.message || "Unable to create repository"}`,
        );
      }
    } catch {
      setStatus(
        "❌ Error: Unable to connect to GitHub. Please check your connection.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FolderGit2 className="w-8 h-8 text-green-600" />
            Create New Repository
          </h1>
          <p className="text-gray-600 mt-2">
            Create a new repository on your GitHub account
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleCreateRepo} className="space-y-6">
            {/* Token Input (if not saved) */}
            {!token && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  GitHub Personal Access Token *
                </label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a token at:{" "}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    github.com/settings/tokens
                  </a>
                </p>
              </div>
            )}

            {/* Repository Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Repository Name *
              </label>
              <input
                type="text"
                placeholder="my-awesome-project"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                pattern="[a-zA-Z0-9._-]+"
                title="Only letters, numbers, dots, hyphens, and underscores allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use letters, numbers, dots, hyphens, and underscores only
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <textarea
                placeholder="A short description of your project..."
                value={repoDescription}
                onChange={(e) => setRepoDescription(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={4}
              />
            </div>

            {/* Privacy Setting */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium">
                  Make this repository private
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Private repositories are only visible to you and people you
                share them with
              </p>
            </div>

            {/* Status Message */}
            {status && (
              <div
                className={`p-3 rounded-lg ${
                  status.includes("✅")
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : status.includes("❌")
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-blue-50 border border-blue-200 text-blue-800"
                }`}
              >
                {status}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading || !repoName}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                {isLoading ? "Creating..." : "Create Repository"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Choose a descriptive name for your repository</li>
            <li>Add a README file to help others understand your project</li>
            <li>
              Consider making the repository private if it contains sensitive
              data
            </li>
            <li>You can always change repository settings later on GitHub</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
