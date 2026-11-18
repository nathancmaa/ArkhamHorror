import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api';
import { getToken, setToken, clearToken } from '@/authToken';
import { localSignIn } from '@/localUser';
import {
  Credentials,
  Registration,
  Authentication,
  User,
} from '@/types';

export interface UserState {
  currentUser: User | null
  token: string | null
}

export const useUserStore = defineStore("user", () => {
  const currentUser = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isAdmin = ref(false)
  // set when the server rejected our token rather than the player signing out,
  // so the sign-in form can say why they are looking at it
  const sessionExpired = ref(false)

  async function authenticate(credentials: Credentials) {
    const authentication = await api.post<Authentication>('authenticate', credentials)
    token.value = authentication.data.token
    setCurrentUser()
  }

  async function register(registration: Registration) {
    const authentication = await api.post<Authentication>('register', registration)
    token.value = authentication.data.token
    setCurrentUser()
  }

  function logout() {
    clearToken()
    delete api.defaults.headers.common.Authorization
    signOut()
  }

  async function setCurrentUser() {
    if (token.value) {
      setToken(token.value);
      api.defaults.headers.common.Authorization = `Token ${token.value}`;
      try {
        const whoami = await api.get<User>('whoami')
        currentUser.value = whoami.data
        isAdmin.value = whoami.data.admin
      } catch (_err) {
        logout()
      }
    }
  }

  async function deleteAccount() {
    await api.delete('account')
    logout()
  }

  async function loadUserFromStorage() {
    if (currentUser.value) return
    const tokenFromStorage = getToken();
    if (tokenFromStorage !== null) {
      token.value = tokenFromStorage
      await setCurrentUser()
    }
    // Fork: no sign-in form. A missing or rejected token (setCurrentUser
    // clears a rejected one) is replaced by the shared account's.
    if (!currentUser.value) await signInLocally()
  }

  // one attempt shared by everything that asks at once (router guard, the 401
  // interceptor), so a first visit does not register the account twice
  let localSignInRun: Promise<void> | null = null
  function signInLocally(): Promise<void> {
    localSignInRun ??= (async () => {
      try {
        token.value = await localSignIn()
        await setCurrentUser()
      } catch (err) {
        console.error('Could not sign in to the shared local account', err)
      } finally {
        localSignInRun = null
      }
    })()
    return localSignInRun
  }

  function signOut() {
    currentUser.value = null
    token.value = null
  }

  return { token, currentUser, isAdmin, sessionExpired, loadUserFromStorage, authenticate, register, logout, deleteAccount, setCurrentUser }
})
