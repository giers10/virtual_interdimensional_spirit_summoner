# Virtuelles Interdimensionales Geisterteleportationsgerät

**Author:** Victor Giers

> ⚠️ **This README.md has been automatically generated using AI and might contain hallucinations or inaccuracies. Please proceed with caution!**

---

Ein experimentelles 3D-Webprojekt, das Figuren der japanischen Mythologie weltweit sichtbar macht.  
Technisch ist es ein synchronisiertes Lexikon und eine virtuelle Ausstellung im Browser.

---

## Idee & Hintergrund

- **Ziel:**  
  Die Vielfalt der japanischen Mythologie als 3D-Modelle erfahrbar machen und einen niedrigschwelligen, spielerischen Zugang ermöglichen.
- **Kulturelle Brücken:**  
  Die zentrale „Beschwörungseinheit“ (Merkaba/Spinner) ist ein Motiv aus der hebräischen Mystik und wird hier als universales, verbindendes Symbol genutzt.  
  Sie „teleportiert“ japanische Geisterwesen in die virtuelle Szene, bevor sie durch das japanische Torii in eine andere Welt weiterziehen.

- **Servergesteuert:**  
  Die Auswahl und das Erscheinen der Spirits erfolgt serverseitig im festen Takt. Alle Nutzer:innen sehen zeitgleich dasselbe Geistwesen – unabhängig von ihrem eigenen Verhalten.

---

## Features

- **Zufällige Geistwesen aus der japanischen Mythologie**  
  Jede Figur besitzt ein Bild, ein 3D-Modell und eine Kurzbeschreibung mit Mythos, Rolle und Herkunft.
- **Weltweite Synchronisierung**  
  Alle Besucher:innen sehen denselben „aktiven Spirit“, gesteuert durch den Server.
- **Interaktives Overlay**  
  Per Klick auf das 3D-Modell erscheinen Bild und Textinfos in einer Infobox.
- **Plattformunabhängig & responsiv**  
  Funktioniert auf Desktop und Mobile. Die Darstellung passt sich an die Bildschirmgröße an.

---

## Installation & Start

1. **Repository klonen**
    ```sh
    git clone <repo-url>
    cd virtuelles-geisterteleportationsgeraet
    ```
2. **Abhängigkeiten installieren**
    ```sh
    npm install
    ```
3. **Server starten**
    ```sh
    node server.js
    ```
4. **Im Browser öffnen:**  
   [`http://localhost:3000`](http://localhost:3000)

**Hinweis:** Die Assets (Bilder, 3D-Modelle, spirit_list.json) müssen in den passenden Verzeichnissen liegen.

---

## Technischer Überblick

- **Backend:** Node.js, Express, WebSocket
- **Frontend:** Three.js (3D, Effekte), Vanilla JS
- **Datenaufbereitung:** Python-Skripte, manuelle Kuration

**Assets:**  
- KI-Bilder: ChatGPT (o4-mini-high)  
- 3D-Modelle: Hunyuan3D-2, nachbearbeitet in Blender  
- Spirit-Texte: ChatGPT

---

## Lizenz

**Empfehlung:**  
Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)  
Du darfst den Code und die Assets für nicht-kommerzielle Zwecke verwenden, Bearbeitung ist erlaubt, Namensnennung (Victor Giers, KI-Quellen) ist erforderlich.

---

## Credits

- **Konzept, Code, Datenbearbeitung:** Victor Giers ([victorgiers.com](https://victorgiers.com/))
- **Bilder, Texte:** ChatGPT (o4-mini-high)
- **3D-Modelle:** Hunyuan3D-2, Blender

---

## Zweck

Das Projekt will japanische Mythologie weltweit zugänglich machen, religiöse Symbole neu kontextualisieren  
und zum spielerischen, offenen Umgang mit Tradition und Technik einladen.

---

## Kontakt

Feedback und Fragen:  
[https://victorgiers.com](https://victorgiers.com)