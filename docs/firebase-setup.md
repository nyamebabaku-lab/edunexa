# Turning on phone notifications (Firebase) — 10 minutes

Push notifications on Android go through Google Firebase (free). EduNexa needs **two files** from you.

## 1. Create the Firebase project
1. Open https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project**, name it `EduNexa`, then **Continue**. Google Analytics is optional; you can turn it off. Click **Create project**.

## 2. Add both Android apps
1. On the project page, click the **Android** icon ("Add app").
2. **Android package name:** `com.edunexa.app`. **App nickname:** `EduNexa`. Click **Register app**.
3. Click **Next**, **Next**, then **Continue to console**. You can skip the download for now.
4. Click **Add app**, choose **Android** again, and register the second app:
   - **Android package name:** `com.edunexa.admin`
   - **App nickname:** `EduNexa Admin`

## 3. File 1: `google-services.json`
1. Click the ⚙️ gear (top left), then **Project settings**.
2. In **Your apps**, select either Android app and click **google-services.json** to download it.
   - Download it *after* both apps are added, so the one file covers both apps.

## 4. File 2: the service-account key
1. Still in **Project settings**, open the **Service accounts** tab.
2. Click **Generate new private key**, then **Generate key**. A `.json` file downloads, e.g. `edunexa-firebase-adminsdk-xxxx.json`.
3. Keep this file private. It lets a server send notifications as your app.

## 5. Give them to Claude
Put both files in `/home/BrandsME/projects/edunexa-signing/` (the private folder that is never published) and say **"Firebase files ready"**.

Claude then:
- stores them as private secrets on GitHub and Supabase;
- deploys the `edunexa-push` server function;
- rebuilds both APKs with notifications switched on.

After installing the new APKs, each phone asks **"Allow EduNexa to send you notifications?"**. Tap **Allow**.

## What sends a notification

| Who | When |
|---|---|
| Owner/Admin | someone signs up and is waiting for approval |
| Super Admin | a new school registers |
| Anyone | your account is approved, suspended or deactivated; a new private message; a school notice for your group |
| Parent | your child arrived at or left school (gate); your child was marked absent; a new bill; a payment received |
| Parent & student | new results entered; a new assignment; a live class scheduled or starting now |

The same notifications appear in the app under the 🔔 bell, including on the web.
