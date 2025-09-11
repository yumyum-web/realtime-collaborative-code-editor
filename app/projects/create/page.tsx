"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Plus, X, User, LogOut } from "lucide-react";

export default function CreateProjectPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollaborator, setNewCollaborator] = useState("");
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) router.push("/");
    else setUser(JSON.parse(userData));
  }, [router]);

  // Hide popup if click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
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
    if (collaborators.includes(newCollaborator.trim())) return;
    setCollaborators((prev) => [...prev, newCollaborator.trim()]);
    setNewCollaborator("");
  };

  const removeCollaborator = (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("Project title is required");
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          ownerEmail: user?.email,
          collaborators,
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
    <div className="flex min-h-screen font-sans bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col p-6 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            CollabCode
          </h1>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-lg bg-accent/10 hover:bg-accent/100 transition-all"
            onClick={() => router.push("/projects")}
          >
            Projects
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-lg bg-accent/10 hover:bg-accent/100 transition-all"
            onClick={() => router.push("/invitations")}
          >
            Invitations
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border shadow-sm p-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-serif font-semibold tracking-tight">
              Create New Project
            </h2>
            <p className="text-muted-foreground mt-1">
              Start building something amazing together
            </p>
          </div>

          {/* User menu */}
          <div className="relative" ref={popupRef}>
            <Button
              variant="outline"
              size="icon"
              className="relative h-11 w-11 rounded-full bg-gradient-primary hover:shadow-glow transition"
              onClick={() => setShowPopup((p) => !p)}
            >
              <span className="text-lg font-bold text-primary-foreground">
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </Button>

            {showPopup && user && (
              <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg p-4 z-50 animate-slide-up">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Form */}
        <main className="flex-1 flex justify-center items-center px-6 py-12 bg-gradient-subtle">
          <Card className="w-full max-w-2xl shadow-card border border-primary/50 animate-slide-up">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl bg-gradient-primary bg-clip-text text-transparent">
                Project Details
              </CardTitle>
              <p className="text-lg text-muted-foreground">
                Set up your new collaborative coding project
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-lg">
                    Project Title *
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter an awesome project name"
                    className="h-14 bg-background-secondary border-border focus:ring-primary text-lg transition"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="description" className="text-lg">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what you're building…"
                    className="min-h-[120px] bg-background-secondary border-border focus:ring-primary text-lg resize-none transition"
                  />
                </div>

                {/* Collaborators */}
                <div className="space-y-5">
                  <Label className="text-lg">Collaborators</Label>
                  <div className="flex gap-3">
                    <Input
                      type="email"
                      value={newCollaborator}
                      onChange={(e) => setNewCollaborator(e.target.value)}
                      placeholder="colleague@example.com"
                      className="flex-1 bg-background-secondary border-border focus:ring-primary text-lg transition"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCollaborator();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddCollaborator}
                      className={`transition ${
                        newCollaborator.trim()
                          ? "bg-gradient-primary hover:shadow-primary"
                          : "bg-muted hover:shadow-none"
                      }`}
                    >
                      <Plus className="h-5 w-5 " />
                    </Button>
                  </div>

                  {collaborators.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-lg text-muted-foreground">
                        {collaborators.length} collaborator
                        {collaborators.length !== 1 && "s"} added:
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {collaborators.map((email) => (
                          <Badge
                            key={email}
                            variant="secondary"
                            className="pl-4 pr-2 py-2 bg-accent/50 hover:bg-accent transition text-lg"
                          >
                            {email}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-3 h-5 w-5 p-0 hover:bg-destructive/20"
                              onClick={() => removeCollaborator(email)}
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="w-full h-12 bg-gradient-primary hover:shadow-primary disabled:opacity-50 transition text-lg font-semibold"
                >
                  {loading ? "Creating Project..." : "Create Project"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
