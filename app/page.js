"use client";

import { useState, useRef, useEffect } from "react";

/* ── Sample codes ────────────────────────────────────────── */
const SAMPLES = {
  "Nested Loop O(n²)": `for(int i=0; i<n; i++){
    for(int j=0; j<n; j++){
        cout << i << j;
    }
}`,
  "Binary Search O(log n)": `int binarySearch(int arr[], int l, int r, int x) {
    while (l <= r) {
        int mid = l + (r - l) / 2;
        if (arr[mid] == x) return mid;
        if (arr[mid] < x) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}`,
  "Fibonacci O(2^n)": `int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}`,
  "Merge Sort O(n log n)": `void mergeSort(int arr[], int l, int r) {
    if (l < r) {
        int m = l + (r - l) / 2;
        mergeSort(arr, l, m);
        mergeSort(arr, m + 1, r);
        merge(arr, l, m, r);
    }
}`,
  "Map Usage O(n log n)": `void countFreq(vector<int>& v) {
    map<int, int> freq;
    for (int x : v) {
        freq[x]++;
    }
    for (auto& p : freq) {
        cout << p.first << ": " << p.second << endl;
    }
}`,
};

/* ── Tiny helpers ────────────────────────────────────────── */
function Badge({ children, color = "green" }) {
  const m = {
    green:  { bg: "#0a2e1a", bd: "#1a5c34", fg: "#4ade80" },
    blue:   { bg: "#0a1e3e", bd: "#1a3c6e", fg: "#60a5fa" },
    amber:  { bg: "#2e2a0a", bd: "#5c4e1a", fg: "#fbbf24" },
    red:    { bg: "#2e0a0a", bd: "#5c1a1a", fg: "#f87171" },
    purple: { bg: "#1e0a2e", bd: "#3c1a5c", fg: "#c084fc" },
  };
  const c = m[color] || m.green;
  return (
    <span
      style={{
        display: "inline-block", padding: "3px 10px", borderRadius: 6,
        background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
        fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: 0.5,
      }}
    >
      {children}
    </span>
  );
}

function ConfidenceMeter({ level }) {
  const m = {
    high:   { w: "100%", c: "#4ade80", l: "HIGH" },
    medium: { w: "60%",  c: "#fbbf24", l: "MEDIUM" },
    low:    { w: "30%",  c: "#f87171", l: "LOW" },
  };
  const v = m[level] || m.medium;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: v.w, height: "100%", background: v.c, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: v.c, fontFamily: "var(--mono)" }}>{v.l}</span>
    </div>
  );
}

function TypingText({ text, speed = 6 }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return shown;
}

