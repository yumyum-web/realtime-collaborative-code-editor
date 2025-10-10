"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LogoTitle from "@/app/components/LogoTitle";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Checking...");
  const [loading, setLoading] = useState(true);

  // Helper function to mask emails in a text string
  const maskEmailInText = (text: string): string => {
    // Regex to match emails (simple pattern for local@domain)
    const emailRegex =
      /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    return text.replace(emailRegex, (match, localPart, domain) => {
      if (domain === "gmail.com" && localPart.length > 5) {
        const visiblePart = localPart.slice(0, -5);
        const maskedPart = "*".repeat(5);
        return visiblePart + maskedPart + "@" + domain;
      } else if (domain === "gmail.com") {
        // If local part is 5 or fewer chars, mask it fully
        return "*".repeat(localPart.length) + "@" + domain;
      }
      // For non-gmail domains, return as-is (or customize if needed)
      return match;
    });
  };

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
          const rawError = data.error || "Failed to accept invitation.";
          // Mask any emails in the error message
          setStatus(maskEmailInText(rawError));
        }
      })
      .catch(() => setStatus("Failed to accept invitation."))
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen inset-0">
      <LogoTitle />
      <div className="absolute inset-0 bg-flow opacity-10"></div>
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
      ></div>
      <div className="flex flex-col items-center justify-center z-10 w-full max-w-md mt-8">
        <Card className="w-full p-8 flex flex-col items-center">
          <h1 className="text-3xl font-bold mb-[-8]">Accept Invitation</h1>
          <div className="p-6 rounded shadow-lg w-full flex flex-col items-center">
            {loading ? (
              <p>Processing...</p>
            ) : (
              <>
                {status.toLowerCase().includes("accepted") && (
                  <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
                )}
                {(status.toLowerCase().includes("not for you") ||
                  status.toLowerCase().includes("error") ||
                  status.toLowerCase().includes("invalid") ||
                  status === "403") && (
                  <XCircle className="h-20 w-20 text-red-500 mb-4" />
                )}
                <p className="text-center">{status}</p>
                {(status.toLowerCase().includes("not for you") ||
                  status.toLowerCase().includes("error") ||
                  status.toLowerCase().includes("invalid") ||
                  status === "403") && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      className="w-full bg-gradient-primary hover:shadow-primary cursor-pointer mt-4"
                      onClick={() => {
                        localStorage.removeItem("user");
                        router.push("/login");
                      }}
                    >
                      Go to Login page
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
