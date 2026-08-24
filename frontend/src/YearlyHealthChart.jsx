import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function YearlyHealthChart({ batteryId }) {
  const [yearlyData, setYearlyData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(
      `http://127.0.0.1:8000/battery/${batteryId}/yearly-health`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load yearly health");
        }

        return response.json();
      })
      .then((data) => {
        const healthData = data.yearly_health || [];

        setYearlyData(healthData);
        setSelectedYear(0);
        setLoading(false);
      })
      .catch((error) => {
        console.error(
          "Error fetching yearly health:",
          error
        );

        setError(
          "Could not load yearly battery health."
        );

        setLoading(false);
      });
  }, [batteryId]);

  if (loading) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>
          Year-wise Battery Health
        </h2>

        <p style={styles.message}>
          Loading yearly health data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>
          Year-wise Battery Health
        </h2>

        <p style={styles.message}>
          {error}
        </p>
      </div>
    );
  }

  if (yearlyData.length === 0) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>
          Year-wise Battery Health
        </h2>

        <p style={styles.message}>
          No yearly health data available.
        </p>
      </div>
    );
  }

  const selectedData =
    yearlyData[selectedYear];

  return (
    <div style={styles.card}>

      {/* TITLE */}

      <h2 style={styles.title}>
        Year-wise Battery Health
      </h2>

      <p style={styles.subtitle}>
        Battery degradation across operational years
      </p>


      {/* SELECTED YEAR */}

      <div style={styles.selectedPanel}>

        <div style={styles.selectedLeft}>

          <p style={styles.smallLabel}>
            SELECTED YEAR
          </p>

          <h3 style={styles.selectedYear}>
            {selectedData.label}
          </h3>

          <p style={styles.status}>
            {selectedData.health_status}
          </p>

        </div>


        <div style={styles.sohBox}>

          <p style={styles.smallLabel}>
            AVERAGE SOH
          </p>

          <div style={styles.sohValue}>
            {selectedData.average_soh}%
          </div>

        </div>

      </div>


      {/* DETAILS */}

      <div style={styles.detailsGrid}>

        <div style={styles.detailCard}>
          <p style={styles.detailLabel}>
            Minimum SOH
          </p>

          <strong>
            {selectedData.minimum_soh}%
          </strong>
        </div>


        <div style={styles.detailCard}>
          <p style={styles.detailLabel}>
            Maximum SOH
          </p>

          <strong>
            {selectedData.maximum_soh}%
          </strong>
        </div>


        <div style={styles.detailCard}>
          <p style={styles.detailLabel}>
            Battery Cycles
          </p>

          <strong>
            {selectedData.cycles}
          </strong>
        </div>

      </div>


      {/* CHART */}

      <ResponsiveContainer
        width="100%"
        height={300}
      >

        <BarChart
          data={yearlyData}
          margin={{
            top: 20,
            right: 20,
            left: 10,
            bottom: 10,
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--bt-chart-grid)"
          />

          <XAxis
            dataKey="label"
            stroke="var(--bt-chart-muted)"
          />

          <YAxis
            domain={[0, 100]}
            stroke="var(--bt-chart-muted)"
            label={{
              value: "SOH (%)",
              angle: -90,
              position: "insideLeft",
              fill: "var(--bt-chart-muted)",
            }}
          />

          <Tooltip
            contentStyle={{
              background: "var(--bt-chart-soft)",
              border: "1px solid var(--bt-chart-grid)",
              borderRadius: "10px",
              color: "white",
            }}
            formatter={(value) => [
              `${value}%`,
              "Average SOH",
            ]}
          />

          <Bar
            dataKey="average_soh"
            radius={[8, 8, 0, 0]}
            onClick={(_, index) => {
              setSelectedYear(index);
            }}
          >

            {yearlyData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  index === selectedYear
                    ? "var(--bt-chart-cyan)"
                    : "var(--bt-chart-blue-dark)"
                }
              />
            ))}

          </Bar>

        </BarChart>

      </ResponsiveContainer>


      {/* SLIDER */}

      <div style={styles.sliderSection}>

        <div style={styles.sliderHeader}>

          <span>
            Year 1
          </span>

          <strong>
            {selectedData.label}
          </strong>

          <span>
            Year {yearlyData.length}
          </span>

        </div>


        <input
          type="range"
          min="0"
          max={yearlyData.length - 1}
          value={selectedYear}
          onChange={(event) =>
            setSelectedYear(
              Number(event.target.value)
            )
          }
          style={styles.slider}
        />


        {/* YEAR DOTS */}

        <div style={styles.yearDots}>

          {yearlyData.map((year, index) => (

            <button
              key={year.year}
              onClick={() =>
                setSelectedYear(index)
              }
              style={{
                ...styles.yearButton,

                ...(index === selectedYear
                  ? styles.activeYearButton
                  : {}),
              }}
            >
              {year.year}
            </button>

          ))}

        </div>

      </div>

    </div>
  );
}


