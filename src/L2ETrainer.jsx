import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, ChevronDown, ChevronUp, Pencil, RotateCcw, BarChart3, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Case data — transcribed from CubeSkills "5x5 L2E Algorithms (Last Two Edges)"
// ---------------------------------------------------------------------------
const CASES = [
  { id: "NP1", cat: "np", label: "No Parity 1", alg: "Rw' U' R' U (R' F R F') Rw", alt: "[z' y'] Uw' (R U R' F R' F' R) Uw" },
  { id: "NP2", cat: "np", label: "No Parity 2", alg: "3Lw U' R' U (R' F R F') Rw'", alt: "[z' y'] 3Dw (R U R' F R' F' R) Uw'" },
  { id: "NP3", cat: "np", label: "No Parity 3", alg: "Rw2' F2 U2' Rw2' U2' F2 Rw2", alt: null },
  { id: "NP4", cat: "np", label: "No Parity 4", alg: "Rw' Lw U' R' U (R' F R F') Rw Lw'", alt: "[z' y'] Uw' Dw (R U R' F R' F' R) Uw Dw'" },
  { id: "P1", cat: "p", label: "Parity 1", alg: "Rw U2 x Rw U2 Rw U2' Rw' U2 Lw U2 3Rw' U2' Rw U2 Rw' U2' Rw'", alt: null },
  { id: "P2", cat: "p", label: "Parity 2", alg: "Rw U2 Rw U2' x U2 Rw U2' 3Rw' U2 Lw U2' Rw2", alt: null },
  { id: "P3", cat: "p", label: "Parity 3", alg: "F2 Rw U2 Rw U2' Rw' F2 Rw' U2 Rw' U2' Rw U2 Rw' U2' Rw2", alt: null },
  { id: "P4", cat: "p", label: "Parity 4", alg: "B2 Rw' U2 Rw' U2' Rw B2 Rw U2 Rw U2' Rw' U2 Rw U2' Rw2", alt: null },
  { id: "P5", cat: "p", label: "Parity 5", alg: "Rw U2 Rw2 U2' Rw' U2 Rw U2' Rw' U2 Rw2 U2' Rw", alt: null },
  { id: "P6", cat: "p", label: "Parity 6", alg: "Rw' U2' Rw2 U2' Rw U2' Rw' U2 Rw U2' Rw2 U2' Rw'", alt: null },
  { id: "P7", cat: "p", label: "Parity 7", alg: "Rw' U2 Rw U2' 3Lw' U2 Rw U2 Rw U2' Rw' U2 Rw U2' Rw2", alt: null },
  { id: "P8", cat: "p", label: "Parity 8", alg: "Rw2 B2 Rw' U2 Rw' U2' x' U2 Rw' U2' Rw U2 Rw' U2' Rw2", alt: null },
];

