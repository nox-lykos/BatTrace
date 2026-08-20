from pathlib import Path
import sys

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

SRC_DIR = PROJECT_ROOT / "src"

sys.path.append(str(SRC_DIR))


# ============================================================
# IMPORT MODEL FUNCTIONS
# ============================================================

from predictModel import (
    predict_battery,
    forecast_battery
)


# ============================================================
# CREATE FASTAPI APP
# ============================================================

app = FastAPI(
    title="BATTRACE API",
    description="Battery Health & Second-Life Assessment API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATA FILE
# ============================================================

SOH_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "battery_soh.csv"
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "project": "BATTRACE",
        "status": "online",
        "message": "Battery Health API is running"
    }


# ============================================================
# BATTERY PREDICTION
# ============================================================

@app.get("/battery/{battery_id}")
def get_battery(battery_id: str):

    try:

        result = predict_battery(
            battery_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# BATTERY HISTORY
# ============================================================

@app.get("/battery/{battery_id}/history")
def get_battery_history(battery_id: str):

    if not SOH_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="Battery SOH data file not found"
        )

    try:

        df = pd.read_csv(
            SOH_FILE
        )

        battery_data = df[
            df["battery_id"]
            .astype(str)
            .str.upper()
            == battery_id.upper()
        ]

        if battery_data.empty:

            raise HTTPException(
                status_code=404,
                detail=f"Battery {battery_id} not found"
            )

        history = battery_data[
            ["cycle", "soh"]
        ].copy()

        history = history.sort_values(
            "cycle"
        )

        return {
            "battery_id": battery_id.upper(),
            "history": history.to_dict(
                orient="records"
            )
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# FUTURE BATTERY FORECAST
# ============================================================

@app.get("/battery/{battery_id}/forecast")
def get_battery_forecast(
    battery_id: str
):

    try:

        result = forecast_battery(
            battery_id,
            future_cycles=100
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# YEAR-WISE BATTERY HEALTH
# ============================================================

# ============================================================
# YEAR-WISE BATTERY HEALTH
# ============================================================

@app.get("/battery/{battery_id}/yearly-health")
def get_yearly_health(battery_id: str):

    if not SOH_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="Battery SOH data file not found"
        )

    try:

        df = pd.read_csv(SOH_FILE)

        # ----------------------------------------------------
        # Find battery
        # ----------------------------------------------------

        battery_data = df[
            df["battery_id"]
            .astype(str)
            .str.upper()
            == battery_id.upper()
        ].copy()

        if battery_data.empty:

            raise HTTPException(
                status_code=404,
                detail=f"Battery {battery_id} not found"
            )

        # ----------------------------------------------------
        # Check required columns
        # ----------------------------------------------------

        required_columns = [
            "cycle",
            "soh"
        ]

        for column in required_columns:

            if column not in battery_data.columns:

                raise HTTPException(
                    status_code=500,
                    detail=f"Missing required column: {column}"
                )

        # ----------------------------------------------------
        # Clean data
        # ----------------------------------------------------

        battery_data = battery_data.dropna(
            subset=["cycle", "soh"]
        )

        battery_data["cycle"] = pd.to_numeric(
            battery_data["cycle"]
        )

        battery_data["soh"] = pd.to_numeric(
            battery_data["soh"]
        )

        # ----------------------------------------------------
        # Define operational year
        #
        # 100 battery cycles = 1 operational year
        # ----------------------------------------------------

        battery_data["year"] = (
            (battery_data["cycle"] - 1) // 100
        ) + 1

        # ----------------------------------------------------
        # Calculate yearly statistics
        # ----------------------------------------------------

        yearly = (
            battery_data
            .groupby("year")
            .agg(
                average_soh=("soh", "mean"),
                minimum_soh=("soh", "min"),
                maximum_soh=("soh", "max"),
                cycles=("cycle", "count")
            )
            .reset_index()
        )

        # ----------------------------------------------------
        # Sort
        # ----------------------------------------------------

        yearly = yearly.sort_values(
            "year"
        )

        # ----------------------------------------------------
        # Create response
        # ----------------------------------------------------

        result = []

        for _, row in yearly.iterrows():

            average_soh = float(
                row["average_soh"]
            )

            # Health classification
            if average_soh >= 80:
                health_status = "Healthy"

            elif average_soh >= 60:
                health_status = "Moderate"

            elif average_soh >= 40:
                health_status = "Degraded"

            else:
                health_status = "Critical"

            result.append({

                "year": int(row["year"]),

                "label": f"Year {int(row['year'])}",

                "average_soh": round(
                    average_soh,
                    2
                ),

                "minimum_soh": round(
                    float(row["minimum_soh"]),
                    2
                ),

                "maximum_soh": round(
                    float(row["maximum_soh"]),
                    2
                ),

                "cycles": int(
                    row["cycles"]
                ),

                "health_status": health_status
            })

        # ----------------------------------------------------
        # Final response
        # ----------------------------------------------------

        return {

            "battery_id": battery_id.upper(),

            "cycles_per_year": 100,

            "yearly_health": result

        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )