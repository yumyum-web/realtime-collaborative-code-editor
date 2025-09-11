"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase/config";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";
import { Mail, Lock } from "lucide-react";
import Link from "next/link";
import LogoTitle from "../components/LogoTitle";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );
      const user = userCredential.user;
      localStorage.setItem("token", await user.getIdToken());
      localStorage.setItem(
        "user",
        JSON.stringify({ username: user.displayName, email: user.email }),
      );
      setStatus({
        type: "success",
        message: "Login successful! Redirecting...",
      });
      setTimeout(() => router.push("/projects"), 1500);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setStatus({ type: "error", message: errorMessage });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      localStorage.setItem("token", await user.getIdToken());
      localStorage.setItem(
        "user",
        JSON.stringify({ username: user.displayName, email: user.email }),
      );
      router.push("/projects");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setStatus({ type: "error", message: errorMessage });
    }
  };

  // Professional Eye Icon component
  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      {visible ? (
        <>
          <path d="M1 1l22 22" />
          <path d="M17.94 17.94A10.05 10.05 0 0 1 12 19c-5.05 0-9.27-3.18-10.61-7.5a10.05 10.05 0 0 1 4.13-5.34" />
          <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
          <path d="M12 5c5.05 0 9.27 3.18 10.61 7.5a10.05 10.05 0 0 1-1.78 2.84" />
        </>
      ) : (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-flow opacity-10"></div>
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
      ></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Heading */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold mb-4"
          >
            <LogoTitle />
          </Link>
          <p className="text-foreground-muted">
            Welcome back to your coding workspace
          </p>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-border shadow-card">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your projects
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status message */}
            {status && (
              <div
                className={`text-sm text-center p-2 rounded ${
                  status.type === "success"
                    ? "bg-green-900 text-green-400"
                    : "bg-red-900 text-red-400"
                }`}
              >
                {status.message}
              </div>
            )}

            {/* Google Login */}
            <div>
              <Button
                variant="outline"
                className="w-full border-border hover:bg-muted"
                onClick={handleGoogleLogin}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-foreground-muted">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-foreground-muted" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={form.email}
                    onChange={handleChange}
                    className="pl-10 bg-background border-border"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-foreground-muted" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    className="pl-10 bg-background border-border pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-foreground-muted"
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:shadow-primary"
              >
                Sign In
              </Button>
            </form>

            <div className="text-center">
              <span className="text-foreground-muted text-sm">
                Don’t have an account?
              </span>
              <Button
                variant="link"
                className="text-primary ml-1 px-1 text-sm"
                onClick={() => router.push("/signup")}
              >
                Sign up
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link href="/">
            <Button variant="ghost" className="text-foreground-muted">
              ← Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
