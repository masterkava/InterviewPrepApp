import { useState } from 'react';

const STORAGE_KEY = 'session_user_id';

function generateUUID(): string {
  return crypto.randomUUID();
}

export function useSessionId(): string {
  const [userId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = generateUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  });
  return userId;
}
