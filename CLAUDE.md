# Hinweise für Claude Code

## Was das ist

Klassenspiel zur Stunde „Die Taktarten“ (Klasse 5, Stundenordner
`Klasse 5 - 1c Taktarten +`). Aufbau, Raum-Logik und Look wie die
Metrum-Challenge (`metrum-spiel`), Skill `klassenspiel-bauen`.
Sieben Teile (Reihenfolge `TEILE` in `js/spiel.js`):

- **Hörquiz** (`hoer`): Songs aus dem Ordner „Hörbeispiele“ (Folien 2–8),
  Kinder tippen 2/4, 3/4 oder 4/4. „Erst zuhören“ sperrt die Knöpfe.
- **Klick-Detektiv** (`klick`, eigene Idee): Web Audio spielt Metronom,
  Schlagzeug oder Blaskapelle mit betonter 1, Taktart und Tempo zufällig.
- **Taktart eintragen** (`takt`, Aufgabe 2 + 6): „?“ antippen, Taktart wählen;
  Profi-Zeilen mit Taktwechsel.
- **Taktstriche setzen** (`strich`, Aufgabe 4): Lücken zwischen den Noten
  antippen.
- **Fehlende Note** (`luecke`, Aufgabe 5): „?“ antippen, Notenwert wählen.
- **Notenkobold** (`kobold`, Fehlersuche aus Z2): verhexten Takt antippen.
- **Taktarten-Millionär** (`quiz`): Merke-Fragen mit Quatsch-Antworten.

Inhalte stehen oben in `js/spiel.js` (`SONGS`, `TAKT`, `STRICH`, `LUECKE`,
`KOBOLD`, `QUIZ`). Notenkürzel wie in der Rhythmus-Werkstatt (`js/noten.js`,
unveränderte Kopie), dazu `Hd` = punktierte Halbe (in `spiel.js` ergänzt).
Jeder Baustein wird als eigenes SVG gezeichnet (`notenSvg`), Taktart,
Taktstriche und „?“ sind HTML (`zeileHtml`) – so sind sie am iPad antippbar.
Alles per Tippen (pointerdown), kein HTML5-Drag.

## Spielart, Songs, Mitspieler

- **Spielart** (`ta-modus`): „Ganze Challenge“ (Teile per Häkchen, feste
  Rundenzahl je Teil, nur die Songzahl im Hörquiz einstellbar, `ta-songzahl`)
  oder „Nur ein Teil“ (`ta-einzeln`, Rundenzahl `ta-runden`, 3–30 oder alle).
- **Hörbeispiele:** „MP3s wählen“ – alle Dateien aus dem Ordner
  „Hörbeispiele“ markieren, Zuordnung über den Dateinamen (`SONGS[].such`),
  Tanz-Songs werden übersprungen. Nur IndexedDB (`taktarten-challenge`/`hb`).
- **Eigene Songs:** `e-…` mit `{blob, name, titel, ta, seit}`, Taktart aus
  dem Dateinamen („3-4“) oder per Auswahl. Häkchen = im Spiel (`ta-hb-aus`).
- **Songs im Spiel:** Aufklappbereich unter dem Spiel, Songs nachlegen.
- Anwesenheit, Entfernen, Auto weiter (`ta-auto`), Vollbild (F),
  Mitspieler (M), Weiterführen nach Neuladen: wie in der Metrum-Challenge.

## Keine Musik ins Repository

Die Songs sind urheberrechtlich geschützt (`.gitignore: *.mp3`). Sie liegen
im Stundenordner und nur in IndexedDB des Beamer-Browsers.

## Firebase

Projekt `greenboys-scoreboard`, Knoten `rooms/ta-<CODE>` (offen, ohne
`.validate`) – nur kleine, flache Daten. **Präfix `ta-` ist für dieses Spiel
vergeben** (`mt-` Metrum-Challenge, `zz-` Rhythmus-Klassenspiel, Scoreboard
ohne Präfix). Aufbau oben in `js/spiel.js`. Kinder hören nur `lehrer` ab,
die Lehrkraft `spieler` und die Antworten der laufenden Runde. Die Aufgabe
für die Kinder (`aufgabeVon`) enthält nie die Lösung. Grob 8 MB pro Stunde
bei 28 Kindern und ~30 Runden (obere Grenze).

## Kein Build

Reines HTML/CSS/JS. Nach Änderungen die `?v=`-Nummern in `index.html`
hochzählen, sonst liefern iPads die alte Fassung aus dem Cache.
Nicht in einen Cloud-Ordner legen.
