"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function InvitationsPage() {
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  const [showPopup, setShowPopup] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/");
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

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

  const handleAcceptInvitation = (invitationId: number) => {
    console.log(`Accepted invitation with ID: ${invitationId}`);
    // Add your logic here to handle the invitation acceptance
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
            className="block w-full text-left px-3 py-2 rounded-lg bg-blue-800 hover:bg-blue-600 font-bold transition"
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

            {/* Sample Invitations */}
            {[1, 2, 3].map((invitation) => (
              <div
                key={invitation}
                className="grid grid-cols-5 items-center gap-4 bg-gray-800 p-4 mb-4 rounded-lg shadow-sm border border-gray-700 hover:shadow transition"
              >
                <div className="text-gray-200 font-medium">
                  Invitation {invitation}
                </div>
                <div className="text-gray-400">User {invitation}</div>
                <div className="text-gray-500">{24 - invitation} hrs</div>
                <button
                  className="w-8 h-8 bg-blue-800 text-gray-200 rounded hover:bg-blue-600 flex items-center justify-center text-sm font-bold transition"
                  title="Accept"
                  onClick={() => handleAcceptInvitation(invitation)}
                >
                  ✓
                </button>
                <button
                  className="w-8 h-8 bg-blue-800 text-gray-200 rounded hover:bg-blue-600 flex items-center justify-center text-sm font-bold transition"
                  title="Decline"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
