# sogehtbowling.ch

Website des Bowlingteams **Hoppi Galoppi Solutions**. Reines HTML, CSS und JavaScript, ohne Build-Schritt. Läuft auf jedem statischen Hosting, zum Beispiel GitHub Pages.

## Aufbau

```
index.html        Seitengerüst (Navigation, Abschnitte, Spiel-Bereich)
content.json      Alle Inhalte, die sich ändern: Team, Turnier, Geschichte, Sprüche
css/styles.css    Gestaltung (Farben, Schriften, Layout, Animationen)
js/site.js        Lädt content.json, Countdown, Intro, Navigation
js/rules.js       Spielregeln ohne Grafik: offizielle Zählung, Frame-Ablauf, Spruchauswahl
js/comics.js      Comic-Einblendungen: Sprechblase, Spare-, Strike-, Abschluss- und Rekord-Stern
js/share.js       Bild zum Teilen am Spielende (Spieltafel, Bahn mit Stern, Adresse)
js/physics.js     Physik ohne Grafik: Kugel, Pins, Zusammenstösse, Einstellungen
js/game.js        Das Bowling-Spiel: Ablauf eines Wurfs, Pinsetter, Zeichnen, Eingabe
assets/logo.svg   Logo inkl. funkelndem Feenstaub
assets/og.png     Vorschaubild beim Teilen auf Social Media (1200 × 630)
tests/            Automatische Tests und Vorschau aller Sprüche (siehe „Tests“)
```

Das Spiel zählt nach den offiziellen Regeln: 10 Frames, Strike = 10 plus die nächsten zwei Würfe, Spare = 10 plus der nächste Wurf, im 10. Frame bis zu drei Würfe. Oben im Spiel steht die übliche Bowling-Tafel. Nach dem 10. Frame zeigt ein Abschluss-Stern die Punktzahl, ein Tipp startet ein neues Spiel.

## Inhalte pflegen

Fast alles, was sich ändert, steht in **`content.json`**. HTML oder JavaScript müssen dafür nicht angefasst werden.

- **Nächstes Turnier:** `turnier.datum` (Format `JJJJ-MM-TTTHH:MM:SS`, z.B. `2027-03-13T10:00:00`) steuert den Countdown, `turnier.text` ist der Satz darüber.
- **Team:** Ein Eintrag pro Person mit `name`, `rolle`, `text` und den drei Farben der Kugel (`kugel`: hell, mittel, dunkel, als Hex-Farben wie `#ff7a1a`).
- **Geschichte:** `zahlen` sind die vier Kennzahlen. In `eintraege` steht die Turnierliste, das neueste Turnier zuoberst. Ein neues Turnier oben einfügen:
  ```json
  {"rang": 5, "liga": "Europa League", "datum": "Samstag, 20. März 2027", "turnier_nr": 21, "witz": "Euer Spruch."},
  ```
  Ränge 1 bis 3 werden automatisch hervorgehoben.
- **Sprüche im Spiel:** Unter `sprueche`, pro Situation drei Töpfe: `any` (immer möglich, mindestens ein Spruch), `schnell` (harter Wurf), `sanft` (weicher Wurf). Derselbe Spruch kommt nie zweimal hintereinander.
  - Situationen beim ersten Wurf: `strike`, `rinne1`, `luft1` (nichts getroffen), `wenig1`, `mittel1`, `viel1`, `neun1`, `mitte1` (nur die Aussenpins stehen)
  - beim zweiten Wurf: `spare`, `rinne2`, `luft2`, `knapp2` (einer bleibt stehen), `rest2gut`, `rest2mittel`, `rest2schwach`
  - letzter Wurf im 10. Frame auf neue Pins: `ende0`, `ende_wenig`, `ende_viel`
  - `keinekugel`: Klick auf die Bahn, bevor die Kugel aus dem Rücklauf geholt wurde (nur `any`). Am besten mit Hinweis, wo die Kugel liegt
  - `{rest}` wird durch die Zahl der stehenden Pins ersetzt („zwei“, „drei“ …). Nur dort verwenden, wo mindestens zwei Pins stehen, sonst entsteht „einer sind …“.
  - Strike- und Spare-Sprüche nicht mit „Strike!“ oder „Spare!“ beginnen, der Titel steht schon gross im Stern.
  - Schweizer Schreibweise: „ss“ statt „ß“.
