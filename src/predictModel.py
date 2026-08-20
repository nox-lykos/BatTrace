from pathlib import Path

import numpy as np
import pandas as pd
import joblib


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "model_data.csv"
)

MODEL_FILE = (
    PROJECT_ROOT
    / "models"
    / "soh_model.pkl"
)


# ============================================================
# FEATURES USED BY THE ML MODEL
# ============================================================

FEATURES = [
    "cycle",

    "voltage_mean",
    "voltage_min",
    "voltage_max",

    "current_mean",
    "current_min",
    "current_max",

    "temperature_mean",
    "temperature_min",
    "temperature_max",

    "current_load_mean",
    "voltage_load_mean",

    "discharge_duration"
]


# ============================================================
# HEALTH CLASSIFICATION
# ============================================================

# These are BATTRACE demo/product thresholds.
# They are NOT official NASA diagnostic thresholds.


def get_health_status(soh):

    if soh >= 80:
        return "Healthy"

    elif soh >= 60:
        return "Moderate"

    elif soh >= 40:
        return "Degraded"

    else:
        return "Critical"


# ============================================================
# RISK CLASSIFICATION
# ============================================================

def get_risk_level(soh):

    if soh >= 80:
        return "Low"

    elif soh >= 60:
        return "Medium"

    elif soh >= 40:
        return "High"

    else:
        return "Critical"


# ============================================================
# CURRENT BATTERY PREDICTION
# ============================================================

def predict_battery(battery_id):

    # --------------------------------------------------------
    # Check required files
    # --------------------------------------------------------

    if not DATA_FILE.exists():

        raise FileNotFoundError(
            "model_data.csv was not found."
        )

    if not MODEL_FILE.exists():

        raise FileNotFoundError(
            "soh_model.pkl was not found."
        )

    # --------------------------------------------------------
    # Load processed data
    # --------------------------------------------------------

    df = pd.read_csv(
        DATA_FILE
    )

    # --------------------------------------------------------
    # Load trained ML model
    # --------------------------------------------------------

    model = joblib.load(
        MODEL_FILE
    )

    # --------------------------------------------------------
    # Find requested battery
    # --------------------------------------------------------

    battery_df = df[
        df["battery_id"] == battery_id
    ].copy()

    if battery_df.empty:

        raise ValueError(
            f"Battery {battery_id} was not found."
        )

    # --------------------------------------------------------
    # Sort by cycle
    # --------------------------------------------------------

    battery_df = battery_df.sort_values(
        "cycle"
    )

    # --------------------------------------------------------
    # Get latest battery cycle
    # --------------------------------------------------------

    latest = battery_df.iloc[-1]

    # --------------------------------------------------------
    # Prepare features for ML model
    # --------------------------------------------------------

    X = pd.DataFrame(
        [
            latest[FEATURES].values
        ],
        columns=FEATURES
    )

    # --------------------------------------------------------
    # Predict SOH using Random Forest
    # --------------------------------------------------------

    predicted_soh = float(
        model.predict(X)[0]
    )

    # --------------------------------------------------------
    # Keep SOH between 0 and 100
    # --------------------------------------------------------

    predicted_soh = max(
        0,
        min(
            100,
            predicted_soh
        )
    )

    # --------------------------------------------------------
    # Determine health
    # --------------------------------------------------------

    health_status = get_health_status(
        predicted_soh
    )

    # --------------------------------------------------------
    # Determine risk
    # --------------------------------------------------------

    risk_level = get_risk_level(
        predicted_soh
    )

    # --------------------------------------------------------
    # Return battery assessment
    # --------------------------------------------------------

    return {

        "battery_id": battery_id,

        "cycle": int(
            latest["cycle"]
        ),

        "predicted_soh": round(
            predicted_soh,
            2
        ),

        "health_status": health_status,

        "risk_level": risk_level,

        "temperature": round(
            float(
                latest["temperature_mean"]
            ),
            2
        ),

        "voltage": round(
            float(
                latest["voltage_mean"]
            ),
            3
        ),

        "current": round(
            float(
                latest["current_mean"]
            ),
            3
        )
    }


# ============================================================
# FUTURE SOH FORECAST
# ============================================================

