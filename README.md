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

Frontend je čisté HTML/CSS/JavaScript bez buildovacieho procesu. Backend sú Vercel serverless funkcie (Node.js) v `/api`, ktoré čítajú a zapisujú do Postgres databázy (Vercel Storage / Neon). Grafy cez [Chart.js](https://www.chartjs.org/) (načítaný z CDN).

## Ukladanie dát

Faktúry a nastavenia sa ukladajú v **spoločnej Postgres databáze** pripojenej k projektu vo Vercel — appka je teda dostupná a rovnaká z akéhokoľvek zariadenia/prehliadača, nie je viazaná na jeden localStorage.

⚠️ **Appka nemá prihlásenie** — kto pozná adresu appky, má plný prístup (čítanie aj úpravy/mazanie faktúr). V **Nastaveniach → Záloha dát** si aj tak vieš kedykoľvek stiahnuť zálohu (JSON) a neskôr ju obnoviť.

## Spustenie

Appka potrebuje bežiace API funkcie a pripojenie na databázu, takže sa spúšťa cez Vercel (samotné `index.html` lokálne nestačí, keďže appka volá `/api/*`):

```bash
npm i -g vercel
vercel dev
```

Vercel CLI si pri prvom spustení vypýta prepojenie na existujúci projekt `fakturacrm` a stiahne potrebné premenné prostredia (pripojenie na databázu).

## Štruktúra projektu

```
index.html          — kostra appky (sidebar, kontajner pre obrazovky)
css/style.css        — dizajnové tokeny, layout, komponenty, tlačová šablóna
api/                  — Vercel serverless funkcie (Node.js) — /api/invoices, /api/invoices/[id], /api/settings
js/storage.js        — dátová vrstva appky, volá /api/* a drží lokálnu kópiu pre synchrónne čítanie
js/charts.js          — Chart.js grafy (mesačné príjmy, stav faktúr)
js/icons.js            — zdieľané SVG ikony
js/utils.js             — zdieľané UI pomôcky
js/views/               — jednotlivé obrazovky (dashboard, faktúry, formulár, detail, štatistiky, nastavenia)
js/app.js                — routing, motív (svetlý/tmavý), modály, toasty
```
