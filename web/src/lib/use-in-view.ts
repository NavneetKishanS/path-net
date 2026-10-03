'use client'

import { useEffect, useRef, useState } from 'react'

/** True once the element has come within `margin` of the viewport. Stays true. */
export function useInView<T extends Element>(margin = '200px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [margin, seen])
  return [ref, seen] as const
}
