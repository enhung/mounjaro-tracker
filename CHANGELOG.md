# Changelog

All notable changes to Mounjaro PK Simulator will be documented here.

---

## [v1.0.1] — 2026-03-31

### Bug Fixes
- Fixed `zh-CN.json` invalid JSON caused by unescaped straight ASCII double-quote pairs used as Chinese quotation marks (`"无酒精"`, `"过滤"`) in `alcoholText` and `nafBeerText` — entire Simplified Chinese UI was silently falling back to zh-TW

---

## [v1.0.0] — 2026-03-31

### Initial Release

#### Core Features
- **Concentration Simulation tab** — one-compartment PK model (half-life ~5 days, Tmax ~2 days) with interactive Chart.js visualization
- **Dose management** — add/remove/edit injection records (day + mg), treatment start date with actual calendar date display
- **Discomfort threshold line** — configurable overlay on the concentration chart
- **Diet Advice tab** — alcohol warning, non-alcoholic beer guidance, meal principles, supplement recommendations, meal timing
- **Exercise Log tab** — CRUD for exercise records (date, type, duration, notes) with summary stats (total sessions, total minutes)
- **Body Weight Trend tab** — weight/BMI/body fat tracking; weight chart with BMI 18.5 & 24.9 reference lines; body fat % chart; BMI zone badge with color coding; height input for BMI calculation; summary stat cards (current weight, BMI, total lost, target range)
- **Data Management tab** — JSON backup export/import (full state), PDF report export (English labels, chart image, all record tables)
- **Internationalization** — 4 languages: 繁體中文 (zh-TW), 简体中文 (zh-CN), English (en), Deutsch (de)
- **No authentication / no server** — all data stored in browser localStorage only

#### Technical
- Pure vanilla HTML/CSS/JS, no build tools
- Dark glassmorphism design system with CSS custom properties
- GitHub Pages deployment via GitHub Actions (`deploy.yml`)
- Modular JS architecture: `i18n.js`, `pk.js`, `exercise.js`, `body.js`, `export.js`, `app.js`
- PDF export always uses English locale to avoid CJK/umlaut rendering issues with jsPDF built-in fonts
- jsPDF v3.0.3 (CDN)

#### Bug Fixes in this version
- Fixed `de.json` invalid JSON caused by German typographic quotes (`„..."`) breaking the JSON parser — entire German UI was silently falling back to zh-TW
- Fixed PDF garbled text (CJK/Chinese characters rendered as boxes) by always using English locale for PDF label strings
- Fixed jsPDF CDN URL (old v2.5.2 returned HTTP 404; updated to v3.0.3)
