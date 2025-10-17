"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  User,
  LogOut,
  Clock,
  Mail,
  Check,
  X,
  Inbox,
  Calendar,
  Folder,
  Shield,
  CheckCircle,
} from "lucide-react";
import LogoTitle from "@/app/components/LogoTitle";

interface Invitation {
  _id: string;
  projectTitle: string;
  ownerEmail: string;
  createdAt: string;
}

export default function InvitationsPage() {
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const router = useRouter();
  const userPopupRef = useRef<HTMLDivElement>(null);

  // Fetch logged in user
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) router.push("/");
    else setUser(JSON.parse(userData));
  }, [router]);

  // Fetch invitations
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/invitations?userEmail=${encodeURIComponent(user.email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInvitations(data);
          setInvitationCount(data.length);
        }
      })
      .catch((err) => console.error("Error fetching invitations:", err));
  }, [user]);

  // Hide popup if click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userPopupRef.current &&
        !userPopupRef.current.contains(event.target as Node)
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

  const handleInvitationAction = async (
    invitationId: string,
    action: "accept" | "decline",
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, action }),
      });
      if (!res.ok) throw new Error("Failed to update invitation");

      setInvitations((prev) => prev.filter((i) => i._id !== invitationId));
      setInvitationCount((prev) => prev - 1);
    } catch (err) {
      console.error(err);
      alert("Error handling invitation.");
    } finally {
      setLoading(false);
    }
  };

  const getTimeLeft = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 3 * 24 * 60 * 60 * 1000; // 3 days expiration
    const diff = expires - Date.now();
    if (diff <= 0) return { text: "Expired", isExpired: true };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return { text: `${days}d ${hours % 24}h`, isExpired: false };
    }

    return {
      text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      isExpired: false,
    };
  };

  return (
    <div className="flex min-h-screen font-sans bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-border p-6 flex flex-col">
        <div className="mb-8">
          <LogoTitle />
        </div>

        <nav className="space-y-2 flex-1">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm hover:bg-primary hover:text-primary-foreground transition-all"
            onClick={() => router.push("/projects")}
          >
            <Folder className="h-5 w-5 mr-3" />
            Projects
          </Button>
          <Button
            variant="default"
            className="w-full bg-primary justify-between text-sm hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
            onClick={() => router.push("/invitations")}
          >
            <div className="flex items-center">
              <Mail className="h-5 w-5 mr-3" />
              Invitations
            </div>
            {invitationCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 text-xs px-1.5 py-0.5 h-5 min-w-5 flex items-center justify-center"
              >
                {invitationCount}
              </Badge>
            )}
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-card border-b border-border shadow-md p-6 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-semibold tracking-tight">
            Invitations
          </h2>

          <div className="relative flex items-center gap-3" ref={userPopupRef}>
            <span className="hidden sm:inline text-sm font-medium text-foreground">
              Hi, {user?.username || "User"}
            </span>
            <Avatar
              className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={() => setShowUserPopup(!showUserPopup)}
            >
              <AvatarFallback className="bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {showUserPopup && user && (
              <Card className="absolute right-0 top-full mt-1 w-80 z-50 border border-primary shadow-lg">
                <CardContent className="p-4 space-y-4">
                  {/* Email */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Email
                      </span>
                    </div>
                    <span
                      className="text-sm text-foreground truncate max-w-48"
                      title={user.email}
                    >
                      {user.email}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Status
                      </span>
                    </div>
                    <span className="text-sm text-green-600 font-medium">
                      Active
                    </span>
                  </div>

                  {/* Role */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Role
                      </span>
                    </div>
                    <span className="text-sm text-foreground font-medium">
                      Collaborator
                    </span>
                  </div>

                  <Separator />

                  {/* Logout Button */}
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

        {/* Invitations */}
        <main className="flex-1 px-6 py-8 bg-gradient-subtle">
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-primary/10 flex items-center justify-center mb-6">
                <Inbox className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Invitations</h3>
              <p className="text-muted-foreground max-w-sm">
                When someone invites you to collaborate on a project,
                you&apos;ll see their invitations here.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {invitations.map((invitation) => {
                const timeLeft = getTimeLeft(invitation.createdAt);
                return (
                  <Card
                    key={invitation._id}
                    className="shadow-card bg-accent/07 border-border/50 hover:shadow-primary/50 transition animate-slide-up"
                  >
                    <CardContent className="p-6 flex justify-between items-start">
                      <div className="flex-1 space-y-2">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {invitation.projectTitle}
                          </h3>
                          <p className="text-muted-foreground flex items-center gap-2 mt-1">
                            <Mail className="h-4 w-4" />
                            Invited by {invitation.ownerEmail}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Received{" "}
                          {new Date(invitation.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-6">
                        <Badge
                          variant={
                            timeLeft.isExpired ? "destructive" : "secondary"
                          }
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {timeLeft.text}
                        </Badge>
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={() =>
                              handleInvitationAction(invitation._id, "accept")
                            }
                            disabled={loading || timeLeft.isExpired}
                            className="bg-success hover:bg-success/50 text-success-foreground transition"
                          >
                            <Check className="h-4 w-4 mr-2" /> Accept
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleInvitationAction(invitation._id, "decline")
                            }
                            disabled={loading}
                            className="border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition"
                          >
                            <X className="h-4 w-4 mr-2" /> Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
