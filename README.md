# sogehtbowling.ch

Website des Bowlingteams **Hoppi Galoppi Solutions**. Reines HTML, CSS und JavaScript, ohne Build-Schritt. Läuft auf jedem statischen Hosting, zum Beispiel GitHub Pages.

## Aufbau

```
index.html        Seitengerüst (Navigation, Abschnitte, Spiel-Bereich)
content.json      Alle Inhalte, die sich ändern: Team, Turnier, Geschichte, Sprüche
css/styles.css    Gestaltung (Farben, Schriften, Layout, Animationen)
js/site.js        Lädt content.json, Countdown, Intro, Navigation
js/game.js        Das Bowling-Spiel (Physik, Pinsetter, Comic-Meldungen)
assets/logo.svg   Logo inkl. funkelndem Feenstaub
```

## Inhalte pflegen

Fast alles, was sich ändert, steht in **`content.json`**. HTML oder JavaScript müssen dafür nicht angefasst werden.

- **Nächstes Turnier:** `turnier.datum` (Format `JJJJ-MM-TTTHH:MM:SS`, z.B. `2027-03-13T10:00:00`) steuert den Countdown, `turnier.text` ist der Satz darüber.
- **Team:** Ein Eintrag pro Person mit `name`, `rolle`, `text` und den drei Farben der Kugel (`kugel`: hell, mittel, dunkel).
- **Geschichte:** `zahlen` sind die vier Kennzahlen. In `eintraege` steht die Turnierliste, das neueste Turnier zuoberst. Ein neues Turnier oben einfügen:
  ```json
  {"rang": 5, "liga": "Europa League", "datum": "Samstag, 20. März 2027", "turnier_nr": 21, "witz": "Euer Spruch."},
  ```
  Ränge 1 bis 3 werden automatisch hervorgehoben.
- **Sprüche im Spiel:** Unter `sprueche`, pro Situation (z.B. `strike`, `spare`, `rinne1`) drei Töpfe: `any` (immer möglich), `schnell` (harter Wurf), `sanft` (weicher Wurf). `{rest}` wird durch die Zahl der stehenden Pins ersetzt („zwei“, „drei“ …).

Wichtig beim Bearbeiten: Texte in `"Anführungszeichen"`, Kommas zwischen Einträgen, kein Komma nach dem letzten Eintrag. Wer unsicher ist, prüft die Datei kurz auf [jsonlint.com](https://jsonlint.com).

## Lokal testen

`content.json` wird per `fetch` geladen. Das funktioniert nicht, wenn man `index.html` direkt per Doppelklick öffnet. Stattdessen im Ordner einen kleinen Server starten:

```
python3 -m http.server 8000
```

und `http://localhost:8000` öffnen.

**Test-Modus:** Mit `?test` in der Adresse (`http://localhost:8000/?test`) gibt es Tasten für den nächsten Wurf: **X** = Strike, **S** = Spare, **R** = Rinne. Ohne `?test` sind die Tasten aus.

## Veröffentlichen mit GitHub Pages

1. Auf GitHub ein Repository anlegen und den Inhalt dieses Ordners hochladen (die Dateien direkt ins Hauptverzeichnis, nicht in einen Unterordner).
2. Im Repository: **Settings → Pages → Build and deployment**, Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten ist die Seite unter `https://<benutzername>.github.io/<repository>/` erreichbar.
4. Eigene Domain: unter **Settings → Pages → Custom domain** `sogehtbowling.ch` eintragen und beim Domain-Anbieter die DNS-Einträge setzen, die GitHub dort anzeigt. Danach „Enforce HTTPS“ aktivieren.

Jede gespeicherte Änderung (auch direkt im Browser auf github.com, z.B. an `content.json`) wird automatisch neu veröffentlicht.

## Schriften

Die Google Fonts Schriften (Bowlby One, Space Grotesk, Yellowtail) sind lokal unter `assets/fonts/` abgelegt.
