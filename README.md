# FakturaCRM

Jednoduchá appka na vystavovanie faktúr a sledovanie príjmov — pre freelancerov a malé firmy na Slovensku.

## Funkcie

- **Prehľad (dashboard)** — celkové príjmy, príjmy za tento mesiac, neuhradené a po splatnosti faktúry, graf mesačných príjmov, posledné faktúry
- **Faktúry** — zoznam všetkých faktúr s hľadaním a filtrom podľa stavu (zaplatená / nezaplatená / po splatnosti)
- **Nová faktúra / úprava** — formulár s údajmi odberateľa (s automatickým dopĺňaním podľa predchádzajúcich klientov), položkami, DPH a automatickým výpočtom sumy
- **Detail faktúry** — prehľadný náhľad faktúry s tlačou / uložením do PDF cez tlačový dialóg prehliadača
- **Štatistiky** — priemerná hodnota faktúry, priemerná doba úhrady, rebríček klientov podľa príjmov
- **Nastavenia** — fakturačné a bankové údaje firmy, záloha a obnova dát (JSON export/import)

Appka **nezapočítava výdavky** — sleduje výhradne príjmy z vystavených faktúr.

## Technológie

Čisté HTML/CSS/JavaScript bez buildovacieho procesu — žiadny Node.js, žiadna inštalácia závislostí. Grafy cez [Chart.js](https://www.chartjs.org/) (načítaný z CDN).

## Ukladanie dát

Všetky dáta (faktúry, nastavenia) sa ukladajú **lokálne v prehliadači** (`localStorage`) — appka nemá backend ani databázu. To znamená:

- Dáta ostávajú len v prehliadači a zariadení, na ktorom ich appku používaš.
- Vyčistenie histórie/dát prehliadača dáta zmaže.
- V **Nastaveniach → Záloha dát** si vieš kedykoľvek stiahnuť zálohu (JSON) a neskôr ju obnoviť — odporúča sa robiť pravidelne.

## Spustenie

Appka je statická — stačí otvoriť `index.html` v prehliadači, alebo spustiť jednoduchý lokálny server:

```bash
python3 -m http.server 8000
```

a otvoriť `http://localhost:8000`.

## Štruktúra projektu

```
index.html          — kostra appky (sidebar, kontajner pre obrazovky)
css/style.css        — dizajnové tokeny, layout, komponenty, tlačová šablóna
js/storage.js        — dátová vrstva (localStorage), výpočty nad faktúrami
js/charts.js          — Chart.js grafy (mesačné príjmy, stav faktúr)
js/icons.js            — zdieľané SVG ikony
js/utils.js             — zdieľané UI pomôcky
js/views/               — jednotlivé obrazovky (dashboard, faktúry, formulár, detail, štatistiky, nastavenia)
js/app.js                — routing, motív (svetlý/tmavý), modály, toasty
```
