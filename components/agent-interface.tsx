"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { GitPullRequest, GitMerge, MessageSquare, CheckCircle2, Clock, AlertCircle, Zap, GitCommit, Eye, Terminal } from "lucide-react"

// ── Data ─────────────────────────────────────────────────────────────────────

// A simulated verifier console. Everything here is synthetic — no real patient
// data, issuers, or verifiers exist in this demo.
//
// The +/- figures are the point of the whole product, so they are mapped
// literally: GREEN is what the verifier LEARNED (always 1 bit — a single
// pass/fail boolean), RED is how many private fields stayed on the holder's
// device. Every row is "+1" because a proof never discloses more than its
// answer, however much it had to read to get there.
const ALL_PRS = [
  { id: 145, title: "Vaccination complete as of today",        agent: "pharmacy-7f2a",  status: "verified", comments: 4, additions: 1, deletions: 4, branch: "proveVaccination",  time: "Just now" },
  { id: 144, title: "Lab value below clinical threshold",      agent: "clinic-2c8f",    status: "proving",  comments: 3, additions: 1, deletions: 4, branch: "proveLabThreshold", time: "1m ago" },
  { id: 143, title: "Coverage active on date of service",      agent: "insurer-9d4e",   status: "verified", comments: 3, additions: 1, deletions: 4, branch: "proveCoverage",     time: "1m ago" },
  { id: 142, title: "Vaccination — dose count met",            agent: "travel-5a3d",    status: "verified", comments: 4, additions: 1, deletions: 4, branch: "proveVaccination",  time: "2m ago" },
  { id: 141, title: "Credential found in revocation set",      agent: "employer-3b1c",  status: "revoked",  comments: 2, additions: 1, deletions: 4, branch: "proveCoverage",     time: "8m ago" },
  { id: 140, title: "Lab value above minimum threshold",       agent: "lab-4f2c",       status: "verified", comments: 3, additions: 1, deletions: 4, branch: "proveLabThreshold", time: "22m ago" },
  { id: 139, title: "Coverage check before admission",         agent: "hospital-8d1a",  status: "verified", comments: 3, additions: 1, deletions: 4, branch: "proveCoverage",     time: "1h ago" },
]

// Which private inputs the running circuit is reading. The percentage is
// constraint-satisfaction progress, not a disclosure level.
const ALL_REVIEW_FILES = [
  { file: "vaccinationRecord()", pct: 72 },
  { file: "credentialPath()",    pct: 45 },
  { file: "credentialNonce()",   pct: 88 },
  { file: "issuerSecretKey()",   pct: 31 },
  { file: "coveragePolicy()",    pct: 60 },
]

// The checks a circuit performs, interleaved with the constraints themselves.
const ALL_REVIEW_LINES: { type: "comment"|"approve"|"change"|"code"; text: string; author?: string }[] = [
  { type: "code",    text: 'assert(registeredIssuers.member(issuerPk))' },
  { type: "comment", text: "Issuer attestation verified", author: "circuit" },
  { type: "code",    text: 'const root = credentialTree.checkRoot(path)' },
  { type: "approve", text: "Merkle membership holds", author: "circuit" },
  { type: "code",    text: 'assert(!revocationRegistry.member(handle))' },
  { type: "change",  text: "Revocation registry consulted", author: "circuit" },
  { type: "code",    text: 'const n = persistentHash(nonce, verifier)' },
  { type: "approve", text: "Nullifier unspent — no replay", author: "circuit" },
  { type: "code",    text: 'assert(record.doses >= requiredDoses)' },
  { type: "comment", text: "Predicate evaluated privately", author: "circuit" },
  { type: "code",    text: 'return disclose(true)' },
  { type: "approve", text: "1 bit disclosed. Nothing else.", author: "circuit" },
]

// Ledger writes, not git commits.
const COMMITS = [
  { hash: "a3f8c21", msg: "nullifier spent — proof #145 recorded",  time: "Just now" },
  { hash: "b7d2e09", msg: "credential commitment added to tree",    time: "4m ago"   },
  { hash: "c9a1f34", msg: "issuer registered — pharmacy-7f2a",      time: "12m ago"  },
  { hash: "d4e6b78", msg: "credential handle revoked",              time: "31m ago"  },
  { hash: "e2c9d56", msg: "proofCount incremented → 3,847",         time: "1h ago"   },
]

