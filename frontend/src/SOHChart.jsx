import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function SOHChart({ batteryId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(
      `http://127.0.0.1:8000/battery/${batteryId}/history`
    )
      .then((response) => response.json())
      .then((data) => {
        setHistory(data.history || []);
      })
      .catch((error) => {
        console.error(
          "Error fetching battery history:",
          error
        );
      });
  }, [batteryId]);

  return (
    <div style={styles.card}>

      <div style={styles.chartHeader}>
        <div>
          <p style={styles.label}>
            HISTORICAL PERFORMANCE
          </p>

          <h3 style={styles.title}>
            State of Health
          </h3>
        </div>

        <div style={styles.legend}>
          <span style={styles.legendDot}></span>
          SOH %
        </div>
      </div>

      <div style={styles.chartContainer}>

        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={history}
            margin={{
              top: 15,
              right: 5,
              left: -15,
              bottom: 5,
            }}
          >

            <defs>

              <linearGradient
                id="sohGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--bt-chart-cyan)"
                  stopOpacity={0.25}
                />

                <stop
                  offset="100%"
                  stopColor="var(--bt-chart-cyan)"
                  stopOpacity={0}
                />
              </linearGradient>

            </defs>

            <CartesianGrid
              stroke="var(--bt-chart-grid)"
              strokeDasharray="4 4"
              vertical={false}
            />

            <XAxis
              dataKey="cycle"
              tick={{
                fill: "var(--bt-chart-muted)",
                fontSize: 10,
              }}
              axisLine={{
                stroke: "var(--bt-border)",
              }}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{
                fill: "var(--bt-chart-muted)",
                fontSize: 10,
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              contentStyle={{
                background: "var(--bt-surface)",
                border: "1px solid var(--bt-border)",
                borderRadius: "12px",
                boxShadow:
                  "0 8px 25px rgba(30,50,80,0.10)",
              }}
              labelStyle={{
                color: "var(--bt-text-secondary)",
                fontWeight: 700,
              }}
              itemStyle={{
                color: "var(--bt-chart-blue)",
                fontWeight: 700,
              }}
              formatter={(value) => [
                `${Number(value).toFixed(2)}%`,
                "SOH",
              ]}
            />

            <Line
              type="monotone"
              dataKey="soh"
              stroke="var(--bt-chart-blue)"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 6,
                fill: "var(--bt-surface)",
                stroke: "var(--bt-chart-blue)",
                strokeWidth: 3,
              }}
            />

          </LineChart>
        </ResponsiveContainer>

      </div>

      <div style={styles.bottomText}>
        Battery degradation across charge/discharge cycles
      </div>

    </div>
  );
}


const styles = {

  card: {
    background: "var(--bt-surface)",
    border: "1px solid var(--bt-border)",
    borderRadius: "22px",
    padding: "18px 14px 14px",
    boxShadow:
      "0 8px 25px rgba(30,50,80,0.05)",
  },

  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    padding: "0 3px",
  },

  label: {
    margin: 0,
    color: "var(--bt-chart-muted-2)",
    fontSize: "9px",
    fontWeight: 800,
    letterSpacing: "1px",
  },

  title: {
    margin: "4px 0 0",
    fontSize: "17px",
    color: "var(--bt-text)",
  },

  legend: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    color: "var(--bt-chart-secondary)",
    fontSize: "10px",
    fontWeight: 700,
  },

  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--bt-chart-blue)",
  },

  chartContainer: {
    width: "100%",
    height: "280px",
  },

  bottomText: {
    color: "var(--bt-muted-2)",
    fontSize: "9px",
    marginTop: "5px",
    textAlign: "center",
  },

};

export default SOHChart;