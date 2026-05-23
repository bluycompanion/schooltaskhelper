# UI/UX Brief v1 — SchoolTaskHelper

## 1) Syfte
Designa en touch-first webbapp som hjälper barn att planera och slutföra skoluppgifter med tydlig, motiverande feedback.

## 2) Målgrupp
- Primär målgrupp: 10–16 år
- Extra fokus: användare med koncentrationssvårigheter

## 3) Designprinciper
- Tydlig men inte barnslig
- Stilren och lugn
- Kort, peppig mikrocopy
- Låg kognitiv belastning (få val, tydliga steg)
- Touch-optimerade klickytor

## 4) Informationsarkitektur (v1)
- En huvudvy som visar **alla aktuella uppgifter**
- Ingen filterfunktion i v1
- Ingen historikvy i v1
- Förberedd struktur för framtida startvy (t.ex. “Idag”)

## 5) Top-sektion (måste designas)
Innehåll:
- Progress-/hungerbar högst upp
- Avatar i övre högra hörnet (emoji-placeholder i v1)

Beteende:
- Bar/avataren visar hur väl användaren ligger i fas
- Positiv feedback ska kännas tydligt “vinnig”
- Negativ feedback ska vara mild
- Vinst ska upplevas väga cirka 10x mer än bakslag

## 6) Uppgiftslista (måste designas)
Varje uppgift i collapsed-läge bör visa:
- Titel
- Svårighetsgrad (enkel/medel/svår)
- Planerad tidsram (idag/imorgon/denna vecka/nästa vecka/vet inte)
- Status

Uppgift ska vara expanderbar för mer info.

## 7) Uppgiftsdetalj (expanded)
Ska kunna innehålla:
- Ämne/kurs
- Källa (ex. Skolplattformen/manuell)
- Förfallodatum (om känt)
- Barnets notering:
  - “Det här känns svårt för att …”
  - “Jag förstår inte …”
- Förälders notering/bekräftelse
- Eventuell kort historik kring svårighetsgrad/planering (utforskas vidare)

## 8) Flöden och roller
Samma UI för barn och förälder, men olika tillåtna handlingar.

Barn:
- Bekräfta att uppgift är mottagen
- Sätta svårighetsgrad (ska kunna göras före planering)
- Sätta planerad tidsram
- Markera “tror klar”

Förälder:
- Bekräfta slutligt “klar”

## 9) Statusmodell (v1-förslag)
- Mottagen
- Svårighetsgrad satt
- Planerad
- Tror klar (barn)
- Bekräftad klar (förälder)

## 10) Gamification-krav
Positivt:
- Belöning när uppgift blir bekräftad klar (stjärnor efter svårighetsgrad: enkel=3, medel=6, svår=10)
- Extra positivt när “tror klar” var korrekt
- Liten “mat”-signal/animation från uppgift till hungerbar vid positiva steg

Mild negativ feedback:
- Om “tror klar” inte stämmer: mild signal
- Exempel: avatar mår lite illa + diskret negativ visuell indikator
- Negativ animation (emoji från felaktig uppgift till hungerbar + färgskifte i bar) ska spelas exakt en gång per reject-händelse
- UI måste läsa/kvittera opelade animationsevents från API så replay inte sker vid reload
- Illamående ska kunna klinga av efter 24h eller nollställas vid level-up

## 11) Animation & känsla
- Animationer ska öka tydlighet och motivation
- Kort duration, tydlig riktning, inga röriga effekter
- Fokus: tillfredsställande framstegskänsla

## 12) Tekniska ramar för design
- Webbapp, touch-first
- Online-only i v1
- Ett visuellt läge i v1 (ingen dark/light-switch)

## 13) Leverabler från designer
1. Low-fi wireframes
2. Hi-fi UI-förslag (mobil först, ev. desktop-adaptering)
3. Komponentlista (topbar, avatar, task card, expanded panel, statuschips, CTA)
4. Interaktionsspec för animationer (inkl. “mat”-signal)
5. Kort statespec: normal / klar / felaktig “tror klar” / tom lista

## 14) Öppna punkter för iteration (ej blockerande för v1-design)
- Hur mycket detalj av “historik” som ska visas i expanded-läge
- Exakt visualisering av hungerbarens nivåer/steg
- Exakt ordval för mikrocopy per ålderssegment


## 15) Gameplay-parametrar att playtesta (låsta för första implementation)
- Hunger +3 vid ny uppgift
- Hunger -1 per meningsfull progression, max 3 sänkningar per uppgift/cykel
- Nausea +1 vid reject
- Nausea decay efter 24h eller vid level-up
