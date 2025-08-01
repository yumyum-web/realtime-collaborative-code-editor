'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  username: string;
  projects: string[];
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/signup'); // redirect if no user found
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null; // or loading spinner

  return (
    <div className="min-h-screen bg-indigo-50">
      {/* Navbar */}
      <nav className="flex justify-between items-center bg-white shadow-md px-6 py-4">
        <div className="text-lg font-semibold text-gray-700">Hello, {user.username}</div>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-5 rounded transition"
        >
          Logout
        </button>
      </nav>

      {/* Projects Section */}
      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Signed Projects</h2>
        {user.projects.length === 0 ? (
          <p className="text-gray-600">No projects signed yet.</p>
        ) : (
          <ul className="space-y-3">
            {user.projects.map((project, idx) => (
              <li
                key={idx}
                onClick={() => router.push(`/editor/${project}`)}
                className="cursor-pointer rounded-lg bg-indigo-100 text-indigo-800 font-medium px-5 py-3 hover:bg-indigo-200 transition"
              >
                {project}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
