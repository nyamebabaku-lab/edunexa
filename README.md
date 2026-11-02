# EduNexa — School Management System + LMS

A complete, installable web app for running a Ghanaian school from Creche to Diploma: admissions, students, parents, staff & payroll, classes, timetable, attendance, gradebook, report cards, LMS, fees, transport, library, store, hostel, health & discipline, communication, calendar, reports and settings.

**Stack:** React + Vite, Tailwind CSS, Zustand (data saved in the browser), Recharts, PWA (installable on iOS/Android).

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (e.g. http://localhost:5173) and pick a portal on the sign-in screen.

## Deploy to a public URL (Netlify)

```bash
npm run build
npx netlify-cli login
npx netlify-cli deploy --prod --dir dist
```

## Install on a phone

- **iPhone:** open the URL in Safari → Share → *Add to Home Screen*.
- **Android:** open the URL in Chrome → ⋮ → *Install app*.

## Project layout

- `src/data/seed.js` – realistic demo data generator
- `src/data/store.js` – the data store (swap point for a cloud backend such as Supabase)
- `src/lib/` – grading (GES/BECE, WASSCE, GPA), payroll (SSNIT/PAYE), formatting, permissions
- `src/components/` – UI kit, layout, print views
- `src/modules/<module>/` – one folder per module

## Prototype notes

- Data lives in each browser's local storage, so each device has its own copy. **Settings → Data** can reset it or download a backup.
- Sign-in is one-click demo sign-in per role. Real accounts, shared data, SMS and Mobile Money integrations come with the backend phase.

## Live deployment

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
