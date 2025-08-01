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
      localStorage.setItem(
        'user',
        JSON.stringify({
          username: data.user?.username || 'User',
          projects: ['Project A', 'Project B'],
        })
      );
      router.push('/dashboard');
    } else {
      alert(data.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto mt-20 space-y-4">
      <h2 className="text-2xl font-semibold text-center">Log In</h2>

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
          className="absolute right-2 top-2 text-gray-600 hover:text-gray-900"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? '🙈' : '👁️'}
        </button>
      </div>

      <button type="submit" className="bg-blue-600 text-white p-2 rounded w-full hover:bg-blue-700 transition">
        Log In
      </button>

      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <span onClick={() => router.push('/signup')} className="text-blue-600 cursor-pointer hover:underline">
          Create new account
        </span>
      </p>
    </form>
  );
}