- **Bewertung am Spielende:** Unter `endwertung` eine Liste mit Punktgrenze und Text, z.B. `{"ab": 150, "text": "Starkes Spiel."}`. Es gilt der höchste Eintrag, dessen `ab` erreicht ist. Die Liste beginnt bei 0 und ist aufsteigend.
- **Neuer Rekord:** Der Browser merkt sich die persönliche Bestmarke (`localStorage`, Eintrag `hg-bestmarke`, nirgends angezeigt). Wird sie übertroffen, erscheint statt der Bewertung ein goldener Stern mit einem Text aus `rekord` (Liste, Platzhalter `{bisher}` = alte Bestmarke). Das erste Spiel setzt die Bestmarke nur, ein Rekord ist es noch nicht.
- **Teilen:** Am Spielende erscheint auf der Bahn ein Knopf „Teilen“. Er teilt ein Bild (Spieltafel, Bahn mit Abschluss-Stern, Adresse; erzeugt in `js/share.js`) zusammen mit einem Text über das Teilen-Menü des Geräts. Ohne Teilen-Menü kommt das Bild in die Zwischenablage, sonst wird es heruntergeladen. Der Text dazu steht unter `teilen` (z.B. „Schaffst du mehr?“), der Link wird automatisch angehängt. Punkte und Rekord stehen schon im Bild; wer sie trotzdem im Text will, kann `{punkte}` verwenden. Der Link kommt aus `og:url` in `index.html`.