// ---------------------------------------------------------------------------
// Move inversion — reverses a move sequence and inverts each token so it can
// be used as a "scramble" that sets up the case (standard trainer technique).
// ---------------------------------------------------------------------------
function tokenize(alg) {
  return alg
    .replace(/[()[\]]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function parseToken(tok) {
  const m = tok.match(/^(\d*)([A-Za-z]+)(2'?|'|)$/);
  if (!m) return null;
  const [, prefix, face, suffix] = m;
  return { prefix, face, suffix };
}

function invertSuffix(suffix) {
  if (suffix === "") return "'";
  if (suffix === "'") return "";
  return "2";
}

function invertToken(tok) {
  const p = parseToken(tok);
  if (!p) return tok;
  return `${p.prefix}${p.face}${invertSuffix(p.suffix)}`;
}

function invertTokens(tokens) {
  return tokens.slice().reverse().map(invertToken);
}

function randomSuffix() {
  const opts = ["", "'", "2"];
  return opts[Math.floor(Math.random() * opts.length)];
}

// Return a non-obvious identity. Opposite outer faces commute, so
// A B A' B' is exactly identity even though the inverse moves are separated.
// Keeping the four moves together means the block remains identity wherever
// it is inserted; no assumption about the surrounding algorithm is required.
function commutingIdentity() {
  const oppositePairs = [["U", "D"], ["L", "R"], ["F", "B"]];
  const [a, b] = oppositePairs[Math.floor(Math.random() * oppositePairs.length)];
  const aMove = `${a}${randomSuffix()}`;
  const bMove = `${b}${randomSuffix()}`;
  return [aMove, bMove, invertToken(aMove), invertToken(bMove)];
}

// Build the exact inverse setup, then insert 1-2 independently neutral
// identity blocks. This obscures the reverse algorithm without changing the
// final cube state produced by the setup.
function buildScramble(alg) {
  const solveTokens = tokenize(alg);
  const result = invertTokens(solveTokens);
  const blockCount = 1 + Math.floor(Math.random() * 2);

  for (let i = 0; i < blockCount; i += 1) {
    const position = Math.floor(Math.random() * (result.length + 1));
    result.splice(position, 0, ...commutingIdentity());
  }

  return result.join(" ");
}

function formatTime(ms) {
  const totalCs = Math.floor(ms / 10);
  const min = Math.floor(totalCs / 6000);
  const sec = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  if (min > 0) {
    return `${min}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }
  return `${sec}.${String(cs).padStart(2, "0")}`;
}

function pickCase(pool, avoidId) {
  const options = pool.length > 1 ? pool.filter((c) => c.id !== avoidId) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

const STORAGE_KEY = "l2e_history_v1";
const FILTER_KEY = "l2e_filter_v1";

// ---------------------------------------------------------------------------
// Three-tier responsive layout. Inline styles can't use @media queries, so
// layout switching is driven by matchMedia + state instead.
//
//   mobile  : < 730px    — phone-style single column, stats in a bottom sheet
//   tablet  : 730-1023px — wider single column, stats in a right slide-in panel
//   desktop : >= 1024px  — trainer + permanently visible stats side-by-side
//
// 730px (not a "rounder" 768px) is deliberate: the current-generation iPad
// mini's CSS viewport width in portrait is 744px, which needs to clear the
// tablet threshold. 730px leaves comfortable margin above every phone's
// portrait width (even the largest phones top out well under 500px
// portrait) while safely including the iPad mini. Re-check this number
// against real device widths before changing it.
//
// This lands current iPads in portrait in the tablet layout and iPads in
// landscape in either the tablet or desktop layout, depending on width.
// ---------------------------------------------------------------------------
const TABLET_QUERY = "(min-width: 730px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function useLayoutMode() {
  const getMode = () => {
    if (typeof window === "undefined") return "mobile";
    if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
    if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
    return "mobile";
  };

  const [mode, setMode] = useState(getMode);

  useEffect(() => {
    const tabletMq = window.matchMedia(TABLET_QUERY);
    const desktopMq = window.matchMedia(DESKTOP_QUERY);
    const handler = () => setMode(getMode());
    tabletMq.addEventListener("change", handler);
    desktopMq.addEventListener("change", handler);
    return () => {
      tabletMq.removeEventListener("change", handler);
      desktopMq.removeEventListener("change", handler);
    };
  }, []);

  return mode;
}

export default function L2ETrainer() {
  const layout = useLayoutMode();
  const isMobile = layout === "mobile";
  const isTablet = layout === "tablet";
  const isDesktop = layout === "desktop";
  // Mobile and tablet both render the trainer as a single column; only
  // desktop splits into two grid columns.
  const wide = isTablet || isDesktop;

  const [filter, setFilter] = useState("all");
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(() => pickCase(CASES));
  const [scramble, setScramble] = useState(() => buildScramble(current.alg));
  const [showAlg, setShowAlg] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | running | stopped
  const [elapsed, setElapsed] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // A drawer opened in one layout should not unexpectedly reappear after the
  // viewport crosses into another layout mode.
  useEffect(() => setStatsOpen(false), [layout]);

  const startRef = useRef(0);
  const rafRef = useRef(null);
  const spaceHeldRef = useRef(false);

  // load persisted state
  useEffect(() => {
    try {
      const savedHistory = window.localStorage.getItem(STORAGE_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      /* localStorage may be unavailable or contain invalid data */
    }
    try {
      const savedFilter = window.localStorage.getItem(FILTER_KEY);
      if (["all", "np", "p"].includes(savedFilter)) setFilter(savedFilter);
    } catch (e) {
      /* localStorage may be unavailable */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const pool = filter === "all" ? CASES : CASES.filter((c) => c.cat === filter);
    const next = pickCase(pool);
    setCurrent(next);
    setScramble(buildScramble(next.alg));
    try {
      window.localStorage.setItem(FILTER_KEY, filter);
    } catch (e) {
      /* best effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, loaded]);

  const persistHistory = useCallback((next) => {
    setHistory(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      /* best effort */
    }
  }, []);

  const tick = useCallback(() => {
    setElapsed(Date.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTimer = useCallback(() => {
    setShowAlg(false);
    startRef.current = Date.now();
    setElapsed(0);
    setPhase("running");
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopTimer = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setElapsed(Date.now() - startRef.current);
    setPhase("stopped");
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      spaceHeldRef.current = false;
      return undefined;
    }

    const isInteractiveTarget = (target) =>
      target instanceof Element &&
      Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));

    const handleKeyDown = (event) => {
      if (event.code !== "Space" || event.repeat || isInteractiveTarget(event.target)) return;
      event.preventDefault();
      spaceHeldRef.current = true;
    };

    const handleKeyUp = (event) => {
      if (event.code !== "Space" || !spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();

      if (phase === "idle") startTimer();
      else if (phase === "running") stopTimer();
    };

    const clearHeldSpace = () => {
      spaceHeldRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearHeldSpace);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearHeldSpace);
      spaceHeldRef.current = false;
    };
  }, [isDesktop, phase, startTimer, stopTimer]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const logResult = (ms) => {
    const entry = { id: current.id, cat: current.cat, ms, t: Date.now() };
    persistHistory([...history, entry]);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  };

  const nextCase = () => {
    const pool = filter === "all" ? CASES : CASES.filter((c) => c.cat === filter);
    const next = pickCase(pool, current.id);
    setCurrent(next);
    setScramble(buildScramble(next.alg));
    setPhase("idle");
    setElapsed(0);
    setShowAlg(false);
    setManualOpen(false);
    setManualVal("");
  };

  const saveAndNext = () => {
    logResult(elapsed);
    nextCase();
  };

  const discard = () => {
    setPhase("idle");
    setElapsed(0);
  };

  const submitManual = () => {
    const val = parseFloat(manualVal);
    if (!isNaN(val) && val > 0) {
      logResult(Math.round(val * 1000));
      nextCase();
    }
  };

  const clearHistory = () => {
    persistHistory([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  const sessionCount = history.length;
  const sessionAvg = sessionCount ? history.reduce((a, b) => a + b.ms, 0) / sessionCount : 0;
  const sessionBest = sessionCount ? Math.min(...history.map((h) => h.ms)) : 0;

  const perCase = CASES.map((c) => {
    const runs = history.filter((h) => h.id === c.id);
    const avg = runs.length ? runs.reduce((a, b) => a + b.ms, 0) / runs.length : null;
    const best = runs.length ? Math.min(...runs.map((r) => r.ms)) : null;
    return { ...c, count: runs.length, avg, best };
  });

  // Shared stats content — rendered inside whichever container the current
  // layout uses (desktop panel, tablet slide-in, or mobile bottom sheet).
  const statsBody = (
    <>
      <div style={{ marginTop: 14 }}>
        {perCase.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid #1F2230",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: "#7A7F94" }}>
                {c.count} solve{c.count === 1 ? "" : "s"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  color: c.avg ? "#EDEFF4" : "#4A4F60",
                }}
              >
                {c.avg ? formatTime(c.avg) : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#7A7F94" }}>
                best {c.best ? formatTime(c.best) : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <button
          onClick={clearHistory}
          style={{
            marginTop: 18,
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: "1px solid #3A2A2E",
            background: "rgba(255,107,107,0.08)",
            color: "#FF6B6B",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Clear all history
        </button>
      )}
    </>
  );

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#101218",
        color: "#EDEFF4",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        display: isDesktop ? "grid" : "flex",
        flexDirection: isDesktop ? undefined : "column",
        gridTemplateColumns: isDesktop ? "480px minmax(320px, 420px)" : undefined,
        justifyContent: isDesktop ? "center" : undefined,
        gap: isDesktop ? 28 : 0,
        alignItems: isDesktop ? "start" : undefined,
        // 1024 leaves enough content width for the 480px trainer, 420px stats
        // panel, 28px gap, and 48px of desktop padding without overflow.
        maxWidth: isDesktop ? 1024 : isTablet ? 640 : 480,
        margin: "0 auto",
        position: "relative",
        paddingTop: isDesktop ? 40 : isTablet ? 32 : 0,
        paddingRight: isDesktop ? 24 : isTablet ? 32 : 0,
        paddingBottom: isDesktop ? 40 : isTablet ? 40 : 24,
        paddingLeft: isDesktop ? 24 : isTablet ? 32 : 0,
      }}
    >
      {/* Left column: the trainer itself */}
      <div>
        {/* Header */}
        <div style={{ padding: wide ? "0 0 14px" : "22px 20px 14px" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "#7A7F94",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            5×5 · Last Two Edges
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2 }}>
              L2E Trainer
            </div>
            {/* Desktop shows stats permanently, so the toggle button only
                makes sense on mobile (bottom sheet) and tablet (slide-in). */}
            {!isDesktop && (
              <button
                onClick={() => setStatsOpen(true)}
                aria-label="Open statistics"
                style={{
                  background: "#1B1E28",
                  border: "1px solid #2A2E3C",
                  borderRadius: 12,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C4C8D6",
                }}
              >
                <BarChart3 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, padding: wide ? "0 0 16px" : "0 20px 16px" }}>
          {[
            { k: "all", label: "All 12" },
            { k: "np", label: "No Parity" },
            { k: "p", label: "Parity" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              disabled={phase !== "idle"}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 10,
                border: "1px solid " + (filter === f.k ? "#4FD98B" : "#262A36"),
                background: filter === f.k ? "rgba(79,217,139,0.12)" : "transparent",
                color: filter === f.k ? "#4FD98B" : "#8A8FA3",
                fontSize: 13,
                fontWeight: 600,
                opacity: phase !== "idle" ? 0.5 : 1,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Case card */}
        <div style={{ padding: wide ? 0 : "0 20px" }}>
          <div
            style={{
              background: "#1B1E28",
              border: "1px solid #262A36",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  padding: "4px 9px",
                  borderRadius: 999,
                  background: current.cat === "p" ? "rgba(255,107,107,0.14)" : "rgba(79,217,139,0.14)",
                  color: current.cat === "p" ? "#FF6B6B" : "#4FD98B",
                }}
              >
                {current.cat === "p" ? "PARITY" : "NO PARITY"}
              </span>
              <span style={{ fontSize: 13, color: "#7A7F94", fontWeight: 600 }}>{current.label}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#7A7F94", fontWeight: 600, marginBottom: 4 }}>
                SCRAMBLE (SET-UP)
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "#EDEFF4",
                  wordBreak: "break-word",
                }}
              >
                {scramble}
              </div>
            </div>

            <button
              onClick={() => setShowAlg((s) => !s)}
              style={{
                marginTop: 12,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "transparent",
                border: "1px dashed #33384A",
                borderRadius: 10,
                padding: "8px 0",
                color: "#8A8FA3",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showAlg ? "Hide algorithm" : "Reveal algorithm"}
              {showAlg ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAlg && (
              <div style={{ marginTop: 10, borderTop: "1px solid #262A36", paddingTop: 10 }}>
                <div
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 14,
                    color: "#4FD98B",
                    lineHeight: 1.5,
                  }}
                >
                  {current.alg}
                </div>
                {current.alt && (
                  <div
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12.5,
                      color: "#7A7F94",
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {current.alt}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Timer */}
        <div style={{ padding: wide ? "22px 0 0" : "22px 20px 0", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(44px, 15vw, 64px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: phase === "running" ? "#4FD98B" : "#EDEFF4",
              transition: "color 0.15s",
            }}
          >
            {formatTime(elapsed)}
          </div>

          {phase !== "stopped" && (
            <button
              onClick={phase === "running" ? stopTimer : startTimer}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "16px 0",
                borderRadius: 16,
                border: "none",
                background: phase === "running" ? "#FF6B6B" : "#4FD98B",
                color: "#0E1016",
                fontSize: 17,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {phase === "running" ? <Square size={18} fill="#0E1016" /> : <Play size={18} fill="#0E1016" />}
              {phase === "running" ? "Stop" : "Start Timer"}
            </button>
          )}

          {phase === "stopped" && (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={discard}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "1px solid #33384A",
                  background: "transparent",
                  color: "#8A8FA3",
                  fontSize: 15,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <RotateCcw size={15} /> Redo
              </button>
              <button
                onClick={saveAndNext}
                style={{
                  flex: 2,
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: "#4FD98B",
                  color: "#0E1016",
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                Save &amp; Next
              </button>
            </div>
          )}

          {phase === "idle" && (
            <button
              onClick={() => setManualOpen((s) => !s)}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "#7A7F94",
                fontSize: 13,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Pencil size={13} /> Enter time manually
            </button>
          )}

          {manualOpen && phase === "idle" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="seconds, e.g. 42.35"
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                style={{
                  flex: 1,
                  background: "#1B1E28",
                  border: "1px solid #262A36",
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: "#EDEFF4",
                  fontSize: 15,
                  fontFamily: "ui-monospace, monospace",
                }}
              />
              <button
                onClick={submitManual}
                style={{
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2A2E3C",
                  color: "#EDEFF4",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Log
              </button>
            </div>
          )}
        </div>

        {/* Skip case */}
        {phase === "idle" && (
          <div style={{ padding: wide ? "16px 0 0" : "16px 20px 0", textAlign: "center" }}>
            <button
              onClick={nextCase}
              style={{ background: "transparent", border: "none", color: "#4A4F60", fontSize: 13 }}
            >
              Skip this case →
            </button>
          </div>
        )}

        {/* Session summary */}
        <div style={{ padding: wide ? "22px 0 0" : "22px 20px 0" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <SummaryTile label="Solves" value={sessionCount} />
            <SummaryTile label="Session Avg" value={sessionCount ? formatTime(sessionAvg) : "—"} />
            <SummaryTile label="Best" value={sessionCount ? formatTime(sessionBest) : "—"} />
          </div>
        </div>
      </div>

      {/* Right column: always-visible stats panel, desktop only */}
      {isDesktop && (
        <div
          style={{
            background: "#161822",
            border: "1px solid #262A36",
            borderRadius: 20,
            padding: "20px 20px 24px",
            position: "sticky",
            top: 40,
            maxHeight: "calc(100vh - 80px)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>Per-case stats</div>
          {statsBody}
        </div>
      )}

      {flash && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#4FD98B",
            color: "#0E1016",
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 999,
            zIndex: 50,
          }}
        >
          Saved ✓
        </div>
      )}

      {/* Mobile stats drawer — bottom sheet */}
      {statsOpen && isMobile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 40,
          }}
          onClick={() => setStatsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Per-case statistics"
            style={{
              background: "#161822",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "78vh",
              overflowY: "auto",
              padding: "18px 20px 28px",
              border: "1px solid #262A36",
              borderBottom: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Per-case stats</div>
              <button
                onClick={() => setStatsOpen(false)}
                aria-label="Close statistics"
                style={{ background: "none", border: "none", color: "#8A8FA3" }}
              >
                <X size={20} />
              </button>
            </div>
            {statsBody}
          </div>
        </div>
      )}

      {/* Tablet stats drawer — slide-in panel from the right, sized for a
          two-handed hold in portrait rather than a full-width sheet */}
      {statsOpen && isTablet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "flex-end",
            zIndex: 40,
          }}
          onClick={() => setStatsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Per-case statistics"
            style={{
              background: "#161822",
              width: "min(420px, 88vw)",
              maxHeight: "100%",
              overflowY: "auto",
              padding: "24px 24px 32px",
              borderLeft: "1px solid #262A36",
              boxShadow: "-8px 0 24px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Per-case stats</div>
              <button
                onClick={() => setStatsOpen(false)}
                aria-label="Close statistics"
                style={{ background: "none", border: "none", color: "#8A8FA3" }}
              >
                <X size={20} />
              </button>
            </div>
            {statsBody}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#1B1E28",
        border: "1px solid #262A36",
        borderRadius: 14,
        padding: "12px 4px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "clamp(13px, 4vw, 18px)",
          fontWeight: 700,
          color: "#EDEFF4",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: "#7A7F94", marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
