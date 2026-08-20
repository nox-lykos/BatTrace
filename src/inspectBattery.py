from pathlib import Path
from scipy.io import loadmat


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = PROJECT_ROOT / "data" / "raw" / "extracted"


# ============================================================
# FIND B0005
# ============================================================

matches = list(DATA_DIR.rglob("B0005.mat"))

if not matches:
    print("B0005.mat was not found.")
    exit()

mat_file = matches[0]

print("=" * 60)
print("BATTRACE - B0005 INSPECTOR")
print("=" * 60)

print("\nFile:")
print(mat_file)


# ============================================================
# LOAD MATLAB FILE
# ============================================================

data = loadmat(
    mat_file,
    squeeze_me=True,
    struct_as_record=False
)


# ============================================================
# TOP LEVEL VARIABLES
# ============================================================

print("\nTop-level variables:")

for key, value in data.items():

    if not key.startswith("__"):

        print(f"\n{key}")
        print(f"Type: {type(value)}")
        print(
            f"Shape: {getattr(value, 'shape', None)}"
        )


# ============================================================
# GET B0005 STRUCTURE
# ============================================================

battery = data["B0005"]

print("\n" + "=" * 60)
print("B0005 STRUCTURE")
print("=" * 60)

print("\nType:")
print(type(battery))


# ============================================================
# BATTERY FIELDS
# ============================================================

print("\nB0005 fields:")

print(battery._fieldnames)


# ============================================================
# CYCLES
# ============================================================

cycles = battery.cycle

print("\nNumber of cycles:")

try:
    print(len(cycles))
except TypeError:
    print("Cycle object is not directly iterable.")


# ============================================================
# INSPECT CYCLES
# ============================================================

print("\n" + "=" * 60)
print("CYCLE INFORMATION")
print("=" * 60)


# Convert single cycle to list if necessary
if not hasattr(cycles, "__len__"):
    cycles = [cycles]


for index, cycle in enumerate(cycles[:5], start=1):

    print(f"\nCycle {index}")

    print("Fields:")

    if hasattr(cycle, "_fieldnames"):
        print(cycle._fieldnames)

    print("\nCycle type:")

    try:
        print(cycle.type)
    except Exception:
        print("Could not read type.")

    print("\nData fields:")

    try:
        print(cycle.data._fieldnames)
    except Exception:
        print("Could not read data fields.")


print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
print("=" * 60)