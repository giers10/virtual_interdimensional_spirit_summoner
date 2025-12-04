#!/usr/bin/env python3
import os
import sys
import argparse
import json
import requests
import urllib.parse

def generate_image_prompt(entity_json: dict, chat_model: str, api_key: str) -> str:
    """
    Generiert einen Bild-Prompt aus der JSON-Beschreibung mit Hilfe eines OpenAI-Chat-Modells.
    """
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    pretext = (
        "Ich schicke dir nun einen JSON-Abschnitt, der ein japanisches spirituelles Wesen beschreibt."
        " Du wirst das Internet bemühen, um nach Darstellungen und weitere Beschreibung der äußeren Erscheinung dieses Wesens zu finden."
        " Mit all diesen Informationen generierst du dann ein Bild von dem Wesen im Stil von moderner Low-Poly 3D-Grafik,"
        " ohne Hintergrund, nur das Wesen selbst. Das Wesen soll vollständig auf dem Bild dargestellt sein, nicht abgeschnitten."
        " Es soll dafür geeignet sein, ein 3D Objekt daraus zu bauen."
        " Hier der JSON-Abschnitt:"
    )
    content = f"{pretext}\n{json.dumps(entity_json, ensure_ascii=False)}"
    payload = {
        "model": chat_model,
        "messages": [
            {"role": "user", "content": content}
        ],
        "temperature": 0.7,
    }
    resp = requests.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    # Annahme: Der Prompt steht im ersten Choice unter message.content
    prompt = data["choices"][0]["message"]["content"].strip()
    return prompt


def generate_and_download_image(prompt: str,
                                image_model: str,
                                api_key: str,
                                count: int,
                                size: str,
                                fmt: str,
                                base_output: str):
    """
    Generiert Bilder mit der OpenAI Image API und lädt sie herunter.
    """
    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": image_model,
        "prompt": prompt,
        "n": count,
        "size": size,
        "response_format": fmt,
    }
    resp = requests.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json().get("data", [])

    for idx, item in enumerate(data, start=1):
        if fmt == "url":
            img_url = item.get("url")
            try:
                img_resp = requests.get(img_url)
                img_resp.raise_for_status()
            except requests.RequestException as e:
                print(f"Fehler beim Herunterladen des Bildes #{idx}: {e}", file=sys.stderr)
                continue
            # Dateinamen bestimmen
            if base_output:
                base, ext = os.path.splitext(base_output)
                ext = ext or os.path.splitext(urllib.parse.urlparse(img_url).path)[1]
                filename = f"{base}_{idx}{ext}" if count > 1 else base_output
            else:
                path = urllib.parse.urlparse(img_url).path
                filename = os.path.basename(path)
            with open(filename, "wb") as f:
                f.write(img_resp.content)
            print(f"Bild gespeichert: {filename}")
        else:
            # Base64 JSON direkt ausgeben
            b64 = item.get("b64_json")
            out_name = f"{base_output or 'image'}_{idx}.b64.txt"
            with open(out_name, "w") as f:
                f.write(b64)
            print(f"Base64 in Datei geschrieben: {out_name}")


def main():
    parser = argparse.ArgumentParser(
        description="Generiere Bild-Prompts aus JSON und erstelle Bilder via OpenAI API"
    )
    parser.add_argument(
        "--api_key", "-k",
        help="OpenAI API-Schlüssel (alternativ ENV OPENAI_API_KEY)",
    )
    parser.add_argument(
        "--chat_model", "-c",
        default="o4-mini-high",
        help="Modell für die Prompt-Generierung (z.B. 'o4-mini-high')",
    )
    parser.add_argument(
        "--image_model", "-m",
        default="dall-e-3",
        help="Modell für die Bild-Generierung (z.B. 'dall-e-3')",
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Pfad zu JSON-Datei mit einer Liste von Entity-Objekten",
    )
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=1,
        help="Anzahl Bilder pro Entity",
    )
    parser.add_argument(
        "--size", "-s",
        choices=["256x256", "512x512", "1024x1024"],
        default="1024x1024",
        help="Bildgröße",
    )
    parser.add_argument(
        "--format", "-f",
        choices=["url", "b64_json"],
        default="url",
        help="Antwort-Format",
    )
    parser.add_argument(
        "--output", "-o",
        help="Basis-Ausgabe-Dateiname oder Verzeichnis (Suffixe _1,_2 werden ergänzt)",
    )
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: API-Schlüssel fehlt. Nutze --api_key oder setze OPENAI_API_KEY.", file=sys.stderr)
        sys.exit(1)

    # JSON-Datei einlesen
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            entities = json.load(f)
    except Exception as e:
        print(f"Fehler beim Laden der JSON-Datei: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(entities, list):
        print("Error: Die JSON-Datei muss eine Liste von Objekten enthalten.", file=sys.stderr)
        sys.exit(1)

    # Für jede Entity Prompt generieren und Bild erstellen
    for idx, entity in enumerate(entities, start=1):
        name_safe = entity.get("Name", f"entity_{idx}").replace(" ", "_")
        print(f"Verarbeite: {entity.get('Name', name_safe)}")

        prompt = generate_image_prompt(entity, args.chat_model, api_key)
        print(f"Generierter Prompt: {prompt}\n")

        base_out = None
        if args.output:
            # Wenn Ausgabe ein Verzeichnis ist, dort ablegen
            if os.path.isdir(args.output):
                base_out = os.path.join(args.output, f"{name_safe}.png")
            else:
                base_out = f"{os.path.splitext(args.output)[0]}_{name_safe}.png"

        generate_and_download_image(
            prompt=prompt,
            image_model=args.image_model,
            api_key=api_key,
            count=args.count,
            size=args.size,
            fmt=args.format,
            base_output=base_out,
        )

if __name__ == "__main__":
    main()
