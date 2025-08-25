"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateProjectPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollaborator, setNewCollaborator] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setOwnerEmail(user.email);
    }
  }, []);

  const handleAddCollaborator = () => {
    if (
      newCollaborator.trim() &&
      !collaborators.includes(newCollaborator.trim())
    ) {
      setCollaborators([...collaborators, newCollaborator.trim()]);
      setNewCollaborator("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, ownerEmail, collaborators }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/editor/${data.projectId}`);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "Failed to create project");
    }
  };

  return (
    <main className="min-h-screen flex justify-center items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-md w-full space-y-6 bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-700 text-gray-100"
      >
        <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-blue-600 to-indigo-800 bg-clip-text text-transparent tracking-wide">
          Create New Project
        </h1>

        <div>
          <label className="block mb-1 font-medium text-gray-300">
            Project Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Enter project title"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-100"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-gray-300">
            Owner Email
          </label>
          <input
            type="email"
            value={ownerEmail}
            readOnly
            placeholder="Owner email"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-400"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-gray-300">
            Collaborators (Emails)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              value={newCollaborator}
              onChange={(e) => setNewCollaborator(e.target.value)}
              placeholder="Enter collaborator email"
              className="flex-grow bg-gray-800 border border-gray-700 rounded px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-100"
            />
            <button
              type="button"
              onClick={handleAddCollaborator}
              className="bg-blue-800 text-gray-100 px-4 rounded-lg hover:bg-blue-600 transition"
            >
              Add
            </button>
          </div>
          <ul className="list-disc pl-5 text-gray-400">
            {collaborators.map((email, idx) => (
              <li key={idx}>{email}</li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-800 text-gray-100 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          Create Project
        </button>
      </form>
    </main>
  );
}
