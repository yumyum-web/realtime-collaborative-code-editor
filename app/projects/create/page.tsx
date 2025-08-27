"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function CreateProjectPage() {
  const [title, setTitle] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollaborator, setNewCollaborator] = useState("");
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/");
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  // Hide popup if click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setShowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleAddCollaborator = () => {
    if (!newCollaborator.trim()) return;
    setCollaborators((prev) => [...prev, newCollaborator.trim()]);
    setNewCollaborator("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Project title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          ownerEmail: user?.email,
          collaborators, // already an array
        }),
      });

      if (!res.ok) throw new Error("Failed to create project");
      router.push("/projects");
    } catch (err) {
      console.error(err);
      alert("Error creating project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-gray-700 text-gray-200">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-6 shadow-xl flex flex-col">
        <h1 className="text-4xl font-serif font-extrabold mb-10 text-gray-200 tracking-tight">
          RCCE
        </h1>
        <nav className="space-y-4 flex-1">
          <button
            onClick={() => router.push("/projects")}
            className="block w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-600 font-bold transition"
          >
            Projects
          </button>
          <button
            onClick={() => router.push("/invitations")}
            className="block w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-600 font-bold transition"
          >
            Invitations
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-gray-900">
        {/* Topbar */}
        <header className="bg-gray-800 shadow p-6 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-semibold text-gray-200 tracking-tight">
            Create New Project
          </h2>

          {/* User Icon & Popup */}
          <div className="relative" ref={popupRef}>
            <div
              className="w-11 h-11 bg-blue-800 text-white flex items-center justify-center rounded-full cursor-pointer text-xl font-bold"
              onClick={() => setShowPopup((prev) => !prev)}
            >
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {showPopup && user && (
              <div
                className="absolute right-0 mt-2 w-56 bg-gray-800 shadow-xl rounded-lg p-4 text-sm z-50 border border-gray-700"
                onMouseEnter={() => setShowPopup(true)}
                onMouseLeave={() => setShowPopup(false)}
              >
                <p className="font-semibold text-gray-200">{user.username}</p>
                <p className="font-semibold text-gray-400 text-sm">
                  {user.email}
                </p>
                <button
                  className="w-full bg-blue-800 text-gray-200 py-1.5 rounded hover:bg-blue-600 font-medium mt-2 transition"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Form */}
        <main className="flex-1 flex justify-center items-center px-6 py-12">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg bg-gray-800 shadow-lg rounded-lg p-8 space-y-6 border border-gray-700"
          >
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-600 text-gray-200 focus:ring-2 focus:ring-blue-800 outline-none"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-600 text-gray-200 focus:ring-2 focus:ring-blue-800 outline-none"
                placeholder="Enter project description"
                rows={3}
              />
            </div>

            {/* Collaborators Input + Button */}
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Add Collaborators
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollaborator}
                  onChange={(e) => setNewCollaborator(e.target.value)}
                  className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-600 text-gray-200 focus:ring-2 focus:ring-blue-800 outline-none"
                  placeholder="Enter collaborator email"
                />
                <button
                  type="button"
                  onClick={handleAddCollaborator}
                  className="px-4 py-2 bg-blue-800 hover:bg-blue-600 rounded font-bold text-gray-200 transition"
                >
                  Add
                </button>
              </div>

              {/* Show added collaborators as plain text */}
              {collaborators.length > 0 && (
                <p className="mt-2 text-gray-400 text-sm">
                  Added: {collaborators.join(", ")}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-800 hover:bg-blue-600 text-gray-200 rounded font-bold transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
