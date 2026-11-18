/* Fork: no sign-in. Every browser shares one account, created on first use.
 * These must match frontend/src/localUser.ts, which explains why the password
 * is not a secret. The two frontends share the token through the browser, so
 * this only runs when the third-edition site is opened before the main one.
 */
import { ApiError, authenticate, register } from '@/api'

export const LOCAL_USER = {
  username: 'Player',
  email: 'player@arkham.local',
  password: 'arkham-local-player',
} as const

export async function localSignIn(): Promise<string> {
  const credentials = { email: LOCAL_USER.email, password: LOCAL_USER.password }
  try {
    return (await authenticate(credentials)).token
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e
  }
  return (await register(LOCAL_USER)).token
}
