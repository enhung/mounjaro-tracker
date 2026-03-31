# KNOWLEDGE.md

## Project Identity
- Name: 猛健樂 (Mounjaro) 濃度模擬器 / Mounjaro PK Simulator
- Repository: github.com/enhung/mounjaro-tracker
- Type: Static web application (HTML/CSS/JavaScript)
- Languages: Traditional Chinese (zh-TW), Simplified Chinese (zh-CN), English, Deutsch

## Purpose
This project provides an interactive pharmacokinetic (PK) simulator for Tirzepatide (Mounjaro).
Users can enter dose records and visualize estimated in-body residual drug amount over time.
Additionally it provides diet advice, exercise tracking, and data export/import capabilities.
The tool emphasizes educational reference and does not replace clinical judgment.

## Current Scope
- Single-page frontend application with tab navigation
- Dose timeline input (day + amount) with start date support
- Adjustable simulation duration and discomfort threshold
- Dynamic Chart.js chart rendering
- Diet advice panel (alcohol warnings, meal principles, supplements)
- Exercise tracking with CRUD operations
- Data management: JSON export/import + PDF report generation
- Multi-language support (zh-TW, zh-CN, en, de)
- Local browser persistence (localStorage)
- GitHub Pages deployment

## File Map
```
├── index.html          # Main page structure with tab navigation
├── style.css           # Complete dark-theme visual design
├── app.js              # Main controller: state, tabs, rendering, event handling
├── i18n.js             # Lightweight internationalization module
├── pk.js               # Pharmacokinetic calculation (separated from app.js)
├── exercise.js         # Exercise tracking module (CRUD + localStorage)
├── export.js           # Data export/import (JSON backup + PDF report)
├── locales/
│   ├── zh-TW.json      # Traditional Chinese translations
│   ├── zh-CN.json      # Simplified Chinese translations
│   ├── en.json         # English translations
│   └── de.json         # German translations
├── KNOWLEDGE.md        # This documentation file
├── .gitignore          # Git ignore rules
└── .nojekyll           # Prevents GitHub Pages Jekyll processing
```

## Core Domain Model

### Dose Record
- id: numeric unique identifier
- day: day index from start (integer/number)
- amount: dose in mg (number)

### Exercise Record
- id: numeric unique identifier
- date: ISO date string (YYYY-MM-DD)
- type: cardio | strength | flexibility | walking | other
- duration: minutes (integer)
- note: free text (string)

## Pharmacokinetic Parameters
Defined in `pk.js`:
- halfLifeHours = 120 (5 days)
- bioavailability = 0.8
- tMax = 48 hours
- ke = ln(2) / halfLifeHours
- ka = 0.05 (approximation for ~48h tMax with ke)

Model assumptions:
- One-compartment model
- First-order absorption + elimination
- Linear superposition across doses
- Population-average parameters (not individualized)

## Core Formula
Amount(t) = Dose * F * (ka / (ka - ke)) * (exp(-ke * t) - exp(-ka * t))

## Persistence Keys (localStorage)
- mounjaro_doses — JSON array of dose records
- mounjaro_simDays — simulation days (string)
- mounjaro_threshold — risk threshold in mg (string)
- mounjaro_startDate — treatment start date (ISO string)
- mounjaro_exercises — JSON array of exercise records
- mounjaro_lang — selected language code

## i18n System
- Module: `i18n.js` (IIFE pattern, exposed as `I18n` global)
- Translation files: `locales/{lang}.json`
- HTML elements use `data-i18n` attributes for auto-translation
- Supports dot-notation keys and `{placeholder}` substitution
- Language auto-detected from browser, user selection persisted in localStorage

## External Dependencies (CDN)
- Google Fonts (Inter)
- Chart.js
- jsPDF 2.5.2
- Font Awesome 6.4.0

## Diet Advice Content
- Alcohol avoidance warning (critical)
- Non-alcoholic beer: must choose filtered varieties
- Meal principles: small frequent meals, slow chewing, low-fat, hydration, protein, fiber
- Supplement recommendations: multivitamin, B12, calcium/vitamin D, electrolytes
- Meal timing relative to injection schedule

## Exercise Tracking
- CRUD operations for exercise records
- Types: cardio, strength, flexibility, walking, other
- Summary statistics: total sessions and total minutes
- Exercise advice specific to GLP-1 agonist treatment

## Data Management
- JSON export: complete backup of all localStorage data
- JSON import: restore from backup file with validation
- PDF report: includes treatment summary, dose table, concentration chart, exercise records, diet reminders

## Deployment
- Platform: GitHub Pages
- Repository: Public
- No build step required — pure static files
- `.nojekyll` file prevents Jekyll processing

## Privacy and Compliance Notes
- No backend transmission implemented.
- All data retained in browser localStorage only.
- Explicit medical disclaimer in footer.
- No authentication required (local-only data).
- Data export enables users to backup before sharing public repo.

## Important Warning
All outputs are model-based approximations and must not be used
as a sole basis for medication changes.
Clinical decisions require qualified medical professionals.
