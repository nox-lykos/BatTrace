from pathlib import Path

import pandas as pd


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "battery_soh.csv"
)

OUTPUT_FILE = (
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

    print("=" * 60)
    print("     BATTRACE - ML DATA PREPARATION")
    print("=" * 60)

    # --------------------------------------------------------
    # Check input
    # --------------------------------------------------------

    if not INPUT_FILE.exists():

        print("\nERROR:")
        print("battery_soh.csv was not found.")

        return

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    df = pd.read_csv(INPUT_FILE)

    print(
        f"\nOriginal rows: {len(df)}"
    )

    # --------------------------------------------------------
    # Check required columns
    # --------------------------------------------------------

    required_columns = (
        ["battery_id"]
        + FEATURES
        + [TARGET]
    )

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:

        print("\nERROR: Missing columns:")

        for column in missing:
            print(f"  {column}")

        return

    # --------------------------------------------------------
    # Select data
    # --------------------------------------------------------

    model_df = df[
        [
            "battery_id"
        ]
        + FEATURES
        + [TARGET]
    ].copy()

    # --------------------------------------------------------
    # Remove missing values
    # --------------------------------------------------------

    before = len(model_df)

    model_df = model_df.dropna()

    after = len(model_df)

    print(
        f"\nRemoved {before - after} rows "
        "with missing values."
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    model_df = model_df.sort_values(
        [
            "battery_id",
            "cycle"
        ]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    model_df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("MODEL DATASET READY")
    print("=" * 60)

    print(
        f"\nTotal rows: {len(model_df)}"
    )

    print(
        f"Total features: {len(FEATURES)}"
    )

    print("\nFeatures:")

    for feature in FEATURES:

        print(
            f"  ✓ {feature}"
        )

    print(
        f"\nTarget:"
    )

    print(
        f"  ✓ {TARGET}"
    )

    print("\nRows per battery:")

    print(
        model_df.groupby(
            "battery_id"
        ).size()
    )

    print("\nSaved to:")

    print(OUTPUT_FILE)

    print("\nFirst 5 rows:")

    print(
        model_df.head().to_string(
            index=False
        )
    )

    print("\n" + "=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()