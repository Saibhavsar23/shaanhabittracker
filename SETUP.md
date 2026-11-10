# Streak Buddy: what to upload and set up

## 1. Upload to your GitHub repo (same folder as before)
`index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
and the folders `scripts/` and `.github/` (for hourly push). `widget/` is only for you to copy into Scriptable.

## 2. Firestore rules (Firebase console -> Firestore -> Rules)
Add a `homework` block next to `workouts` (full rules are in the comment at the top of index.html). Publish.

## 3. Install it on iPhone / iPad
Open the site in **Safari** -> Share -> **Add to Home Screen**. Open it from the Home Screen icon.
Settings (gear) -> Hourly reminders -> Turn on. iOS only allows notifications for Home Screen apps (iOS 16.4+).

## 4. Real hourly notifications (even when the app is closed)
1. Firebase console -> Project settings -> **Cloud Messaging** -> Web Push certificates -> *Generate key pair*. Copy the public key into `VAPID_KEY` near the top of index.html.
2. Firebase console -> Project settings -> **Service accounts** -> *Generate new private key*. In GitHub: repo -> Settings -> Secrets and variables -> Actions -> New secret named `FIREBASE_SERVICE_ACCOUNT`, paste the whole JSON.
3. Actions tab -> "Hourly reminders" -> Run workflow (tick dry run first to test). It then runs every hour at :05.
Notes: GitHub can delay scheduled runs a few minutes, and pauses schedules on repos with no activity for 60 days (just re-enable it). Without steps 1-2, reminders still work while the app is open or recently in the background.

## 5. Home Screen widget (iPhone + iPad)
Web apps can't make native widgets, so this uses the free **Scriptable** app: paste `widget/streak-buddy-widget.js`, set `APP_URL`, run it once to sign in (email + password), then add a Scriptable widget to the Home Screen and pick the script. Small, medium and large sizes work. A parent account shows the person they follow.

## Layout
Four tabs: Today, Calendar (Day, Week, Month), Homework, Fitness. Tap the 🔥 or ⚡ in the header for Rewards.

## Haptics
Android vibrates. iPhone/iPad get a light tap on iOS 17.4+ (Safari/Home Screen apps) via a hidden switch control; older iOS has no web haptics.
