"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Checking...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("Invalid invitation link.");
      setLoading(false);
      return;
    }
    // Check if user is logged in (demo: check localStorage)
    const userData = localStorage.getItem("user");
    if (!userData) {
      // Not logged in, redirect to signup/login with redirect back
      router.push(`/signup?redirect=/invitations/accept?token=${token}`);
      return;
    }
    const user = JSON.parse(userData);
    // Accept invitation
    fetch(`/api/invitations/accept?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("Invitation accepted! Redirecting to your projects...");
          setTimeout(() => router.push("/projects"), 2000);
        } else {
          const data = await res.json();
          setStatus(data.error || "Failed to accept invitation.");
        }
      })
      .catch(() => setStatus("Failed to accept invitation."))
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-200">
      <h1 className="text-3xl font-bold mb-4">Accept Invitation</h1>
      <div className="bg-gray-800 p-6 rounded shadow-lg">
        {loading ? <p>Processing...</p> : <p>{status}</p>}
      </div>
    </div>
  );
}
