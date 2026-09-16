"use client"

import { useEffect, useState } from "react"

// SEATH AID. Nine slots; the per-letter stagger and the curtain timing are all
// derived from LETTERS.length, so they stay in sync.
//
// The gap is a NON-BREAKING space. Each character renders in its own span, and
// a plain " " alone in a span is whitespace at the start and end of its line
// box, which collapses to zero width — the word break would vanish and the
// intro would read "SEATHAID".
const LETTERS = ["S", "E", "A", "T", "H", " ", "A", "I", "D"]

// Roughly half the original durations. The hero sits behind the curtain until
// it retracts, so every millisecond here is time the headline cannot be read.
const LETTER_IN_STAGGER  = 45
const LETTER_IN_DUR      = 400
const HOLD_DURATION      = 150
const LETTERS_IN_TOTAL   = LETTER_IN_STAGGER * (LETTERS.length - 1) + LETTER_IN_DUR + HOLD_DURATION

const LETTER_OUT_STAGGER = 30
const LETTER_OUT_DUR     = 300
const LETTERS_OUT_TOTAL  = LETTER_OUT_STAGGER * (LETTERS.length - 1) + LETTER_OUT_DUR

const CURTAIN_DELAY      = LETTERS_IN_TOTAL + 60
const CURTAIN_DURATION   = 700
const ANIM_TOTAL         = CURTAIN_DELAY + Math.max(CURTAIN_DURATION, LETTERS_OUT_TOTAL) + 200

/** Moment the curtain finishes retracting. */
export const INTRO_DURATION_MS = CURTAIN_DELAY + CURTAIN_DURATION
/** When hero copy should start animating — slightly before the curtain clears. */
export const HERO_REVEAL_MS = Math.max(0, INTRO_DURATION_MS - 250)

const SESSION_KEY = "seath-aid.introSeen"

/**
 * The opening curtain.
 *
 * EVERY ANIMATION HERE IS CSS, deliberately. This component renders during SSR,
 * and its curtain is an opaque full-screen layer: when the retraction was
 * driven by React state, the page stayed covered until hydration finished, and
 * stayed covered forever if JS never ran. CSS animations start at first paint
 * and finish on schedule regardless, so the content underneath is guaranteed to
 * be revealed. JS is now only used to unmount the finished layer and to skip
 * the intro entirely — neither of which can hide anything if it fails.
 */
export function IntroAnimation({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      // Private mode or blocked storage: just play it.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Seen this session, or motion is unwelcome: remove it and let the hero go.
    if (seen || reduced) {
      setGone(true)
      onDone?.()
      return
    }

    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      /* ignore */
    }

    const t1 = setTimeout(() => onDone?.(), HERO_REVEAL_MS)
    const t2 = setTimeout(() => setGone(true), ANIM_TOTAL)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])

  if (gone) return null

  return (
    <div className="seath-intro fixed inset-0 z-[100] pointer-events-none" aria-hidden="true">
      {/* Curtain — retracts upward, revealing the page beneath. */}
      <div
        className="seath-curtain absolute inset-0"
        style={{
          background: "#f5f4f1",
          animationDelay: `${CURTAIN_DELAY}ms`,
          animationDuration: `${CURTAIN_DURATION}ms`,
        }}
      />

      {/* SEATH AID letters */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex" style={{ gap: "0.06em" }}>
          {LETTERS.map((letter, i) => (
            <span
              key={i}
              className="font-sans font-bold text-[#111] leading-none select-none"
              style={{
                fontSize: `calc((100vw - 64px) / ${LETTERS.length})`,
                letterSpacing: "0.05em",
                willChange: "opacity, filter, transform",
                animation:
                  `seath-letter-in ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${i * LETTER_IN_STAGGER}ms both, ` +
                  `seath-letter-out ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${LETTERS_IN_TOTAL + i * LETTER_OUT_STAGGER}ms forwards`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
