import React from "react";
import GitHubVersionControl from "./components/GitHubVersionControl";

export default function GitHubVersionControlPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <GitHubVersionControl />
    </main>
  );
}