// Activity graph data — 7 cols x 5 rows like GitHub contributions.
//
// DETERMINISTIC ON PURPOSE. This runs at module load, which happens once on the
// server during prerender and again in the browser. Math.random() therefore
// produced two different grids, and every cell's background colour mismatched
// during hydration — React discards the server HTML and re-renders when that
// happens. A fixed-seed generator gives the same varied-looking pattern on both
// sides. Anything random here must be generated after mount instead.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // Numerical Recipes LCG: same sequence everywhere, no dependencies.
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const activityRandom = seededRandom(20260916)

const ACTIVITY_SEED = Array.from({ length: 35 }, () => ({
  level: activityRandom() > 0.4 ? Math.floor(activityRandom() * 4) + 1 : 0,
}))

// ── Sub-components ────────────────────────────────────────────────────────────

// Smooth 60fps bar chart — canvas fills full container width
function MiniBarGraph({ seed }: { seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const barsRef   = useRef<number[]>([])

  useEffect(() => {
    const N = 20
    // Initialise bars with a seeded pattern
    barsRef.current = Array.from({ length: N }, (_, i) =>
      0.2 + 0.8 * Math.abs(Math.sin((i + seed) * 1.3))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)

      ctx.clearRect(0, 0, W, H)

      // Slowly drift each bar toward a new random target
      barsRef.current = barsRef.current.map((v, i) => {
        const target = 0.15 + 0.85 * Math.abs(Math.sin(Date.now() / 3000 + i * 0.8 + seed))
        return v + (target - v) * 0.012 // lerp — very smooth
      })

      const bars = barsRef.current
      const gap  = 2
      const bw   = (W - gap * (N - 1)) / N

      bars.forEach((v, i) => {
        const bh = v * H
        const x  = i * (bw + gap)
        const y  = H - bh
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, 2)
        ctx.fillStyle = `rgba(17,17,17,${0.12 + v * 0.65})`
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

// Smooth 60fps area sparkline — fills full width
function LiveSparkline({ seed }: { seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const ptsRef    = useRef<number[]>([])

  useEffect(() => {
    const N = 24
    ptsRef.current = Array.from({ length: N }, (_, i) =>
      0.1 + 0.7 * Math.abs(Math.sin(i * 0.6 + (seed ?? 0)))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, W, H)

      // Scroll left: drop first point, lerp last toward new target
      const last   = ptsRef.current[ptsRef.current.length - 1]
      const target = 0.1 + 0.85 * (0.5 + 0.5 * Math.sin(Date.now() / 2200 + (seed ?? 0)))
      ptsRef.current = [...ptsRef.current.slice(1), last + (target - last) * 0.04]

      const pts = ptsRef.current
      const step = W / (N - 1)

      // Area fill
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, "rgba(17,17,17,0.10)")
      grad.addColorStop(1, "rgba(17,17,17,0)")
      ctx.beginPath()
      ctx.moveTo(0, H)
      pts.forEach((v, i) => ctx.lineTo(i * step, H - v * H * 0.9))
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Line
      ctx.beginPath()
      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = "rgba(17,17,17,0.75)"
      ctx.lineWidth   = 1.5
      ctx.lineJoin    = "round"
      ctx.lineCap     = "round"
      ctx.stroke()

      // Dot at end
      const ex = W
      const ey = H - pts[pts.length - 1] * H * 0.9
      ctx.beginPath()
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(17,17,17,0.85)"
      ctx.fill()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

// Smooth 60fps dot/line graph — fills full width
function MiniDotGraph({ seed }: { seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const ptsRef    = useRef<number[]>([])

  useEffect(() => {
    const N = 18
    ptsRef.current = Array.from({ length: N }, (_, i) =>
      0.1 + 0.8 * Math.abs(Math.sin(i * 0.9 + (seed ?? 2)))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, W, H)

      const last   = ptsRef.current[ptsRef.current.length - 1]
      const target = 0.1 + 0.85 * (0.5 + 0.5 * Math.sin(Date.now() / 2800 + (seed ?? 2) * 1.5))
      ptsRef.current = [...ptsRef.current.slice(1), last + (target - last) * 0.03]

      const pts  = ptsRef.current
      const step = W / (N - 1)

      // Dashed connector line
      ctx.beginPath()
      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.88
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = "rgba(17,17,17,0.15)"
      ctx.lineWidth   = 1
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Dots
      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.88
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(17,17,17,${0.2 + v * 0.65})`
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    merged:   { bg: "rgba(130,80,255,0.1)",  color: "#8250df", icon: <GitMerge style={{ width: 9, height: 9 }} />,  label: "Merged"   },
    approved: { bg: "rgba(40,167,69,0.1)",   color: "#28a745", icon: <CheckCircle2 style={{ width: 9, height: 9 }} />, label: "Approved" },
    review:   { bg: "rgba(201,169,110,0.12)",color: "#b07d30", icon: <Eye style={{ width: 9, height: 9 }} />,       label: "In Review"},
  }[status] ?? { bg: "#eee", color: "#666", icon: null, label: status }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 8, padding: "2px 7px", borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase",
      fontWeight: 600,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function Bar({ pct, color = "rgba(0,0,0,0.75)" }: { pct: number; color?: string }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 600)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ height: 2, background: "rgba(0,0,0,0.07)", borderRadius: 99, width: "100%", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1.4s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  )
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let s: number | null = null
    const f = (ts: number) => {
      if (!s) s = ts
      const p = Math.min((ts - s) / 1100, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }, [to])
  return <>{val}{suffix}</>
}

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#28a745", opacity: 0.4, animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ borderRadius: "50%", width: "100%", height: "100%", background: "#28a745" }} />
    </span>
  )
}

// Activity heatmap cell
function HeatCell({ level, animDelay }: { level: number; animDelay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), animDelay); return () => clearTimeout(t) }, [animDelay])
  const colors = ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.32)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.8)"]
  return (
    <div style={{
      width: 9, height: 9, borderRadius: 2,
      background: colors[level],
      opacity: visible ? 1 : 0,
      transition: `opacity 0.4s ease`,
    }} />
  )
}

// Animated typing cursor in review
function ReviewLine({ item, delay }: { item: (typeof ALL_REVIEW_LINES)[0]; delay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])

  if (!visible) return null

  if (item.type === "code") {
    return (
      <div style={{ padding: "3px 10px", background: "rgba(0,0,0,0.04)", borderLeft: "2px solid rgba(0,0,0,0.08)", margin: "2px 0", animation: "logIn 0.2s ease forwards", opacity: 0 }}>
        <code style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,0,0,0.55)" }}>{item.text}</code>
      </div>
    )
  }
  const iconCfg = {
    approve: { icon: <CheckCircle2 style={{ width: 9, height: 9, color: "#28a745", flexShrink: 0 }} />, color: "#28a745" },
    change:  { icon: <AlertCircle  style={{ width: 9, height: 9, color: "#b07d30", flexShrink: 0 }} />, color: "#b07d30" },
    comment: { icon: <MessageSquare style={{ width: 9, height: 9, color: "rgba(0,0,0,0.35)", flexShrink: 0 }} />, color: "rgba(0,0,0,0.5)" },
  }[item.type] ?? { icon: null, color: "rgba(0,0,0,0.5)" }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", animation: "logIn 0.2s ease forwards", opacity: 0 }}>
      {iconCfg.icon}
      <div>
        <span style={{ fontSize: 9, color: iconCfg.color, fontFamily: "monospace" }}>{item.text}</span>
        {item.author && <span style={{ fontSize: 8, color: "rgba(0,0,0,0.3)", marginLeft: 5, fontFamily: "monospace" }}>— {item.author}</span>}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────



export function AgentInterface({ revealDelay = 0 }: { revealDelay?: number }) {
  const [revealed, setRevealed]       = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [reqCount, setReqCount]       = useState(1847)
  const [cursor, setCursor]           = useState(true)
  const [prOffset, setPrOffset]       = useState(0)
  const [reviewFileIdx, setReviewFileIdx] = useState(0)
  const [reviewFilePcts, setReviewFilePcts] = useState([72, 45, 88, 31, 60])
  const [reviewLineIdx, setReviewLineIdx]   = useState(0)
  const [activity, setActivity]       = useState(ACTIVITY_SEED)

  // Slide-up reveal synced to intro animation end
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), revealDelay)
    return () => clearTimeout(t)
  }, [revealDelay])

  // Internal content mounts 300ms after reveal starts (lets slide settle first)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), revealDelay + 300)
    return () => clearTimeout(t)
  }, [revealDelay])

  // Live tasks/min counter
  useEffect(() => {
    const t = setInterval(() => {
      setReqCount(v => v + Math.floor(Math.random() * 8 + 2))
    }, 1600)
    return () => clearInterval(t)
  }, [])



  // PR list auto-scroll: new PR arrives every 5s, list shifts
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => setPrOffset(v => (v + 1) % (ALL_PRS.length - 3)), 4000)
    return () => clearInterval(t)
  }, [mounted])

  // Code review: cycle through files and advance progress bars
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setReviewFilePcts(p => p.map((v, i) => {
        const delta = Math.random() * 4 - 1
        return Math.max(10, Math.min(99, v + (i === reviewFileIdx ? Math.abs(delta) + 1 : delta * 0.3)))
      }))
    }, 800)
    return () => clearInterval(t)
  }, [mounted, reviewFileIdx])

  // Cycle active file highlight every 3s
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => setReviewFileIdx(v => (v + 1) % ALL_REVIEW_FILES.length), 2800)
    return () => clearInterval(t)
  }, [mounted])

  // Review lines appear one by one, then reset and loop
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setReviewLineIdx(p => {
        if (p >= ALL_REVIEW_LINES.length) return 0
        return p + 1
      })
    }, 650)
    return () => clearInterval(t)
  }, [mounted])

  // Heatmap: occasional cell lights up
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setActivity(prev => {
        const next = [...prev]
        const idx = Math.floor(Math.random() * next.length)
        next[idx] = { level: Math.min(4, next[idx].level + 1) }
        return next
      })
    }, 700)
    return () => clearInterval(t)
  }, [mounted])

  // Cursor blink
  useEffect(() => { const t = setInterval(() => setCursor(c => !c), 530); return () => clearInterval(t) }, [])

  const anim = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  })

  const panel: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, overflow: "hidden" }
  const visiblePRs = ALL_PRS.slice(prOffset, prOffset + 4)

  return (
    <div
      // Normal document flow at every width. This previously carried
      // `md:absolute md:inset-0 md:pt-[220px] md:pb-[8%]`, from a design where
      // the console overlaid a hero. Here it is its own section, so from `md`
      // up it escaped that section (absolute against the nearest positioned
      // ancestor — the hero, which is `relative` for the glitch background),
      // left its own section zero-height, and covered the hero text.
      className="relative z-10 flex items-center justify-center pointer-events-none select-none px-3 md:px-8 w-full"
      style={{ paddingTop: "16px", paddingBottom: "16px" }}
    >
      <div style={{
        width: "100%", maxWidth: 900,
        background: "rgba(246,245,242,0.96)",
        border: "1px solid rgba(0,0,0,0.1)",
        backdropFilter: "blur(32px)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 28px 70px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.95) inset",
        // Slide up from bottom when revealed
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(72px)",
        transition: "opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* Titlebar */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "9px 14px",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          background: "rgba(255,255,255,0.65)",
          position: "relative",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#ff5f56","#ffbd2e","#27c93f"].map(c => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />
            ))}
          </div>
          <span style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            fontSize: 10, letterSpacing: "0.18em", color: "rgba(0,0,0,0.28)", fontFamily: "monospace",
          }}>agentic / platform — main</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <LiveDot />
            <span style={{ fontSize: 8, color: "rgba(40,167,69,0.8)", letterSpacing: "0.16em", fontFamily: "monospace" }}>PROOF SERVER ONLINE</span>
          </div>
        </div>

        {/* Metrics strip — fixed height */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(251,250,247,0.9)" }}>
          {[
            { label: "PRs Merged today",  val: 18,       icon: <GitMerge style={{ width: 11, height: 11 }} />,   graph: <MiniBarGraph seed={0} /> },
            { label: "Reviews completed", val: 34,       icon: <Eye style={{ width: 11, height: 11 }} />,         graph: <MiniBarGraph seed={5} /> },
            { label: "Agent commits",     val: 127,      icon: <GitCommit style={{ width: 11, height: 11 }} />,   graph: <MiniDotGraph seed={2} /> },
            { label: "Tasks / min",       val: reqCount, icon: <Zap style={{ width: 11, height: 11 }} />,         graph: <LiveSparkline seed={7} /> },
          ].map((m, i) => (
            <div key={i} style={{ padding: "9px 12px", height: 82, overflow: "hidden", borderRight: i < 3 ? "1px solid rgba(0,0,0,0.06)" : "none", ...anim(60 + i * 45) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span style={{ color: "rgba(0,0,0,0.32)" }}>{m.icon}</span>
                <span style={{ fontSize: 7.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.32)", fontFamily: "monospace" }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111", lineHeight: 1, marginBottom: 5, fontFamily: "monospace" }}>
                {mounted ? <Counter to={m.val} /> : "—"}
              </div>
              {mounted && m.graph}
            </div>
          ))}
        </div>

        {/* Main 3-col body — fixed height container */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.85fr", gap: 8, padding: 8, height: 340, overflow: "hidden" }}>

          {/* Col 1 — PR list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, height: "100%", overflow: "hidden", ...anim(160) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <GitPullRequest style={{ width: 10, height: 10, color: "rgba(0,0,0,0.38)" }} />
                <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", fontFamily: "monospace" }}>Proof Requests</span>
              </div>
              <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.25)", fontFamily: "monospace" }}>{ALL_PRS.filter(p => p.status === "review").length} OPEN</span>
            </div>

            {/* Fixed-height PR container — clips overflow, no layout shift */}
            <div style={{ position: "relative", overflow: "hidden", flex: 1 }}>
              {visiblePRs.map((pr, i) => (
                <div key={`${pr.id}-${prOffset}`} style={{
                  ...panel,
                  padding: "8px 10px",
                  marginBottom: 5,
                  animation: i === 0 ? "prSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 5, marginBottom: 5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#111", lineHeight: 1.3, marginBottom: 2 }}>{pr.title}</div>
                      <div style={{ fontSize: 7.5, fontFamily: "monospace", color: "rgba(0,0,0,0.32)" }}>{pr.branch} · {pr.agent}</div>
                    </div>
                    <StatusBadge status={pr.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 7 }}>
                      <span style={{ fontSize: 7.5, color: "#28a745", fontFamily: "monospace" }}>+{pr.additions}</span>
                      <span style={{ fontSize: 7.5, color: "#d73a49", fontFamily: "monospace" }}>-{pr.deletions}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <MessageSquare style={{ width: 7, height: 7, color: "rgba(0,0,0,0.28)" }} />
                        <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.28)" }}>{pr.comments}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock style={{ width: 7, height: 7, color: "rgba(0,0,0,0.22)" }} />
                      <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.28)", fontFamily: "monospace" }}>{pr.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap — fixed height, no layout shift */}
            <div style={{ ...panel, padding: "8px 10px", flexShrink: 0, height: 76, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <Terminal style={{ width: 9, height: 9, color: "rgba(0,0,0,0.33)" }} />
                <span style={{ fontSize: 7.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(0,0,0,0.33)", fontFamily: "monospace" }}>Proof Activity</span>
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap", maxWidth: 210, height: 30, overflow: "hidden" }}>
                {activity.map((a, i) => <HeatCell key={i} level={a.level} animDelay={i * 18 + 300} />)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                <span style={{ fontSize: 7, color: "rgba(0,0,0,0.26)", fontFamily: "monospace" }}>Less</span>
                {[0,1,2,3,4].map(l => (
                  <div key={l} style={{ width: 7, height: 7, borderRadius: 1.5, background: ["rgba(0,0,0,0.05)","rgba(0,0,0,0.15)","rgba(0,0,0,0.32)","rgba(0,0,0,0.55)","rgba(0,0,0,0.8)"][l] }} />
                ))}
                <span style={{ fontSize: 7, color: "rgba(0,0,0,0.26)", fontFamily: "monospace" }}>More</span>
              </div>
            </div>
          </div>

          {/* Col 2 — Code Review — fixed height */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, height: "100%", overflow: "hidden", ...anim(210) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 2px", flexShrink: 0 }}>
              <Eye style={{ width: 10, height: 10, color: "rgba(0,0,0,0.38)" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", fontFamily: "monospace" }}>Code Review — #{ALL_PRS[reviewFileIdx % ALL_PRS.length].id}</span>
            </div>
            <div style={{ ...panel, flex: 1, padding: "9px 10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Header — fixed */}
              <div style={{ marginBottom: 7, paddingBottom: 7, borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#111", marginBottom: 2 }}>feat: parallel tool execution</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontSize: 7.5, color: "#28a745", fontFamily: "monospace" }}>+142</span>
                  <span style={{ fontSize: 7.5, color: "#d73a49", fontFamily: "monospace" }}>-27</span>
                  <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.28)" }}>5 files</span>
                </div>
              </div>

              {/* Progress bars — fixed height */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 9, flexShrink: 0 }}>
                {ALL_REVIEW_FILES.map((f, i) => (
                  <div key={f.file} style={{ opacity: i === reviewFileIdx ? 1 : 0.55, transition: "opacity 0.4s ease" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontFamily: "monospace", color: i === reviewFileIdx ? "#111" : "rgba(0,0,0,0.42)", transition: "color 0.4s ease" }}>{f.file}</span>
                      <span style={{ fontSize: 7.5, fontFamily: "monospace", color: reviewFilePcts[i] > 70 ? "#28a745" : "#d73a49", transition: "color 0.4s ease", fontWeight: i === reviewFileIdx ? 700 : 400 }}>{Math.round(reviewFilePcts[i])}%</span>
                    </div>
                    <Bar pct={reviewFilePcts[i]} color={i === reviewFileIdx ? "#111" : "rgba(0,0,0,0.3)"} />
                  </div>
                ))}
              </div>

              {/* Review comments — fixed height, clips overflow, no scroll */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 7, flex: 1, overflow: "hidden" }}>
                {ALL_REVIEW_LINES.slice(0, reviewLineIdx).slice(-5).map((item, i) => (
                  <ReviewLine key={`${reviewLineIdx}-${i}`} item={item} delay={0} />
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <Terminal style={{ width: 7, height: 7, color: "rgba(0,0,0,0.18)" }} />
                  <span style={{ display: "inline-block", width: 4, height: 9, background: cursor ? "rgba(0,0,0,0.38)" : "transparent", transition: "background 0.08s" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Col 3 — Commits + CI — fixed height */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, height: "100%", overflow: "hidden", ...anim(260) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 2px", flexShrink: 0 }}>
              <GitCommit style={{ width: 10, height: 10, color: "rgba(0,0,0,0.38)" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", fontFamily: "monospace" }}>Ledger Writes</span>
            </div>
            <div style={{ ...panel, flexShrink: 0, overflow: "hidden" }}>
              {COMMITS.slice(0, 4).map((c, i) => (
                <div key={c.hash} style={{
                  padding: "7px 10px",
                  borderBottom: i < 3 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  animation: mounted ? `fadeSlide 0.3s ease ${280 + i * 55}ms both` : "none",
                }}>
                  <div style={{ fontSize: 8.5, fontWeight: 500, color: "#111", lineHeight: 1.35, marginBottom: 2 }}>{c.msg}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 7.5, fontFamily: "monospace", color: "#8250df" }}>{c.hash}</span>
                    <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.28)", fontFamily: "monospace" }}>{c.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 2px 0", flexShrink: 0 }}>
              <Zap style={{ width: 10, height: 10, color: "rgba(0,0,0,0.38)" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", fontFamily: "monospace" }}>Circuits</span>
            </div>
            <div style={{ ...panel, flexShrink: 0, overflow: "hidden" }}>
              {[
                { name: "researcher-agent", status: "passing", duration: "1m 32s" },
                { name: "analyst-agent",    status: "running", duration: "0m 48s" },
                { name: "executor-agent",   status: "passing", duration: "2m 11s" },
                { name: "monitor-agent",    status: "running", duration: "0m 54s" },
              ].map((a, i) => (
                <div key={a.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: i < 3 ? "1px solid rgba(0,0,0,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {a.status === "running"
                      ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,0.5)", borderTopColor: "transparent", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
                      : <CheckCircle2 style={{ width: 8, height: 8, color: "#28a745", flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 8.5, fontFamily: "monospace", color: "#111" }}>{a.name}</span>
                  </div>
                  <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.28)", fontFamily: "monospace" }}>{a.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes logIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes prSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
