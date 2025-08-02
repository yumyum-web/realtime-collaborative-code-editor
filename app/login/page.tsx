'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify({ username: data.user?.username || 'User' }));
      router.push('/dashboard');
    } else {
      alert(data.error || 'Login failed');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md space-y-4 text-gray-800"
      >
        <h2 className="text-2xl font-semibold text-center text-purple-700">Log In</h2>

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

        <button
          type="submit"
          className="bg-purple-700 text-white p-2 rounded w-full hover:bg-purple-800 transition"
        >
          Log In
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don’t have an account?{' '}
          <span
            onClick={() => router.push('/signup')}
            className="text-purple-700 cursor-pointer hover:underline"
          >
            Create new account
          </span>
        </p>
      </form>
    </main>
  );
}
