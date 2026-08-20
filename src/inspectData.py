from pathlib import Path
import zipfile


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

RAW_DIR = PROJECT_ROOT / "data" / "raw"

EXTRACTED_DIR = RAW_DIR / "extracted"


# ============================================================
# EXTRACT ALL ZIP FILES RECURSIVELY
# ============================================================

def extract_all_zips():

    EXTRACTED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # Start with the ZIP files that are directly
    # inside data/raw
    pending_zips = list(
        RAW_DIR.glob("*.zip")
    )

    processed = set()

    while pending_zips:

        zip_path = pending_zips.pop(0)

        zip_path = zip_path.resolve()

        if zip_path in processed:
            continue

        processed.add(zip_path)

        print(
            f"\nExtracting: {zip_path.name}"
        )

        # Create a unique extraction folder
        destination = (
            EXTRACTED_DIR /
            zip_path.stem
        )

        destination.mkdir(
            parents=True,
            exist_ok=True
        )

        try:

            with zipfile.ZipFile(
                zip_path,
                "r"
            ) as archive:

                archive.extractall(
                    destination
                )

            print(
                f"Extracted to: {destination}"
            )

        except zipfile.BadZipFile:

            print(
                f"ERROR: Invalid ZIP:"
                f" {zip_path}"
            )

            continue

        # ----------------------------------------------------
        # Look for NEW ZIP files inside the extracted folder
        # ----------------------------------------------------

        new_zips = list(
            destination.rglob("*.zip")
        )

        for new_zip in new_zips:

            new_zip = new_zip.resolve()

            if new_zip not in processed:

                pending_zips.append(
                    new_zip
                )


# ============================================================
# FIND MATLAB FILES
# ============================================================

def find_mat_files():

    return sorted(
        EXTRACTED_DIR.rglob("*.mat")
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)
    print("        BATTRACE DATASET INSPECTOR")
    print("=" * 60)

    print(
        f"\nRaw directory:"
    )

    print(RAW_DIR)

    print(
        "\nStarting recursive ZIP extraction..."
    )

    extract_all_zips()

    # --------------------------------------------------------
    # Find MATLAB files
    # --------------------------------------------------------

    mat_files = find_mat_files()

    print("\n" + "=" * 60)

    print(
        f"FOUND {len(mat_files)} MATLAB FILE(S)"
    )

    print("=" * 60)

    # --------------------------------------------------------
    # Display MATLAB files
    # --------------------------------------------------------

    if not mat_files:

        print(
            "\nNo .mat files were found."
        )

        return

    for mat_file in mat_files:

        print(
            f"\n{mat_file}"
        )

    print("\n" + "=" * 60)

    print(
        "MATLAB FILE DISCOVERY COMPLETE"
    )

    print("=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()