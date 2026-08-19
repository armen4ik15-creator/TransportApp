import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

type SupabaseAuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const isWeb = Platform.OS === 'web';
const isBrowserWithWindow = isWeb && typeof window !== 'undefined';

const noopStorage: SupabaseAuthStorage = {
  async getItem() {
    return null;
  },
  async setItem() {},
  async removeItem() {},
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? (isBrowserWithWindow ? AsyncStorage : noopStorage) : AsyncStorage,
    autoRefreshToken: isWeb ? isBrowserWithWindow : true,
    persistSession: isWeb ? isBrowserWithWindow : true,
    detectSessionInUrl: false,
  },
});
