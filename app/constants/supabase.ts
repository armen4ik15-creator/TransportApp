import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rltlfbjatccyxbwmtwny.supabase.co';
const supabaseAnonKey = 'sb_publishable_CxgESJwBsjM6hQQBAWrI7Q_adh35GuY'; // вставьте ваш ключ

export const supabase = createClient(supabaseUrl, supabaseAnonKey);