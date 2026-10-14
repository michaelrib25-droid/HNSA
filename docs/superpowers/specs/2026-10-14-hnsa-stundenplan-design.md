# HNSA – Nachhilfe-Stundenplan App (Design)

## Zweck

"HNSA" = **H**andy **N**achhilfe **S**tundenplan **A**pp. Eine lokale, offline-fähige PWA
für ein einzelnes Android-Handy, die den wöchentlichen Nachhilfeplan für 7 Schüler
übersichtlich darstellt und leicht anpassbar macht (Absagen, Verschiebungen,
Extra-Termine), ohne die feste Wochenstruktur zu zerstören.

Explizit **nicht** im Scope: Schülernotizen, Kontaktdaten, Fächer, Zahlungs-Tracking.
Reine Termin-Übersicht.

## Datenmodell

Gespeichert in `localStorage` unter einem Schlüssel (`hnsa_schedule_v1`) als ein JSON-Objekt:

```js
{
  template: [
    { id: "s1", name: "Lisa", weekday: 1, time: "16:00" }
    // weekday: 0 = Montag ... 6 = Sonntag
    // Dauer ist global fix: 90 Minuten (keine Speicherung pro Termin nötig)
  ],
  exceptions: {
    "2026-W42": {
      "s1": { type: "cancelled" },
      "s1-alt": { type: "moved", weekday: 3, time: "17:00" }, // ersetzt s1 nur diese Woche
      "extra-<uuid>": { type: "extra", name: "Tom", weekday: 3, time: "18:00" }
    }
  }
}
```

- `template` ist die dauerhafte, wiederkehrende Wochenstruktur (max. ~7 Einträge).
- `exceptions` ist nach ISO-Kalenderwoche (`YYYY-Www`) gruppiert und enthält nur
  Abweichungen von der Vorlage für genau diese eine Woche:
  - `cancelled` — dieser Template-Termin fällt diese Woche aus
  - `moved` — dieser Template-Termin findet diese Woche zu anderer Zeit statt
  - `extra` — ein einmaliger Zusatztermin ohne Bezug zum Template
- Die angezeigte Woche wird zur Laufzeit immer aus `template` + den Exceptions der
  jeweiligen Woche zusammengerechnet. Nichts wird implizit dauerhaft verändert.

## Komponenten / Dateistruktur

```
HNSA/
  index.html          Einstiegsseite, lädt manifest.json, service-worker.js, js/app.js
  manifest.json        PWA-Manifest (bereits vorhanden aus Hello-World)
  service-worker.js    Offline-Cache (Asset-Liste erweitern)
  css/styles.css        Styling (Raster, Tagesansicht, Dialoge)
  js/
    app.js              Einstiegspunkt: initialisiert Store, rendert aktuelle Ansicht,
                         verdrahtet Navigation und Dialoge
    store.js             Liest/schreibt localStorage; CRUD für template & exceptions;
                         berechnet die effektiven Termine einer Woche
    dateUtils.js          ISO-Kalenderwoche berechnen, deutsche Wochentags-/Monatsnamen,
                         Datumsformatierung
    weekGrid.js            Rendert das Wochenraster (7 Spalten × Zeitachse)
    dayDetail.js            Rendert die Tagesansicht (Liste) inkl. Bearbeitungsdialoge
  icons/                (bestehend, aus Hello-World übernommen)
```

Jede JS-Datei hat genau eine Zuständigkeit; `store.js` kennt keine UI, die UI-Module
kennen kein localStorage-Format direkt, sondern nur die Store-API.

## Bedienung / Interaktionsfluss

**Leeres Zeitfeld antippen:**
Dialog mit Name-Eingabe (Tag/Zeit vorbelegt aus angetipptem Slot) → Auswahl:
- *Einmalig (nur diese Woche)* → wird als `extra`-Exception der aktuellen Woche gespeichert
- *Dauerhaft (jede Woche)* → wird dem `template` hinzugefügt

**Bestehenden Termin antippen** → Aktionsmenü, abhängig vom Typ:
- Template-Termin:
  - *Diese Woche absagen* → `cancelled`-Exception
  - *Diese Woche verschieben* → Tag/Zeit wählen → `moved`-Exception
  - *Dauerhaft ändern* → Tag/Zeit im `template`-Eintrag direkt bearbeiten
  - *Komplett aus Plan löschen* → Eintrag aus `template` entfernen
- Einmaliger Extra-Termin: *Verschieben* (Tag/Zeit innerhalb der Woche ändern) / *Löschen*

**Wochennavigation:** Pfeile ◀/▶ wechseln die angezeigte ISO-Woche, ein "Heute"-Button
springt zurück zur aktuellen Woche.

**Farbgebung:** Jeder Schüler erhält eine deterministische Farbe, abgeleitet aus seinem
Namen (Hash → feste Palette), damit alle 7 Schüler im Raster optisch unterscheidbar sind,
ohne dass Farbe manuell gepflegt werden muss.

## Ansicht

- **Wochenraster (Übersicht):** 7 Spalten (Mo–So), vertikale Zeitachse, farbige Blöcke
  pro Termin mit Schülername. Tippen auf einen leeren Bereich oder Termin löst die
  jeweilige Interaktion aus (siehe oben). Tippen auf den Tages-Header öffnet die
  Tagesansicht.
- **Tagesansicht (Detail):** Liste der Termine des gewählten Tages, größer und leichter
  zu treffen als einzelne Rasterzellen; gleiche Bearbeitungsoptionen wie im Raster.

## Edge Cases

- **Keine Schüler im Template (Erststart):** Leeres Raster mit Hinweistext "Tippe auf
  ein Zeitfeld, um loszulegen."
- **Überschneidende Termine** (zwei Schüler zur gleichen Zeit, z. B. durch Verschiebung):
  werden einfach nebeneinander im selben Zeitfenster dargestellt; keine Fehlermeldung
  oder Validierung nötig — es ist eine Ein-Personen-App, Konflikte erkennt der Nutzer
  selbst am schnellsten.
- **localStorage nicht verfügbar** (z. B. privater Modus): kein Spezialfall gebaut,
  App funktioniert dann nur für die laufende Sitzung ohne Persistenz. Kein Over-Engineering
  für einen unwahrscheinlichen Fall auf einem eigenen, dauerhaft genutzten Handy.

## Testing

Kein automatisierter Test-Unterbau — für eine Offline-Ein-Personen-App unverhältnismäßig.
Manuelles Testen über den bereits etablierten lokalen Server (`node server.js` im
`hello-world-pwa`-Muster, hier direkt im `HNSA`-Ordner) und Live-Test auf dem Handy im
selben WLAN, wie beim Hello-World-Prototyp.
