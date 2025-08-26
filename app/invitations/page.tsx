"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const [showPopup, setShowPopup] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const [invitationCount, setInvitationCount] = useState(0);

  // Fetch logged-in user
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/");
    } else {
      setUser(JSON.parse(userData));
    }
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

      // remove from UI
      setInvitations((prev) =>
        prev.filter((invitation) => invitation._id !== invitationId),
      );
      setInvitationCount((prev) => prev - 1);
    } catch (err) {
      console.error(err);
      alert("Error handling invitation.");
    } finally {
      setLoading(false);
    }
  };

  // Helper: Calculate time left (24h expiration)
  const getTimeLeft = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const diff = expires - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} hrs`;
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
            className="relative block w-full text-left px-3 py-2 rounded-lg bg-blue-800 hover:bg-blue-600 font-bold transition"
          >
            Invitations
            {/* Show badge only if > 0 */}
            {invitationCount > 0 && (
              <span className="absolute top-1 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {invitationCount}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-gray-900">
        {/* Topbar */}
        <header className="bg-gray-800 shadow p-6 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-semibold text-gray-200 tracking-tight">
            Invitations
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

        {/* Invitations Table */}
        <main className="flex-1 px-8 py-6">
          <div className="w-full overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-5 font-semibold text-left text-gray-400 border-b pb-2 mb-4">
              <div>Title</div>
              <div>Invitor</div>
              <div>Time Left</div>
              <div>Accept</div>
              <div>Decline</div>
            </div>

            {invitations.length === 0 ? (
              <p className="text-gray-500">No pending invitations.</p>
            ) : (
              invitations.map((invitation) => (
                <div
                  key={invitation._id}
                  className="grid grid-cols-5 items-center gap-4 bg-gray-800 p-4 mb-4 rounded-lg shadow-sm border border-gray-700 hover:shadow transition"
                >
                  <div className="text-gray-200 font-medium">
                    {invitation.projectTitle}
                  </div>
                  <div className="text-gray-400">{invitation.ownerEmail}</div>
                  <div className="text-gray-500">
                    {getTimeLeft(invitation.createdAt)}
                  </div>
                  <button
                    className="w-8 h-8 bg-blue-800 text-gray-200 rounded hover:bg-blue-600 flex items-center justify-center text-sm font-bold transition disabled:opacity-50"
                    title="Accept"
                    disabled={loading}
                    onClick={() =>
                      handleInvitationAction(invitation._id, "accept")
                    }
                  >
                    ✓
                  </button>
                  <button
                    className="w-8 h-8 bg-blue-800 text-gray-200 rounded hover:bg-blue-600 flex items-center justify-center text-sm font-bold transition disabled:opacity-50"
                    title="Decline"
                    disabled={loading}
                    onClick={() =>
                      handleInvitationAction(invitation._id, "decline")
                    }
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