/* ============================================================
   STYLES
   ============================================================ */

const styles = {

  card: {
    background: "var(--bt-chart-soft)",
    borderRadius: "20px",
    padding: "30px",
    marginTop: "25px",
    border: "1px solid var(--bt-border)",
  },

  title: {
    color: "white",
    textAlign: "center",
    marginBottom: "8px",
    fontSize: "28px",
  },

  subtitle: {
    color: "var(--bt-chart-muted)",
    textAlign: "center",
    marginBottom: "25px",
  },

  message: {
    color: "var(--bt-chart-muted)",
    textAlign: "center",
    padding: "40px",
  },

  selectedPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--bt-chart-surface)",
    borderRadius: "16px",
    padding: "22px 28px",
    marginBottom: "20px",
    border: "1px solid var(--bt-chart-grid)",
  },

  selectedLeft: {
    textAlign: "left",
  },

  smallLabel: {
    color: "var(--bt-chart-muted-2)",
    fontSize: "12px",
    letterSpacing: "2px",
    fontWeight: "600",
    margin: "0 0 8px 0",
  },

  selectedYear: {
    color: "white",
    fontSize: "25px",
    margin: 0,
  },

  status: {
    color: "var(--bt-chart-cyan)",
    fontWeight: "600",
    marginTop: "7px",
    marginBottom: 0,
  },

  sohBox: {
    textAlign: "right",
  },

  sohValue: {
    color: "white",
    fontSize: "38px",
    fontWeight: "700",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    gap: "15px",
    marginBottom: "25px",
  },

  detailCard: {
    background: "var(--bt-chart-surface)",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center",
    border: "1px solid var(--bt-chart-grid)",
  },

  detailLabel: {
    color: "var(--bt-chart-muted-2)",
    fontSize: "12px",
    marginBottom: "8px",
  },

  detailCardStrong: {
    color: "white",
  },

  sliderSection: {
    marginTop: "20px",
    padding: "20px",
    background: "var(--bt-chart-deep)",
    borderRadius: "15px",
  },

  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "var(--bt-chart-muted)",
    marginBottom: "15px",
  },

  slider: {
    width: "100%",
    cursor: "pointer",
    accentColor: "var(--bt-chart-cyan)",
  },

  yearDots: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "12px",
    flexWrap: "wrap",
  },

  yearButton: {
    background: "transparent",
    border: "1px solid var(--bt-chart-grid)",
    color: "var(--bt-chart-muted)",
    borderRadius: "8px",
    padding: "6px 12px",
    cursor: "pointer",
  },

  activeYearButton: {
    background: "var(--bt-chart-cyan)",
    color: "var(--bt-bg)",
    border: "1px solid var(--bt-chart-cyan)",
    fontWeight: "700",
  },

};

export default YearlyHealthChart;