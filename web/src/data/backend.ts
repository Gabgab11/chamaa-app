import type { AuthError, Dashboard, Profile, SignUpInput } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError };

/**
 * Everything the app needs from the server. The local backend keeps data on this device
 * until Supabase is connected; the Supabase backend implements the same contract.
 */
export interface Backend {
  readonly mode: 'local' | 'supabase';
  currentUser(): Promise<Profile | null>;
  signUp(input: SignUpInput): Promise<Result<{ email: string }>>;
  resendVerification(email: string): Promise<Result<null>>;
  logIn(email: string, password: string): Promise<Result<Profile>>;
  requestPasswordReset(email: string): Promise<Result<null>>;
  logOut(): Promise<void>;
  dashboard(userId: string): Promise<Dashboard>;
  markNoticesRead(userId: string): Promise<void>;
}
