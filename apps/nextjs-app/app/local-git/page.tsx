"use client";

import React, { useState } from "react";
import LocalGitPanel from "../components/LocalGitPanel";
import { Folder } from "lucide-react";

export default function LocalGitPage() {
  const [repoPath, setRepoPath] = useState<string>("");
  const [showPanel, setShowPanel] = useState<boolean>(false);

  const handleConnect = () => {
    if (repoPath.trim()) {
      setShowPanel(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {!showPanel ? (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Folder className="w-8 h-8 text-blue-600" />
              Local Git Control
            </h1>
            <p className="text-gray-600 mb-6">
              Connect to your local Git repository to manage changes, commits,
              branches, and sync with GitHub
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Repository Path *
              </label>
              <input
                type="text"
                placeholder="C:\Users\User\Desktop\my-project"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleConnect()}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the full path to your local Git repository
              </p>
            </div>

            <button
              onClick={handleConnect}
              disabled={!repoPath.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Connect to Repository
            </button>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                💡 Example Paths:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 font-mono">
                <li>• Windows: C:\Users\User\Desktop\my-project</li>
                <li>• Linux/Mac: /home/user/projects/my-project</li>
                <li>
                  • Current Project:{" "}
                  {typeof window !== "undefined"
                    ? window.location.pathname
                    : ""}
                </li>
              </ul>
            </div>

            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-2">✨ Features:</h3>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>View and stage/unstage file changes</li>
                <li>Commit changes with messages</li>
                <li>Push and pull to/from GitHub</li>
                <li>Switch and create branches</li>
                <li>View commit history</li>
                <li>Configure remote repositories</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setShowPanel(false)}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Change Repository
          </button>
          <LocalGitPanel repoPath={repoPath} />
        </div>
      )}
    </div>
  );
}
