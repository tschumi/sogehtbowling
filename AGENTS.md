# AGENTS.md

Hinweise für KI-Programmierassistenten (Claude Code, Codex, Copilot usw.) in diesem Repository. Für Menschen steht alles Wichtige im [README](README.md).

## Projekt

Website des Fun-Bowlingteams **Hoppi Galoppi Solutions** (sogehtbowling.ch) mit einem kleinen Bowling-Spiel im Browser. Ein Goodie für Arbeitskollegen, gehostet auf GitHub Pages.

- Reines HTML, CSS und JavaScript. **Kein Build-Schritt, keine Abhängigkeiten, kein npm.** Das soll so bleiben.
- Keine Frameworks, keine Bibliotheken von CDNs, keine externen Anfragen (auch Schriften liegen lokal unter `assets/fonts/`).

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst, lädt die Skripte in dieser Reihenfolge (alle `defer`): `site.js`, `rules.js`, `comics.js`, `physics.js`, `game.js` |
| `content.json` | Alle redaktionellen Inhalte (Team, Turnier, Geschichte, Sprüche, Endwertung) |
| `css/styles.css` | Gestaltung, Layout, Animationen |
| `js/site.js` | Lädt `content.json` (als `window.HG_CONTENT`), Countdown, Intro, Navigation, Burger-Menü |
| `js/rules.js` | `HGRules`: Zählung, Frame-Ablauf, Spruchauswahl. Ohne DOM, in Node testbar |
| `js/comics.js` | `HGComics`: Comic-Einblendungen (Strike, Spare, Sprechblase, Abschluss-Stern) |
| `js/physics.js` | `HGPhysics`: Kugel, Pins, Zusammenstösse und der Block `TUNING`. Ohne DOM, in Node testbar |
| `js/game.js` | Ablauf eines Wurfs, Pinsetter, Kugelrücklauf, Bahnlogo, Zeichnen auf dem Canvas, Eingabe, Spielanleitung (Info-Knopf) |
| `tests/` | `node --test`-Tests und `vorschau.html` (Vorschau aller Sprüche) |

`rules.js`, `comics.js` und `physics.js` sind UMD-Module: im Browser globale Objekte, in Node per `require`.

`game.js` ist in Abschnitte mit `/* ========== … ========== */` gegliedert: Spielzustand, Pinsetter, Ablauf, Zeichnen (inkl. Bahnlogo), Kugelrücklauf, Hauptschleife, Eingabe, Test-Modus, Start.

### Spielablauf in Kürze

- Zustände: `READY → ROLLING → SCORING → SHOWING → READY`. Geworfen werden kann nur in `READY`.
- **Kugelrücklauf** (Objekt `ret`, Phasen `rack → out → under → roll → rack`, beim Hinlegen `pick` (gezogen) bzw. `drop` (angeklickt: fällt, hüpft, rollt; Einstellungen `DROP…`) `→ held`): Die Kugel kommt erst zurück, wenn der Pinsetter die Pins absetzt (Auftrag `returnBall` in `planReset`). `READY` gibt es erst, wenn sie zurück ist (in der Mulde oder schon geholt). Holen und Verschieben geht schon, während der Pinsetter noch arbeitet, werfen erst in `READY`.
- Der Spieler holt die Kugel selbst aus dem Rücklauf (Klick = Mitte, Ziehen = eigene Position) und kann sie auf der Bahn seitlich verschieben. Der Startpunkt geht als `sx` an `lane.launch(tx, v, sx)`.
- **Bahnlogo:** Einstellungen im Block `LANE_LOGO` in `game.js` (Lage, Grösse, Deckkraft, Brauntöne, mit oder ohne Raute bzw. Kugel und Pins). Es wird aus `assets/logo.svg` erzeugt und blendet dafür die SVG-Gruppen `#Claim`, `#Frame` (Raute), `#Pins`, `#Ball`, `#Shadow` und `#Fairy-dust` per CSS aus bzw. ein. Diese IDs im SVG nicht umbenennen. Das Logo wird mit Versionsnummer geladen (`assets/logo.svg?v=2` in `index.html`, `?v=2&bahn` in `game.js`), weil der Server keine Cache-Angaben sendet: bei Änderungen am SVG überall hochzählen. Das Bahnlogo braucht eine eigene Adresse, sonst hört das Logo oben auf der Seite in Safari auf dem iPhone auf zu funkeln.

## Befehle

