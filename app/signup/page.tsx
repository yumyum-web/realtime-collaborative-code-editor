'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Password strength check (basic)
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
    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    if (passwordStrength === 'Weak' || passwordStrength === '') {
      alert('Please choose a stronger password.');
      return;
    }
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username,
        email: form.email,
        password: form.password,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      alert('Signup successful! Please log in.');
      router.push('/login'); // Redirect to login after signup
    } else {
      alert(data.error || 'Signup failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto mt-20 space-y-4">
      <h2 className="text-2xl font-semibold text-center">Create New Account</h2>

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
          className="absolute right-2 top-2 text-gray-600 hover:text-gray-900"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
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

      <input
        type={showPassword ? 'text' : 'password'}
        name="confirmPassword"
        placeholder="Confirm Password"
        onChange={handleChange}
        className="block w-full p-2 border rounded"
        required
      />

      <button type="submit" className="bg-blue-600 text-white p-2 rounded w-full hover:bg-blue-700 transition">
        Sign Up
      </button>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <span onClick={() => router.push('/login')} className="text-blue-600 cursor-pointer hover:underline">
          Log in
        </span>
      </p>
    </form>
  );
}
