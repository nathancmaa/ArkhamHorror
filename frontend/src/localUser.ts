/* Fork: no sign-in. This fork runs on a home server for one household, so the
 * app signs every browser in to a single shared account instead of asking for
 * one. The account is created on first use with the credentials below.
 *
 * The password is not a secret: it is in the bundle every visitor downloads,
 * and anyone who can reach the server is signed in anyway. It exists only
 * because the backend's accounts need one. frontend-3ed/src/localUser.ts holds
 * the same values and must match, so both frontends land on the same account.
 */
import api from '@/api'
import type { Authentication } from '@/types'

export const LOCAL_USER = {
  username: 'Player',
  email: 'player@arkham.local',
  password: 'arkham-local-player',
} as const

/* Returns a token for the shared account, registering it if this is the first
 * visit. Throws if the email is taken by an account with another password (an
 * account made by hand before this change); the sign-in form is the fallback. */
export async function localSignIn(): Promise<string> {
  const credentials = { email: LOCAL_USER.email, password: LOCAL_USER.password }
  try {
    return (await api.post<Authentication>('authenticate', credentials)).data.token
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status !== 401) throw e
  }
  return (await api.post<Authentication>('register', LOCAL_USER)).data.token
}
