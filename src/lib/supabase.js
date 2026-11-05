import { createClient } from '@supabase/supabase-js';
import { LIVE, storeKey } from '../config';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Demo builds never talk to the server. EduNexa's tables live in their own "edunexa" schema.
export const supabase = LIVE && url && key
  ? createClient(url, key, {
      db: { schema: 'edunexa' },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: storeKey('edunexa-auth') },
    })
  : null;

/** Unwraps a Supabase response, turning errors into thrown Errors with a readable message. */
export function must({ data, error }) {
  if (error) throw new Error(friendly(error.message));
  return data;
}

export function friendly(msg = '') {
  if (/row-level security/i.test(msg)) return 'Your account is not allowed to change this';
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email/phone or password';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'No internet connection';
  return msg.replace(/^.*?exception: /i, '') || 'Something went wrong';
}
