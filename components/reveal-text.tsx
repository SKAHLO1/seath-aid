"use client"

import { useEffect, useRef, useState } from "react"

// Splits text into words and reveals each with a staggered opacity+blur+rise.
//
// WHY THE DEFAULT STATE IS VISIBLE. This previously rendered every word at
// `opacity: 0` and relied on client JS to reveal it. That made the copy
// invisible until hydration finished — and permanently invisible if JS failed
// or was disabled. Text now renders normally in the server HTML, and the
// animation is applied on top as an enhancement.
//
// Two modes:
//   immediate  — animate from first paint, driven entirely by CSS. Used for
//                above-the-fold copy, where there is nothing to scroll to and a
//                JS-gated reveal is exactly the bug described above.
//   observed   — the default. Hidden only once JS has confirmed it can animate,
//                then revealed on scroll. Arming happens on mount, so any
//                element the reader can already see is never hidden by it.
export function RevealText({
  children,
  className = "",
  as: Tag = "h2",
  stagger = 80,       // ms between each word
  duration = 700,     // ms per word transition
  delay = 0,          // initial delay before first word
  threshold = 0.2,    // IntersectionObserver threshold
  immediate = false,  // animate on load instead of on scroll
}: {
  children: string
  className?: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
  stagger?: number
  duration?: number
  delay?: number
  threshold?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  // `armed` gates the hidden state: until JS has run we render plain, readable
  // text. `visible` says the animation should play.
  const [armed, setArmed] = useState(false)
  const [visible, setVisible] = useState(immediate)

  useEffect(() => {
    if (immediate) return
    const el = ref.current
    if (!el) return

    // Someone who asked for reduced motion gets the text, not the choreography.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    setArmed(true)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, immediate])

  // Split on spaces but preserve line breaks (rendered via <br />)
  const parts = children.split(/(\n)/g)
  const words: { word: string; index: number }[] = []
  let wordIndex = 0
  parts.forEach((part) => {
    if (part === "\n") {
      words.push({ word: "\n", index: wordIndex++ })
    } else {
      part.split(" ").forEach((w, i, arr) => {
        if (w) words.push({ word: i < arr.length - 1 ? w + " " : w, index: wordIndex++ })
      })
    }
  })

  return (
    // @ts-ignore — dynamic tag
    <Tag ref={ref} className={className} style={{ display: "block", overflow: "hidden" }}>
      {words.map(({ word, index }) => {
        if (word === "\n") return <br key={`br-${index}`} />

        const wordDelay = delay + index * stagger

        // `both` fill mode holds the from-state through the delay, so the word
        // is hidden while waiting and visible after — without JS touching it.
        const style: React.CSSProperties = visible
          ? {
              display: "inline-block",
              animation: `seath-reveal ${duration}ms cubic-bezier(0.16,1,0.3,1) ${wordDelay}ms both`,
            }
          : armed
            ? { display: "inline-block", opacity: 0 }
            : { display: "inline-block" }

        return (
          <span key={index} className="seath-reveal-word" style={style}>
            {word}
          </span>
        )
      })}
    </Tag>
  )
}
