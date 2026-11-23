# BrickStack: open play queue for The Brick Club

Players join the queue from their phones, the organizer runs courts from the live board,
and a TV at the venue shows who's playing and who's next. Data lives in Firebase
(project `brickstack-queue`).

## Folder layout

```
Brick club queue/
├── public/                  ← everything here is the live website (deployed to Firebase Hosting)
│   ├── index.html           Player app: join the queue          →  /
│   ├── run/index.html       Organizer live board                →  /run
│   ├── tv/index.html        Venue TV board                      →  /tv
│   ├── css/
│   │   ├── player.css       styles for the player app
│   │   ├── organizer.css    styles for the organizer board
│   │   └── tv.css           styles for the TV board
│   ├── js/
│   │   ├── player.js        player app logic
│   │   ├── organizer.js     organizer board logic
│   │   ├── tv.js            TV board logic
│   │   ├── store.js         shared data layer (Firestore, or browser-only demo mode)
│   │   ├── firebase-config.js  Firebase web config (+ App Check key)
│   │   └── vendor/          Firebase SDK + QR library, hosted here on purpose
│   └── assets/brand/        logo mark, favicon, home-screen icon
├── design/                  design references (not deployed)
├── tests/                   attack tests for the database rules (npm test)
├── firestore.rules          who can read/write what in the database
├── SECURITY.md              what's protected + console security checklist
├── firebase.json            hosting + rules config
└── package.json             shortcut commands (below)
```

## Where to edit

| I want to change…                     | Edit                                   |
|---------------------------------------|----------------------------------------|
| Text or layout of a page              | the page's `index.html` (markup), or its `js/*.js` file if the text is built in code |
| Colors, spacing, fonts                | `css/player.css`, `css/organizer.css`, `css/tv.css` (colors are the `--` variables at the top) |
| How the queue / courts work           | `js/organizer.js` (and `js/player.js` for the phone side) |
| How data is saved or loaded           | `js/store.js`                          |
| Security (who can change data)        | `firestore.rules`                      |
| Logo / icons                          | `public/assets/brand/`                 |

## Brand

| Name  | Hex       | Use                     |
|-------|-----------|-------------------------|
| Cream | `#F3EADB` | page background         |
| Ink   | `#25201D` | text, dark panels       |
| Brick | `#A93F27` | primary buttons, accent |
| Lime  | `#D4E64A` | the ball, live/next tags |

Font: [Outfit](https://fonts.google.com/specimen/Outfit) (loaded from Google Fonts).

## Preview and deploy

Run these from this folder (needs the Firebase CLI: `npm install -g firebase-tools`, then `firebase login`).

```
npm run dev            # preview the site at http://localhost:5000
npm run deploy         # publish the website
npm test               # run the database attack tests (needs Java: brew install openjdk)
npm run deploy:rules   # test, then publish firestore.rules changes
npm run deploy:all     # test, then publish rules + website together
```

Demo mode: blank out `apiKey` in `public/js/firebase-config.js` and every page runs
on your own browser only (no Firebase), handy for trying changes without touching live data.
