from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt


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

OUTPUT_DIR = (
    PROJECT_ROOT
    / "data"
    / "processed"
)

OUTPUT_FILE = OUTPUT_DIR / "soh_degradation.png"


# ============================================================
# LOAD DATA
# ============================================================

if not INPUT_FILE.exists():

    print("ERROR: battery_soh.csv was not found.")

    print(
        f"Expected file:\n{INPUT_FILE}"
    )

    exit()


df = pd.read_csv(INPUT_FILE)


print("=" * 60)
print("       BATTRACE - SOH DEGRADATION PLOT")
print("=" * 60)

print(
    f"\nLoaded {len(df)} rows."
)


# ============================================================
# CREATE PLOT
# ============================================================

plt.figure(figsize=(12, 7))


# Plot each battery separately

for battery_id, battery_data in df.groupby("battery_id"):

    battery_data = battery_data.sort_values("cycle")

    plt.plot(
        battery_data["cycle"],
        battery_data["soh"],
        marker="o",
        markersize=3,
        linewidth=1.5,
        label=battery_id
    )


# ============================================================
# LABELS
# ============================================================

plt.title(
    "Battery State of Health Degradation",
    fontsize=16
)

plt.xlabel(
    "Battery Cycle",
    fontsize=12
)

plt.ylabel(
    "State of Health (SoH %)",
    fontsize=12
)


# ============================================================
# GRID + LEGEND
# ============================================================

plt.grid(
    True,
    alpha=0.3
)

plt.legend(
    title="Battery"
)


# Keep the graph focused on useful SoH range

plt.ylim(
    0,
    105
)


plt.tight_layout()


# ============================================================
# SAVE
# ============================================================

plt.savefig(
    OUTPUT_FILE,
    dpi=200
)


print("\nGraph saved to:")

print(OUTPUT_FILE)


# ============================================================
# SHOW
# ============================================================

plt.show()


print("\n" + "=" * 60)
print("PLOT COMPLETE")
print("=" * 60)