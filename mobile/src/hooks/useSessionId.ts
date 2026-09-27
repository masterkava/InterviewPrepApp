import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'interview_user_id';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSessionId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem(SESSION_KEY);
        if (!id) {
          id = generateId();
          await AsyncStorage.setItem(SESSION_KEY, id);
        }
        setUserId(id);
      } catch {
        const id = generateId();
        setUserId(id);
      }
    })();
  }, []);

  return userId;
}
