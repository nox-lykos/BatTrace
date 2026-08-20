from pathlib import Path

import numpy as np
import pandas as pd
from scipy.io import loadmat


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = PROJECT_ROOT / "data" / "raw" / "extracted"

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

OUTPUT_FILE = OUTPUT_DIR / "battery_cycles.csv"


# ============================================================
# BATTERIES
# ============================================================

BATTERIES = [
    "B0005",
    "B0006",
    "B0007",
    "B0018"
]


# ============================================================
# HELPER FUNCTION
# ============================================================

def to_array(value):

    """
    Convert MATLAB data into a 1D NumPy array.
    """

    try:

        return np.asarray(value).flatten()

    except Exception:

        return np.array([])


# ============================================================
# FIND BATTERY FILE
# ============================================================

def find_battery_file(battery_id):

    matches = list(
        DATA_DIR.rglob(
            f"{battery_id}.mat"
        )
    )

    if not matches:

        return None

    return matches[0]


# ============================================================
# EXTRACT ONE BATTERY
# ============================================================

def extract_battery(mat_file, battery_id):

    print("\n" + "-" * 60)

    print(
        f"Processing {battery_id}"
    )

    print(
        f"File: {mat_file}"
    )

    # --------------------------------------------------------
    # Load MATLAB file
    # --------------------------------------------------------

    mat_data = loadmat(
        mat_file,
        squeeze_me=True,
        struct_as_record=False
    )

    # The variable inside B0005.mat is B0005,
    # inside B0006.mat it is B0006, etc.

    battery = mat_data[battery_id]

    # --------------------------------------------------------
    # Get cycles
    # --------------------------------------------------------

    cycles = battery.cycle

    if not isinstance(cycles, np.ndarray):

        cycles = np.array(
            [cycles],
            dtype=object
        )

    rows = []

    # --------------------------------------------------------
    # Loop through cycles
    # --------------------------------------------------------

    for cycle_number, cycle in enumerate(
        cycles,
        start=1
    ):

        try:

            cycle_type = str(
                cycle.type
            ).lower().strip()

        except Exception:

            continue

        # ----------------------------------------------------
        # We only extract discharge cycles
        # because they contain Capacity.
        # ----------------------------------------------------

        if cycle_type != "discharge":

            continue

        try:

            data = cycle.data

            # ------------------------------------------------
            # Measurements
            # ------------------------------------------------

            voltage = to_array(
                data.Voltage_measured
            )

            current = to_array(
                data.Current_measured
            )

            temperature = to_array(
                data.Temperature_measured
            )

            time = to_array(
                data.Time
            )

            current_load = to_array(
                data.Current_load
            )

            voltage_load = to_array(
                data.Voltage_load
            )

            # ------------------------------------------------
            # Remove invalid values
            # ------------------------------------------------

            voltage = voltage[
                np.isfinite(voltage)
            ]

            current = current[
                np.isfinite(current)
            ]

            temperature = temperature[
                np.isfinite(temperature)
            ]

            time = time[
                np.isfinite(time)
            ]

            current_load = current_load[
                np.isfinite(current_load)
            ]

            voltage_load = voltage_load[
                np.isfinite(voltage_load)
            ]

            # ------------------------------------------------
            # Capacity
            # ------------------------------------------------

            try:

                capacity = float(
                    np.asarray(
                        data.Capacity
                    ).flatten()[0]
                )

            except Exception:

                capacity = np.nan

            # ------------------------------------------------
            # Calculate features
            # ------------------------------------------------

            voltage_mean = (
                np.mean(voltage)
                if len(voltage)
                else np.nan
            )

            voltage_min = (
                np.min(voltage)
                if len(voltage)
                else np.nan
            )

            voltage_max = (
                np.max(voltage)
                if len(voltage)
                else np.nan
            )

            current_mean = (
                np.mean(current)
                if len(current)
                else np.nan
            )

            current_min = (
                np.min(current)
                if len(current)
                else np.nan
            )

            current_max = (
                np.max(current)
                if len(current)
                else np.nan
            )

            temperature_mean = (
                np.mean(temperature)
                if len(temperature)
                else np.nan
            )

            temperature_min = (
                np.min(temperature)
                if len(temperature)
                else np.nan
            )

            temperature_max = (
                np.max(temperature)
                if len(temperature)
                else np.nan
            )

            current_load_mean = (
                np.mean(current_load)
                if len(current_load)
                else np.nan
            )

            voltage_load_mean = (
                np.mean(voltage_load)
                if len(voltage_load)
                else np.nan
            )

            # ------------------------------------------------
            # Discharge duration
            # ------------------------------------------------

            if len(time) > 1:

                duration = (
                    time[-1] - time[0]
                )

            else:

                duration = np.nan

            # ------------------------------------------------
            # Create row
            # ------------------------------------------------

            row = {

                "battery_id": battery_id,

                "cycle": cycle_number,

                "cycle_type": cycle_type,

                "capacity": capacity,

                "voltage_mean": voltage_mean,
                "voltage_min": voltage_min,
                "voltage_max": voltage_max,

                "current_mean": current_mean,
                "current_min": current_min,
                "current_max": current_max,

                "temperature_mean": temperature_mean,
                "temperature_min": temperature_min,
                "temperature_max": temperature_max,

                "current_load_mean": current_load_mean,

                "voltage_load_mean": voltage_load_mean,

                "discharge_duration": duration
            }

            rows.append(row)

        except Exception as error:

            print(
                f"Error in cycle "
                f"{cycle_number}: {error}"
            )

    print(
        f"Discharge cycles extracted: "
        f"{len(rows)}"
    )

    return rows


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)

    print(
        "       BATTRACE - NASA DATA EXTRACTION"
    )

    print("=" * 60)

    all_rows = []

    # --------------------------------------------------------
    # Process each battery
    # --------------------------------------------------------

    for battery_id in BATTERIES:

        mat_file = find_battery_file(
            battery_id
        )

        if mat_file is None:

            print(
                f"\nWARNING: "
                f"{battery_id}.mat was not found."
            )

            continue

        try:

            rows = extract_battery(
                mat_file,
                battery_id
            )

            all_rows.extend(rows)

        except Exception as error:

            print(
                f"\nERROR processing "
                f"{battery_id}:"
            )

            print(error)

    # --------------------------------------------------------
    # Check result
    # --------------------------------------------------------

    if not all_rows:

        print("\n" + "=" * 60)

        print(
            "NO DATA WAS EXTRACTED"
        )

        print("=" * 60)

        return

    # --------------------------------------------------------
    # Create DataFrame
    # --------------------------------------------------------

    df = pd.DataFrame(
        all_rows
    )

    # Sort data

    df = df.sort_values(
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

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Display summary
    # --------------------------------------------------------

    print("\n" + "=" * 60)

    print(
        "       EXTRACTION COMPLETE"
    )

    print("=" * 60)

    print(
        f"\nTotal rows: {len(df)}"
    )

    print(
        f"Total columns: {len(df.columns)}"
    )

    print("\nRows per battery:")

    print(
        df.groupby(
            "battery_id"
        ).size()
    )

    print("\nColumns:")

    for column in df.columns:

        print(
            f"  {column}"
        )

    print("\nFirst 5 rows:")

    print(
        df.head().to_string(
            index=False
        )
    )

    print("\nSaved to:")

    print(
        OUTPUT_FILE
    )

    print("\n" + "=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()