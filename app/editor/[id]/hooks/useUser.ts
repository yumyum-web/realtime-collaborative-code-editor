import { useEffect, useState } from "react";
import type { User } from "../types";

export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser({
          email: parsed.email,
          username: parsed.username || parsed.email,
        });
      } catch {
        setUser({ email: "anonymous@local" });
      }
    } else {
      setUser({ email: "anonymous@local" });
    }
  }, []);

  return user;
}
