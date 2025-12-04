#!/usr/bin/env python3
import os
import sys
import argparse
import requests
import urllib.parse

def main():
    parser = argparse.ArgumentParser(
        description="Bilder mit der OpenAI Image API generieren und herunterladen"
    )
    parser.add_argument(
        "--api_key", "-k",
        help="OpenAI API-Schlüssel (alternativ über OPENAI_API_KEY)"
    )
    parser.add_argument(
        "--model", "-m",
        default="dall-e-2",
        help="Modellname (z.B. 'gpt-image-1' oder 'dall-e-2')"
    )
    parser.add_argument(
        "--prompt", "-p",
        required=True,
        help="Text-Prompt für die Bildgenerierung"
    )
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=1,
        help="Anzahl der Bilder"
    )
    parser.add_argument(
        "--size", "-s",
        choices=["256x256", "512x512", "1024x1024"],
        default="1024x1024",
        help="Bildgröße"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["url", "b64_json"],
        default="url",
        help="Format der Antwort"
    )
    parser.add_argument(
        "--output", "-o",
        help="Zieldatei für das heruntergeladene Bild (bei mehreren: Suffix _1,_2 etc.)"
    )
    args = parser.parse_args()

    # API-Key: zuerst aus Argument, sonst aus Umgebungsvariable
    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: Bitte gib einen API-Schlüssel via --api_key an oder setze OPENAI_API_KEY.", file=sys.stderr)
        sys.exit(1)

    # Request aufsetzen
    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": args.model,
        "prompt": args.prompt,
        "n": args.count,
        "size": args.size,
        "response_format": args.format,
    }

    # Anfrage abschicken
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"API-Request fehlgeschlagen: {e}", file=sys.stderr)
        sys.exit(1)

    # Antwort auswerten und ggf. herunterladen
    data = response.json().get("data", [])
    for i, item in enumerate(data, start=1):
        if args.format == "url":
            img_url = item.get('url')
            print(f"[{i}] Bild-URL: {img_url}")

            # Bild herunterladen
            try:
                img_resp = requests.get(img_url)
                img_resp.raise_for_status()
            except requests.RequestException as e:
                print(f"Fehler beim Herunterladen des Bildes: {e}", file=sys.stderr)
                continue

            # Dateinamen bestimmen
            if args.output:
                base, ext = os.path.splitext(args.output)
                filename = f"{base}_{i}{ext}" if args.count > 1 else args.output
            else:
                path = urllib.parse.urlparse(img_url).path
                filename = os.path.basename(path)

            # Datei schreiben
            with open(filename, 'wb') as f:
                f.write(img_resp.content)
            print(f"Bild gespeichert: {filename}")

        else:
            # Base64-Ausgabe
            b64 = item.get('b64_json')
            print(f"[{i}] Bild (Base64):\n{b64}\n")

if __name__ == "__main__":
    main()
