'use client';

import { useParams } from 'next/navigation';

export default function Editor() {
  const { id } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Project Editor</h1>
      <p className="mt-2">You're editing project: <strong>{id}</strong></p>
    </div>
  );
}
