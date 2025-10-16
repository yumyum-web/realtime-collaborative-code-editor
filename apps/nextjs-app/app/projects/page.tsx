"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Separator } from "@/app/components/ui/separator";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Crown,
  Users,
  Calendar,
  LogOut,
  Github,
} from "lucide-react";
import { useToast } from "@/app/hooks/use-toast";
import { Toaster } from "@/app/components/ui/toaster";
import { GitHubConnectButton } from "@/app/components/GitHubConnectButton";
import { useGitHubOAuth } from "@/app/hooks/useGitHubOAuth";

import LogoTitle from "../components/LogoTitle";

interface Project {
  _id: string;
  title: string;
  owner: string;
  collaborators: string[];
  description?: string;
  createdAt?: string;
}

interface Invitation {
  _id: string;
  collaboratorEmail: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  owner?: { login: string };
  html_url: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { disconnectGitHub: oauthDisconnect } = useGitHubOAuth();
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
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
  const userPopupRef = useRef<HTMLDivElement>(null);

  // GitHub connection state
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubProjectId, setGithubProjectId] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);

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
    setEditMode(false); // Always start in view mode
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

  // GitHub connection handlers
  const openGitHubModal = (projectId: string) => {
    setGithubProjectId(projectId);
    const savedToken = localStorage.getItem(`github_token_${projectId}`);
    if (savedToken) {
      setGithubToken(savedToken);
      loadGitHubRepos(savedToken);
    }
    setShowGitHubModal(true);
  };

  const closeGitHubModal = () => {
    setShowGitHubModal(false);
    setGithubProjectId(null);
    setGithubToken("");
    setGithubRepos([]);
  };

  const handleConnectGitHub = async () => {
    if (!githubToken.trim() || !githubProjectId) {
      toast({
        title: "Error",
        description: "Please enter a valid GitHub token",
        variant: "destructive",
      });
      return;
    }

    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github?token=${githubToken}`);
      if (!res.ok) throw new Error("Failed to connect to GitHub");

      const repos = await res.json();
      setGithubRepos(repos);

      // Save token to localStorage
      localStorage.setItem(`github_token_${githubProjectId}`, githubToken);

      toast({
        title: "Success",
        description: `Connected to GitHub! Found ${repos.length} repositories.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to connect to GitHub. Please check your token.",
        variant: "destructive",
      });
    } finally {
      setGithubLoading(false);
    }
  };

  const loadGitHubRepos = async (token: string) => {
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github?token=${token}`);
      if (res.ok) {
        const repos = await res.json();
        setGithubRepos(repos);
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setGithubLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!githubProjectId) return;

    // Disconnect OAuth if used
    await oauthDisconnect(githubProjectId);

    // Also clear localStorage (for backward compatibility with manual tokens)
    localStorage.removeItem(`github_token_${githubProjectId}`);
    localStorage.removeItem(`github_repo_${githubProjectId}`);

    setGithubToken("");
    setGithubRepos([]);

    toast({
      title: "Disconnected",
      description: "GitHub connection removed for this project.",
    });

    closeGitHubModal();
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
    const collaboratorEmail = newCollaborator.trim();
    try {
      const res = await fetch(
        `/api/projects/${selectedProject._id}/collaborators`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": user.email,
          },
          body: JSON.stringify({ email: collaboratorEmail }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: err.error || "Failed to add collaborator",
          variant: "destructive",
        });
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

      // Show success toast
      toast({
        title: "Collaborator Added",
        description: `Invitation sent to ${collaboratorEmail}`,
      });

      // Re-fetch pending invitations
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
      toast({
        title: "Error",
        description: "Failed to add collaborator",
        variant: "destructive",
      });
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
      setEditMode(true);
      alert("Ownership transferred.");
    } catch (e) {
      console.error(e);
      alert("Failed to promote owner");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-border p-6 flex flex-col">
        <div className="mb-8">
          <LogoTitle />
        </div>

        <nav className="space-y-2 flex-1">
          <Button
            variant="default"
            className="w-full justify-start text-lg hover:bg-primary hover:text-primary-foreground transition-all"
            onClick={() => router.push("/projects")}
          >
            Projects
          </Button>
          <Button
            variant="ghost"
            className="w-full bg-accent/10 justify-between text-lg hover:bg-gray-700 hover:text-accent-foreground transition-all cursor-pointer"
            onClick={() => router.push("/invitations")}
          >
            Invitations
            {invitationCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-lg">
                {invitationCount}
              </Badge>
            )}
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border shadow-md p-6 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-semibold tracking-tight">
            Projects
          </h2>

          <div className="relative" ref={userPopupRef}>
            <Avatar
              className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={() => setShowUserPopup(!showUserPopup)}
            >
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            {showUserPopup && user && (
              <Card className="absolute right-0 mt-2 w-56 z-50 border border-primary shadow-lg">
                <CardContent className="p-4">
                  <p className="font-medium text-foreground">{user.username}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Separator className="my-3" />
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Search and New Project */}
          <div className="mb-6 flex items-center gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="pl-10 border border-primary focus:ring-primary focus:border-primary"
              />
            </div>

            <Button
              onClick={() => router.push("/projects/create")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Project
            </Button>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No projects found. Create your first project!
              </p>
              <Button
                onClick={() => router.push("/projects/create")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((project) => (
                <Card
                  key={project._id}
                  className="group hover:shadow-glow-lg hover:bg-accent/10 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:border-primary border border-border rounded-lg"
                >
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between">
                      <span className="text-xl font-semibold group-hover:text-primary transition-colors">
                        {project.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openMoreModal(project)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="h-3 w-3 text-primary" />
                      <span>{project.owner}</span>
                    </div>

                    {project.collaborators &&
                      project.collaborators.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3 w-3 text-primary" />
                          <span>
                            {project.collaborators.length} collaborator
                            {project.collaborators.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                    {project.createdAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 text-primary" />
                        <span>
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
                        onClick={() =>
                          window.open(`/editor/${project._id}`, "_blank")
                        }
                      >
                        Open
                      </Button>
                      <Button
                        variant="outline"
                        className="hover:bg-blue-500 hover:text-white transition-colors border-primary"
                        onClick={() => openMoreModal(project)}
                      >
                        More
                      </Button>
                    </div>

                    {/* GitHub Connection Indicator */}
                    <div className="pt-2 mt-2 border-t border-border">
                      {localStorage.getItem(`github_token_${project._id}`) ? (
                        <button
                          onClick={() => openGitHubModal(project._id)}
                          className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700 transition-colors w-full"
                        >
                          <Github className="h-3 w-3" />
                          <span>GitHub Connected</span>
                          <span className="ml-auto text-gray-500">
                            • Click to manage
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openGitHubModal(project._id)}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
                        >
                          <Github className="h-3 w-3" />
                          <span>Connect GitHub</span>
                          <span className="ml-auto">→</span>
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Project Details Modal */}
      {showModal && selectedProject && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl border border-primary shadow-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-primary">
                Project Details
              </DialogTitle>
              <DialogDescription>
                {editMode
                  ? "Edit project details, manage collaborators, and view pending invitations."
                  : "View project details and collaborators."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Project Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Crown className="h-4 w-4 text-primary" />
                  <span>Owner: {selectedProject.owner}</span>
                </div>
                {selectedProject.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>
                      Created:{" "}
                      {new Date(selectedProject.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={selectedProject.title}
                  disabled={!editMode}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      title: e.target.value,
                    })
                  }
                  className="border border-primary focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={selectedProject.description || ""}
                  disabled={!editMode}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="border border-primary focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Collaborators */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Collaborators</label>
                  {isOwner && editMode && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newCollaborator}
                        onChange={(e) => setNewCollaborator(e.target.value)}
                        placeholder="email@example.com"
                        className="w-48 border border-primary focus:ring-primary focus:border-primary"
                      />
                      <Button
                        size="sm"
                        onClick={addCollaborator}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>

                {selectedProject.collaborators?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No collaborators yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedProject.collaborators?.map((email) => (
                      <Card
                        key={email}
                        className="p-3 border border-primary rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{email}</span>
                          {isOwner && editMode && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => promoteToOwner(email)}
                                className="border-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                <Crown className="h-3 w-3 mr-1" />
                                Make Owner
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeCollaborator(email)}
                                className="hover:bg-red-600 hover:text-white"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations */}
              <div className="space-y-4">
                <label className="text-sm font-medium">
                  Pending Invitations
                </label>
                {pendingInvitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending invitations.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvitations.map((invitation) => (
                      <Card
                        key={invitation._id}
                        className="p-3 border border-primary rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm">
                            {invitation.collaboratorEmail}
                          </span>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              {isOwner && (
                <>
                  {editMode ? (
                    <>
                      <Button
                        onClick={saveProject}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditMode(false)}
                        className="border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setEditMode(true)}
                        className="border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={deleteProject}
                        className="hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                onClick={closeModal}
                className="hover:bg-muted hover:text-muted-foreground"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* GitHub Connection Modal */}
      {showGitHubModal && githubProjectId && (
        <Dialog open={showGitHubModal} onOpenChange={setShowGitHubModal}>
          <DialogContent className="max-w-2xl border border-primary shadow-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Github className="h-5 w-5" />
                GitHub Integration
              </DialogTitle>
              <DialogDescription>
                Connect your GitHub account to sync repositories and view commit
                history.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Connection Status */}
              {githubToken && githubRepos.length > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <Github className="h-5 w-5" />
                    <span className="font-semibold">Connected to GitHub</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Found {githubRepos.length} repositories in your account.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* OAuth Connection (Recommended) */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        RECOMMENDED
                      </span>
                      <p className="text-sm font-semibold text-blue-900">
                        One-Click Connection
                      </p>
                    </div>
                    <p className="text-sm text-blue-700 mb-4">
                      Connect securely with GitHub OAuth (like Gmail sign-in)
                    </p>
                    <GitHubConnectButton
                      projectId={githubProjectId || undefined}
                      mode="popup"
                      variant="default"
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                      onConnect={() => {
                        toast({
                          title: "Connecting...",
                          description: "Opening GitHub authentication...",
                        });
                      }}
                    />
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">
                        Or use manual token
                      </span>
                    </div>
                  </div>

                  {/* Manual Token (Fallback) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Manual Setup:</strong>
                    </p>
                    <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1 mb-3">
                      <li>
                        Go to{" "}
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-blue-600"
                        >
                          GitHub Settings → Tokens
                        </a>
                      </li>
                      <li>
                        Create a new token with{" "}
                        <code className="bg-gray-200 px-1 rounded">repo</code>{" "}
                        scope
                      </li>
                      <li>Paste the token below</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Token Input (only show if not using OAuth or for manual mode) */}
              {!githubRepos.length && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">
                    Manual Token (Optional)
                  </label>
                  <Input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your token is stored locally and only used to communicate
                    with GitHub.
                  </p>
                </div>
              )}

              {/* Repository List (if connected) */}
              {githubRepos.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Your Repositories ({githubRepos.length})
                  </label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {githubRepos.slice(0, 10).map((repo) => (
                      <div
                        key={repo.id}
                        className="text-xs p-2 hover:bg-gray-100 rounded flex items-center justify-between"
                      >
                        <span className="font-mono">
                          {repo.owner?.login}/{repo.name}
                        </span>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View →
                        </a>
                      </div>
                    ))}
                    {githubRepos.length > 10 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        ...and {githubRepos.length - 10} more. Open in editor to
                        see all.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                {githubToken && githubRepos.length > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`/editor/${githubProjectId}`, "_blank");
                        closeGitHubModal();
                      }}
                      className="border-primary"
                    >
                      Open in Editor
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnectGitHub}
                    >
                      Disconnect
                    </Button>
                    <Button variant="ghost" onClick={closeGitHubModal}>
                      Close
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleConnectGitHub}
                      disabled={!githubToken.trim() || githubLoading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {githubLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Github className="h-4 w-4 mr-2" />
                          Connect GitHub
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" onClick={closeGitHubModal}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