/* ── Main page ───────────────────────────────────────────── */
export default function Home() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("analysis");
  const [compareMode, setCompareMode] = useState(false);
  const [compareCode, setCompareCode] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  const fileRef = useRef();

  async function callApi(src) {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: src }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || "Request failed");
    }
    return res.json();
  }

  async function handleAnalyze() {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCompareResult(null);
    try {
      const r = await callApi(code);
      let cr = null;
      if (compareMode && compareCode.trim()) {
        cr = await callApi(compareCode);
      }
      setResult(r);
      setCompareResult(cr);
      setTab("analysis");
    } catch (e) {
      setResult(null);
      setCompareResult(null);
      setError(e.message || "Analysis failed.");
    }
    setLoading(false);
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setCode(ev.target.result);
    r.readAsText(f);
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 60px" }}>
      {/* ── Header ─────────────────────── */}
      <header
        style={{
          padding: "24px 0 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--border)", marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg,#4ade80,#06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "#08080f", fontFamily: "var(--mono)",
            }}
          >
            ⟨⟩
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#e8eaed", fontFamily: "var(--mono)", letterSpacing: -0.5, margin: 0 }}>
              Complexity Analyzer
            </h1>
            <p style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)", margin: 0 }}>
              TC &amp; SC Predictor · C/C++
            </p>
          </div>
        </div>
        <button
          onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: compareMode ? "#1a2e1a" : "transparent",
            color: compareMode ? "var(--green)" : "var(--text-dim)",
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}
        >
          ⚖ Compare
        </button>
      </header>

      {/* ── Samples ────────────────────── */}
      <div style={{ marginBottom: 16, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-ghost)", fontFamily: "var(--mono)", marginRight: 4 }}>
          SAMPLES:
        </span>
        {Object.keys(SAMPLES).map((k) => (
          <button
            key={k}
            onClick={() => setCode(SAMPLES[k])}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text-dim)",
              fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer", fontWeight: 600,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Code editors ───────────────── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--mono)", letterSpacing: 1 }}>
              INPUT CODE
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => fileRef.current?.click()} style={smallBtnStyle}>📁 Upload</button>
              <button onClick={() => setCode("")} style={smallBtnStyle}>✕ Clear</button>
            </div>
            <input ref={fileRef} type="file" accept=".cpp,.c,.h,.hpp,.cc,.cxx,.txt" onChange={handleFile} hidden />
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your C/C++ code here…"
            spellCheck={false}
            rows={compareMode ? 8 : 10}
            style={editorStyle("#b8e986")}
          />
        </div>

        {compareMode && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--mono)", letterSpacing: 1 }}>
                COMPARE CODE
              </span>
            </div>
            <textarea
              value={compareCode}
              onChange={(e) => setCompareCode(e.target.value)}
              placeholder="Paste second code to compare…"
              spellCheck={false}
              rows={8}
              style={editorStyle("#fbbf24")}
            />
          </div>
        )}
      </div>

      {/* ── Analyze button ─────────────── */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !code.trim()}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
          fontFamily: "var(--mono)", fontSize: 14, fontWeight: 800, letterSpacing: 1,
          cursor: loading ? "wait" : "pointer",
          background: loading ? "#1a2e1a" : "linear-gradient(135deg,#4ade80,#06b6d4)",
          color: "#08080f", transition: "all .3s", marginBottom: 24,
          opacity: !code.trim() ? 0.4 : 1,
        }}
      >
        {loading ? "⏳ ANALYZING…" : "▶ ANALYZE COMPLEXITY"}
      </button>

      {error && (
        <div style={{ padding: 14, borderRadius: 8, background: "#2e0a0a", border: "1px solid #5c1a1a", color: "#f87171", fontFamily: "var(--mono)", fontSize: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── Results ────────────────────── */}
      {result && (
        <>
          {/* Big cards */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <Card border="var(--green-dim)" grad="#0a1a0a" label="TIME COMPLEXITY" labelColor="#4a6a4a">
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)", fontFamily: "var(--mono)" }}>{result.timeComplexity}</div>
              {compareResult && <div style={{ fontSize: 14, color: "var(--amber)", fontFamily: "var(--mono)", marginTop: 6 }}>vs {compareResult.timeComplexity}</div>}
            </Card>
            <Card border="var(--blue-dim)" grad="#0a0a2e" label="SPACE COMPLEXITY" labelColor="#4a4a8a">
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--blue)", fontFamily: "var(--mono)" }}>{result.spaceComplexity}</div>
              {compareResult && <div style={{ fontSize: 14, color: "var(--amber)", fontFamily: "var(--mono)", marginTop: 6 }}>vs {compareResult.spaceComplexity}</div>}
            </Card>
            <Card border="var(--border)" grad="var(--surface)" label="CONFIDENCE" labelColor="var(--text-muted)">
              <ConfidenceMeter level={result.confidence} />
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5 }}>{result.summary}</p>
            </Card>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
            {["analysis", "explanation", "observations"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "1px solid transparent",
                  borderBottom: "none", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase",
                  background: tab === t ? "#12121e" : "transparent",
                  color: tab === t ? "#e8eaed" : "var(--text-muted)",
                  borderColor: tab === t ? "var(--border)" : "transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 24 }}>
            {tab === "analysis" && (
              <>
                <Section title="LOOP ANALYSIS" items={result.loops} field="description" badgeField="complexity" color="green" />
                <Section title="RECURSION ANALYSIS" items={result.recursion} field="description" badgeField="complexity" color="purple" />
                <Section title="DATA STRUCTURES" items={result.dataStructures} field="name" badgeField="impact" color="blue" />
              </>
            )}

            {tab === "explanation" && result.explanation?.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: "var(--green)", fontFamily: "var(--mono)",
                }}>{i + 1}</div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "#a8aab0", paddingTop: 4, margin: 0 }}>
                  <TypingText text={step} />
                </p>
              </div>
            ))}

            {tab === "observations" && (
              <>
                {result.observations?.map((o, i) => (
                  <div key={i} style={rowStyle}>
                    <span style={{ color: "var(--amber)", marginRight: 8 }}>⚡</span>{o}
                  </div>
                ))}
                {result.optimizationSuggestions?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--mono)", letterSpacing: 1, marginBottom: 10 }}>
                      OPTIMIZATION SUGGESTIONS
                    </p>
                    {result.optimizationSuggestions.map((s, i) => (
                      <div key={i} style={{ ...rowStyle, background: "#0a1a0a", borderColor: "#1a3c1a", color: "var(--green)" }}>
                        <span style={{ marginRight: 8 }}>💡</span>{s}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Disclaimer */}
          <p style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-ghost)", fontFamily: "var(--mono)", lineHeight: 1.6 }}>
            ⚠ Complexity analysis is heuristic-based. Results may not capture all edge cases
            (e.g., amortized complexity, input-dependent branches, compiler optimizations).
            Always verify with formal analysis for production systems.
          </p>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#2a2c36" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⟨⟩</div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, margin: 0 }}>
            Paste code above and hit Analyze
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, marginTop: 6, color: "#1a1c26" }}>
            Supports C/C++ with loop, recursion &amp; STL detection
          </p>
        </div>
      )}
    </main>
  );
}

/* ── Reusable bits ───────────────────────────────────────── */
function Card({ children, border, grad, label, labelColor }) {
  return (
    <div style={{
      flex: 1, minWidth: 200, padding: 20, borderRadius: 12,
      border: `1px solid ${border}`,
      background: `linear-gradient(135deg, ${grad} 0%, #0a0a16 100%)`,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: labelColor, fontFamily: "var(--mono)", letterSpacing: 1.5, marginBottom: 8, margin: 0 }}>{label}</p>
      {children}
    </div>
  );
}

function Section({ title, items, field, badgeField, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--mono)", letterSpacing: 1, marginBottom: 10, margin: "0 0 10px" }}>
        {title}
      </p>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...rowStyle, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#a8aab0" }}>{item[field]}</span>
          <Badge color={color}>{item[badgeField]}</Badge>
        </div>
      ))}
    </div>
  );
}

const smallBtnStyle = {
  padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border)",
  background: "transparent", color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer",
};

const editorStyle = (fg) => ({
  width: "100%", padding: 16, borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--surface2)", color: fg,
  fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.7, resize: "vertical",
  outline: "none", boxSizing: "border-box",
});

const rowStyle = {
  padding: "10px 14px", borderRadius: 8, background: "#08080f",
  border: "1px solid #14141e", marginBottom: 6, fontSize: 13, color: "#a8aab0", lineHeight: 1.6,
};
