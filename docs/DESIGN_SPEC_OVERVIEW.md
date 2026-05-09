# Designspec — totalbeskrivning och sektionsplan

## Övergripande beskrivning (vad som ska göras)
Vi ska ta fram en komplett UI/UX-designspec för SchoolTaskHelper som kan användas direkt av designer och senare av utveckling/API-arbete.

Målet är att designen ska vara:
- touch-first (mobil prioriterad)
- tydlig för barn 10–16 år
- anpassad för koncentrationssvårigheter
- motiverande via gamification, men fortfarande stilren och inte barnslig

Specifikationen ska beskriva både:
1. Hur appen ser ut (layout, komponenter, states)
2. Hur appen fungerar (flöden, beslut, feedback, rollskillnader)

Resultatet ska bli en "write-and-paste"-vänlig sektionerad spec där varje del kan skickas separat till designer.

---

## Sektioner vi ska lyfta i den fullständiga specifikationen

1. **Produktmål & Scope v1**
   - Syfte, målgrupp, vad som ingår/inte ingår i v1.

2. **UX-principer**
   - Kognitiv tydlighet, kort peppig text, få val, touch-optimering.

3. **Informationsarkitektur**
   - Huvudvy, alla aktuella uppgifter, ingen filter/historik i v1.

4. **Top-sektion: Hungerbar + Avatar**
   - Placering, visuellt beteende, positiv/negativ signalstyrka.

5. **Uppgiftslista (collapsed state)**
   - Vad varje rad visar, statusindikatorer, CTA-knappar.

6. **Uppgiftsdetalj (expanded state)**
   - Fördjupad information, kommentarer, svårighetsförklaring, "förstår inte".

7. **Input per uppgift**
   - Exakta fält, obligatoriskt/frivilligt, valbara nivåer/tidsramar.

8. **Roller & behörigheter i samma UI**
   - Barnets handlingar vs förälderns handlingar.

9. **Statusmodell och tillstånd**
   - Statussteg och tillståndsövergångar.

10. **Gamificationlogik**
   - Leveling + hunger, vinstlogik, milda bakslag, anti-missbruk.

11. **Animationer & microinteractions**
   - “Mat”-signal upp till bar, vinn-känsla, lugna/milda negativa signaler.

12. **Mikrocopy och tonalitet**
   - Peppig men kortfattad textstil per UI-situation.

13. **Tillståndsskärmar**
   - Tom lista, aktiv lista, “tror klar” korrekt/inkorrekt, bekräftad klar.

14. **Designsystem-light (v1)**
   - Färgroller, spacing, typografi, knappstorlekar för touch.

15. **Tekniska designramar**
   - Online-only, ett tema/läge, emoji-avatar i v1.

16. **Leverabler från designer**
   - Wireframes, hi-fi, komponentkatalog, interaktionsspec.

17. **Öppna frågor för nästa iteration**
   - Ex. framtida startvy, ev. historiknivå, finjustering av hungeralgoritm.

---

## Föreslagen arbetsordning
1. Lås sektion 1–4 (riktning och top-level UX)
2. Lås sektion 5–9 (uppgifter, input, status, roller)
3. Lås sektion 10–13 (gamification, animation, copy, states)
4. Avsluta med sektion 14–17 (designramar, leverabler, öppna punkter)

Detta gör att designern kan börja skissa tidigt, samtidigt som vi detaljerar logiken utan att blockera.
