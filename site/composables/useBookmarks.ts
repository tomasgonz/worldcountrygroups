interface BookmarkState {
  bookmarkedCountries: string[]
  bookmarkedGroups: string[]
  loaded: boolean
}

export function useBookmarks() {
  const state = useState<BookmarkState>('bookmarks', () => ({
    bookmarkedCountries: [],
    bookmarkedGroups: [],
    loaded: false,
  }))

  async function fetchBookmarks() {
    try {
      const data = await $fetch<any>('/api/account/bookmarks')
      state.value = {
        bookmarkedCountries: data.bookmarkedCountries || [],
        bookmarkedGroups: data.bookmarkedGroups || [],
        loaded: true,
      }
    } catch {
      state.value = { bookmarkedCountries: [], bookmarkedGroups: [], loaded: true }
    }
  }

  async function toggleBookmark(type: 'country' | 'group', id: string) {
    try {
      const result = await $fetch<any>('/api/account/bookmarks', {
        method: 'POST',
        body: { type, id },
      })
      const key = type === 'country' ? 'bookmarkedCountries' : 'bookmarkedGroups'
      if (result.added) {
        if (!state.value[key].includes(id)) {
          state.value[key].push(id)
        }
      } else {
        state.value[key] = state.value[key].filter((x) => x !== id)
      }
      return result
    } catch (e: any) {
      throw e
    }
  }

  function isBookmarked(type: 'country' | 'group', id: string): boolean {
    const key = type === 'country' ? 'bookmarkedCountries' : 'bookmarkedGroups'
    return state.value[key].includes(id)
  }

  return {
    state,
    fetchBookmarks,
    toggleBookmark,
    isBookmarked,
  }
}
