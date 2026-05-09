# SchoolTaskHelper — Fullständig designbrief (write-and-paste)

Vi bygger en touch-first webbapp för barn/ungdomar (10–16 år) som behöver stöd för att planera och slutföra skoluppgifter.

Målet är att skapa en stilren, tydlig och motiverande upplevelse som fungerar extra bra för användare med koncentrationssvårigheter. Designen ska kännas modern och “vinnig”, men inte barnslig.

## Produktmål (v1)
- Hjälpa barnet att se och hantera alla aktuella skoluppgifter.
- Göra planering konkret genom att kombinera svårighetsgrad + tidsram.
- Ge tydlig positiv feedback när uppgifter faktiskt blir klara.
- Behålla samma UI för barn och förälder, men med olika tillåtna handlingar.

## Scope i v1
Ingår:
- En huvudvy som visar alla aktuella uppgifter.
- Top-sektion med hunger/progressbar + avatar (emoji-placeholder).
- Uppgiftskort som kan expandera för detaljer.
- Statusflöde: mottagen → svårighetsgrad satt → planerad → tror klar → förälder bekräftad klar.
- Gamification: leveling + hungerlogik + positiv feedbackanimation.

Ingår inte i v1:
- Filtrering/sortering
- Historikvy
- Flera teman (endast ett visuellt läge)
- Offline-läge (online-only)

## UX-principer
- Touch-first: stora tryckytor, enkel interaktion med tumme.
- Låg kognitiv belastning: få samtidiga val, tydliga nästa steg.
- Kort och peppig mikrocopy: motiverande men kompakt.
- Visuell tydlighet före detaljrikedom.
- Positiv förstärkning ska dominera över negativ feedback.

## Informationsarkitektur
- Huvudvy: lista med alla aktuella uppgifter.
- Ingen historik visas i v1 (bara aktuella).
- Ingen filtrering i v1.
- Arkitektur förbereds för framtida “startvy” (t.ex. Idag), men används inte nu.

## Top-sektion (hungerbar + avatar)
Placering:
- Bar högst upp.
- Avatar i övre högra hörnet.

Beteende:
- Visar hur väl användaren ligger i fas.
- Oplanerade uppgifter och uppgifter utan svårighetsgrad gör avataren “hungrigare”.
- Positiva events ska ge tydlig vinn-känsla.
- Negativa events ska vara milda.

Feedbackbalans:
- Vinstsignal ska väga cirka 10x mer än bakslag i upplevelsen.

## Uppgiftslista (collapsed)
Varje uppgift visar:
- Titel
- Svårighetsgrad: enkel / medel / svår
- Planerad tidsram: idag / imorgon / denna vecka / nästa vecka / vet inte
- Status

Uppgiftskortet ska vara tydligt klickbart/tappbart för expandering.

## Uppgiftsdetalj (expanded)
Expanded-läge kan innehålla:
- Ämne/kurs
- Källa (ex. Skolplattformen/manuell)
- Förfallodatum (om känt)
- Barnets text för:
  - “Det här är svårt för att …”
  - “Jag förstår inte …”
- Förälders kommentar/bekräftelse

## Input per uppgift
Barn ska kunna:
1. Bekräfta mottagen uppgift
2. Sätta svårighetsgrad (ska kunna göras före planering)
3. Sätta planerad tidsram
4. Markera “tror klar”

Förälder ska kunna:
5. Bekräfta slutligt “klar”

## Roller i samma UI
- Samma layout och komponenter för alla.
- Skillnad ligger i vilka actions som är aktiva:
  - Barn: planering + självskattning
  - Förälder: slutbekräftelse

## Statusmodell (v1)
- Mottagen
- Svårighetsgrad satt
- Planerad
- Tror klar (barn)
- Bekräftad klar (förälder)

## Gamification
Mekanik:
1. Leveling över tid
2. Hungerbar kopplad till planeringskvalitet och slutförande

Positiv feedback:
- Belöning när uppgift blir bekräftad klar.
- Extra belöning när “tror klar” var korrekt.
- “Mat”-signal (liten animation) från uppgift upp till hungerbar.

Mild negativ feedback:
- Om “tror klar” är fel: mild signal.
- Exempel: lätt illamående uttryck i avatar + diskret negativ markering i bar.

## Animationer & microinteractions
- Animationer ska vara korta, tydliga och tillfredsställande.
- Positiva animationer ska kännas tydligt vinniga.
- Negativa animationer ska vara milda och icke-straffande.
- Undvik röriga effekter som stör fokus.

## Mikrocopy (ton)
- Peppig men kortfattad.
- Enkel och tydlig svenska.
- Ingen överdriven “barnslig” ton.

## Tekniska ramar för design
- Webbdesign (touch-first)
- Online-only
- Ett visuellt läge i v1
- Avatar som emoji-placeholder i v1
- Uppgifter kan komma från externa källor; ingen direktintegration med Skolplattformen krävs i v1

## Leverabler från designer
1. Low-fi wireframes
2. Hi-fi design (mobil först)
3. Komponentöversikt
4. Interaktionsspec för animationer (inkl. mat-signalen)
5. Statespec för nyckellägen:
   - normal aktiv lista
   - uppgift markerad “tror klar”
   - korrekt bekräftad klar
   - felaktig “tror klar” (mild negativ feedback)
   - tom lista

## Öppna punkter för nästa iteration
- Framtida startvy (Idag-fokus)
- Eventuell historiknivå i expanded-läge
- Finjustering av hunger/poäng-algoritm
- Eventuell framtida tillgänglighetsutbyggnad