Wichtig beim Bearbeiten: Texte in `"Anführungszeichen"`, Kommas zwischen Einträgen, kein Komma nach dem letzten Eintrag. Wer unsicher ist, prüft die Datei kurz auf [jsonlint.com](https://jsonlint.com).

## Schwierigkeit anpassen

Alle Werte für das Spielgefühl stehen oben in **`js/physics.js`** im Block `TUNING`, jeder mit einem kurzen Kommentar. Die wichtigsten:

- `pinImpulse`: Stoss von Pin zu Pin, der Hauptregler für die Strike-Quote. Schon ±0.01 ist spürbar.
- `pocketCarry` / `headOnCarry`: Bonus für einen Treffer in die Tasche (knapp neben den vordersten Pin) bzw. Abzug für einen frontalen Treffer.
- `aimNoise` / `hookNoise`: wie stark der Zufall den Wurf ablenkt.
- `pushLen`: wie weit man für volle Wucht nach vorne ziehen muss.
- `pushAim`: wie stark seitliches Ziehen die Richtung ändert (kleiner = verzeihender).
- `pushWobble`: wie stark der Pfeil bei viel Wucht zittert.
- `speedMin` / `speedMax`: Tempo der Kugel bei wenig bzw. voller Wucht.

Ablauf und Grafik (Zeiten der Meldungen, Pinsetter, umgefallene Pins, Kugelrücklauf, Bahnlogo) lassen sich im Abschnitt **Einstellungen** am Anfang von `js/game.js` verstellen.

Nach einer Änderung `node --test` laufen lassen: `tests/physics.test.js` wirft ein paar tausend simulierte Kugeln und meldet die aktuelle Strike-Quote. Er schlägt fehl, wenn das Spiel deutlich zu leicht oder zu schwer wird oder die Tasche sich nicht mehr lohnt.

## Lokal testen

`content.json` wird per `fetch` geladen. Das funktioniert nicht, wenn man `index.html` direkt per Doppelklick öffnet. Stattdessen im Ordner einen kleinen Server starten:

```
python3 -m http.server 8000
```

und `http://localhost:8000` öffnen.

**Vorschau aller Sprüche:** `http://localhost:8000/tests/vorschau.html` zeigt jeden Spruch aus `content.json` in seiner echten Einblendung. Rot markiert = Text passt nicht in die Form, gelb = Schrift musste auf die Mindestgrösse schrumpfen. Praktisch nach dem Bearbeiten der Sprüche. Ganz unten stehen die Bilder zum Teilen mit festen Beispielspielen (normal, neuer Rekord, perfektes Spiel) auf einer vereinfachten Bahn; fehlt eines, ist die Kachel rot. Mit der echten Bahn zeigt sie das Spiel über die Abkürzung `?ende` (siehe unten).

**Direkt ans Spielende:** `http://localhost:8000/?ende` springt mit einem zufälligen Spiel ans Ende und zeigt Abschluss-Stern und Teilen-Knopf, ohne zehn Frames zu spielen. `?ende=rekord` zeigt den goldenen Rekord-Stern, `?ende=300` das perfekte Spiel. Wirkt nur lokal (`localhost`, `0.0.0.0`, `[::]`, `*.local` und Adressen im eigenen Netz, also auch auf dem Handy über die IP des Rechners), die gespeicherte Bestmarke bleibt unberührt.

## Tests

Die Tests brauchen nur [Node.js](https://nodejs.org) (ab Version 18), keine Zusatzpakete. Im Projektordner:

```
node --test
```

- `tests/rules.test.js`: Zählung (ganze Spiele inkl. 300 und Sonderfälle im 10. Frame), Frame-Ablauf, Wahl der Spruchgruppe, Spruchauswahl, Bewertung, Bestmarke
- `tests/physics.test.js`: Aufstellung, Rinnenwurf, gleicher Zufall ergibt gleichen Wurf, und eine Simulation der Spielbarkeit (Strike-Quote in der Tasche zwischen 25 und 55 %, Tasche besser als die Mitte)
- `tests/content.test.js`: prüft `content.json` auf typische Bearbeitungsfehler (fehlende oder falsch geschriebene Gruppen, leere oder doppelte Sprüche, `{rest}` an falscher Stelle, „Strike!“ am Anfang, „ß“, Lücken in `endwertung`, Platzhalter in `rekord` und `teilen`). Die Meldungen nennen Gruppe und Spruch.
- `tests/csp.test.js`: prüft die Sicherheitsregeln (Content-Security-Policy) in `index.html`. Wer das kleine Skript im Kopf von `index.html` ändert, muss dessen Hash in der CSP nachführen; der Test nennt den neuen Wert.
- `tests/layout.test.js`: öffnet die Vorschau in Chrome im Hintergrund und schlägt fehl, wenn ein Spruch nicht in seine Einblendung passt. Speichert dabei ein Bild aller Einblendungen unter `tests/vorschau.png` (nicht im Repository). Ohne Chrome wird dieser Test übersprungen, ein anderer Pfad geht mit `CHROME_PATH=/pfad/zu/chrome node --test`.

Am besten vor jedem Veröffentlichen laufen lassen, vor allem nach Änderungen an `content.json`.

## Veröffentlichen mit GitHub Pages

1. Auf GitHub ein Repository anlegen und den Inhalt dieses Ordners hochladen (die Dateien direkt ins Hauptverzeichnis, nicht in einen Unterordner).
2. Im Repository: **Settings → Pages → Build and deployment**, Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten ist die Seite unter `https://<benutzername>.github.io/<repository>/` erreichbar.
4. Eigene Domain: unter **Settings → Pages → Custom domain** `sogehtbowling.ch` eintragen und beim Domain-Anbieter die DNS-Einträge setzen, die GitHub dort anzeigt. Danach „Enforce HTTPS“ aktivieren.

Jede gespeicherte Änderung (auch direkt im Browser auf github.com, z.B. an `content.json`) wird automatisch neu veröffentlicht.

## Vorschau beim Teilen

Wird der Link auf Social Media oder in Messengern geteilt, erscheint `assets/og.png` als Vorschaubild, dazu Titel und Beschreibung aus den `og:`-Angaben im Kopf von `index.html`. Ein neues Bild muss 1200 × 630 Pixel gross sein, das Wichtigste gehört in die Mitte (manche Apps schneiden quadratisch zu). Nach dem Austauschen die Zahl in `og.png?v=…` hochzählen, sonst zeigen Facebook, LinkedIn und Co. noch lange das alte Bild. Prüfen lässt sich die Vorschau z.B. mit [opengraph.xyz](https://www.opengraph.xyz).

## Sicherheit

Die Seite lädt nichts von fremden Servern. Eine Content-Security-Policy im Kopf von `index.html` erzwingt das: Skripte, Schriften, Bilder und Daten nur von der eigenen Adresse. Neue externe Quellen (z.B. ein Zählpixel oder eine Schrift von Google) funktionieren darum erst, wenn sie dort eingetragen sind. Texte aus `content.json` werden vor dem Einfügen in die Seite maskiert.

## Schriften

Die Google Fonts Schriften (Bowlby One, Space Grotesk, Yellowtail) sind mit den eigenen Lizenzen lokal unter `assets/fonts/` abgelegt.

## Copyright

© 2026 Daniel Tschumi, sogehtbowling.ch