```
python3 -m http.server 8000   # lokal ansehen: http://localhost:8000 (fetch braucht einen Server)
node --test                   # alle Tests (Node ab 18, keine Pakete)
```

- `http://localhost:8000/?test` schaltet den Test-Modus ein: Tasten **X** (Strike), **S** (Spare), **R** (Rinne), fps-Anzeige.
- Die Spielanleitung öffnet sich beim ersten Besuch einmal von selbst. Zum erneuten Testen den Eintrag `hg-anleitung` im `localStorage` löschen oder ein privates Fenster nutzen.
- `tests/layout.test.js` braucht Chrome (Pfad über `CHROME_PATH`), sonst wird er übersprungen.
- Nach jeder Änderung `node --test` laufen lassen und das Ergebnis ehrlich melden.

## Regeln für Änderungen

- **Sprache:** Texte auf der Seite, Kommentare und Doku auf Deutsch in **Schweizer Schreibweise** („ss“, nie „ß“). Der Test `content.test.js` prüft das für `content.json`.
- **Code-Stil:** bestehenden Stil beibehalten: kompakt, Einrückung mit einem Leerzeichen, kurze Namen, deutsche Kommentare mit `/* … */`. Keine Formatter laufen lassen, die ganze Dateien umformatieren.
- **Spielgefühl:** Alle Werte für Schwierigkeit, Physik und Eingabe (Ziehen, Zittern) stehen in `TUNING` in `js/physics.js`, jeder mit Kommentar. Neue Stellschrauben dort ergänzen, nicht als Magic Numbers in `game.js`. Kleine Änderungen haben grosse Wirkung (`pinImpulse` ±0.01 ist spürbar). `tests/physics.test.js` meldet die Strike-Quote, auch für Würfe von der Seite (Winkelbonus `angleCarry`).
- **Grafik-Einstellungen** (Bahnlogo, Rücklauf-Positionen und -Tempo) stehen als benannte Konstanten in `game.js` beim jeweiligen Abschnitt.
- **Physik und Regeln ohne DOM:** `physics.js` und `rules.js` dürfen nicht auf `window`, `document` oder Canvas zugreifen. Zufall läuft über den übergebenen `rand`, damit die Simulation deterministisch testbar bleibt.
- **Inhalte:** Sprüche und Texte gehören in `content.json`, nicht in den Code. Regeln für Sprüche (Töpfe `any`/`schnell`/`sanft`, `{rest}` nur ab zwei Pins, kein „Strike!“ am Anfang) stehen im README.
- **Steuerung:** Geworfen wird durch **Schieben**: auf der Bahn drücken, nach vorne ziehen (seitlich = Richtung, Länge = Wucht), loslassen. Gespielt wird nur mit **Maus oder Touch**. Eine Tastatursteuerung für das Spiel gibt es bewusst nicht (die Bahn ist `role="img"`). Die übrige Seite (Navigation, Anleitung, Schliessen-Knöpfe) bleibt per Tastatur bedienbar.
- **Bedienhinweise:** Unter der Bahn steht nur eine kurze Zeile. Die ausführliche Erklärung gehört in die Anleitung `#howto` in `index.html` (Info-Knopf).
- **Farben:** Die Seite hat nur ein dunkles Farbschema (`color-scheme:dark`, Farben als Variablen in `:root`). Keinen hellen Modus und keine `prefers-color-scheme`-Umschaltung einbauen.
- **Responsive:** Layout auf Handy (ab 360 px), Tablet und Desktop prüfen. Mobile Ansicht bis 820 px über Container-Queries, das Spiel läuft dort im Vollbild (nach „Zur Bowlingbahn“), Burger-Menü bis 600 px.
- **Barrierefreiheit:** Animationen respektieren `prefers-reduced-motion` (in CSS und in `game.js` über `REDUCED`). Neue Animationen dort ebenfalls abschalten.
- **Doku:** Bei neuen Dateien, Einstellungen oder Tests das README nachführen.

## Git

- **Nicht selbst committen oder pushen**, ausser ausdrücklich gewünscht. Der Maintainer committet selbst.
- Commit-Nachrichten auf Englisch nach [Conventional Commits](https://www.conventionalcommits.org), z.B. `feat(game): …`, `fix(layout): …`, `docs(readme): …`, `test(game): …`.
- `tests/vorschau.png` wird von den Tests erzeugt und gehört nicht ins Repository.

