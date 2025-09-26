import os
import json
import re

NOTES_DIR = "notes"
OUTPUT_FILE = "notes_index.json"

def extract_title(path, filename):
    """Extract first H1 (# ...) line or fallback to filename."""
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                match = re.match(r"#\s+(.+)", line.strip())
                if match:
                    return match.group(1).strip()
    except Exception:
        pass
    return filename

def generate_index():
    files = [f for f in os.listdir(NOTES_DIR) if f.endswith(".md")]
    files.sort()

    data = []
    for f in files:
        fullpath = os.path.join(NOTES_DIR, f)
        title = extract_title(fullpath, f)
        data.append({"file": f, "title": title})

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(data, out, indent=2, ensure_ascii=False)

    print(f"✅ Generated {OUTPUT_FILE} with {len(files)} notes.")

if __name__ == "__main__":
    generate_index()
