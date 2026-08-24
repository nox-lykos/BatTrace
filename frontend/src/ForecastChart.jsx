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

function ForecastChart({ batteryId }) {
  const [forecast, setForecast] = useState([]);
  const [currentSOH, setCurrentSOH] = useState(null);

  useEffect(() => {
    fetch(
      `http://127.0.0.1:8000/battery/${batteryId}/forecast`
    )
      .then((response) => response.json())
      .then((data) => {
        setForecast(data.forecast || []);
        setCurrentSOH(data.current_soh);
      })
      .catch((error) => {
        console.error(
          "Error fetching forecast:",
          error
        );
      });
  }, [batteryId]);

  return (
    <div style={styles.card}>

      <div style={styles.header}>

        <div>
          <p style={styles.label}>
            PREDICTIVE ANALYSIS
          </p>

          <h3 style={styles.title}>
            Future Health Forecast
          </h3>
        </div>

        <div style={styles.forecastBadge}>
          🔮 Forecast
        </div>

      </div>


      {currentSOH !== null && (
        <div style={styles.currentBox}>

          <div>
            <p style={styles.smallLabel}>
              CURRENT SOH
            </p>

            <strong style={styles.currentValue}>
              {Number(currentSOH).toFixed(2)}%
            </strong>
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div>
            <p style={styles.smallLabel}>
              PROJECTED
            </p>

            <strong style={styles.projectedValue}>
              {forecast.length
                ? `${Number(
                    forecast[forecast.length - 1].soh
                  ).toFixed(2)}%`
                : "--"}
            </strong>
          </div>

        </div>
      )}


      <div style={styles.chartContainer}>

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <LineChart
            data={forecast}
            margin={{
              top: 15,
              right: 5,
              left: -15,
              bottom: 5,
            }}
          >

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
              formatter={(value) => [
                `${Number(value).toFixed(2)}%`,
                "Predicted SOH",
              ]}
            />

            <Line
              type="monotone"
              dataKey="soh"
              stroke="var(--bt-purple)"
              strokeWidth={3}
              strokeDasharray="7 5"
              dot={{
                r: 3,
                fill: "var(--bt-surface)",
                stroke: "var(--bt-purple)",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: "var(--bt-surface)",
                stroke: "var(--bt-purple)",
                strokeWidth: 3,
              }}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      <p style={styles.description}>
        Estimated battery health based on the
        observed degradation trend.
      </p>

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

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
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

  forecastBadge: {
    background: "var(--bt-purple-soft)",
    color: "var(--bt-purple)",
    padding: "7px 9px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: 800,
  },

  currentBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "var(--bt-chart-soft)",
    borderRadius: "15px",
    padding: "13px",
    marginBottom: "10px",
  },

  smallLabel: {
    margin: 0,
    color: "var(--bt-chart-muted-2)",
    fontSize: "8px",
    fontWeight: 800,
    letterSpacing: "0.8px",
  },

  currentValue: {
    display: "block",
    marginTop: "4px",
    fontSize: "18px",
    color: "var(--bt-chart-blue)",
  },

  projectedValue: {
    display: "block",
    marginTop: "4px",
    fontSize: "18px",
    color: "var(--bt-purple)",
  },

  arrow: {
    fontSize: "20px",
    color: "var(--bt-muted-2)",
  },

  chartContainer: {
    width: "100%",
    height: "280px",
  },

  description: {
    margin: "5px 0 0",
    color: "var(--bt-muted-2)",
    textAlign: "center",
    fontSize: "9px",
  },

};

export default ForecastChart;