"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Project {
  _id: string;
  title: string;
  owner: string;
  collaborators: string[];
  description?: string;
  createdAt?: string;
}

export default function ProjectsPage() {
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  interface Invitation {
    _id: string;
    collaboratorEmail: string;
    // Add other fields if needed
  }

  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>(
    [],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [search, setSearch] = useState("");
  const [invitationCount, setInvitationCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState("");
  const router = useRouter();
  const userPopupRef = useRef<HTMLDivElement>(null);

  // Auth bootstrap
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/");
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  // Fetch projects
  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    fetch(`/api/projects?userEmail=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setProjects(data))
      .catch((e) => console.error("Error fetching projects:", e))
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch invitations
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/invitations?userEmail=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setInvitationCount(data.length))
      .catch((e) => console.error("Error fetching invitations:", e));
  }, [user]);

  // Close user popup on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userPopupRef.current &&
        !userPopupRef.current.contains(e.target as Node)
      ) {
        setShowUserPopup(false);
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

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Modal helpers
  const openMoreModal = async (project: Project) => {
    setSelectedProject(project);
    // setEditMode(user?.email === project.owner); // owner can edit
    setEditMode(false);
    setShowModal(true);

    try {
      const res = await fetch(`/api/projects/${project._id}/invitations`);
      if (res.ok) {
        const invitations = await res.json();
        setPendingInvitations(invitations);
      } else {
        console.error("Failed to fetch invitations");
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
      setPendingInvitations([]);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProject(null);
    setNewCollaborator("");
    setEditMode(false);
  };

  const isOwner = selectedProject && user?.email === selectedProject.owner;

  // Update project
  const saveProject = async () => {
    if (!selectedProject || !user?.email) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
        body: JSON.stringify({
          title: selectedProject.title,
          description: selectedProject.description || "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update project");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
      );
      setSelectedProject((prev) =>
        prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
      );
      setEditMode(false);
    } catch (e) {
      console.error(e);
      alert("Update failed");
    }
  };

  // Delete project
  const deleteProject = async () => {
    if (!selectedProject || !user?.email) return;
    if (
      !confirm(
        "Are you sure you want to delete this project? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/projects/${selectedProject._id}`, {
        method: "DELETE",
        headers: { "x-user-email": user.email },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Delete failed");
        return;
      }
      setProjects((prev) => prev.filter((p) => p._id !== selectedProject._id));
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    }
  };

  // Add collaborator
  const addCollaborator = async () => {
    if (!selectedProject || !user?.email || !newCollaborator.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${selectedProject._id}/collaborators`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": user.email,
          },
          body: JSON.stringify({ email: newCollaborator.trim() }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to add collaborator");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
      );
      setSelectedProject((prev) =>
        prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
      );
      setNewCollaborator("");

      // Re-fetch pending invitations for the selected project
      try {
        const inviteRes = await fetch(
          `/api/projects/${selectedProject._id}/invitations`,
        );
        if (inviteRes.ok) {
          const invitations = await inviteRes.json();
          setPendingInvitations(invitations);
        } else {
          setPendingInvitations([]);
        }
      } catch {
        setPendingInvitations([]);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to add collaborator");
    }
  };

  // Remove collaborator
  const removeCollaborator = async (email: string) => {
    if (!selectedProject || !user?.email) return;
    if (!confirm(`Remove collaborator ${email}?`)) return;
    try {
      const res = await fetch(
        `/api/projects/${selectedProject._id}/collaborators`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": user.email,
          },
          body: JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to remove collaborator");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
      );
      setSelectedProject((prev) =>
        prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
      );
    } catch (e) {
      console.error(e);
      alert("Failed to remove collaborator");
    }
  };

  // Promote collaborator -> owner
  const promoteToOwner = async (email: string) => {
    if (!selectedProject || !user?.email) return;
    if (
      !confirm(`Make ${email} the new owner? You will become a collaborator.`)
    )
      return;
    try {
      const res = await fetch(`/api/projects/${selectedProject._id}/owner`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
        body: JSON.stringify({ newOwnerEmail: email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to promote owner");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
      );
      setSelectedProject((prev) =>
        prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
      );
      setEditMode(true); // new owner can edit
      alert("Ownership transferred.");
    } catch (e) {
      console.error(e);
      alert("Failed to promote owner");
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
            className="block w-full text-left px-3 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 font-bold transition"
          >
            Projects
          </button>
          <button
            onClick={() => router.push("/invitations")}
            className="relative block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-600 font-bold transition"
          >
            Invitations
            {invitationCount > 0 && (
              <span className="absolute right-3 top-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {invitationCount}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative bg-gray-900">
        {/* Topbar */}
        <header className="bg-gray-800 shadow p-6 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-semibold text-gray-200 tracking-tight">
            Projects
          </h2>
          <div className="relative" ref={userPopupRef}>
            <div
              className="w-11 h-11 bg-blue-800 text-white flex items-center justify-center rounded-full cursor-pointer text-xl font-bold"
              onClick={() => setShowUserPopup((p) => !p)}
            >
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {showUserPopup && user && (
              <div
                className="absolute right-0 mt-2 w-56 bg-gray-800 shadow-xl rounded-lg p-4 text-sm z-50 border border-gray-700"
                onMouseEnter={() => setShowUserPopup(true)}
                onMouseLeave={() => setShowUserPopup(false)}
              >
                <p className="font-semibold text-gray-200">{user.username}</p>
                <p className="font-semibold text-gray-400 text-sm">
                  {user.email}
                </p>
                <button
                  className="w-full bg-red-600 text-white py-1.5 rounded hover:bg-red-700 font-medium mt-2 transition"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-8 py-6">
          <div className="mb-6 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="p-3 border border-gray-700 rounded-lg w-1/2 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-600 transition shadow-sm"
              />
              <button className="px-5 py-3 bg-blue-800 text-gray-200 rounded-lg hover:bg-blue-700 font-semibold transition">
                Search
              </button>
            </div>
            <button
              onClick={() => router.push("/projects/create")}
              className="px-10 py-3 bg-blue-800 text-gray-200 rounded-lg hover:bg-blue-700 font-semibold transition whitespace-nowrap"
            >
              + New Project
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <p className="text-gray-500">Loading projects...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">No projects found. Create one!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((project) => (
                <div
                  key={project._id}
                  className="bg-gray-800 p-4 shadow-lg rounded-lg space-y-2 border border-gray-700 hover:shadow-xl transition"
                >
                  <h3 className="font-bold text-xl text-gray-200">
                    {project.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Owner: {project.owner}
                  </p>
                  {project.createdAt && (
                    <p className="text-xs text-gray-500">
                      Created:{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="pt-2 flex items-center">
                    <button
                      className="bg-blue-800 text-gray-200 rounded-lg px-4 py-1 hover:bg-blue-700 font-medium transition"
                      onClick={() =>
                        window.open(`/editor/${project._id}`, "_blank")
                      }
                    >
                      Open
                    </button>
                    <button
                      className="ml-4 text-gray-400 underline hover:text-gray-300 font-medium transition"
                      onClick={() => openMoreModal(project)}
                    >
                      More
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative bg-gray-800 text-gray-200 w-full max-w-2xl rounded-xl p-6 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editMode ? "Edit Project" : "Project Details"}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-200"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-semibold">Owner:</span>{" "}
                {selectedProject.owner}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Created:</span>{" "}
                {selectedProject.createdAt
                  ? new Date(selectedProject.createdAt).toLocaleString()
                  : "N/A"}
              </p>

              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                  value={selectedProject?.title || ""}
                  disabled={!isOwner}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      title: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 min-h-[90px]"
                  value={selectedProject?.description || ""}
                  disabled={!isOwner}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm">Collaborators</label>
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <input
                        value={newCollaborator}
                        onChange={(e) => setNewCollaborator(e.target.value)}
                        placeholder="email@example.com"
                        className="p-2 bg-gray-700 rounded border border-gray-600"
                      />
                      <button
                        className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded text-sm"
                        onClick={addCollaborator}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {(selectedProject.collaborators || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No collaborators yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-700 rounded border border-gray-700">
                    {(selectedProject.collaborators || []).map((email) => (
                      <li
                        key={email}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-sm">{email}</span>
                        {isOwner && (
                          <div className="flex items-center gap-2">
                            <button
                              className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                              onClick={() => promoteToOwner(email)}
                              title="Make this collaborator the owner"
                            >
                              Make Owner
                            </button>
                            <button
                              className="text-red-400 hover:text-red-300 text-sm underline"
                              onClick={() => removeCollaborator(email)}
                              title="Remove collaborator"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Pending Invitations</label>
              {pendingInvitations.length === 0 ? (
                <p className="text-sm text-gray-400">No pending invitations.</p>
              ) : (
                <ul className="divide-y divide-gray-700 rounded border border-gray-700">
                  {pendingInvitations.map((invitation) => (
                    <li
                      key={invitation._id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span className="text-sm">
                        {invitation.collaboratorEmail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {isOwner && (
                <>
                  {editMode ? (
                    <>
                      <button
                        className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
                        onClick={saveProject}
                      >
                        Save
                      </button>
                      <button
                        className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
                        onClick={() => setEditMode(false)}
                      >
                        Cancel Edit{" "}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded"
                        onClick={() => setEditMode(true)}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
                        onClick={deleteProject}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
              <button
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
                onClick={closeModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
