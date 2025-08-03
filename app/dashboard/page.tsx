'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

type DecodedToken = { userId: string; username: string; exp: number };

export default function Dashboard() {
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        return router.push('/login');
      }

      setUsername(decoded.username);
    } catch (err) {
      localStorage.removeItem('token');
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  if (!username) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200">
      <nav className="flex justify-between items-center bg-white shadow-md px-6 py-4">
        <div className="text-lg font-semibold text-gray-700">Hello, {username}</div>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-5 rounded transition"
        >
          Logout
        </button>
      </nav>

      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Accepted Projects</h2>
        <p className="text-gray-600">No projects accepted yet.</p>
      </main>
    </div>
  );
}
