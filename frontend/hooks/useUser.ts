import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

/**
 * Хук для получения текущего пользователя из Supabase Auth
 */
export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Получаем текущего пользователя
    const fetchUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Подписываемся на изменения состояния аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    userId: user?.id ?? null,
    loading,
    isAuthenticated: !!user,
  };
};

