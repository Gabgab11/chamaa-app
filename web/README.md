# My Chaama web app

React + TypeScript + Vite, built as an installable PWA.

```
npm install
npm run dev        # local
npm run build      # production build in dist/
npm run typecheck
```

Layout:
- `src/app`: app state, navigation (in-app back history and phone back button)
- `src/components`: shared UI (sheets, fields, top bar, icons)
- `src/features`: screens grouped by area (auth, dashboard, shell)
- `src/data`: the backend contract (`backend.ts`) and the device-only backend used until Supabase is connected
- `src/lib`: money (integer minor units), countries, validation, translations, storage
- `functions/api/geo.ts`: Cloudflare Pages Function that returns the visitor's country (for the display currency)
- `public/`: manifest, icons, service worker, security headers

Cloudflare Pages settings: root directory `web`, build command `npm run build`, output `dist`.
