import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { Html5Qrcode } from "html5-qrcode";

/*
  BAT HEALTH SIH UPGRADE

  New frontend features:
  - Explicit "Estimated, Not Certified" messaging
  - Safety-risk engine
  - Degradation-factor explanation
  - Safe charging recommendations
  - Second-life assessment
  - Digital battery passport
  - Verification fingerprint
  - CSV / JSON battery-data ingestion preview
  - Health + forecast analytics
  - Existing QR scanner retained

  IMPORTANT:
  Set VITE_API_URL in Vercel to your deployed backend URL.
  If VITE_API_URL is absent, localhost is used for local development.
*/

const API = import.meta.env.VITE_API_URL || "https://battrace.onrender.com";

const BATTERIES = ["B0005", "B0006", "B0007", "B0018"];
const PASSPORT_VERSION = "BT-PASSPORT-1.0";

const n = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function first(...values) {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

function App() {
  const [batteryId, setBatteryId] = useState("B0006");
  const [battery, setBattery] = useState(null);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [importedFile, setImportedFile] = useState(null);
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("bat-health-theme") === "dark";
    } catch {
      return false;
    }
  });
  const qrUploadRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.remove("bt-preload-dark");
    document.body.classList.toggle("bt-dark", darkMode);
    try {
      localStorage.setItem("bat-health-theme", darkMode ? "dark" : "light");
    } catch {}
    return () => document.body.classList.remove("bt-dark");
  }, [darkMode]);

  useEffect(() => {
    loadBattery(batteryId);
  }, [batteryId]);

  async function loadBattery(id) {
    try {
      setLoading(true);
      setError("");

      const r = await fetch(`${API}/battery/${id}`);
      if (!r.ok) throw new Error("Battery not found");

      const data = await r.json();
      setBattery(data);

      try {
        const hr = await fetch(`${API}/battery/${id}/history`);
        if (hr.ok) {
          const hd = await hr.json();
          const list = hd.history || [];
          setHistory(list);
          setSelectedIndex(Math.max(0, list.length - 1));
        } else {
          setHistory([]);
        }
      } catch {
        setHistory([]);
      }

      try {
        const fr = await fetch(`${API}/battery/${id}/forecast`);
        if (fr.ok) {
          const fd = await fr.json();
          setForecast(fd.forecast || []);
        } else {
          setForecast([]);
        }
      } catch {
        setForecast([]);
      }
    } catch (err) {
      console.error(err);
      setBattery(null);
      setHistory([]);
      setForecast([]);
      setError(
        "Could not load battery data. Check your deployed backend URL and VITE_API_URL."
      );
    } finally {
      setLoading(false);
    }
  }

  function processQRResult(result) {
    if (!result) {
      setError("QR code is empty.");
      return;
    }

    let scannedId = result.trim().toUpperCase();

    // Supports:
    // B0005
    // BATTERY:B0005
    // https://bat-trace.com/battery/B0005
    if (scannedId.includes("/")) {
      const parts = scannedId.split("/");
      scannedId = parts[parts.length - 1];
    }

    scannedId = scannedId.replace("BATTERY:", "").trim();

    console.log("Decoded battery ID:", scannedId);

    if (!BATTERIES.includes(scannedId)) {
      setError(`Battery "${scannedId}" is not registered in Bat Health.`);
      return;
    }

    setError("");
    setBatteryId(scannedId);
    setScannerOpen(false);
    setImportOpen(false);
    setActiveTab("dashboard");
  }

  async function handleQRUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError("");

      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file.");
      }

      const fileScanner = new Html5Qrcode("qr-file-reader");

      console.log("Scanning uploaded QR:", file.name);

      const result = await fileScanner.scanFile(file, true);

      console.log("QR decoded successfully:", result);

      try {
        await fileScanner.clear();
      } catch {}

      processQRResult(result);
    } catch (err) {
      console.error("QR upload error:", err);

      setError(
        "Could not read the QR code. Please upload a clear QR image."
      );
    }

    event.target.value = "";
  }

  async function handleDataImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");

    try {
      const isImage = file.type.startsWith("image/");
      const lowerName = file.name.toLowerCase();

      if (isImage) {
        try {
          const fileScanner = new Html5Qrcode("qr-file-reader");

          console.log("Scanning uploaded QR from data import:", file.name);

          const result = await fileScanner.scanFile(file, true);

          console.log("QR decoded successfully:", result);

          try {
            await fileScanner.clear();
          } catch {}

          processQRResult(result);
          return;
        } catch (qrError) {
          console.log(
            "No readable QR found in image; keeping image preview.",
            qrError
          );

          const imageUrl = URL.createObjectURL(file);

          setImportedFile({
            name: file.name,
            format: "IMAGE",
            rows: [],
            count: 1,
            isImage: true,
            imageUrl,
            size: file.size,
            mimeType: file.type,
            qrDetected: false,
            qrText: "",
            batteryId: "",
          });

          return;
        }
      }

      const text = await file.text();
      let parsed;

      if (lowerName.endsWith(".json") || file.type === "application/json") {
        parsed = JSON.parse(text);
      } else if (lowerName.endsWith(".csv") || file.type === "text/csv") {
        parsed = parseCSV(text);
      } else {
        throw new Error("Supported formats: CSV, JSON, JPG, PNG, WEBP and other image files.");
      }

      const rows = Array.isArray(parsed)
        ? parsed
        : parsed.history || parsed.data || parsed.records || [parsed];

      if (!rows.length) throw new Error("No records found.");

      setImportedFile({
        name: file.name,
        format: lowerName.endsWith(".json") ? "JSON" : "CSV",
        rows: rows.slice(0, 500),
        count: rows.length,
        isImage: false,
      });
    } catch (err) {
      setImportedFile(null);
      setImportError(err.message || "Could not read the file.");
    } finally {
      e.target.value = "";
    }
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const split = (line) => {
      const out = [];
      let value = "";
      let quoted = false;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (c === '"' && line[i + 1] === '"') {
          value += '"';
          i++;
        } else if (c === '"') {
          quoted = !quoted;
        } else if (c === "," && !quoted) {
          out.push(value);
          value = "";
        } else {
          value += c;
        }
      }

      out.push(value);
      return out;
    };

    const headers = split(lines[0]).map((x) =>
      x.trim().toLowerCase().replace(/\s+/g, "_")
    );

    return lines.slice(1).map((line) => {
      const values = split(line);
      return headers.reduce((obj, h, i) => {
        obj[h] = values[i] ?? "";
        return obj;
      }, {});
    });
  }

  const selected = history[selectedIndex] || null;

  const soh = clamp(
    n(first(selected?.soh, battery?.predicted_soh, battery?.soh, 0)),
    0,
    100
  );

  const cycle = n(first(selected?.cycle, battery?.cycle, 0));

  const temperature = n(
    first(
      selected?.temperature,
      selected?.temperature_mean,
      battery?.temperature,
      battery?.temperature_mean,
      0
    )
  );

  const voltage = n(
    first(selected?.voltage, selected?.voltage_mean, battery?.voltage, 0)
  );

  const current = n(
    first(selected?.current, selected?.current_mean, battery?.current, 0)
  );

  const batteryType = first(
    battery?.battery_type,
    battery?.chemistry,
    battery?.cell_chemistry,
    "Li-ion"
  );

  const originalCapacity = n(
    first(
      battery?.original_capacity,
      battery?.initial_capacity,
      battery?.capacity_nominal,
      0
    )
  );

  const currentCapacity = n(
    first(
      battery?.current_capacity,
      battery?.capacity,
      originalCapacity ? (originalCapacity * soh) / 100 : 0
    )
  );

  const risk = calculateRisk({
    soh, temperature, cycle, current, battery,
  });

  const factors = calculateFactors({
    soh, temperature, cycle, current, battery,
  });

  const recommendations = calculateRecommendations({
    soh, temperature, risk, factors,
  });

  const secondLife = calculateSecondLife({
    soh, risk: risk.level, cycle,
  });

  const passport = createPassport({
    batteryId,
    battery,
    batteryType,
    soh,
    currentCapacity,
    originalCapacity,
    cycle,
    temperature,
    voltage,
    current,
    risk,
    factors,
    secondLife,
  });

  const historyData = history.map((x) => ({
    cycle: n(x.cycle),
    soh: n(x.soh),
  }));

  const forecastData = forecast.map((x) => ({
    cycle: n(x.cycle),
    soh: n(x.soh),
  }));

  const go = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function downloadPassport() {
    const blob = new Blob([JSON.stringify(passport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batteryId}-battery-passport.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyVerification() {
    try {
      await navigator.clipboard.writeText(passport.verificationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy verification ID.");
    }
  }

  if (loading) {
    return (
      <div style={S.loading}>
        <div style={{ fontSize: 55 }}>🔋</div>
        <h2>Bat Health</h2>
        <p>Loading battery intelligence...</p>
        <div style={S.loader} />
      </div>
    );
  }

  if (!battery) {
    return (
      <div style={S.loading}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2>Unable to load battery</h2>
        <p style={{ maxWidth: 520 }}>{error}</p>
        <button style={S.blueButton} onClick={() => loadBattery(batteryId)}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`bt-app ${darkMode ? "bt-theme-dark" : "bt-theme-light"}`} style={S.app}>
      <style>{`
.bt-action-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;font-size:14px;line-height:1}.bt-primary-action .bt-action-icon{background:rgba(255,255,255,.18)}.bt-upload-action .bt-action-icon{background:rgba(255,255,255,.10)}
@media (max-width:640px){.bt-main-content{padding:14px 12px 28px!important}.bt-hero-clean{min-height:0!important;padding:22px 18px!important;border-radius:16px!important;margin-bottom:12px!important}.bt-hero-content{max-width:none!important}.bt-hero-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:9px!important;margin-top:18px!important}.bt-hero-action{width:100%!important;padding:11px 8px!important;font-size:10px!important;min-height:44px!important}.bt-hero-clean h1{font-size:29px!important;letter-spacing:-1.3px!important;margin:7px 0 8px!important}.bt-hero-clean p{font-size:11px!important;line-height:1.5!important}.bt-hero-clean .bt-action-icon{width:20px;height:20px;font-size:13px}}

        .bt-theme-toggle{
          display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 11px;border-radius:999px;
          border:1px solid var(--bt-border);background:var(--bt-surface);color:var(--bt-text);
          font-size:10px;font-weight:850;cursor:pointer;transition:all .2s ease;
        }
        .bt-theme-toggle:hover{transform:translateY(-1px);border-color:var(--bt-blue);box-shadow:0 5px 16px rgba(15,23,42,.10)}
        .bt-theme-toggle-icon{font-size:15px;line-height:1}
        .bt-theme-toggle-label{letter-spacing:.2px}
        .bt-theme-dark .bt-theme-toggle{background:#111827;border-color:#263244;color:#f8fafc}
        .bt-theme-dark .bt-sidebar-note{background:#111827!important;border-color:#263244!important;color:#84cc16!important}
        .bt-theme-dark .bt-bottom-nav{background:rgba(15,23,42,.97)!important;border-color:#263244!important}
        .bt-theme-dark .bt-bottom-nav button{color:#94a3b8!important}
        .bt-theme-dark .bt-bottom-nav button.active{background:#13251a!important;color:#84cc16!important}
        .bt-theme-dark .bt-mobile-overlay{background:rgba(2,6,23,.72)!important}
        .bt-theme-dark .recharts-default-tooltip{background:#111827!important;border:1px solid #263244!important;color:#f8fafc!important;box-shadow:0 12px 30px rgba(0,0,0,.35)!important}
        .bt-theme-dark .recharts-tooltip-label,.bt-theme-dark .recharts-tooltip-item{color:#e2e8f0!important}
        @keyframes btspin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button,input,select { font: inherit; }
        .bt-mobile-menu-btn{display:none}
        .bt-mobile-overlay{display:none}
        .bt-bottom-nav{display:none}
        .bt-side-collapsed .bt-nav-label,
        .bt-side-collapsed .bt-brand-copy,
        .bt-side-collapsed .bt-sidebar-note{display:none}
        .bt-side-collapsed{width:76px!important;padding-left:10px!important;padding-right:10px!important}
        .bt-side-collapsed .bt-brand{justify-content:center;padding-left:0!important;padding-right:0!important}
        .bt-side-collapsed .bt-nav-item{justify-content:center;padding-left:8px!important;padding-right:8px!important}
        .bt-side-collapsed .bt-nav-icon{width:30px!important;font-size:16px}
        .bt-side-collapsed .bt-collapse-label{display:none}
        .bt-main-collapsed{margin-left:76px!important}
        @media(max-width:980px){
          .bt-side{display:none!important}
          .bt-side.bt-mobile-open{display:flex!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,300px)!important;z-index:1000!important;padding:18px 14px!important;box-shadow:20px 0 50px rgba(15,23,42,.18)!important}
          .bt-side.bt-mobile-open .bt-nav-label,
          .bt-side.bt-mobile-open .bt-brand-copy,
          .bt-side.bt-mobile-open .bt-sidebar-note,
          .bt-side.bt-mobile-open .bt-collapse-label{display:block}
          .bt-side.bt-mobile-open .bt-nav-item{justify-content:flex-start;padding:11px 10px!important}
          .bt-side.bt-mobile-open .bt-nav-icon{width:22px!important}
          .bt-main,.bt-main-collapsed{margin-left:0!important}
          .bt-mobile-menu-btn{display:flex!important}
          .bt-mobile-overlay{display:block;position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:999}
          .bt-3{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:650px){
          .bt-3,.bt-2{grid-template-columns:1fr!important}
          .bt-hero{padding:22px!important;min-height:auto!important;border-radius:16px!important}
          .bt-hero-art{display:none!important}
          .bt-passport{grid-template-columns:1fr!important}
          .bt-top-search{display:none!important}
          .bt-header{padding:10px 14px!important;min-height:62px!important}
          .bt-header-title{font-size:15px!important}
          .bt-main-content{padding:14px 12px 88px!important}
          .bt-actions{display:grid!important;grid-template-columns:1fr!important}
          .bt-actions button{width:100%!important}
          .bt-active-bar{display:grid!important;grid-template-columns:1fr auto!important;gap:10px!important}
          .bt-active-bar .bt-data-loaded{grid-column:1/-1!important}
          .bt-card{border-radius:14px!important}
          .bt-grid-chart{height:245px!important}
          .bt-bottom-nav{position:fixed;display:grid;grid-template-columns:repeat(4,1fr);left:10px;right:10px;bottom:10px;z-index:80;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border:1px solid #dbe3ec;border-radius:18px;box-shadow:0 14px 35px rgba(15,23,42,.16);padding:7px}
          .bt-bottom-nav button{border:0;background:transparent;color:#64748b;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:9px;font-weight:750;padding:7px 3px;border-radius:11px}
          .bt-bottom-nav button.active{background:#eff6ff;color:#2563eb}
          .bt-bottom-nav .bt-bottom-icon{font-size:17px;line-height:1}
          .bt-footer{padding-bottom:12px!important}
        }
        @media print {
          body * { visibility:hidden!important; }
          #bt-print, #bt-print * { visibility:visible!important; }
          #bt-print { position:absolute!important; inset:0!important; }
        }
      `}</style>

      {mobileMenuOpen && (
        <div
          className="bt-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`bt-side ${sidebarCollapsed ? "bt-side-collapsed" : ""} ${mobileMenuOpen ? "bt-mobile-open" : ""}`}
        style={S.sidebar}
      >
        <div style={S.brand}>
          <div style={S.brandIcon}>⚡</div>
          <div className="bt-brand-copy">
            <div style={S.brandName}>BAT <span>HEALTH</span></div>
            <div style={S.brandSub}>
              Battery Health, Safety &amp; Second-Life Passport
            </div>
          </div>
        </div>

        <nav style={S.nav}>
          {[
            ["dashboard", "⌂", "Dashboard"],
            ["health", "♡", "Health Analysis"],
            ["safety", "◈", "Safety Analysis"],
            ["charging", "ϟ", "Charging History"],
            ["recommendations", "✦", "Recommendations"],
            ["secondlife", "♻", "Second-Life"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              style={{ ...S.navItem, ...(activeTab === id ? S.navActive : {}) }}
              onClick={() => go(id)}
            >
              <span className="bt-nav-icon" style={{ width: 22, textAlign: "center" }}>{icon}</span>
              <span className="bt-nav-label">{label}</span>
            </button>
          ))}

          <button
            style={S.navItem}
            onClick={() => setPassportOpen(true)}
          >
            <span className="bt-nav-icon" style={{ width: 22, textAlign: "center" }}>▣</span>
            <span className="bt-nav-label">Battery Passport</span>
          </button>

          <button
            style={S.navItem}
            onClick={() => setImportOpen(true)}
          >
            <span className="bt-nav-icon" style={{ width: 22, textAlign: "center" }}>⇧</span>
            <span className="bt-nav-label">Import CSV / JSON</span>
          </button>
        </nav>

        <button
          className="bt-collapse-button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          style={{
            marginTop: 10, border: "1px solid var(--bt-border)", background: "var(--bt-surface)",
            color: "var(--bt-muted)", borderRadius: 9, padding: "9px 10px",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, fontSize: 10, fontWeight: 800,
          }}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span>{sidebarCollapsed ? "→" : "←"}</span>
          <span className="bt-collapse-label">
            {sidebarCollapsed ? "Expand" : "Collapse sidebar"}
          </span>
        </button>

        <div className="bt-sidebar-note" style={S.sidebarNote}>
          <strong>🛡 Estimate, Not Certification</strong>
          <p>
            Bat Health provides AI-based estimates and recommendations. It does
            not replace certified battery testing or diagnostics.
          </p>
        </div>
      </aside>

      <div className={`bt-main ${sidebarCollapsed ? "bt-main-collapsed" : ""}`} style={S.mainWrap}>
        <header className="bt-header" style={S.header}>
          <button
            className="bt-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "1px solid #dbe3ec",
              background: "var(--bt-surface)", color: "var(--bt-heading)", fontSize: 20, cursor: "pointer",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div>
            <div style={S.mobileBrand}>⚡ BAT HEALTH</div>
            <div className="bt-header-title" style={S.headerTitle}>{pageTitle(activeTab)}</div>
          </div>

          <div style={S.headerRight}>
            <div className="bt-top-search" style={S.search}>
              <span>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Battery ID..."
                style={S.searchInput}
              />
              {search && (
                <div style={S.searchResults}>
                  {BATTERIES.filter((id) =>
                    id.toLowerCase().includes(search.toLowerCase())
                  ).map((id) => (
                    <button
                      key={id}
                      style={S.searchResult}
                      onClick={() => {
                        setBatteryId(id);
                        setSearch("");
                      }}
                    >
                      🔋 {id}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="bt-theme-toggle"
              onClick={() => setDarkMode((value) => !value)}
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            >
              <span className="bt-theme-toggle-icon">{darkMode ? "☀" : "☾"}</span>
              <span className="bt-theme-toggle-label">{darkMode ? "Light" : "Dark"}</span>
            </button>
            <div style={S.onlineBadge}>● SYSTEM ONLINE</div>
          </div>
        </header>

        <main className="bt-main-content" style={S.main}>
          {error && (
            <div style={S.error}>
              ⚠️ <span>{error}</span>
              <button style={S.errorClose} onClick={() => setError("")}>×</button>
            </div>
          )}

          <section className="bt-hero bt-hero-clean" style={S.hero}>
            <div className="bt-hero-content" style={S.heroContent}>
              <div style={S.heroEyebrow}>WELCOME TO BAT HEALTH</div>
              <h1 style={S.heroTitle}>
                Understand. <span>Extend.</span> <b>Reuse.</b>
              </h1>
              <p style={S.heroText}>
                Battery health, safety and second-life intelligence in one place.
              </p>
              <div className="bt-actions bt-hero-actions" style={S.actions}>
                <button className="bt-hero-action bt-primary-action" style={S.greenButton} onClick={() => setScannerOpen(true)}>
                  <span className="bt-action-icon">⌗</span><span>Scan Battery QR</span>
                </button>
                <button
                  className="bt-hero-action bt-upload-action"
                  style={S.heroOutline}
                  onClick={() => qrUploadRef.current?.click()}
                >
                  <span className="bt-action-icon">↑</span>
                  <span>Upload from Device</span>
                </button>
                <input
                  ref={qrUploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleQRUpload}
                  style={{ display: "none" }}
                />
              </div>
            </div>
          </section>

          <section className="bt-active-bar" style={S.activeBar}>
            <div>
              <div style={S.eyebrow}>ACTIVE BATTERY</div>
              <strong style={{ fontSize: 17 }}>{batteryId}</strong>
            </div>

            <select
              value={batteryId}
              onChange={(e) => setBatteryId(e.target.value)}
              style={S.select}
            >
              {BATTERIES.map((id) => <option key={id}>{id}</option>)}
            </select>

            <span className="bt-data-loaded" style={S.verified}>✓ Data loaded</span>
          </section>

          {activeTab === "dashboard" && (
            <>
              <div className="bt-3" style={S.grid3}>
                <HealthCard
                  soh={soh}
                  capacity={currentCapacity}
                  originalCapacity={originalCapacity}
                />
                <RiskCard risk={risk} onClick={() => go("safety")} />
                <PassportCard
                  passport={passport}
                  onOpen={() => setPassportOpen(true)}
                />
              </div>

              <div className="bt-2" style={S.grid2}>
                <Details
                  battery={battery}
                  batteryType={batteryType}
                  originalCapacity={originalCapacity}
                  voltage={voltage}
                  cycle={cycle}
                />
                <SecondLifeCard
                  secondLife={secondLife}
                  onClick={() => go("secondlife")}
                />
              </div>

              <div className="bt-2" style={S.grid2}>
                <Factors factors={factors} />
                <ChargingCard
                  temperature={temperature}
                  current={current}
                  battery={battery}
                  onClick={() => go("charging")}
                />
              </div>

              <Timeline
                history={history}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
                selected={selected}
                soh={soh}
              />

              <Charts history={history} forecast={forecast} />

              <Recommendations
                items={recommendations}
                onClick={() => go("recommendations")}
              />
            </>
          )}

          {activeTab === "health" && (
            <HealthPage
              soh={soh}
              history={history}
              forecast={forecast}
              factors={factors}
              temperature={temperature}
              cycle={cycle}
            />
          )}

          {activeTab === "safety" && (
            <SafetyPage
              risk={risk}
              soh={soh}
              temperature={temperature}
              current={current}
              cycle={cycle}
            />
          )}

          {activeTab === "charging" && (
            <ChargingPage
              history={history}
              temperature={temperature}
              current={current}
              battery={battery}
              recommendations={recommendations}
            />
          )}

          {activeTab === "recommendations" && (
            <RecommendationsPage
              items={recommendations}
              risk={risk}
              soh={soh}
            />
          )}

          {activeTab === "secondlife" && (
            <SecondLifePage
              secondLife={secondLife}
              soh={soh}
              risk={risk.cycle}
              cycle={cycle}
            />
          )}

          <footer className="bt-footer" style={S.footer}>
            <span>© 2026 BAT HEALTH</span>
            <span>AI estimates • Lifecycle intelligence • Sustainable reuse</span>
            <span>Certified testing remains authoritative</span>
          </footer>
        </main>
      </div>

      <nav className="bt-bottom-nav" aria-label="Mobile navigation">
        {[
          ["dashboard", "⌂", "Home"],
          ["health", "♡", "Health"],
          ["safety", "◈", "Safety"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            className={activeTab === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <span className="bt-bottom-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
        <button
          className={!["dashboard","health","safety"].includes(activeTab) ? "active" : ""}
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="bt-bottom-icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      <div
        id="qr-file-reader"
        style={{
          width: 1, height: 1, position: "absolute", opacity: 0,
          pointerEvents: "none", overflow: "hidden",
        }}
      />

      {scannerOpen && (
        <QRScanner
          onResult={processQRResult}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {passportOpen && (
        <PassportModal
          passport={passport}
          copied={copied}
          onCopy={copyVerification}
          onDownload={downloadPassport}
          onClose={() => setPassportOpen(false)}
        />
      )}

      {importOpen && (
        <ImportModal
          importedFile={importedFile}
          error={importError}
          onFile={handleDataImport}
          onClose={() => {
            setImportOpen(false);
            setImportError("");
          }}
        />
      )}
    </div>
  );
}

function pageTitle(tab) {
  return {
    dashboard: "Battery Intelligence Dashboard",
    health: "Health Analysis",
    safety: "Safety Analysis",
    charging: "Charging History",
    recommendations: "Safety Recommendations",
    secondlife: "Second-Life Assessment",
  }[tab] || "Battery Intelligence";
}

function calculateRisk({ soh, temperature, cycle, current, battery }) {
  let score = 0;

  if (temperature >= 45) score += 45;
  else if (temperature >= 40) score += 30;
  else if (temperature >= 35) score += 15;

  if (soh < 60) score += 30;
  else if (soh < 75) score += 18;
  else if (soh < 85) score += 8;

  if (cycle >= 1500) score += 20;
  else if (cycle >= 1000) score += 12;
  else if (cycle >= 700) score += 6;

  if (Math.abs(current) >= 8) score += 10;
  else if (Math.abs(current) >= 5) score += 5;

  const backend = String(first(battery?.risk_level, battery?.risk, "")).toLowerCase();

  if (backend.includes("critical") || backend.includes("high")) score = Math.max(score, 75);
  else if (backend.includes("medium") || backend.includes("moderate")) score = Math.max(score, 45);

  if (score >= 70) {
    return {
      score: clamp(Math.round(score), 0, 100),
      level: "High",
      color: "var(--bt-red)",
      bg: "var(--bt-error-bg)",
      icon: "!",
      summary: "Elevated risk indicators detected. Certified diagnostics are recommended.",
    };
  }

  if (score >= 40) {
    return {
      score: clamp(Math.round(score), 0, 100),
      level: "Medium",
      color: "var(--bt-orange)",
      bg: "var(--bt-warning-soft)",
      icon: "!",
      summary: "Some operating conditions may accelerate degradation or increase risk.",
    };
  }

  return {
    score: Math.round(score),
    level: "Low",
    color: "var(--bt-green)",
    bg: "var(--bt-green-soft)",
    icon: "✓",
    summary: "No major risk signal is visible in the currently available data.",
  };
}

function calculateFactors({ soh, temperature, cycle, current, battery }) {
  if (Array.isArray(battery?.degradation_factors) && battery.degradation_factors.length) {
    return battery.degradation_factors.map((x, i) => ({
      name: x.name || x.factor || `Factor ${i + 1}`,
      value: clamp(n(x.value ?? x.percent), 0, 100),
    }));
  }

  const raw = [
    { name: "High temperature exposure", value: clamp(10 + Math.max(0, temperature - 30) * 4, 8, 45) },
    { name: "Fast / high-rate charging", value: clamp(12 + Math.abs(current) * 2.5, 10, 35) },
    { name: "Cycle ageing", value: clamp(10 + cycle / 55, 10, 35) },
    { name: "Deep discharge / low SoC", value: soh < 70 ? 24 : 12 },
  ];

  const total = raw.reduce((sum, x) => sum + x.value, 0);
  return raw.map((x) => ({
    ...x,
    value: Math.round((x.value / total) * 100),
  }));
}

function calculateRecommendations({ soh, temperature, risk, factors }) {
  const items = [];

  if (risk.level === "High") {
    items.push({
      priority: "URGENT",
      title: "Seek certified diagnostics",
      text: "Bat Health detects elevated risk indicators. Do not treat this estimate as a safety certification.",
    });
  }

  items.push({
    priority: temperature >= 40 ? "HIGH" : "NORMAL",
    title: "Control charging temperature",
    text:
      temperature >= 40
        ? "Avoid charging in high ambient temperature and allow the battery to cool before the next charge."
        : "Prefer a cool, ventilated charging environment and avoid covering the battery during charging.",
  });

  if (factors.some((x) => x.name.toLowerCase().includes("fast"))) {
    items.push({
      priority: "NORMAL",
      title: "Limit repeated fast charging",
      text: "Use normal charging when practical because repeated high-rate charging can accelerate ageing.",
    });
  }

  items.push({
    priority: soh < 80 ? "HIGH" : "NORMAL",
    title: soh < 80 ? "Plan a battery inspection" : "Maintain healthy operation",
    text:
      soh < 80
        ? "Estimated SoH is below the common 80% lifecycle reference point. Consider certified diagnostic testing."
        : "Continue avoiding prolonged extreme temperatures and unnecessary deep-discharge events.",
  });

  return items;
}

function calculateSecondLife({ soh, risk, cycle }) {
  let score = soh;

  if (risk === "High") score -= 20;
  else if (risk === "Medium") score -= 8;

  if (cycle > 1500) score -= 8;
  else if (cycle > 1000) score -= 4;

  score = Math.round(clamp(score, 0, 100));

  let application = "Recycling / material recovery";
  if (score >= 75) application = "Stationary energy storage";
  else if (score >= 60) application = "Low-demand backup storage";
  else if (score >= 45) application = "Low-power applications";

  return {
    score,
    application,
    decision:
      score >= 60
        ? "Potentially suitable for second-life use"
        : "Second-life suitability is limited",
  };
}

function createPassport({
  batteryId,
  battery,
  batteryType,
  soh,
  currentCapacity,
  originalCapacity,
  cycle,
  temperature,
  voltage,
  current,
  risk,
  factors,
  secondLife,
}) {
  const verificationId = fingerprint(
    `${batteryId}|${soh.toFixed(2)}|${cycle}|${risk.level}|${PASSPORT_VERSION}`
  );

  return {
    passportVersion: PASSPORT_VERSION,
    batteryId,
    verificationId,
    generatedAt: new Date().toISOString(),
    status: "AI-ESTIMATED",
    certified: false,
    battery: {
      type: batteryType,
      chemistry: first(battery?.chemistry, batteryType),
      originalCapacity: originalCapacity || null,
      estimatedCurrentCapacity: currentCapacity || null,
      nominalVoltage: voltage || null,
      totalCycles: cycle,
    },
    estimatedHealth: {
      stateOfHealthPercent: Number(soh.toFixed(2)),
      safetyRisk: risk.level,
      safetyRiskScore: risk.score,
      temperatureC: Number(temperature.toFixed(2)),
      currentA: Number(current.toFixed(2)),
    },
    degradationFactors: factors,
    secondLife: {
      suitabilityScore: secondLife.score,
      recommendedApplication: secondLife.application,
      decision: secondLife.decision,
    },
    verification: {
      method: "Deterministic Bat Health passport fingerprint",
      note: "This verifies the integrity of the generated passport record. It is not laboratory certification.",
    },
    disclaimer:
      "Bat Health values are AI/data-driven estimates and recommendations. Certified battery testing and manufacturer diagnostics remain authoritative.",
  };
}

function fingerprint(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `BT-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function HealthCard({ soh, capacity, originalCapacity }) {
  const color = healthColor(soh);

  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>BATTERY HEALTH</div>
      <div style={S.healthBody}>
        <div>
          <div style={{ ...S.bigNumber, color }}>{soh.toFixed(1)}%</div>
          <div style={S.muted}>Estimated State of Health</div>
          <div style={{ ...S.pill, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            ● {healthText(soh)}
          </div>
        </div>

        <div style={{
          ...S.ring,
          background: `conic-gradient(${color} ${soh * 3.6}deg,#e5e7eb 0deg)`,
        }}>
          <div style={S.ringInner}>
            <span>SOH</span>
            <strong>{Math.round(soh)}%</strong>
          </div>
        </div>
      </div>

      <div style={S.capacity}>
        Estimated capacity: <strong>
          {capacity ? capacity.toFixed(2) : "N/A"}
          {originalCapacity ? ` / ${originalCapacity.toFixed(2)}` : ""}
        </strong>
      </div>
    </div>
  );
}

function RiskCard({ risk, onClick }) {
  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>SAFETY RISK</div>

      <div style={S.riskBody}>
        <div style={{ ...S.riskIcon, color: risk.color, background: risk.bg }}>
          {risk.icon}
        </div>
        <div>
          <div style={{ ...S.riskLevel, color: risk.color }}>{risk.level}</div>
          <div style={S.muted}>Estimated risk level</div>
        </div>
      </div>

      <div style={S.riskTrack}>
        <div style={{ ...S.riskFill, width: `${risk.score}%`, background: risk.color }} />
      </div>

      <p style={S.text}>{risk.summary}</p>
      <button style={S.link} onClick={onClick}>View Safety Details →</button>
    </div>
  );
}

function PassportCard({ passport, onOpen }) {
  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>DIGITAL BATTERY PASSPORT</div>

      <div style={S.passportId}>
        <strong>{passport.batteryId}</strong>
        <span style={S.bluePill}>AI-ESTIMATED</span>
      </div>

      <div style={S.verifyBox}>
        <Fingerprint value={passport.verificationId} />
        <div>
          <div style={S.muted}>Verification fingerprint</div>
          <strong style={{ fontSize: 13 }}>{passport.verificationId}</strong>
          <div style={S.muted}>Integrity record</div>
        </div>
      </div>

      <button style={S.fullButton} onClick={onOpen}>
        View / Download Passport
      </button>
    </div>
  );
}

function Details({ battery, batteryType, originalCapacity, voltage, cycle }) {
  const rows = [
    ["Battery type", batteryType],
    ["Original capacity", originalCapacity ? originalCapacity.toFixed(2) : "N/A"],
    ["Nominal voltage", voltage ? `${voltage.toFixed(2)} V` : "N/A"],
    ["Total cycles", cycle || "N/A"],
    ["Application", first(battery?.application, battery?.applications, "EV / Battery system")],
  ];

  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>KEY DETAILS</div>
      <div style={S.details}>
        {rows.map(([a, b]) => (
          <div style={S.detailRow} key={a}>
            <span>{a}</span><strong>{b}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecondLifeCard({ secondLife, onClick }) {
  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>SECOND-LIFE ASSESSMENT</div>
      <div style={S.recycle}>♻</div>
      <div style={S.muted}>Recommended application</div>
      <h3 style={S.secondTitle}>{secondLife.application}</h3>

      <div style={S.scoreRow}>
        <span>Suitability score</span>
        <strong>{secondLife.score}%</strong>
      </div>

      <div style={S.progress}>
        <div style={{ ...S.progressFill, width: `${secondLife.score}%` }} />
      </div>

      <p style={S.text}>
        Final decision should be based on certified testing.
      </p>

      <button style={S.link} onClick={onClick}>View Assessment →</button>
    </div>
  );
}

function Factors({ factors }) {
  const data = factors.map((x) => ({ name: x.name, value: x.value }));

  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>DEGRADATION FACTORS</div>

      <div style={S.factorLayout}>
        <div style={{ width: 145, height: 145 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={42} outerRadius={65} paddingAngle={3}>
                {data.map((_, i) => (
                  <Cell key={i} fill={["var(--bt-green)","var(--bt-blue)","var(--bt-orange)","var(--bt-purple)"][i % 4]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1 }}>
          {factors.map((x, i) => (
            <div style={S.factorRow} key={x.name}>
              <span>
                <i style={{
                  display: "inline-block",
                  width: 7, height: 7, borderRadius: "50%",
                  background: ["var(--bt-green)","var(--bt-blue)","var(--bt-orange)","var(--bt-purple)"][i % 4],
                  marginRight: 6,
                }} />
                {x.name}
              </span>
              <strong>{x.value}%</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={S.info}>
        These are explanatory estimates derived from the available telemetry.
      </div>
    </div>
  );
}

function ChargingCard({ temperature, current, battery, onClick }) {
  return (
    <div style={S.card}>
      <div style={S.cardEyebrow}>CHARGING &amp; THERMAL PROFILE</div>

      <div className="bt-2" style={{ ...S.grid2, margin: "14px 0 0" }}>
        <Mini icon="🌡" label="Temperature" value={`${temperature.toFixed(1)} °C`} />
        <Mini icon="⚡" label="Current" value={`${current.toFixed(2)} A`} />
        <Mini icon="ϟ" label="Charge events" value={first(battery?.charging_events, battery?.fast_charge_count, "N/A")} />
        <Mini icon="◌" label="Thermal flag" value={temperature >= 40 ? "Review" : "Normal"} />
      </div>

      <button style={S.link} onClick={onClick}>View Charging Analysis →</button>
    </div>
  );
}

function Mini({ icon, label, value }) {
  return (
    <div style={S.mini}>
      <span style={S.miniIcon}>{icon}</span>
      <div>
        <div style={S.muted}>{label}</div>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Timeline({ history, selectedIndex, setSelectedIndex, selected, soh }) {
  if (!history.length) return null;

  const label = (x, i) => {
    if (x?.year) return `Year ${x.year}`;
    const date = x?.date || x?.timestamp;
    if (date) {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
    }
    return `Cycle ${x?.cycle ?? i + 1}`;
  };

  return (
    <section style={S.card}>
      <div style={S.sectionHeader}>
        <div>
          <div style={S.cardEyebrow}>BATTERY LIFECYCLE</div>
          <h2 style={S.sectionTitle}>Health Timeline</h2>
        </div>
        <span style={S.bluePill}>{label(selected, selectedIndex)}</span>
      </div>

      <input
        type="range"
        min="0"
        max={history.length - 1}
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(Number(e.target.value))}
        style={{ width: "100%", accentColor: healthColor(soh) }}
      />

      <div style={S.sliderLabels}>
        <span>{label(history[0], 0)}</span>
        <span>{label(history[history.length - 1], history.length - 1)}</span>
      </div>

      <div style={S.selectedInfo}>
        <Mini icon="↻" label="Cycle" value={selected?.cycle ?? "N/A"} />
        <Mini icon="♡" label="Estimated SoH" value={`${soh.toFixed(2)}%`} />
        <Mini icon="●" label="Status" value={healthText(soh)} />
      </div>
    </section>
  );
}

function Charts({ history, forecast }) {
  const hd = history.map((x) => ({ cycle: n(x.cycle), soh: n(x.soh) }));
  const fd = forecast.map((x) => ({ cycle: n(x.cycle), soh: n(x.soh) }));

  return (
    <div className="bt-2" style={S.grid2}>
      <div style={S.card}>
        <div style={S.cardEyebrow}>HISTORICAL ANALYSIS</div>
        <h2 style={S.sectionTitle}>Capacity / SoH Over Time</h2>
        <p style={S.text}>Estimated State of Health across recorded cycles.</p>

        {history.length ? (
          <div style={S.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hd}>
                <CartesianGrid stroke="var(--bt-chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="cycle" tick={{ fill: "var(--bt-muted)", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--bt-muted)", fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={80} stroke="var(--bt-green)" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="soh" stroke="var(--bt-blue)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={S.noData}>No historical data available.</div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardEyebrow}>PREDICTIVE ANALYSIS</div>
        <h2 style={S.sectionTitle}>Future Battery Health</h2>
        <p style={S.text}>Model forecast from the available battery history.</p>

        {forecast.length ? (
          <div style={S.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fd}>
                <CartesianGrid stroke="var(--bt-chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="cycle" tick={{ fill: "var(--bt-muted)", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--bt-muted)", fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={80} stroke="var(--bt-green)" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="soh" stroke="var(--bt-orange)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={S.noData}>Future prediction is unavailable.</div>
        )}
      </div>
    </div>
  );
}

function Recommendations({ items, onClick }) {
  return (
    <section style={S.card}>
      <div style={S.sectionHeader}>
        <div>
          <div style={S.cardEyebrow}>SMART RECOMMENDATIONS</div>
          <h2 style={S.sectionTitle}>What should you do next?</h2>
        </div>
        <button style={S.link} onClick={onClick}>View all →</button>
      </div>

      <div className="bt-3" style={S.grid3}>
        {items.slice(0, 3).map((x) => (
          <div style={S.recommendation} key={x.title}>
            <Priority value={x.priority} />
            <h3 style={{ fontSize: 13 }}>{x.title}</h3>
            <p style={S.text}>{x.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Priority({ value }) {
  const map = {
    URGENT: ["#dc2626", "#fef2f2"],
    HIGH: ["var(--bt-orange)", "var(--bt-warning-soft)"],
    NORMAL: ["var(--bt-blue)", "var(--bt-blue-soft)"],
  };
  const [color, bg] = map[value] || map.NORMAL;

  return (
    <span style={{
      color, background: bg, borderRadius: 999,
      padding: "4px 7px", fontSize: 8, fontWeight: 850,
    }}>
      {value}
    </span>
  );
}

function HealthPage({ soh, history, forecast, factors, temperature, cycle }) {
  return (
    <>
      <section style={S.card}>
        <div style={S.cardEyebrow}>ESTIMATED STATE OF HEALTH</div>
        <div style={S.analysisGrid}>
          <div>
            <div style={{ ...S.bigNumber, color: healthColor(soh) }}>
              {soh.toFixed(2)}%
            </div>
            <p style={S.text}>
              Current estimate at cycle {cycle}. SoH is an estimate, not a
              certified capacity measurement.
            </p>
          </div>
          <div style={S.note}>
            <strong>How to interpret SoH</strong>
            <p>
              SoH compares the estimated present battery capability with its
              original condition. A declining value indicates degradation.
            </p>
          </div>
        </div>
      </section>

      <Charts history={history} forecast={forecast} />

      <section style={S.card}>
        <div style={S.cardEyebrow}>DEGRADATION EXPLANATION</div>
        <h2 style={S.sectionTitle}>Why is the battery ageing?</h2>
        <p style={S.text}>
          Factors below are explanatory estimates from available data.
        </p>

        <div className="bt-2" style={S.grid2}>
          {factors.map((x) => (
            <div style={S.recommendation} key={x.name}>
              <div style={S.scoreRow}>
                <strong>{x.name}</strong>
                <span>{x.value}%</span>
              </div>
              <div style={S.progress}>
                <div style={{ ...S.progressFill, width: `${x.value}%` }} />
              </div>
              <p style={S.text}>
                Greater exposure can contribute to accelerated battery ageing.
              </p>
            </div>
          ))}
        </div>

        <div style={S.info}>
          Current temperature signal: {temperature.toFixed(1)} °C.
        </div>
      </section>
    </>
  );
}

function SafetyPage({ risk, soh, temperature, current, cycle }) {
  const checks = [
    ["Thermal condition", temperature >= 40 ? "Review" : "Normal"],
    ["Estimated SoH", `${soh.toFixed(1)}%`],
    ["Cycle ageing", cycle >= 1000 ? "Elevated" : "Normal"],
    ["Current stress", Math.abs(current) >= 8 ? "Elevated" : "Normal"],
  ];

  return (
    <>
      <section style={S.card}>
        <div style={S.cardEyebrow}>SAFETY RISK ENGINE</div>

        <div style={S.safetyHero}>
          <div style={{ ...S.riskLarge, color: risk.color, background: risk.bg }}>
            {risk.icon}
          </div>
          <div>
            <div style={{ ...S.riskLargeText, color: risk.color }}>
              {risk.level}
            </div>
            <div style={S.muted}>Estimated safety risk</div>
            <p style={S.text}>{risk.summary}</p>
          </div>
        </div>

        <div style={S.riskTrackLarge}>
          <div style={{ ...S.riskFill, width: `${risk.score}%`, background: risk.color }} />
        </div>

        <div style={S.scoreRow}>
          <span>Risk score</span>
          <strong>{risk.score}/100</strong>
        </div>
      </section>

      <div className="bt-2" style={S.grid2}>
        <section style={S.card}>
          <div style={S.cardEyebrow}>SAFETY SIGNALS</div>
          <div style={S.details}>
            {checks.map(([a, b]) => (
              <div style={S.detailRow} key={a}>
                <span>{a}</span><strong>{b}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={S.card}>
          <div style={S.cardEyebrow}>ESTIMATION LIMITATION</div>
          <h2 style={S.sectionTitle}>Estimate ≠ certification</h2>
          <p style={S.text}>
            Bat Health can flag risk patterns but cannot certify a battery as
            safe. Physical inspection, BMS diagnostics and laboratory testing
            remain authoritative.
          </p>
          <div style={S.warning}>
            🛡 High-risk batteries should receive certified diagnostics before reuse.
          </div>
        </section>
      </div>
    </>
  );
}

function ChargingPage({ history, temperature, current, battery, recommendations }) {
  const temps = history
    .map((x) => n(first(x.temperature, x.temperature_mean), NaN))
    .filter(Number.isFinite);

  const peak = temps.length ? Math.max(...temps) : temperature;

  return (
    <>
      <div className="bt-3" style={S.grid3}>
        <MetricCard title="Peak observed temperature" value={`${peak.toFixed(1)} °C`} icon="🌡" />
        <MetricCard title="Current signal" value={`${current.toFixed(2)} A`} icon="⚡" />
        <MetricCard
          title="Charging events"
          value={first(battery?.charging_events, battery?.fast_charge_count, "N/A")}
          icon="ϟ"
        />
      </div>

      <section style={S.card}>
        <div style={S.cardEyebrow}>CHARGING GUIDANCE</div>
        <h2 style={S.sectionTitle}>Safer charging practices</h2>
        <p style={S.text}>
          Recommendations are based on the currently available charging and
          thermal signals.
        </p>

        <div className="bt-2" style={S.grid2}>
          {recommendations.map((x) => (
            <div style={S.recommendation} key={x.title}>
              <Priority value={x.priority} />
              <h3>{x.title}</h3>
              <p style={S.text}>{x.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <div style={S.card}>
      <div style={S.metricIconLarge}>{icon}</div>
      <div style={S.muted}>{title}</div>
      <div style={S.metricValue}>{value}</div>
    </div>
  );
}

function RecommendationsPage({ items, risk, soh }) {
  return (
    <>
      <section style={S.card}>
        <div style={S.cardEyebrow}>PERSONALIZED GUIDANCE</div>
        <h2 style={S.sectionTitle}>Safe charging &amp; usage recommendations</h2>
        <p style={S.text}>
          Advisory recommendations based on current battery telemetry.
        </p>
        <div style={S.warning}>
          Current risk: <strong>{risk.level}</strong> • Estimated SoH:{" "}
          <strong>{soh.toFixed(1)}%</strong>
        </div>
      </section>

      <div className="bt-2" style={S.grid2}>
        {items.map((x) => (
          <section style={S.card} key={x.title}>
            <Priority value={x.priority} />
            <h2 style={S.sectionTitle}>{x.title}</h2>
            <p style={S.text}>{x.text}</p>
          </section>
        ))}
      </div>
    </>
  );
}

function SecondLifePage({ secondLife, soh, risk, cycle }) {
  const apps = [
    ["EV propulsion", soh >= 80 && risk !== "High"],
    ["Stationary energy storage", secondLife.score >= 60],
    ["Backup power", secondLife.score >= 55],
    ["Low-power applications", secondLife.score >= 45],
    ["Recycling / material recovery", secondLife.score < 45],
  ];

  return (
    <>
      <section style={S.card}>
        <div style={S.cardEyebrow}>SECOND-LIFE DECISION SUPPORT</div>

        <div className="bt-2" style={S.grid2}>
          <div>
            <div style={S.bigNumber}>{secondLife.score}%</div>
            <div style={S.muted}>Estimated suitability score</div>
            <h2 style={S.sectionTitle}>{secondLife.application}</h2>
            <p style={S.text}>{secondLife.decision}</p>
          </div>

          <div style={S.note}>
            <div style={S.muted}>Lifecycle snapshot</div>
            <div style={S.scoreRow}><span>Estimated SoH</span><strong>{soh.toFixed(1)}%</strong></div>
            <div style={S.scoreRow}><span>Risk</span><strong>{risk}</strong></div>
            <div style={S.scoreRow}><span>Cycles</span><strong>{cycle}</strong></div>
          </div>
        </div>
      </section>

      <section style={S.card}>
        <div style={S.cardEyebrow}>APPLICATION SCREENING</div>
        <h2 style={S.sectionTitle}>Potential second-life pathways</h2>

        <div style={S.details}>
          {apps.map(([name, ok]) => (
            <div style={S.detailRow} key={name}>
              <span>{name}</span>
              <strong style={{ color: ok ? "var(--bt-green)" : "var(--bt-muted)" }}>
                {ok ? "Potentially suitable" : "Not preferred"}
              </strong>
            </div>
          ))}
        </div>

        <div style={S.warning}>
          ♻ Final reuse/recycling classification must be based on certified
          electrical, thermal and physical testing.
        </div>
      </section>
    </>
  );
}

function PassportModal({ passport, copied, onCopy, onDownload, onClose }) {
  return (
    <div style={S.modalBackdrop}>
      <div id="bt-print" style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.cardEyebrow}>DIGITAL BATTERY PASSPORT</div>
            <h2 style={{ margin: "5px 0" }}>{passport.batteryId}</h2>
          </div>
          <button style={S.close} onClick={onClose}>×</button>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
          <span style={S.bluePill}>AI-ESTIMATED</span>
          <span style={S.orangePill}>NOT CERTIFIED</span>
        </div>

        <div className="bt-passport" style={S.passportGrid}>
          <div style={S.passportQR}>
            <Fingerprint value={passport.verificationId} large />
            <strong>{passport.verificationId}</strong>
            <button style={S.link} onClick={onCopy}>
              {copied ? "Copied ✓" : "Copy verification ID"}
            </button>
          </div>

          <div style={S.passportDetails}>
            <PassportRow label="Passport version" value={passport.passportVersion} />
            <PassportRow label="Battery type" value={passport.battery.type} />
            <PassportRow label="Chemistry" value={passport.battery.chemistry} />
            <PassportRow label="Estimated SoH" value={`${passport.estimatedHealth.stateOfHealthPercent}%`} />
            <PassportRow label="Safety risk" value={passport.estimatedHealth.safetyRisk} />
            <PassportRow label="Suitability" value={`${passport.secondLife.suitabilityScore}%`} />
            <PassportRow label="Recommended reuse" value={passport.secondLife.recommendedApplication} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3>Degradation factors</h3>
          <div className="bt-2" style={S.grid2}>
            {passport.degradationFactors.map((x) => (
              <div style={S.factorBox} key={x.name}>
                <span>{x.name}</span><strong>{x.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={S.passportWarning}>
          <strong>Estimate, not certification.</strong>
          <br />
          {passport.disclaimer}
        </div>

        <div style={S.actionsLight}>
          <button style={S.greenButtonLight} onClick={onDownload}>
            Download Passport JSON
          </button>
          <button style={S.blueButton} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function PassportRow({ label, value }) {
  return (
    <div style={S.passportRow}>
      <span>{label}</span><strong>{value || "N/A"}</strong>
    </div>
  );
}

function ImportModal({ importedFile, error, onFile, onClose }) {
  const headers = Object.keys(importedFile?.rows?.[0] || {}).slice(0, 6);

  return (
    <div style={S.modalBackdrop}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.cardEyebrow}>MULTI-FORMAT DATA INGESTION</div>
            <h2 style={{ margin: "5px 0" }}>Import battery / BMS data</h2>
          </div>
          <button style={S.close} onClick={onClose}>×</button>
        </div>

        <p style={S.text}>
          Upload battery/BMS data as CSV or JSON, or upload a battery/BMS image
          such as a diagnostic screenshot, instrument reading, or battery label.
          Files are previewed locally before they are used by the model.
        </p>

        <label style={S.drop}>
          <div style={{ fontSize: 35 }}>⇧</div>
          <strong>Select a file</strong>
          <span>CSV • JSON • JPG • PNG • WEBP • battery/BMS images</span>
          <input
            type="file"
            accept=".csv,.json,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,text/csv,application/json,image/*"
            onChange={onFile}
            style={{ display: "none" }}
          />
        </label>

        {error && <div style={S.error}>⚠️ {error}</div>}

        {importedFile && (
          <div style={S.importResult}>
            <div style={S.scoreRow}>
              <strong>{importedFile.name}</strong>
              <span>{importedFile.format}</span>
            </div>

            {importedFile.isImage ? (
              <>
                <p style={S.text}>
                  Battery/BMS image uploaded successfully. Previewing the image below.
                </p>

                <div style={{
                  background: "var(--bt-surface-2)",
                  border: "1px solid var(--bt-border)",
                  borderRadius: 14,
                  padding: 10,
                  display: "flex",
                  justifyContent: "center",
                  maxHeight: 280,
                  overflow: "hidden",
                }}>
                  <img
                    src={importedFile.imageUrl}
                    alt="Uploaded battery or BMS data"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 255,
                      objectFit: "contain",
                      borderRadius: 10,
                    }}
                  />
                </div>

                <div style={{ ...S.note, marginTop: 10 }}>
                  <strong>Image ingestion</strong>
                  <p style={{ ...S.text, marginBottom: 0 }}>
                    No readable Bat Health QR code was found in this image.
                    The image is still accepted and previewed locally.
                    OCR/image extraction can be connected to the backend for
                    diagnostic-value extraction.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p style={S.text}>
                  {importedFile.count} records detected. Previewing the first 5.
                </p>

                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>{headers.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importedFile.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {headers.map((h) => <td key={h} style={S.td}>{String(row[h] ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <div style={S.warning}>
          🧪 Imported data is not automatically certified or ground truth.
          Validate the source and schema before model use.
        </div>
      </div>
    </div>
  );
}

function Fingerprint({ value, large = false }) {
  const seed = Array.from(value).reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
    7
  );

  const cells = [];
  for (let i = 0; i < 169; i++) {
    const v = (seed + i * 2654435761) >>> 0;
    cells.push(
      <span
        key={i}
        style={{
          width: "100%",
          height: "100%",
          background: v % 7 < 3 ? "#111827" : "#fff",
        }}
      />
    );
  }

  return (
    <div
      title={`Verification fingerprint: ${value}`}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(13,1fr)",
        width: large ? 170 : 90,
        height: large ? 170 : 90,
        padding: 6,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
      }}
    >
      {cells}
    </div>
  );
}

function QRScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);
  const callbackRef = useRef(onResult);

  useEffect(() => {
    callbackRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let scanner;

    async function start() {
      try {
        scanner = new Html5Qrcode("qr-camera-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            callbackRef.current(text);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
      } catch (err) {
        console.error("QR camera error:", err);
      }
    }

    start();

    return () => {
      if (scanner && scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div style={S.scanner}>
      <div style={S.scannerTop}>
        <button style={S.close} onClick={onClose}>←</button>
        <div>
          <strong>Scan Battery</strong>
          <small>Position the battery QR inside the frame</small>
        </div>
      </div>

      <div style={S.camera}>
        <div id="qr-camera-reader" />
        <div style={S.scannerFrame} />
      </div>

      <div style={{ textAlign: "center", maxWidth: 390, margin: "25px auto" }}>
        <div style={{ fontSize: 45, color: "var(--bt-blue)" }}>▣</div>
        <h3>Scan the battery QR code</h3>
        <p style={S.text}>
          Bat Health will identify the registered battery and retrieve its health
          information.
        </p>
      </div>

      <button style={S.cancel} onClick={onClose}>Cancel</button>
    </div>
  );
}

function healthColor(soh) {
  if (soh >= 80) return "var(--bt-green)";
  if (soh >= 60) return "var(--bt-orange)";
  if (soh >= 40) return "var(--bt-orange-deep)";
  return "var(--bt-red)";
}

function healthText(soh) {
  if (soh >= 80) return "Healthy";
  if (soh >= 60) return "Moderate";
  if (soh >= 40) return "Degraded";
  return "Critical";
}

const S = {
  app: {
    minHeight: "100vh",
    background: "var(--bt-bg)",
    color: "var(--bt-text)",
    fontFamily: "Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  },

  sidebar: {
    position: "fixed", left: 0, top: 0, bottom: 0, width: 248,
    background: "var(--bt-surface)", borderRight: "1px solid var(--bt-border)",
    padding: "22px 14px", zIndex: 20, display: "flex",
    flexDirection: "column",
  },

  brand: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "4px 8px 20px", borderBottom: "1px solid var(--bt-border-soft)",
  },

  brandIcon: {
    width: 38, height: 38, borderRadius: 11,
    background: "var(--bt-blue-soft)", color: "var(--bt-blue)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },

  brandName: { fontSize: 18, fontWeight: 900, color: "var(--bt-heading)" },
  brandSub: { fontSize: 9, color: "var(--bt-muted-2)", maxWidth: 155, marginTop: 3 },

  nav: { display: "flex", flexDirection: "column", gap: 4, marginTop: 18 },

  navItem: {
    border: 0, background: "transparent", color: "var(--bt-muted)",
    borderRadius: 9, padding: "11px 10px",
    display: "flex", alignItems: "center", gap: 10,
    textAlign: "left", cursor: "pointer", fontSize: 12, fontWeight: 650,
  },

  navActive: { background: "var(--bt-blue-soft)", color: "var(--bt-blue)", fontWeight: 850 },

  sidebarNote: {
    marginTop: "auto", background: "var(--bt-surface-2)",
    border: "1px solid var(--bt-border)", borderRadius: 12, padding: 12,
    color: "var(--bt-blue)", fontSize: 10,
  },

  mainWrap: { marginLeft: 248, minHeight: "100vh" },

  header: {
    position: "sticky", top: 0, zIndex: 10,
    minHeight: 70, padding: "12px 28px",
    background: "var(--bt-surface)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid var(--bt-border)",
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 15,
  },

  mobileBrand: { display: "none", fontWeight: 900, color: "var(--bt-heading)", fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: 850, color: "var(--bt-heading)" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },

  search: {
    position: "relative", width: 255,
    display: "flex", alignItems: "center", gap: 7,
    border: "1px solid var(--bt-border)", borderRadius: 9,
    padding: "8px 10px", background: "var(--bt-surface)",
  },

  searchInput: { border: 0, outline: 0, width: "100%", fontSize: 11, color: "var(--bt-text)" },

  searchResults: {
    position: "absolute", left: 0, right: 0, top: "calc(100% + 5px)",
    background: "var(--bt-surface)", border: "1px solid var(--bt-border)",
    borderRadius: 9, overflow: "hidden",
    boxShadow: "0 12px 30px rgba(15,23,42,.12)", zIndex: 50,
  },

  searchResult: {
    width: "100%", border: 0, background: "var(--bt-surface)",
    padding: 10, textAlign: "left", cursor: "pointer",
  },

  onlineBadge: {
    color: "var(--bt-green-deep)", background: "var(--bt-green-soft)",
    border: "1px solid var(--bt-green-border)", borderRadius: 999,
    padding: "6px 9px", fontSize: 8, fontWeight: 850,
    whiteSpace: "nowrap",
  },

  main: { maxWidth: 1420, margin: "0 auto", padding: "24px 28px 36px" },

  hero: {
    minHeight: 220,
    borderRadius: 18,
    padding: "30px 32px",
    background: "var(--bt-surface-2)",
    color: "var(--bt-text)",
    border: "1px solid var(--bt-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 20,
    overflow: "hidden",
    marginBottom: 14,
    position: "relative",
    boxShadow: "0 10px 28px rgba(30,64,175,.08)",
  },
  heroContent: { maxWidth: 720, width: "100%", position: "relative", zIndex: 2 },

  heroEyebrow: {
    color: "var(--bt-green)",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: 900,
  },

  heroTitle: {
    margin: "8px 0",
    fontSize: "clamp(30px,4vw,50px)",
    lineHeight: 1.02,
    letterSpacing: "-2px",
    color: "var(--bt-text)",
  },

  heroText: {
    maxWidth: 620,
    color: "var(--bt-muted)",
    fontSize: 13,
    lineHeight: 1.55,
    margin: 0,
  },

  heroTitleSpan: { color: "var(--bt-blue)" },
  heroArt: { display: "none" },

  actions: { display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" },

  greenButton: {
    border: "1px solid var(--bt-green)",
    borderRadius: 10,
    padding: "12px 18px",
    background: "var(--bt-green)",
    color: "var(--bt-surface)",
    fontWeight: 850,
    fontSize: 11,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 42,
    boxShadow: "0 5px 14px rgba(22,163,74,.14)",
  },

  heroOutline: {
    border: "1px solid var(--bt-blue-border)",
    borderRadius: 10,
    padding: "11px 17px",
    background: "var(--bt-surface)",
    color: "var(--bt-blue-deep)",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 42,
  },

  activeBar: {
    background: "var(--bt-surface)", border: "1px solid var(--bt-border)",
    borderRadius: 12, padding: "12px 15px",
    display: "flex", alignItems: "center", gap: 15, marginBottom: 14,
  },

  eyebrow: { color: "var(--bt-muted)", fontSize: 8, fontWeight: 850, letterSpacing: 1.3 },

  select: {
    marginLeft: "auto", border: "1px solid var(--bt-border-strong)",
    borderRadius: 8, padding: "8px 10px",
    background: "var(--bt-surface)", color: "var(--bt-text)", fontWeight: 700,
  },

  verified: {
    color: "var(--bt-green-deep)", background: "var(--bt-green-soft)",
    border: "1px solid var(--bt-green-border)", borderRadius: 999,
    padding: "7px 10px", fontSize: 8, fontWeight: 850,
  },

  grid3: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 14 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14, marginBottom: 14 },

  card: {
    background: "var(--bt-surface)", border: "1px solid var(--bt-border)",
    borderRadius: 14, padding: 18,
    boxShadow: "0 5px 18px rgba(15,23,42,.035)",
    minWidth: 0,
  },

  cardEyebrow: { color: "var(--bt-blue)", fontSize: 9, fontWeight: 900, letterSpacing: 1.25 },

  healthBody: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 12, marginTop: 14,
  },

  bigNumber: { fontSize: 44, lineHeight: 1, fontWeight: 950, letterSpacing: "-2px" },
  muted: { color: "var(--bt-muted)", fontSize: 10, lineHeight: 1.45 },

  pill: {
    display: "inline-block", borderRadius: 999,
    padding: "5px 8px", fontSize: 9, fontWeight: 850, marginTop: 10,
  },

  ring: {
    width: 104, height: 104, minWidth: 104,
    borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center",
  },

  ringInner: {
    width: 82, height: 82, borderRadius: "50%",
    background: "var(--bt-surface)", display: "flex",
    flexDirection: "column", alignItems: "center",
    justifyContent: "center", border: "1px solid var(--bt-border)",
  },

  capacity: {
    borderTop: "1px solid var(--bt-border-soft)", marginTop: 14,
    paddingTop: 11, fontSize: 10, color: "var(--bt-muted)",
  },

  riskBody: { display: "flex", alignItems: "center", gap: 12, marginTop: 16 },

  riskIcon: {
    width: 48, height: 48, borderRadius: 12,
    display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 22, fontWeight: 900,
  },

  riskLevel: { fontSize: 24, fontWeight: 900 },
  riskTrack: { height: 7, borderRadius: 99, background: "var(--bt-border-soft)", overflow: "hidden", marginTop: 17 },
  riskFill: { height: "100%", borderRadius: 99 },

  text: { color: "var(--bt-muted)", fontSize: 11, lineHeight: 1.55, margin: "9px 0" },

  link: {
    border: 0, background: "transparent",
    color: "var(--bt-blue)", fontSize: 11, fontWeight: 800,
    padding: 0, cursor: "pointer",
  },

  passportId: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 8, marginTop: 15,
  },

  bluePill: {
    color: "var(--bt-blue)", background: "var(--bt-blue-soft)",
    border: "1px solid var(--bt-blue-border)", borderRadius: 999,
    padding: "4px 7px", fontSize: 8, fontWeight: 850,
  },

  orangePill: {
    color: "var(--bt-warning)", background: "var(--bt-surface)beb",
    border: "1px solid var(--bt-warning-border)", borderRadius: 999,
    padding: "4px 7px", fontSize: 8, fontWeight: 850,
  },

  verifyBox: {
    display: "flex", alignItems: "center", gap: 13,
    padding: 11, background: "var(--bt-surface-2)",
    border: "1px solid var(--bt-border)", borderRadius: 10, marginTop: 13,
  },

  fullButton: {
    width: "100%", border: "1px solid var(--bt-blue-border)",
    background: "var(--bt-surface)", color: "var(--bt-blue)",
    borderRadius: 8, padding: "10px 12px",
    marginTop: 12, fontWeight: 800, fontSize: 10, cursor: "pointer",
  },

  details: { marginTop: 13, display: "flex", flexDirection: "column" },

  detailRow: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 15,
    padding: "10px 0", borderBottom: "1px solid var(--bt-border-soft)", fontSize: 10,
  },

  recycle: {
    width: 42, height: 42, borderRadius: 11,
    background: "var(--bt-green-soft)", color: "var(--bt-green)",
    display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 23, margin: "13px 0 10px",
  },

  secondTitle: { fontSize: 18, margin: "4px 0 14px" },

  scoreRow: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 10,
    fontSize: 10, color: "var(--bt-muted)", marginTop: 9,
  },

  progress: { height: 7, background: "var(--bt-border-soft)", borderRadius: 99, overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", background: "var(--bt-green)", borderRadius: 99 },

  factorLayout: { display: "flex", alignItems: "center", gap: 12, marginTop: 8 },
  factorRow: {
    display: "flex", justifyContent: "space-between",
    gap: 10, fontSize: 10, color: "var(--bt-text-secondary)",
    padding: "7px 0", borderBottom: "1px solid var(--bt-border-soft-2)",
  },

  info: {
    marginTop: 12, padding: 9,
    background: "var(--bt-surface-2)", border: "1px solid var(--bt-border)",
    borderRadius: 8, color: "var(--bt-muted)", fontSize: 9,
  },

  mini: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  miniIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: "var(--bt-surface-2)", border: "1px solid var(--bt-border)",
    display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  },

  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  sectionTitle: { fontSize: 19, margin: "6px 0 0", color: "var(--bt-text)" },

  sliderLabels: { display: "flex", justifyContent: "space-between", color: "var(--bt-muted-2)", fontSize: 9, marginTop: 6 },

  selectedInfo: {
    display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 12, background: "var(--bt-surface-2)",
    border: "1px solid var(--bt-border)", borderRadius: 10, padding: 12, marginTop: 14,
  },

  chart: { width: "100%", height: 285, marginTop: 14 },
  noData: { textAlign: "center", padding: "70px 15px", color: "var(--bt-muted-2)", fontSize: 12 },

  recommendation: {
    background: "var(--bt-surface-2)", border: "1px solid var(--bt-border)",
    borderRadius: 11, padding: 13,
  },

  analysisGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 16, alignItems: "center", marginTop: 15,
  },

  note: {
    padding: 15, background: "var(--bt-surface-2)",
    border: "1px solid var(--bt-border)", borderRadius: 10,
    fontSize: 11, color: "var(--bt-text-secondary)",
  },

  safetyHero: { display: "flex", alignItems: "center", gap: 15, marginTop: 15 },

  riskLarge: {
    width: 72, height: 72, borderRadius: 18,
    display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 32, fontWeight: 900,
  },

  riskLargeText: { fontSize: 32, fontWeight: 950 },

  riskTrackLarge: {
    height: 11, background: "var(--bt-border-soft)",
    borderRadius: 99, overflow: "hidden", marginTop: 20,
  },

  warning: {
    background: "var(--bt-surface)beb", border: "1px solid var(--bt-warning-border)",
    color: "var(--bt-warning-text)", borderRadius: 9,
    padding: 11, fontSize: 10, lineHeight: 1.5, marginTop: 14,
  },

  metricIconLarge: {
    width: 40, height: 40, borderRadius: 10,
    background: "var(--bt-blue-soft)", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 20, marginBottom: 12,
  },

  metricValue: { fontSize: 25, fontWeight: 900, color: "var(--bt-heading)", marginTop: 4 },

  modalBackdrop: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(15,23,42,.62)",
    display: "flex", alignItems: "center",
    justifyContent: "center", padding: 18, overflowY: "auto",
  },

  modal: {
    width: "min(900px,100%)", maxHeight: "92vh",
    overflowY: "auto", background: "var(--bt-surface)",
    borderRadius: 16, padding: 22,
    boxShadow: "0 30px 80px rgba(15,23,42,.3)",
  },

  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },

  close: {
    width: 36, height: 36, borderRadius: 8,
    border: "1px solid var(--bt-border)", background: "var(--bt-surface)",
    fontSize: 21, color: "var(--bt-muted)", cursor: "pointer",
  },

  passportGrid: {
    display: "grid", gridTemplateColumns: "250px 1fr",
    gap: 18, marginTop: 18,
  },

  passportQR: {
    border: "1px solid var(--bt-border)", borderRadius: 12,
    padding: 16, display: "flex",
    flexDirection: "column", alignItems: "center",
    gap: 8, background: "var(--bt-surface-2)",
  },

  passportDetails: {
    border: "1px solid var(--bt-border)",
    borderRadius: 12, padding: "8px 14px",
  },

  passportRow: {
    display: "flex", justifyContent: "space-between",
    gap: 15, padding: "11px 0",
    borderBottom: "1px solid var(--bt-border-soft)", fontSize: 10,
  },

  factorBox: {
    display: "flex", justifyContent: "space-between",
    gap: 10, padding: 11,
    background: "var(--bt-surface-2)", border: "1px solid var(--bt-border)",
    borderRadius: 9, fontSize: 10,
  },

  passportWarning: {
    marginTop: 18, padding: 13, borderRadius: 10,
    background: "var(--bt-warning-bg)", border: "1px solid var(--bt-warning-border)",
    color: "var(--bt-warning-text)", fontSize: 10, lineHeight: 1.55,
  },

  actionsLight: { display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" },

  greenButtonLight: {
    border: 0, borderRadius: 8, padding: "10px 14px",
    background: "var(--bt-green)", color: "var(--bt-surface)",
    fontWeight: 850, fontSize: 10, cursor: "pointer",
  },

  blueButton: {
    border: 0, borderRadius: 8, padding: "10px 14px",
    background: "var(--bt-blue)", color: "var(--bt-surface)",
    fontWeight: 850, fontSize: 10, cursor: "pointer",
  },

  drop: {
    minHeight: 150, border: "2px dashed var(--bt-blue-border)",
    borderRadius: 13, background: "var(--bt-blue-soft)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 5, color: "var(--bt-blue)", cursor: "pointer",
    textAlign: "center", padding: 20,
  },

  importResult: {
    marginTop: 15, padding: 13,
    border: "1px solid var(--bt-border)",
    borderRadius: 10, background: "var(--bt-surface-2)",
  },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 10, marginTop: 10 },
  th: { textAlign: "left", padding: 8, borderBottom: "1px solid var(--bt-border-strong)" },
  td: { padding: 8, borderBottom: "1px solid var(--bt-border)" },

  error: {
    marginBottom: 13, padding: "10px 12px",
    border: "1px solid var(--bt-error-border)", background: "var(--bt-surface)7ed",
    color: "var(--bt-error-text)", borderRadius: 9,
    fontSize: 11, display: "flex",
    alignItems: "center", gap: 7,
  },

  errorClose: {
    marginLeft: "auto", border: 0,
    background: "transparent", color: "var(--bt-error-text)",
    cursor: "pointer", fontSize: 18,
  },

  footer: {
    display: "flex", justifyContent: "space-between",
    gap: 12, flexWrap: "wrap",
    padding: "20px 3px 0", color: "var(--bt-muted-2)", fontSize: 9,
  },

  loading: {
    minHeight: "100vh", background: "var(--bt-bg)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    textAlign: "center", color: "var(--bt-text)",
  },

  loader: {
    width: 34, height: 34, border: "3px solid var(--bt-border)",
    borderTop: "3px solid var(--bt-blue)", borderRadius: "50%",
    marginTop: 18, animation: "btspin 1s linear infinite",
  },

  scanner: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "var(--bt-surface)", padding: 18, overflowY: "auto",
  },

  scannerTop: {
    display: "flex", alignItems: "center",
    gap: 12, maxWidth: 520, margin: "0 auto 22px",
  },

  camera: {
    position: "relative", maxWidth: 520,
    margin: "0 auto", borderRadius: 14,
    overflow: "hidden", background: "var(--bt-border-soft-2)",
    border: "1px solid var(--bt-border)",
  },

  scannerFrame: {
    position: "absolute", left: "20%", top: "20%",
    width: "60%", height: "60%",
    border: "3px solid var(--bt-green)",
    borderRadius: 12, pointerEvents: "none",
    boxShadow: "0 0 0 9999px rgba(15,23,42,.08)",
  },

  cancel: {
    display: "block", margin: "18px auto",
    padding: "11px 28px", borderRadius: 8,
    border: "1px solid var(--bt-border-strong)",
    background: "var(--bt-surface)", color: "var(--bt-text-secondary)",
    fontWeight: 750, cursor: "pointer",
  },
};

export default App;
