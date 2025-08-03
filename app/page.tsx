export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex flex-col items-center justify-center text-white px-6 text-center">
      <div className="max-w-3xl">
        <h1 className="text-5xl font-bold mb-6 animate-fade-in">
          Real-Time Collaborative Code Editor
        </h1>
        <p className="text-lg mb-8 animate-fade-in delay-150 leading-relaxed">
          Collaborate with your teammates in real time. Share code, run tests,
          and manage versions effortlessly. Our platform supports live sync,
          terminal output, unit testing, GitHub integration, and in-editor
          communication.
        </p>
        <div className="flex justify-center gap-6 animate-fade-in delay-300">
          <a href="/login">
            <button className="bg-white text-purple-700 font-semibold px-6 py-2 rounded-full hover:bg-purple-200 transition shadow-md">
              Login
            </button>
          </a>
          <a href="/signup">
            <button className="bg-transparent border-2 border-white px-6 py-2 rounded-full hover:bg-white hover:text-purple-700 transition shadow-md">
              Sign Up
            </button>
          </a>
        </div>
      </div>
    </main>
  );
}
