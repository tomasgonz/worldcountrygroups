export interface SectionDef {
  id: string
  label: string
}

export function useSectionNav(sections: SectionDef[]) {
  const activeSection = ref('')
  const visibleSections = ref<SectionDef[]>([])

  // Track which section ids exist in the DOM
  function updateVisibleSections() {
    visibleSections.value = sections.filter(s => document.getElementById(s.id))
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const headerOffset = 96 // 88px header + 8px padding
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  onMounted(() => {
    updateVisibleSections()

    // MutationObserver to detect v-if sections appearing/disappearing
    const mutationObs = new MutationObserver(() => {
      updateVisibleSections()
    })
    mutationObs.observe(document.body, { childList: true, subtree: true })

    // IntersectionObserver for scroll spy
    const observedEls = new Map<Element, string>()

    const intersectionObs = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topId = ''
        let topY = Infinity

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect
            if (rect.top < topY) {
              topY = rect.top
              topId = observedEls.get(entry.target) || ''
            }
          }
        }

        if (topId) {
          activeSection.value = topId
        } else {
          // If nothing is intersecting, find closest section above viewport
          let closestId = ''
          let closestDist = Infinity
          for (const [el, id] of observedEls) {
            const rect = el.getBoundingClientRect()
            // Section is above the detection zone
            if (rect.bottom < 0) {
              const dist = Math.abs(rect.bottom)
              if (dist < closestDist) {
                closestDist = dist
                closestId = id
              }
            }
          }
          if (closestId) {
            activeSection.value = closestId
          }
        }
      },
      {
        // Account for sticky header (~88px)
        rootMargin: '-88px 0px -40% 0px',
        threshold: 0,
      }
    )

    function observeSections() {
      // Disconnect all existing
      for (const el of observedEls.keys()) {
        intersectionObs.unobserve(el)
      }
      observedEls.clear()

      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el) {
          observedEls.set(el, s.id)
          intersectionObs.observe(el)
        }
      }

      // Set initial active section if none set
      if (!activeSection.value && visibleSections.value.length) {
        activeSection.value = visibleSections.value[0].id
      }
    }

    // Initial observe
    observeSections()

    // Re-observe when visible sections change
    watch(visibleSections, () => {
      observeSections()
    })

    onUnmounted(() => {
      mutationObs.disconnect()
      intersectionObs.disconnect()
    })
  })

  return {
    visibleSections,
    activeSection,
    scrollTo,
  }
}
