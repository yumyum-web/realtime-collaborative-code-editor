"use client";

import { useRouter } from "next/navigation";
import { Code, Users, GitBranch, MessageSquare, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();

  const features = [
    {
      icon: Users,
      title: "Real-time Collaboration",
      description:
        "Edit code together instantly with live cursors and real-time sync.",
    },
    {
      icon: GitBranch,
      title: "Integrated Version Control",
      description:
        "Manage branches, commits, and merges without leaving the editor.",
    },
    {
      icon: MessageSquare,
      title: "Live Communication",
      description: "Chat, comment, and discuss code directly in the platform.",
    },
    {
      icon: Code,
      title: "Smart Code Editor",
      description:
        "Syntax highlighting, auto-complete, and error detection for multiple languages.",
    },
    {
      icon: Zap,
      title: "Instant Testing",
      description:
        "Run unit tests inside the editor and get results instantly.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-200 flex items-center justify-center px-6">
      <div className="max-w-6xl w-full flex flex-col md:flex-row gap-12 items-center">
        {/* Hero Section */}
        <div className="md:w-1/2 flex flex-col justify-center gap-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Code Together, <span className="text-blue-800">Ship Faster</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Build, test, and ship software efficiently with real-time
            collaboration, integrated version control, and instant code testing.
          </p>
          <p className="text-gray-400 text-lg">
            Empower your team with a professional, secure, and smart coding
            platform.
          </p>
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => router.push("/signup")}
              className="px-6 py-3 rounded-lg bg-blue-800 text-white font-semibold hover:bg-blue-600 transition"
            >
              Create Account
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 transition"
            >
              Log In
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="md:w-1/2 grid gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 bg-gray-900 rounded-xl border border-gray-700 hover:border-blue-800 transition"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-gray-800 rounded-lg text-blue-800">
                <feature.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