def forecast_battery(
    battery_id,
    future_cycles=100
):

    # --------------------------------------------------------
    # Check data file
    # --------------------------------------------------------

    if not DATA_FILE.exists():

        raise FileNotFoundError(
            "model_data.csv was not found."
        )

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    df = pd.read_csv(
        DATA_FILE
    )

    # --------------------------------------------------------
    # Find battery
    # --------------------------------------------------------

    battery_df = df[
        df["battery_id"] == battery_id
    ].copy()

    if battery_df.empty:

        raise ValueError(
            f"Battery {battery_id} was not found."
        )

    # --------------------------------------------------------
    # Check SOH column
    # --------------------------------------------------------

    if "soh" not in battery_df.columns:

        raise ValueError(
            "The 'soh' column was not found in model_data.csv."
        )

    # --------------------------------------------------------
    # Sort battery history
    # --------------------------------------------------------

    battery_df = battery_df.sort_values(
        "cycle"
    )

    # --------------------------------------------------------
    # Get historical cycles
    # --------------------------------------------------------

    cycles = battery_df[
        "cycle"
    ].astype(float)

    # --------------------------------------------------------
    # Get historical SOH
    # --------------------------------------------------------

    soh_values = battery_df[
        "soh"
    ].astype(float)

    # --------------------------------------------------------
    # Remove invalid values
    # --------------------------------------------------------

    valid_data = pd.DataFrame({
        "cycle": cycles,
        "soh": soh_values
    }).dropna()

    if len(valid_data) < 2:

        raise ValueError(
            "Not enough historical data for SOH forecasting."
        )

    cycles = valid_data["cycle"]
    soh_values = valid_data["soh"]

    # --------------------------------------------------------
    # Fit linear degradation trend
    # --------------------------------------------------------

    slope, intercept = np.polyfit(
        cycles,
        soh_values,
        1
    )

    # --------------------------------------------------------
    # Latest cycle
    # --------------------------------------------------------

    latest_cycle = int(
        cycles.iloc[-1]
    )

    # --------------------------------------------------------
    # Latest historical SOH
    # --------------------------------------------------------

    current_soh = float(
        soh_values.iloc[-1]
    )

    # --------------------------------------------------------
    # Generate future cycles
    # --------------------------------------------------------

    future = []

    step = max(
        1,
        future_cycles // 10
    )

    end_cycle = (
        latest_cycle
        + future_cycles
    )

    for cycle in range(
        latest_cycle + step,
        end_cycle + 1,
        step
    ):

        # ----------------------------------------------------
        # Calculate projected SOH
        # ----------------------------------------------------

        predicted_soh = (
            slope * cycle
            + intercept
        )

        # ----------------------------------------------------
        # Keep SOH between 0 and 100
        # ----------------------------------------------------

        predicted_soh = max(
            0,
            min(
                100,
                predicted_soh
            )
        )

        # ----------------------------------------------------
        # Store forecast point
        # ----------------------------------------------------

        future.append({

            "cycle": int(
                cycle
            ),

            "soh": round(
                float(predicted_soh),
                2
            )
        })

    # --------------------------------------------------------
    # Return forecast
    # --------------------------------------------------------

    return {

        "battery_id": battery_id,

        "current_cycle": latest_cycle,

        "current_soh": round(
            current_soh,
            2
        ),

        "forecast": future
    }


# ============================================================
# MAIN PROGRAM
# ============================================================

def main():

    print("=" * 60)

    print(
        "        BATTRACE - BATTERY PREDICTION"
    )

    print("=" * 60)

    # --------------------------------------------------------
    # Demo battery
    # --------------------------------------------------------

    battery_id = "B0018"

    print(
        f"\nAnalyzing battery: {battery_id}"
    )

    # ========================================================
    # CURRENT BATTERY ASSESSMENT
    # ========================================================

    try:

        result = predict_battery(
            battery_id
        )

    except Exception as error:

        print(
            f"\nERROR: {error}"
        )

        return

    print("\n" + "=" * 60)

    print(
        "BATTERY ASSESSMENT"
    )

    print("=" * 60)

    print(
        f"\nBattery ID     : "
        f"{result['battery_id']}"
    )

    print(
        f"Latest Cycle   : "
        f"{result['cycle']}"
    )

    print(
        f"Predicted SoH  : "
        f"{result['predicted_soh']}%"
    )

    print(
        f"Health Status  : "
        f"{result['health_status']}"
    )

    print(
        f"Risk Level     : "
        f"{result['risk_level']}"
    )

    print(
        f"\nTemperature    : "
        f"{result['temperature']} °C"
    )

    print(
        f"Voltage        : "
        f"{result['voltage']} V"
    )

    print(
        f"Current        : "
        f"{result['current']} A"
    )

    # ========================================================
    # FUTURE SOH FORECAST
    # ========================================================

    try:

        forecast = forecast_battery(
            battery_id,
            future_cycles=100
        )

    except Exception as error:

        print(
            f"\nFORECAST ERROR: {error}"
        )

        return

    print("\n" + "=" * 60)

    print(
        "FUTURE SOH FORECAST"
    )

    print("=" * 60)

    print(
        f"\nCurrent Cycle : "
        f"{forecast['current_cycle']}"
    )

    print(
        f"Current SOH   : "
        f"{forecast['current_soh']}%"
    )

    print(
        "\nProjected SOH:"
    )

    for point in forecast["forecast"]:

        print(
            f"Cycle {point['cycle']} : "
            f"{point['soh']}%"
        )

    print("\n" + "=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()