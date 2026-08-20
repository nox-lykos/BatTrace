from pathlib import Path

import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import joblib


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

MODEL_DIR = PROJECT_ROOT / "models"

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)

MODEL_FILE = MODEL_DIR / "soh_model.pkl"


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

    print("=" * 60)
    print("        BATTRACE - MODEL TRAINING")
    print("=" * 60)

    # --------------------------------------------------------
    # Load dataset
    # --------------------------------------------------------

    if not INPUT_FILE.exists():

        print("\nERROR: model_data.csv not found.")

        print(
            f"Expected:\n{INPUT_FILE}"
        )

        return

    df = pd.read_csv(
        INPUT_FILE
    )

    print(
        f"\nTotal rows: {len(df)}"
    )

    print(
        f"Batteries: "
        f"{df['battery_id'].unique().tolist()}"
    )

    # --------------------------------------------------------
    # TRAIN / TEST SPLIT
    # --------------------------------------------------------
    #
    # We deliberately keep B0018 completely unseen
    # during training.
    #
    # --------------------------------------------------------

    TRAIN_BATTERIES = [
        "B0005",
        "B0006",
        "B0007"
    ]

    TEST_BATTERIES = [
        "B0018"
    ]

    train_df = df[
        df["battery_id"].isin(
            TRAIN_BATTERIES
        )
    ].copy()

    test_df = df[
        df["battery_id"].isin(
            TEST_BATTERIES
        )
    ].copy()

    print("\n" + "-" * 60)

    print("TRAINING BATTERIES:")

    for battery in TRAIN_BATTERIES:
        print(f"  {battery}")

    print(
        f"Training rows: {len(train_df)}"
    )

    print("\nTEST BATTERIES:")

    for battery in TEST_BATTERIES:
        print(f"  {battery}")

    print(
        f"Testing rows: {len(test_df)}"
    )

    # --------------------------------------------------------
    # Features and target
    # --------------------------------------------------------

    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]

    X_test = test_df[FEATURES]
    y_test = test_df[TARGET]

    # --------------------------------------------------------
    # Create model
    # --------------------------------------------------------

    print("\n" + "-" * 60)

    print(
        "Creating Random Forest model..."
    )

    model = RandomForestRegressor(

        n_estimators=300,

        max_depth=12,

        min_samples_leaf=2,

        random_state=42,

        n_jobs=-1
    )

    # --------------------------------------------------------
    # Train
    # --------------------------------------------------------

    print(
        "\nTraining model..."
    )

    model.fit(
        X_train,
        y_train
    )

    print(
        "Training complete."
    )

    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------

    print(
        "\nGenerating predictions..."
    )

    predictions = model.predict(
        X_test
    )

    # --------------------------------------------------------
    # Evaluation
    # --------------------------------------------------------

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

    print("\n" + "=" * 60)

    print(
        "MODEL EVALUATION"
    )

    print("=" * 60)

    print(
        f"\nMAE  : {mae:.4f}%"
    )

    print(
        f"RMSE : {rmse:.4f}%"
    )

    print(
        f"R²   : {r2:.4f}"
    )

    # --------------------------------------------------------
    # Example predictions
    # --------------------------------------------------------

    results = test_df[
        [
            "battery_id",
            "cycle",
            "soh"
        ]
    ].copy()

    results["predicted_soh"] = predictions

    results["error"] = (
        results["predicted_soh"]
        - results["soh"]
    )

    print("\n" + "=" * 60)

    print(
        "SAMPLE PREDICTIONS"
    )

    print("=" * 60)

    print(
        results.head(10).to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Feature importance
    # --------------------------------------------------------

    importance = pd.DataFrame({

        "feature": FEATURES,

        "importance": model.feature_importances_

    })

    importance = importance.sort_values(
        "importance",
        ascending=False
    )

    print("\n" + "=" * 60)

    print(
        "FEATURE IMPORTANCE"
    )

    print("=" * 60)

    print(
        importance.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Save model
    # --------------------------------------------------------

    joblib.dump(
        model,
        MODEL_FILE
    )

    print("\n" + "=" * 60)

    print(
        "MODEL SAVED"
    )

    print("=" * 60)

    print(
        f"\n{MODEL_FILE}"
    )

    print("\nTraining pipeline complete.")


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()