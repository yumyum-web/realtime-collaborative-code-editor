"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase/config";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const router = useRouter();

  const checkPasswordStrength = (password: string) => {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const lengthValid = password.length >= 8;
    const strengthCount = [hasUpper, hasLower, hasNumber, hasSymbol].filter(
      Boolean,
    ).length;
    if (lengthValid && strengthCount >= 3) return "Strong";
    if (password.length >= 6 && strengthCount >= 2) return "Medium";
    if (password.length > 0) return "Weak";
    return "";
  };

  const passwordStrength = checkPasswordStrength(form.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (form.password !== form.confirmPassword) {
      return setStatus({ type: "error", message: "Passwords do not match!" });
    }
    if (passwordStrength === "Weak") {
      return setStatus({
        type: "error",
        message: "Please choose a stronger password.",
      });
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );

      await updateProfile(userCredential.user, { displayName: form.username });

      setStatus({
        type: "success",
        message: "Signup successful! Redirecting...",
      });

      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setStatus({ type: "error", message: errorMessage });
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Fallback if displayName is null
      const username =
        user.displayName ?? user.email?.split("@")[0] ?? "Anonymous";

      localStorage.setItem("token", await user.getIdToken());
      localStorage.setItem(
        "user",
        JSON.stringify({ username, email: user.email }),
      );

      router.push("/projects");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setStatus({ type: "error", message: errorMessage });
    }
  };

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
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-700 w-full max-w-md space-y-4 text-gray-200"
      >
        <h2 className="text-3xl font-extrabold text-center bg-gradient-to-r from-blue-600 to-indigo-800 bg-clip-text text-transparent tracking-wide">
          Create New Account
        </h2>

        {status.message && (
          <div
            className={`text-sm p-2 rounded text-center ${
              status.type === "success"
                ? "bg-green-900 text-green-400"
                : "bg-red-900 text-red-400"
            }`}
          >
            {status.message}
          </div>
        )}

        <input
          type="text"
          name="username"
          placeholder="Username"
          onChange={handleChange}
          className="block w-full p-3 rounded bg-gray-800 border border-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-700 outline-none"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="block w-full p-3 rounded bg-gray-800 border border-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-700 outline-none"
          required
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className="block w-full p-3 rounded bg-gray-800 border border-gray-700 text-gray-100 pr-10 focus:ring-2 focus:ring-blue-700 outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-gray-400"
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>

        {passwordStrength && (
          <p
            className={`text-sm font-semibold ${
              passwordStrength === "Strong"
                ? "text-green-400"
                : passwordStrength === "Medium"
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            Password strength: {passwordStrength}
          </p>
        )}

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm Password"
            onChange={handleChange}
            className="block w-full p-3 rounded bg-gray-800 border border-gray-700 text-gray-100 pr-10 focus:ring-2 focus:ring-blue-700 outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-gray-400"
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-blue-800 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
        >
          Sign Up
        </button>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-400 transition"
        >
          Sign Up with Google
        </button>

        <p className="text-center text-gray-400 text-sm">
          Already have an account?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-blue-700 cursor-pointer hover:underline"
          >
            Log in
          </span>
        </p>
      </form>
    </main>
  );
}
