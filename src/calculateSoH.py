from pathlib import Path

import pandas as pd
import numpy as np


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "battery_cycles.csv"
)

OUTPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "battery_soh.csv"
)


# ============================================================
# CALCULATE SOH
# ============================================================

def calculate_soh(df):

    result = []

    # Process each battery separately
    for battery_id, battery_data in df.groupby(
        "battery_id"
    ):

        # Sort by cycle
        battery_data = battery_data.sort_values(
            "cycle"
        ).copy()

        # ----------------------------------------------------
        # Initial capacity
        # ----------------------------------------------------

        valid_capacity = battery_data[
            battery_data["capacity"].notna()
            & (battery_data["capacity"] > 0)
        ]

        if valid_capacity.empty:

            print(
                f"WARNING: No valid capacity "
                f"for {battery_id}"
            )

            continue

        initial_capacity = (
            valid_capacity.iloc[0]["capacity"]
        )

        print(
            f"\n{battery_id}"
        )

        print(
            f"Initial capacity: "
            f"{initial_capacity:.6f} Ah"
        )

        # ----------------------------------------------------
        # Calculate SoH
        # ----------------------------------------------------

        battery_data["initial_capacity"] = (
            initial_capacity
        )

        battery_data["soh"] = (
            battery_data["capacity"]
            / initial_capacity
            * 100
        )

        # ----------------------------------------------------
        # Keep SoH in sensible range
        # ----------------------------------------------------

        battery_data["soh"] = (
            battery_data["soh"]
            .clip(lower=0, upper=100)
        )

        result.append(
            battery_data
        )

        print(
            f"Final SoH: "
            f"{battery_data.iloc[-1]['soh']:.2f}%"
        )

    if not result:

        return pd.DataFrame()

    return pd.concat(
        result,
        ignore_index=True
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)

    print(
        "       BATTRACE - SOH CALCULATION"
    )

    print("=" * 60)

    # --------------------------------------------------------
    # Check input
    # --------------------------------------------------------

    if not INPUT_FILE.exists():

        print("\nERROR:")
        print(
            "battery_cycles.csv was not found."
        )

        print(
            f"\nExpected:"
        )

        print(INPUT_FILE)

        return

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    print(
        "\nLoading:"
    )

    print(INPUT_FILE)

    df = pd.read_csv(
        INPUT_FILE
    )

    print(
        f"\nRows loaded: {len(df)}"
    )

    # --------------------------------------------------------
    # Calculate SoH
    # --------------------------------------------------------

    soh_df = calculate_soh(
        df
    )

    if soh_df.empty:

        print(
            "\nNo SoH data was generated."
        )

        return

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    soh_df = soh_df.sort_values(
        [
            "battery_id",
            "cycle"
        ]
    ).reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    soh_df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Display
    # --------------------------------------------------------

    print("\n" + "=" * 60)

    print(
        "SOH CALCULATION COMPLETE"
    )

    print("=" * 60)

    print(
        f"\nTotal rows: {len(soh_df)}"
    )

    print(
        f"\nSaved to:"
    )

    print(OUTPUT_FILE)

    print("\nFirst 10 rows:")

    print(
        soh_df[
            [
                "battery_id",
                "cycle",
                "capacity",
                "initial_capacity",
                "soh"
            ]
        ].head(10).to_string(
            index=False
        )
    )

    print("\n" + "=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()