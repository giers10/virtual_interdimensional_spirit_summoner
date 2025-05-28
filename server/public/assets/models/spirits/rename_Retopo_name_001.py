# rename_glbs_underscores.py
# Läuft im exports-Ordner: python3 rename_glbs_underscores.py

import re
from pathlib import Path

# Ordner, in dem die .glb liegen
export_dir = Path('.')

for file in export_dir.glob('Retopo_*.glb'):
    stem = file.stem  # z.B. "Retopo_futakuchi-onna.002"

    # 1) Prefix entfernen
    name = stem.removeprefix('Retopo_')

    # 2) Suffix ".001", ".002", etc. entfernen
    name = re.sub(r'\.\d{3}$', '', name)

    # 3) "_RemeshSrc" entfernen
    name = name.replace('_RemeshSrc', '')

    # 4) Bindestriche durch Leerzeichen ersetzen (für saubere Title-Case)
    name = name.replace('-', ' ')

    # 5) Mehrfach-Leerraum reduzieren
    name = re.sub(r'\s+', ' ', name).strip()

    # 6) Title-Case anwenden
    name = name.title()

    # 7) Leerzeichen durch Unterstriche ersetzen
    name = name.replace(' ', '_')

    # 8) Neuen Dateinamen
    new_file = file.with_name(f"{name}.glb")

    print(f"{file.name} → {new_file.name}")
    file.rename(new_file)