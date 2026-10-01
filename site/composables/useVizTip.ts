/** Shared hover tooltip for the hand-built charts (one tooltip element per page). */
export interface TipLine { text: string; color?: string }

export function useVizTip() {
  const state = useState('viz-tip', () => ({ visible: false, x: 0, y: 0, title: '', lines: [] as TipLine[] }))
  function show(e: MouseEvent | FocusEvent, title: string, lines: TipLine[]) {
    let x = 0, y = 0
    if ('clientX' in e) { x = e.clientX; y = e.clientY } else {
      const r = (e.target as HTMLElement).getBoundingClientRect(); x = r.right; y = r.top
    }
    // keep inside the viewport
    if (typeof window !== 'undefined') x = Math.min(x, window.innerWidth - 300)
    state.value = { visible: true, x, y, title, lines }
  }
  function hide() { state.value = { ...state.value, visible: false } }
  return { state, show, hide }
}
