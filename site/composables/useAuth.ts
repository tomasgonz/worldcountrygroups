interface AuthState {
  authenticated: boolean
  userId: string | null
  username: string | null
  displayName: string | null
  role: string | null
  status: string | null
  siteMode: 'public' | 'restricted'
  disabledPages: string[]
  loaded: boolean
}

export function useAuth() {
  const state = useState<AuthState>('auth', () => ({
    authenticated: false,
    userId: null,
    username: null,
    displayName: null,
    role: null,
    status: null,
    siteMode: 'restricted',
    disabledPages: [],
    loaded: false,
  }))

  async function fetchStatus() {
    try {
      const data = await $fetch<any>('/api/auth/status')
      state.value = {
        authenticated: data.authenticated,
        userId: data.userId || null,
        username: data.username || null,
        displayName: data.displayName || null,
        role: data.role || null,
        status: data.status || null,
        siteMode: data.siteMode || 'restricted',
        disabledPages: data.disabledPages || [],
        loaded: true,
      }
    } catch {
      state.value = {
        authenticated: false,
        userId: null,
        username: null,
        displayName: null,
        role: null,
        status: null,
        siteMode: 'restricted',
        disabledPages: [],
        loaded: true,
      }
    }
    return state.value
  }

  async function login(username: string, password: string) {
    const result = await $fetch<any>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    await fetchStatus()
    return result
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue even if request fails
    }
    state.value = {
      authenticated: false,
      userId: null,
      username: null,
      displayName: null,
      role: null,
      status: null,
      siteMode: state.value.siteMode,
      disabledPages: state.value.disabledPages,
      loaded: true,
    }
  }

  async function register(data: { username: string; password: string; displayName?: string; email?: string }) {
    return await $fetch<any>('/api/auth/register', {
      method: 'POST',
      body: data,
    })
  }

  return {
    state,
    fetchStatus,
    login,
    logout,
    register,
  }
}
