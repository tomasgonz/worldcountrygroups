/** Visitors who came through a share link report each page they view, for the link's access log. */
export default defineNuxtPlugin(() => {
  const { state } = useAuth()
  const router = useRouter()
  let last = ''
  const send = (path: string) => {
    if (state.value.authenticated || !state.value.share || path === last) return
    last = path
    $fetch('/api/share-beacon', { method: 'POST', body: { path } }).catch(() => {})
  }
  router.afterEach(to => send(to.fullPath))
  onNuxtReady(() => send(router.currentRoute.value.fullPath))
})
