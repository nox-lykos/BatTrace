import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Html5Qrcode } from "html5-qrcode";

const API = "http://127.0.0.1:8000";

const BATTERIES = [
  "B0005",
  "B0006",
  "B0007",
  "B0018",
];

function App() {
  const [batteryId, setBatteryId] = useState("B0006");

  const [battery, setBattery] = useState(null);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);

  // ---------------------------------------------------------
  // LOAD BATTERY
  // ---------------------------------------------------------

  useEffect(() => {
    loadBattery(batteryId);
  }, [batteryId]);

  async function loadBattery(id) {
    try {
      setLoading(true);
      setError("");

      const batteryResponse = await fetch(
        `${API}/battery/${id}`
      );

      if (!batteryResponse.ok) {
        throw new Error("Battery not found");
      }

      const batteryData = await batteryResponse.json();

      setBattery(batteryData);

      // ---------------- HISTORY ----------------

      try {
        const historyResponse = await fetch(
          `${API}/battery/${id}/history`
        );

        if (historyResponse.ok) {
          const historyData =
            await historyResponse.json();

          const historyList =
            historyData.history || [];

          setHistory(historyList);

          if (historyList.length > 0) {
            setSelectedIndex(
              historyList.length - 1
            );
          }
        } else {
          setHistory([]);
        }
      } catch (historyError) {
        console.error(
          "History error:",
          historyError
        );

        setHistory([]);
      }

      // ---------------- FORECAST ----------------

      try {
        const forecastResponse = await fetch(
          `${API}/battery/${id}/forecast`
        );

        if (forecastResponse.ok) {
          const forecastData =
            await forecastResponse.json();

          setForecast(
            forecastData.forecast || []
          );
        } else {
          setForecast([]);
        }
      } catch (forecastError) {
        console.error(
          "Forecast error:",
          forecastError
        );

        setForecast([]);
      }
    } catch (err) {
      console.error(err);

      setBattery(null);
      setHistory([]);
      setForecast([]);

      setError(
        "Could not load battery data. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // QR RESULT
  // ---------------------------------------------------------

  function processQRResult(result) {
    if (!result) {
      setError("QR code is empty.");
      return;
    }

    let scannedId = result.trim().toUpperCase();

    /*
      Supports:
      B0005

      BATTERY:B0005

      https://bat-trace.com/battery/B0005
    */

    if (scannedId.includes("/")) {
      const parts = scannedId.split("/");
      scannedId = parts[parts.length - 1];
    }

    scannedId = scannedId.replace(
      "BATTERY:",
      ""
    );

    scannedId = scannedId.trim();

    console.log("Decoded battery ID:", scannedId);

    if (!BATTERIES.includes(scannedId)) {
      setError(
        `Battery "${scannedId}" is not registered in BatTrace.`
      );
      return;
    }

    setError("");
    setBatteryId(scannedId);
    setScannerOpen(false);
    setUploadMode(false);
  }

  // ---------------------------------------------------------
  // QR UPLOAD
  // ---------------------------------------------------------

  async function handleQRUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError("");

      if (!file.type.startsWith("image/")) {
        throw new Error(
          "Please upload an image file."
        );
      }

      const fileScanner = new Html5Qrcode(
        "qr-file-reader"
      );

      console.log(
        "Scanning uploaded QR:",
        file.name
      );

      const result =
        await fileScanner.scanFile(
          file,
          true
        );

      console.log(
        "QR decoded successfully:",
        result
      );

      try {
        await fileScanner.clear();
      } catch {}

      processQRResult(result);
    } catch (err) {
      console.error(
        "QR upload error:",
        err
      );

      setError(
        "Could not read the QR code. Please upload a clear QR image."
      );
    }

    event.target.value = "";
  }

  // ---------------------------------------------------------
  // SELECTED HISTORY
  // ---------------------------------------------------------

  const selectedHistory =
    history.length > 0
      ? history[selectedIndex]
      : null;

  /*
    The SOH shown in the large card changes when
    the timeline slider moves.
  */

  const currentSOH = selectedHistory
    ? Number(selectedHistory.soh)
    : Number(battery?.predicted_soh ?? 0);

  const selectedCycle =
    selectedHistory?.cycle ??
    battery?.cycle ??
    0;

  const selectedTemperature =
    selectedHistory?.temperature ??
    selectedHistory?.temperature_mean ??
    battery?.temperature ??
    0;

  const selectedVoltage =
    selectedHistory?.voltage ??
    selectedHistory?.voltage_mean ??
    battery?.voltage ??
    0;

  const selectedCurrent =
    selectedHistory?.current ??
    selectedHistory?.current_mean ??
    battery?.current ??
    0;

  // ---------------------------------------------------------
  // HEALTH HELPERS
  // ---------------------------------------------------------

  function getHealthColor(soh) {
    if (soh >= 80) return "#16a34a";
    if (soh >= 60) return "#d97706";
    if (soh >= 40) return "#ea580c";
    return "#dc2626";
  }

  function getHealthText(soh) {
    if (soh >= 80) return "Healthy";
    if (soh >= 60) return "Moderate";
    if (soh >= 40) return "Degraded";
    return "Critical";
  }

  // ---------------------------------------------------------
  // TIMELINE LABEL
  // ---------------------------------------------------------

  function getTimelineLabel(item, index) {
    if (item?.year) {
      return `Year ${item.year}`;
    }

    if (item?.date) {
      const date = new Date(item.date);

      if (!Number.isNaN(date.getTime())) {
        return date.getFullYear().toString();
      }
    }

    if (item?.timestamp) {
      const date = new Date(item.timestamp);

      if (!Number.isNaN(date.getTime())) {
        return date.getFullYear().toString();
      }
    }

    return `Cycle ${item?.cycle ?? index + 1}`;
  }

  // ---------------------------------------------------------
  // CHART DATA
  // ---------------------------------------------------------

  const historyChartData = history.map(
    (item) => ({
      cycle: Number(item.cycle),
      soh: Number(item.soh),
    })
  );

  const forecastChartData = forecast.map(
    (item) => ({
      cycle: Number(item.cycle),
      soh: Number(item.soh),
    })
  );

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingIcon}>
          🔋
        </div>

        <h2>BatTrace</h2>

        <p>
          Loading battery intelligence...
        </p>

        <div style={styles.loader} />
      </div>
    );
  }

  // ---------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------

  if (error && !battery) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.errorIcon}>
          ⚠️
        </div>

        <h2>Unable to load battery</h2>

        <p>{error}</p>

        <button
          style={styles.retryButton}
          onClick={() => loadBattery(batteryId)}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------

  return (
    <div style={styles.app}>

      {/* ---------------------------------------------
          HEADER
      --------------------------------------------- */}

      <header style={styles.header}>

        <div>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>
              🔋
            </span>

            BatTrace
          </div>

          <div style={styles.subtitle}>
            EV Battery Intelligence Platform
          </div>
        </div>

        <div style={styles.liveBadge}>
          <span style={styles.liveDot} />
          LIVE
        </div>

      </header>

      {/* ---------------------------------------------
          MAIN
      --------------------------------------------- */}

      <main style={styles.main}>

        {/* QR SECTION */}

        <section style={styles.scanCard}>

          <div style={styles.scanTop}>

            <div>

              <div style={styles.govLabel}>
                BATTERY IDENTIFICATION
              </div>

              <h2 style={styles.scanTitle}>
                Identify your battery
              </h2>

              <p style={styles.scanSubtitle}>
                Scan or upload the battery QR code
                to retrieve its health data.
              </p>

            </div>

            <div style={styles.qrIcon}>
              ▣
            </div>

          </div>

          <button
            style={styles.primaryButton}
            onClick={() => {
              setError("");
              setScannerOpen(true);
            }}
          >
            <span>▣</span>
            Scan Battery QR
          </button>

          <label style={styles.uploadButton}>

            <span>📁</span>

            Upload QR from Device

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleQRUpload}
              style={{
                display: "none",
              }}
            />

          </label>

          {error && (
            <div style={styles.errorBanner}>
              <span>⚠️</span>
              {error}
              <button
                onClick={() => setError("")}
                style={styles.errorClose}
              >
                ×
              </button>
            </div>
          )}

        </section>

        {/* Hidden QR reader for uploaded images */}

        <div
          id="qr-file-reader"
          style={{
            width: "1px",
            height: "1px",
            overflow: "hidden",
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        {/* ---------------------------------------------
            BATTERY SELECTOR
        --------------------------------------------- */}

        <section style={styles.selectorCard}>

          <div style={styles.cardHeader}>

            <div>
              <div style={styles.govLabel}>
                REGISTERED BATTERY
              </div>

              <h3 style={styles.cardTitle}>
                Battery ID
              </h3>
            </div>

            <div style={styles.cycleBadge}>
              Cycle {selectedCycle}
            </div>

          </div>

          <select
            value={batteryId}
            onChange={(e) =>
              setBatteryId(e.target.value)
            }
            style={styles.select}
          >
            {BATTERIES.map((id) => (
              <option
                key={id}
                value={id}
              >
                {id}
              </option>
            ))}
          </select>

        </section>

        {/* ---------------------------------------------
            SOH HERO
        --------------------------------------------- */}

        <section style={styles.sohCard}>

          <div style={styles.sohContent}>

            <div style={styles.govLabel}>
              STATE OF HEALTH
            </div>

            <div style={styles.sohValue}>
              {currentSOH.toFixed(2)}
              <span>%</span>
            </div>

            <div
              style={{
                ...styles.healthBadge,
                color:
                  getHealthColor(currentSOH),
                backgroundColor:
                  `${getHealthColor(
                    currentSOH
                  )}15`,
              }}
            >
              ● {getHealthText(currentSOH)}
            </div>

            <p style={styles.sohDescription}>
              Battery health at the selected
              point in its lifecycle.
            </p>

          </div>

          <div
            style={{
              ...styles.healthRing,
              background:
                `conic-gradient(
                  ${getHealthColor(currentSOH)}
                  ${Math.max(
                    0,
                    Math.min(
                      currentSOH * 3.6,
                      360
                    )
                  )}deg,
                  #e5e7eb 0deg
                )`,
            }}
          >

            <div style={styles.healthRingInner}>

              <span>SOH</span>

              <strong>
                {Math.round(currentSOH)}%
              </strong>

            </div>

          </div>

        </section>

        {/* ---------------------------------------------
            YEAR / TIMELINE SLIDER
        --------------------------------------------- */}

        {history.length > 0 && (
          <section style={styles.timelineCard}>

            <div style={styles.timelineHeader}>

              <div>

                <div style={styles.govLabel}>
                  BATTERY LIFECYCLE
                </div>

                <h3 style={styles.cardTitle}>
                  Timeline
                </h3>

              </div>

              <div style={styles.timelineValue}>
                {getTimelineLabel(
                  selectedHistory,
                  selectedIndex
                )}
              </div>

            </div>

            <input
              type="range"
              min="0"
              max={history.length - 1}
              value={selectedIndex}
              onChange={(e) =>
                setSelectedIndex(
                  Number(e.target.value)
                )
              }
              style={{
                ...styles.slider,
                accentColor:
                  getHealthColor(
                    currentSOH
                  ),
              }}
            />

            <div style={styles.sliderLabels}>

              <span>
                {getTimelineLabel(
                  history[0],
                  0
                )}
              </span>

              <span>
                {getTimelineLabel(
                  history[
                    history.length - 1
                  ],
                  history.length - 1
                )}
              </span>

            </div>

            <div style={styles.selectedInfo}>

              <div>
                <span>Selected Cycle</span>
                <strong>
                  {selectedCycle}
                </strong>
              </div>

              <div>
                <span>SOH</span>

                <strong
                  style={{
                    color:
                      getHealthColor(
                        currentSOH
                      ),
                  }}
                >
                  {currentSOH.toFixed(2)}%
                </strong>
              </div>

              <div>
                <span>Status</span>

                <strong>
                  {getHealthText(
                    currentSOH
                  )}
                </strong>
              </div>

            </div>

          </section>
        )}

        {/* ---------------------------------------------
            LIVE BATTERY DATA
        --------------------------------------------- */}

        <section style={styles.dataGrid}>

          <InfoCard
            icon="❤️"
            title="Health"
            value={getHealthText(
              currentSOH
            )}
          />

          <InfoCard
            icon="⚠️"
            title="Risk"
            value={
              battery?.risk_level ??
              "N/A"
            }
          />

          <InfoCard
            icon="🌡️"
            title="Temperature"
            value={`${Number(
              selectedTemperature
            ).toFixed(1)} °C`}
          />

          <InfoCard
            icon="⚡"
            title="Voltage"
            value={`${Number(
              selectedVoltage
            ).toFixed(3)} V`}
          />

          <InfoCard
            icon="🔌"
            title="Current"
            value={`${Number(
              selectedCurrent
            ).toFixed(3)} A`}
          />

          <InfoCard
            icon="🔄"
            title="Cycle"
            value={selectedCycle}
          />

        </section>

        {/* ---------------------------------------------
            HISTORY CHART
        --------------------------------------------- */}

        <section style={styles.chartCard}>

          <div style={styles.chartHeader}>

            <div>

              <div style={styles.govLabel}>
                HISTORICAL ANALYSIS
              </div>

              <h2 style={styles.chartTitle}>
                Battery Health History
              </h2>

              <p style={styles.chartSubtitle}>
                State of Health across battery
                cycles
              </p>

            </div>

            <div style={styles.chartBadge}>
              {history.length} records
            </div>

          </div>

          {history.length > 0 ? (

            <div style={styles.chartWrapper}>

              <ResponsiveContainer
                width="100%"
                height={300}
              >

                <LineChart
                  data={historyChartData}
                  margin={{
                    top: 15,
                    right: 10,
                    left: -15,
                    bottom: 10,
                  }}
                >

                  <CartesianGrid
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                  />

                  <XAxis
                    dataKey="cycle"
                    stroke="#64748b"
                    tick={{
                      fill: "#64748b",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{
                      fill: "#64748b",
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      background:
                        "#ffffff",
                      border:
                        "1px solid #dbe3ec",
                      borderRadius:
                        "10px",
                      color:
                        "#1e293b",
                      boxShadow:
                        "0 8px 25px rgba(15,23,42,0.10)",
                    }}
                    labelStyle={{
                      color:
                        "#64748b",
                    }}
                  />

                  <ReferenceLine
                    y={80}
                    stroke="#16a34a"
                    strokeDasharray="5 5"
                  />

                  <Line
                    type="monotone"
                    dataKey="soh"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "#2563eb",
                    }}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <div style={styles.noData}>
              No historical battery data
              available.
            </div>

          )}

        </section>

        {/* ---------------------------------------------
            FORECAST
        --------------------------------------------- */}

        <section style={styles.chartCard}>

          <div style={styles.chartHeader}>

            <div>

              <div style={styles.govLabel}>
                PREDICTIVE ANALYSIS
              </div>

              <h2 style={styles.chartTitle}>
                Future Battery Health
              </h2>

              <p style={styles.chartSubtitle}>
                Predicted degradation over the
                next 100 cycles
              </p>

            </div>

            <div style={styles.forecastIcon}>
              ◇
            </div>

          </div>

          {forecast.length > 0 ? (

            <>

              <div style={styles.forecastSummary}>

                <div>
                  <span>
                    Current SOH
                  </span>

                  <strong>
                    {Number(
                      forecast[0].soh
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div style={styles.forecastArrow}>
                  →
                </div>

                <div>
                  <span>
                    Forecast SOH
                  </span>

                  <strong
                    style={{
                      color: "#d97706",
                    }}
                  >
                    {Number(
                      forecast[
                        forecast.length - 1
                      ].soh
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

              </div>

              <div style={styles.chartWrapper}>

                <ResponsiveContainer
                  width="100%"
                  height={300}
                >

                  <LineChart
                    data={forecastChartData}
                    margin={{
                      top: 15,
                      right: 10,
                      left: -15,
                      bottom: 10,
                    }}
                  >

                    <CartesianGrid
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      dataKey="cycle"
                      stroke="#64748b"
                      tick={{
                        fill: "#64748b",
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      tick={{
                        fill: "#64748b",
                        fontSize: 11,
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#ffffff",
                        border:
                          "1px solid #dbe3ec",
                        borderRadius:
                          "10px",
                        color:
                          "#1e293b",
                        boxShadow:
                          "0 8px 25px rgba(15,23,42,0.10)",
                      }}
                    />

                    <ReferenceLine
                      y={80}
                      stroke="#16a34a"
                      strokeDasharray="5 5"
                      label={{
                        value:
                          "80% Health",
                        fill:
                          "#64748b",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="soh"
                      stroke="#d97706"
                      strokeWidth={3}
                      dot={false}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>

            </>

          ) : (

            <div style={styles.noData}>
              Future prediction is currently
              unavailable.
            </div>

          )}

        </section>

        {/* ---------------------------------------------
            SYSTEM STATUS
        --------------------------------------------- */}

        <section style={styles.systemCard}>

          <div>

            <div style={styles.govLabel}>
              SYSTEM STATUS
            </div>

            <h3 style={styles.systemTitle}>
              Battery analysis completed
            </h3>

          </div>

          <div style={styles.online}>
            <span />
            Model Online
          </div>

        </section>

      </main>


      {/* ---------------------------------------------
          QR CAMERA SCANNER
      --------------------------------------------- */}

      {scannerOpen && (
        <QRScanner
          onResult={processQRResult}
          onClose={() =>
            setScannerOpen(false)
          }
        />
      )}

    </div>
  );
}

// =========================================================
// INFO CARD
// =========================================================

function InfoCard({
  icon,
  title,
  value,
}) {
  return (
    <div style={styles.infoCard}>

      <div style={styles.infoIcon}>
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>

        <div style={styles.infoTitle}>
          {title}
        </div>

        <div style={styles.infoValue}>
          {value}
        </div>

      </div>

    </div>
  );
}

// =========================================================
// QR SCANNER
// =========================================================

function QRScanner({
  onResult,
  onClose,
}) {
  const scannerRef =
    useRef(null);

  const resultHandlerRef =
    useRef(onResult);

  useEffect(() => {
    resultHandlerRef.current =
      onResult;
  }, [onResult]);

  useEffect(() => {
    let scanner;

    async function startScanner() {
      try {
        scanner =
          new Html5Qrcode(
            "qr-camera-reader"
          );

        scannerRef.current =
          scanner;

        await scanner.start(
          {
            facingMode:
              "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 240,
              height: 240,
            },
          },
          (decodedText) => {
            resultHandlerRef.current(
              decodedText
            );

            scanner
              .stop()
              .catch(() => {});
          },
          () => {}
        );
      } catch (error) {
        console.error(
          "Camera scanner error:",
          error
        );
      }
    }

    startScanner();

    return () => {
      if (
        scanner &&
        scanner.isScanning
      ) {
        scanner
          .stop()
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div style={styles.scannerOverlay}>

      <div style={styles.scannerTopBar}>

        <button
          onClick={onClose}
          style={styles.closeButton}
        >
          ←
        </button>

        <div>
          <strong>
            Scan Battery
          </strong>

          <small>
            Position the QR code inside
            the frame
          </small>
        </div>

      </div>

      <div style={styles.cameraBox}>

        <div
          id="qr-camera-reader"
          style={{
            width: "100%",
          }}
        />

        <div
          style={styles.scannerFrame}
        />

      </div>

      <div
        style={styles.scannerText}
      >
        <div style={styles.bigQR}>
          ▣
        </div>

        <h3>
          Scan the battery QR code
        </h3>

        <p>
          BatTrace will identify the
          battery and retrieve its
          health information.
        </p>
      </div>

      <button
        style={styles.cancelButton}
        onClick={onClose}
      >
        Cancel
      </button>

    </div>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = {

  // -------------------------------------------------------
  // APP
  // -------------------------------------------------------

  app: {
    minHeight: "100vh",
    background: "#f5f7fa",
    color: "#172033",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "25px",
  },

  // -------------------------------------------------------
  // LOADING
  // -------------------------------------------------------

  loadingScreen: {
    minHeight: "100vh",
    background: "#f5f7fa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "25px",
    color: "#172033",
  },

  loadingIcon: {
    fontSize: "52px",
    marginBottom: "12px",
  },

  errorIcon: {
    fontSize: "48px",
    marginBottom: "15px",
  },

  loader: {
    width: "34px",
    height: "34px",
    border:
      "3px solid #dbe3ec",
    borderTop:
      "3px solid #2563eb",
    borderRadius: "50%",
    marginTop: "20px",
    animation:
      "spin 1s linear infinite",
  },

  retryButton: {
    marginTop: "20px",
    border: "none",
    borderRadius: "8px",
    padding: "12px 22px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: "700",
  },

  // -------------------------------------------------------
  // HEADER
  // -------------------------------------------------------

  header: {
    background: "#ffffff",
    borderBottom:
      "1px solid #dbe3ec",
    minHeight: "72px",
    padding:
      "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  logo: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#173b67",
    letterSpacing: "-0.5px",
  },

  logoIcon: {
    marginRight: "7px",
  },

  subtitle: {
    color: "#64748b",
    fontSize: "11px",
    marginTop: "3px",
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    border:
      "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: "20px",
    padding:
      "6px 9px",
    fontSize: "10px",
    fontWeight: "700",
  },

  liveDot: {
    width: "6px",
    height: "6px",
    background: "#16a34a",
    borderRadius: "50%",
  },

  // -------------------------------------------------------
  // MAIN
  // -------------------------------------------------------

  main: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto",
    padding: "16px",
  },

  // -------------------------------------------------------
  // LABELS
  // -------------------------------------------------------

  govLabel: {
    color: "#64748b",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
  },

  // -------------------------------------------------------
  // QR CARD
  // -------------------------------------------------------

  scanCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "12px",
    boxShadow:
      "0 2px 8px rgba(15,23,42,0.04)",
  },

  scanTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },

  scanTitle: {
    fontSize: "20px",
    margin:
      "7px 0 5px",
    color: "#172033",
  },

  scanSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "1.5",
  },

  qrIcon: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "25px",
  },

  primaryButton: {
    width: "100%",
    marginTop: "16px",
    border: "none",
    borderRadius: "8px",
    padding: "13px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  },

  uploadButton: {
    width: "100%",
    marginTop: "9px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "12px",
    background: "#ffffff",
    color: "#334155",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
  },

  errorBanner: {
    marginTop: "12px",
    padding: "11px",
    border:
      "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: "8px",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  errorClose: {
    marginLeft: "auto",
    border: "none",
    background: "none",
    color: "#c2410c",
    fontSize: "20px",
    cursor: "pointer",
  },

  // -------------------------------------------------------
  // SELECTOR
  // -------------------------------------------------------

  selectorCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "12px",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "12px",
  },

  cardTitle: {
    margin:
      "5px 0 0",
    fontSize: "17px",
    color: "#172033",
  },

  cycleBadge: {
    background: "#f1f5f9",
    color: "#475569",
    border:
      "1px solid #e2e8f0",
    borderRadius: "20px",
    padding:
      "6px 9px",
    fontSize: "10px",
    whiteSpace: "nowrap",
  },

  select: {
    width: "100%",
    padding: "12px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#172033",
    fontSize: "15px",
    fontWeight: "700",
    outline: "none",
  },

  // -------------------------------------------------------
  // SOH
  // -------------------------------------------------------

  sohCard: {
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
    border:
      "1px solid #cbdcf0",
    borderRadius: "14px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "10px",
    boxShadow:
      "0 3px 12px rgba(37,99,235,0.06)",
  },

  sohContent: {
    minWidth: 0,
  },

  sohValue: {
    fontSize: "48px",
    fontWeight: "900",
    letterSpacing: "-2px",
    color: "#173b67",
    margin:
      "6px 0",
  },

  sohDescription: {
    color: "#64748b",
    fontSize: "11px",
    lineHeight: "1.4",
    margin:
      "9px 0 0",
    maxWidth: "240px",
  },

  healthBadge: {
    display: "inline-block",
    padding:
      "5px 9px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: "800",
  },

  healthRing: {
    width: "100px",
    height: "100px",
    minWidth: "100px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  healthRingInner: {
    width: "78px",
    height: "78px",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "inset 0 0 0 1px #e2e8f0",
  },

  // -------------------------------------------------------
  // TIMELINE
  // -------------------------------------------------------

  timelineCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "12px",
    boxShadow:
      "0 2px 8px rgba(15,23,42,0.04)",
  },

  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "17px",
  },

  timelineValue: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border:
      "1px solid #bfdbfe",
    borderRadius: "20px",
    padding:
      "7px 10px",
    fontSize: "11px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  slider: {
    width: "100%",
    height: "5px",
    cursor: "pointer",
  },

  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "7px",
    color: "#94a3b8",
    fontSize: "9px",
  },

  selectedInfo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    marginTop: "14px",
    background: "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "11px 5px",
    textAlign: "center",
  },

  // -------------------------------------------------------
  // DATA GRID
  // -------------------------------------------------------

  dataGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "9px",
    marginBottom: "12px",
  },

  infoCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "10px",
    padding: "12px 10px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
  },

  infoIcon: {
    width: "36px",
    height: "36px",
    minWidth: "36px",
    borderRadius: "8px",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },

  infoTitle: {
    color: "#64748b",
    fontSize: "8px",
    fontWeight: "700",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },

  infoValue: {
    color: "#172033",
    fontSize: "14px",
    fontWeight: "800",
    marginTop: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  // -------------------------------------------------------
  // CHARTS
  // -------------------------------------------------------

  chartCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "12px",
    padding: "17px 10px",
    marginBottom: "12px",
    boxShadow:
      "0 2px 8px rgba(15,23,42,0.04)",
  },

  chartHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
    padding: "0 6px",
  },

  chartTitle: {
    fontSize: "19px",
    margin:
      "6px 0 4px",
    color: "#172033",
  },

  chartSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "11px",
  },

  chartBadge: {
    background: "#eff6ff",
    color: "#2563eb",
    border:
      "1px solid #bfdbfe",
    borderRadius: "20px",
    padding:
      "6px 8px",
    fontSize: "9px",
    whiteSpace: "nowrap",
  },

  chartWrapper: {
    width: "100%",
    height: "300px",
    marginTop: "14px",
  },

  noData: {
    textAlign: "center",
    padding: "55px 15px",
    color: "#94a3b8",
    fontSize: "13px",
  },

  // -------------------------------------------------------
  // FORECAST
  // -------------------------------------------------------

  forecastIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    background: "#fff7ed",
    color: "#d97706",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },

  forecastSummary: {
    display: "grid",
    gridTemplateColumns:
      "1fr auto 1fr",
    alignItems: "center",
    gap: "8px",
    marginTop: "15px",
    background: "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: "9px",
    padding: "13px",
    textAlign: "center",
  },

  forecastArrow: {
    color: "#94a3b8",
    fontSize: "20px",
  },

  // -------------------------------------------------------
  // SYSTEM
  // -------------------------------------------------------

  systemCard: {
    background: "#ffffff",
    border:
      "1px solid #dbe3ec",
    borderRadius: "12px",
    padding: "17px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "15px",
  },

  systemTitle: {
    margin:
      "5px 0 0",
    fontSize: "14px",
    color: "#172033",
  },

  online: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    color: "#15803d",
    fontSize: "10px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  // -------------------------------------------------------
  // QR SCANNER
  // -------------------------------------------------------

  scannerOverlay: {
    position: "fixed",
    inset: 0,
    background: "#ffffff",
    zIndex: 100,
    padding: "18px",
    overflowY: "auto",
  },

  scannerTopBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "25px",
  },

  closeButton: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#172033",
    fontSize: "22px",
    cursor: "pointer",
  },

  cameraBox: {
    position: "relative",
    maxWidth: "420px",
    margin: "0 auto",
    borderRadius: "14px",
    overflow: "hidden",
    background: "#f1f5f9",
    border:
      "1px solid #dbe3ec",
  },

  scannerFrame: {
    position: "absolute",
    left: "20%",
    top: "20%",
    width: "60%",
    height: "60%",
    border:
      "3px solid #2563eb",
    borderRadius: "12px",
    pointerEvents: "none",
    boxShadow:
      "0 0 0 9999px rgba(15,23,42,0.08)",
  },

  scannerText: {
    maxWidth: "350px",
    margin: "28px auto",
    textAlign: "center",
  },

  bigQR: {
    fontSize: "45px",
    color: "#2563eb",
  },

  cancelButton: {
    display: "block",
    margin:
      "20px auto",
    padding:
      "12px 30px",
    borderRadius: "8px",
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: "700",
    cursor: "pointer",
  },
};

export default App;