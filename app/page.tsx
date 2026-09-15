// SPDX-License-Identifier: Apache-2.0
"use client"

import { ArrowRight, Eye, EyeOff } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useState } from "react"

import { AgentInterface } from "@/components/agent-interface"
import { DevExSection } from "@/components/devex-section"
import { HERO_REVEAL_MS, IntroAnimation } from "@/components/intro-animation"
import { LiveAgentCounter, LiveAgentFeed } from "@/components/live-agent-feed"
import { RevealText } from "@/components/reveal-text"
import { StackingAgentCards } from "@/components/stacking-agent-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CLAIM_TYPE_META, CLAIM_TYPES } from "@/lib/midnight/claim-types"

// The glitch backdrop is WebGL (@react-three/fiber + three) and loads two
// textures over the network. Import it client-side only: there is no WebGL
// context during Next's prerender pass, and pulling three into the server
// bundle costs a lot for something purely decorative.
const GlitchBackground = dynamic(
  () => import("@/components/glitch-background").then((m) => m.GlitchBackground),
  { ssr: false },
)

export default function Home() {
  // Gates the hero reveal on the intro curtain retracting, so the headline
  // animates in rather than being already-there behind it.
  const [introDone, setIntroDone] = useState(false)
  const [heroHovered, setHeroHovered] = useState(false)
  const onIntroDone = useCallback(() => setIntroDone(true), [])

  return (
    <main className="min-h-screen">
      <IntroAnimation onDone={onIntroDone} />

      {/* Hero ------------------------------------------------------------ */}
      <section
        className="relative mx-auto max-w-5xl px-6 pb-20 pt-24"
        onMouseEnter={() => setHeroHovered(true)}
        onMouseLeave={() => setHeroHovered(false)}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <GlitchBackground isHovered={heroHovered} />
        </div>

        <RevealText
          as="h1"
          delay={introDone ? 0 : HERO_REVEAL_MS}
          className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
        >
          Prove a medical fact. Reveal nothing else.
        </RevealText>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Health records force an all-or-nothing trade: to prove one fact, you hand
          over the whole document. Seath Aid replaces that with narrow,
          single-purpose zero-knowledge proofs built on Midnight.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Open patient dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/verify">Verifier view</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/issuer">Issuer console</Link>
          </Button>
        </div>
      </section>

      {/* Proof console --------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <AgentInterface revealDelay={200} />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Simulated verifier console. Every issuer, verifier, and medical value in
          this demo is synthetic.
        </p>
      </section>

      {/* The split ------------------------------------------------------- */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2 font-medium">
              <EyeOff className="h-4 w-4" />
              Private state — never on chain
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Vaccine codes, dose counts, completion dates</li>
              <li>Exact laboratory values and measurement dates</li>
              <li>Policy references, status, and expiry dates</li>
              <li>Credential nonces and Merkle authentication paths</li>
            </ul>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 font-medium">
              <Eye className="h-4 w-4" />
              Public state — the whole ledger
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Blinded credential commitments in a Merkle tree</li>
              <li>Revoked credential handles</li>
              <li>Spent proof nullifiers, preventing replay</li>
              <li>A pass/fail boolean per proof — and nothing more</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Claim types ----------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <RevealText as="h2" className="text-2xl font-semibold tracking-tight">
          Three claim types
        </RevealText>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Each is a separate circuit sharing one revocation registry and one
          nullifier scheme.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CLAIM_TYPES.map((id) => {
            const meta = CLAIM_TYPE_META[id]
            return (
              <Card key={id}>
                <CardHeader>
                  <CardTitle className="text-base">{meta.label}</CardTitle>
                  <CardDescription>{meta.provesWhat}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <div className="font-medium">Private inputs</div>
                    <p className="text-muted-foreground">
                      {meta.privateInputs.join(" · ")}
                    </p>
                  </div>
                  <div>
                    <div className="font-medium">Public inputs</div>
                    <p className="text-muted-foreground">
                      {meta.publicInputs.join(" · ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* How it works ---------------------------------------------------- */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <RevealText as="h2" className="text-2xl font-semibold tracking-tight">
            How it works
          </RevealText>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Four stages, one credential. Scroll to follow it from attestation to
            revocation.
          </p>
        </div>
        <StackingAgentCards />
      </section>

      {/* Live proofs ------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <RevealText as="h2" className="text-2xl font-semibold tracking-tight">
          Proofs, as they happen
        </RevealText>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every row is a verifier learning exactly one bit. The circuit that ran,
          and the answer it returned — never the record behind it.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <LiveAgentFeed />
          <div className="text-center md:text-right">
            <LiveAgentCounter />
            <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
              proofs verified
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground/70">
              simulated
            </div>
          </div>
        </div>
      </section>

      {/* Build on it ------------------------------------------------------ */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 pt-20">
          <RevealText as="h2" className="text-2xl font-semibold tracking-tight">
            Build on it
          </RevealText>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The real pipeline for this repository, start to finish.
          </p>
        </div>
        <DevExSection />
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">
        <p>
          Built on Midnight with Compact. All issuers in this demo are simulated
          and all medical data is synthetic. Midnight-related code is licensed
          Apache 2.0.
        </p>
      </footer>
    </main>
  )
}
