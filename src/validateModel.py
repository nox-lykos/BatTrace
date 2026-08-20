from pathlib import Path

import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "model_data.csv"
)


# ============================================================
# FEATURES
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

TARGET = "soh"


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 65)
    print("        BATTRACE - BATTERY-WISE MODEL VALIDATION")
    print("=" * 65)

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    if not INPUT_FILE.exists():

        print("\nERROR: model_data.csv not found.")
        print(INPUT_FILE)

        return

    df = pd.read_csv(INPUT_FILE)

    batteries = sorted(
        df["battery_id"].unique()
    )

    print(
        f"\nBatteries found: {batteries}"
    )

    print(
        f"Total rows: {len(df)}"
    )

    # --------------------------------------------------------
    # Store results
    # --------------------------------------------------------

    validation_results = []

    # --------------------------------------------------------
    # Leave-one-battery-out validation
    # --------------------------------------------------------

    for test_battery in batteries:

        print("\n" + "=" * 65)

        print(
            f"TESTING BATTERY: {test_battery}"
        )

        print("=" * 65)

        # Training data
        train_df = df[
            df["battery_id"] != test_battery
        ].copy()

        # Testing data
        test_df = df[
            df["battery_id"] == test_battery
        ].copy()

        X_train = train_df[FEATURES]
        y_train = train_df[TARGET]

        X_test = test_df[FEATURES]
        y_test = test_df[TARGET]

        print(
            f"\nTraining rows: {len(train_df)}"
        )

        print(
            f"Testing rows: {len(test_df)}"
        )

        # ----------------------------------------------------
        # Create model
        # ----------------------------------------------------

        model = RandomForestRegressor(

            n_estimators=300,

            max_depth=12,

            min_samples_leaf=2,

            random_state=42,

            n_jobs=-1
        )

        # ----------------------------------------------------
        # Train
        # ----------------------------------------------------

        print(
            "\nTraining..."
        )

        model.fit(
            X_train,
            y_train
        )

        # ----------------------------------------------------
        # Predict
        # ----------------------------------------------------

        predictions = model.predict(
            X_test
        )

        # ----------------------------------------------------
        # Metrics
        # ----------------------------------------------------

        mae = mean_absolute_error(
            y_test,
            predictions
        )

        rmse = mean_squared_error(
            y_test,
            predictions
        ) ** 0.5

        r2 = r2_score(
            y_test,
            predictions
        )

        print("\nResults:")

        print(
            f"MAE  : {mae:.4f}%"
        )

        print(
            f"RMSE : {rmse:.4f}%"
        )

        print(
            f"R²   : {r2:.4f}"
        )

        # ----------------------------------------------------
        # Store
        # ----------------------------------------------------

        validation_results.append({

            "test_battery": test_battery,

            "mae": mae,

            "rmse": rmse,

            "r2": r2

        })

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    results_df = pd.DataFrame(
        validation_results
    )

    print("\n\n" + "=" * 65)
    print("             VALIDATION SUMMARY")
    print("=" * 65)

    print(
        results_df.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Average performance
    # --------------------------------------------------------

    average_mae = results_df["mae"].mean()
    average_rmse = results_df["rmse"].mean()
    average_r2 = results_df["r2"].mean()

    print("\n" + "-" * 65)

    print(
        f"AVERAGE MAE  : {average_mae:.4f}%"
    )

    print(
        f"AVERAGE RMSE : {average_rmse:.4f}%"
    )

    print(
        f"AVERAGE R²   : {average_r2:.4f}"
    )

    print("-" * 65)

    print(
        "\nBattery-wise validation complete."
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()