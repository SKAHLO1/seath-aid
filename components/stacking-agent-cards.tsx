"use client"

import { useEffect, useRef, useState } from "react"

// The four stages of a credential's life in VeriHealth.
//
// Stats are STRUCTURAL FACTS about the contract, not usage metrics: this is a
// demo with synthetic data, so invented numbers ("2.4M proofs served") would be
// a lie told in a very confident font. Every figure below is checkable against
// contracts/src/verihealth.compact.
const AGENTS: {
  label: string
  title: string
  desc: string
  stats: { v: string; l: string }[]
  img?: string
}[] = [
  {
    label: "ISSUE",
    title: "An issuer attests, and publishes nothing legible",
    desc: "A clinic, lab, or insurer signs a fact about you and publishes a blinded commitment to Midnight's public ledger. The record itself never leaves your device — what lands on chain is a hash, not a document.",
    stats: [{ v: "0", l: "bytes of PHI on chain" }, { v: "3", l: "claim types" }],
  },
  {
    label: "HOLD",
    title: "You keep the data. It is a witness, not a payload",
    desc: "The underlying record stays in your private state, encrypted in the browser. It is read only as a witness input to a zero-knowledge circuit — never transmitted, never handed to a verifier.",
    stats: [{ v: "local", l: "private state" }, { v: "0", l: "copies shared" }],
  },
  {
    label: "PROVE",
    title: "One boolean, and nothing else",
    desc: "A Compact circuit checks the issuer's attestation, the revocation registry, and the claim predicate together, then outputs a single pass/fail bit. A nullifier is spent so the same proof cannot be replayed.",
    stats: [{ v: "6", l: "ZK circuits" }, { v: "1 bit", l: "disclosed" }],
  },
  {
    label: "REVOKE",
    title: "Lapsed credentials fail inside the circuit",
    desc: "If a credential is withdrawn, the issuer adds its handle to an on-chain revocation registry. Every future proof checks that registry as part of the circuit, so revocation is enforced by the maths rather than by a policy someone remembered to apply.",
    stats: [{ v: "on-chain", l: "registry" }, { v: "per-proof", l: "checked" }],
  },
]

const STICKY_TOP   = 80   // matches top: 80px on first card
const STICKY_STEP  = 16   // each card stacks 16px lower
const SCALE_STEP   = 0.04 // scale reduction per card stacked on top
const OFFSET_STEP  = 8    // px pushed down per card stacked on top

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] tracking-widest font-sans text-black/40 bg-black/[0.04]">
      {children}
    </span>
  )
}

export function StackingAgentCards() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  // depth[i] = 0..N how many cards are currently stacked on top of card i
  const [depth, setDepth] = useState<number[]>(AGENTS.map(() => 0))

  useEffect(() => {
    function onScroll() {
      const nextDepth = AGENTS.map((_, i) => {
        // Count how many cards j > i are currently in sticky position (i.e. have scrolled past card i)
        let count = 0
        for (let j = i + 1; j < AGENTS.length; j++) {
          const el = cardRefs.current[j]
          if (!el) continue
          const rect = el.getBoundingClientRect()
          const stickyTopJ = STICKY_TOP + j * STICKY_STEP
          // Card j is "on top of" card i when it has reached its sticky position
          if (rect.top <= stickyTopJ + 2) count++
        }
        return count
      })
      setDepth(nextDepth)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="flex flex-col" style={{ perspective: "1400px", perspectiveOrigin: "50% 0%" }}>
      {AGENTS.map((agent, i) => {
        const d         = depth[i]
        const scale     = 1 - d * SCALE_STEP
        const translateY = d * OFFSET_STEP

        return (
          <div
            key={agent.label}
            ref={el => { cardRefs.current[i] = el }}
            className="sticky mb-4"
            style={{ top: `${STICKY_TOP + i * STICKY_STEP}px`, zIndex: 10 + i }}
          >
            <div
              style={{
                transform:      `scale(${scale}) translateY(${translateY}px)`,
                transformOrigin: "top center",
                transition:     "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                willChange:     "transform",
              }}
            >
              <div className="group relative bg-[#faf9f7] rounded-2xl border border-black/[0.07] overflow-hidden cursor-pointer">

                {/* ── MOBILE: image top, fades out at bottom ── */}
                {agent.img && (
                  <div className="relative w-full h-52 pointer-events-none md:hidden">
                    <img
                      src={agent.img}
                      alt={agent.label}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      style={{
                        maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                      }}
                    />
                  </div>
                )}

                {/* ── DESKTOP: image right, fades out at left (absolute) ── */}
                {agent.img && (
                  <div className="hidden md:block absolute inset-y-0 right-0 w-1/2 pointer-events-none">
                    <img
                      src={agent.img}
                      alt={agent.label}
                      className="w-full h-full object-cover object-center"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(to right, #faf9f7 0%, transparent 55%)",
                      }}
                    />
                  </div>
                )}

                {/* Text content */}
                <div
                  className="relative z-10 p-8"
                  style={{ maxWidth: agent.img ? undefined : "100%" }}
                  // On desktop limit to left 60% so text doesn't overlap image
                >
                  <div className="md:max-w-[60%]">
                    <div className="flex items-start justify-between mb-6">
                      <Tag>{agent.label}</Tag>
                    </div>
                    <h3 className="text-xl font-light mb-3">{agent.title}</h3>
                    <p className="text-sm text-black/45 leading-relaxed mb-8">{agent.desc}</p>
                  </div>
                  <div className="flex gap-8 pt-6 border-t border-black/[0.06]">
                    {agent.stats.map(s => (
                      <div key={s.l}>
                        <div className="text-2xl font-light">{s.v}</div>
                        <div className="text-[11px] text-black/35 tracking-widest mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
