'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const checkPasswordStrength = (password: string) => {
    if (password.length > 9) return 'Strong';
    if (password.length > 5) return 'Medium';
    if (password.length > 0) return 'Weak';
    return '';
  };

  const passwordStrength = checkPasswordStrength(form.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return alert('Passwords do not match!');
    if (passwordStrength === 'Weak') return alert('Please choose a stronger password.');

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });

    const data = await res.json();
    if (res.ok) {
      alert('Signup successful! Please log in.');
      router.push('/login');
    } else {
      alert(data.error || 'Signup failed');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md space-y-4 text-gray-800"
      >
        <h2 className="text-2xl font-semibold text-center text-purple-700">Create New Account</h2>

        <input
          type="text"
          name="username"
          placeholder="Username"
          onChange={handleChange}
          className="block w-full p-2 border rounded"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="block w-full p-2 border rounded"
          required
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className="block w-full p-2 border rounded"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-gray-600"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        {passwordStrength && (
          <p
            className={`text-sm font-semibold ${
              passwordStrength === 'Strong'
                ? 'text-green-600'
                : passwordStrength === 'Medium'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            Password strength: {passwordStrength}
          </p>
        )}

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            placeholder="Confirm Password"
            onChange={handleChange}
            className="block w-full p-2 border rounded"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-gray-600"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <button
          type="submit"
          className="bg-purple-700 text-white p-2 rounded w-full hover:bg-purple-800 transition"
        >
          Sign Up
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <span
            onClick={() => router.push('/login')}
            className="text-purple-700 cursor-pointer hover:underline"
          >
            Log in
          </span>
        </p>
      </form>
    </main>
  );
}