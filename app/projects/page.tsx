"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const [user, setUser] = useState<{ username: string; email: string } | null>(
    null,
  );
  const [projects, setProjects] = useState<
    { _id: string; title: string; owner: string }[]
  >([]);
  const [showPopup, setShowPopup] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/");
    } else {
      const parsed = JSON.parse(userData);
      setUser(parsed);

      fetch(`/api/projects?userEmail=${encodeURIComponent(parsed.email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.length > 0) setProjects(data);
        })
        .catch((error) => console.error("Error fetching projects:", error));
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
            className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-600 font-bold transition"
          >
            Invitations
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
                  className="w-full bg-red-600 text-white py-1.5 rounded hover:bg-red-700 font-medium mt-2 transition"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-8 py-6">
          {/* Search & Create Button */}
          <div className="mb-6 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 w-full">
              <input
                type="text"
                placeholder="Search projects..."
                className="p-3 border border-gray-700 rounded-lg w-1/2 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-600 transition shadow-sm"
              />
              <button className="px-5 py-3 bg-blue-800 text-gray-200 rounded-lg hover:bg-blue-700 font-semibold transition">
                Search
              </button>
            </div>

            <button
              onClick={() => window.open("/projects/create", "_blank")}
              className="px-4 py-3 bg-blue-800 text-gray-200 rounded-lg hover:bg-blue-700 font-semibold transition"
            >
              +
            </button>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-gray-800 p-4 shadow-lg rounded-lg space-y-2 border border-gray-700 hover:shadow-xl transition"
              >
                <h3 className="font-bold text-xl text-gray-200">
                  {project.title}
                </h3>
                <p className="text-sm text-gray-400">Owner: {project.owner}</p>
                <p className="text-xs text-gray-500">Last Modified: Today</p>
                <div className="pt-2 flex items-center">
                  <button
                    className="bg-blue-800 text-gray-200 rounded-lg px-4 py-1 hover:bg-blue-700 font-medium transition"
                    onClick={() =>
                      window.open(`/editor/${project._id}`, "_blank")
                    }
                  >
                    Open
                  </button>
                  <button className="ml-4 text-gray-400 underline hover:text-gray-300 font-medium transition">
                    More
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
