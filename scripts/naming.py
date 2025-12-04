import os
import json
import re
from difflib import get_close_matches

# ---- Konfiguration ----
image_dir = "webp"
json_path = "spirit_list.json"
output_path = "spirit_list_with_images.json"
image_url_prefix = "/assets/images/spirits/"  # Deine URL

# --- Hilfsfunktion: Normalisiere Namen (um sie vergleichbar zu machen) ---
def norm(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '', s)  # Alles außer Buchstaben/Zahlen raus
    return s

# ---- Bilddateien einlesen & normalisieren ----
image_files = [f for f in os.listdir(image_dir) if f.lower().endswith('.webp')]
norm2file = {norm(os.path.splitext(f)[0]): f for f in image_files}

# ---- JSON einlesen ----
with open(json_path, "r", encoding="utf-8") as f:
    spirits = json.load(f)

matched = 0
notfound = []

for entry in spirits:
    # Nimm zuerst Model URL, ansonsten Name
    base = None
    if "Model URL" in entry and entry["Model URL"]:
        base = os.path.splitext(os.path.basename(entry["Model URL"]))[0]
    if not base and "Name" in entry:
        base = entry["Name"]
    if not base:
        notfound.append(entry)
        continue

    base_norm = norm(base)
    # Direktes Mapping versuchen
    if base_norm in norm2file:
        entry["Image URL"] = image_url_prefix + norm2file[base_norm]
        matched += 1
        continue

    # Fuzzy-Match, falls nicht gefunden
    candidates = get_close_matches(base_norm, norm2file.keys(), n=1, cutoff=0.7)
    if candidates:
        file_name = norm2file[candidates[0]]
        entry["Image URL"] = image_url_prefix + file_name
        print(f"Fuzzy: {base} → {file_name}")
        matched += 1
    else:
        print(f"Kein Bild gefunden für: {base}")
        notfound.append(entry)

# --- Neue JSON schreiben ---
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(spirits, f, indent=2, ensure_ascii=False)

print(f"{matched} von {len(spirits)} Einträgen mit Bild gematcht.")
print(f"Nicht gefunden: {len(notfound)}")
if notfound:
    for entry in notfound:
        print("  -", entry.get("Name", "???"))