# ADHD Scheduler WebApp

This project is a starting point for the **ADHD Personal Scheduler and Coach** described in the accompanying plan.  It demonstrates how to authenticate users with Google, insert a templated daily schedule into their Google Calendar and send a summary email, all while supporting multiple languages (English, Hebrew and Russian).  The app is built with **Node.js** and **Express** and uses the `googleapis` client library.

## Features

- **Google OAuth 2.0 authentication** to access the user’s Calendar, Gmail and Drive.
- **Full‑day schedule** based on evidence‑based time management strategies for ADHD.  Events include morning routines, work sessions, breaks, mindfulness and more.  Reminders are added 10 and 30 minutes before each task.
- **Email notification**: after scheduling the events, the app sends a short summary to the user via Gmail.
- **Multi‑language UI**: the landing page and buttons are translated into English, Hebrew and Russian.  Use a `?lang=xx` query parameter or browser language to select your preferred language.

## Setup

1. **Install dependencies.**  Navigate into the `adhd_scheduler_webapp` folder and run:

   ```bash
   npm install
   ```

2. **Configure environment variables.**  Copy `.env.example` to `.env` and fill in your Google OAuth credentials.  You can obtain a Client ID and Client Secret by creating an OAuth 2.0 Client ID (Web application) in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).  Make sure to add `http://localhost:3000/auth/callback` as an authorized redirect URI.

3. **Run the application.**  Start the server with:

   ```bash
   npm start
   ```

4. **Use the application.**  Open [http://localhost:3000](http://localhost:3000) in your browser.  Optionally append `?lang=en`, `?lang=he` or `?lang=ru` to the URL to select a language.  Click **“Sign in with Google”** to authorise the app.  Once signed in, click **“Generate Schedule”** to insert the events and send the email.

## Next Steps

This skeleton is intended as a foundation.  To build a full‑featured ADHD personal coach:

- Implement persistent storage (e.g. sessions in Redis, a database for user preferences) and proper error handling.
- Expand the schedule creation logic to consider free/busy information, user preferences, work hours and buffer times.
- Integrate with Google Drive to store journals, therapy worksheets and triggers.  Provide a UI for editing these documents.
- Incorporate an open‑source large language model (LLM) for personalised coaching.  A backend service (Python or Node.js) can host the model and provide an API to the web app.  Use the MIND‑SAFE framework for ethical safeguards and retrieval‑augmented therapy content.
- Build an Android companion app using a cross‑platform framework (e.g. Flutter) that connects to the same backend.

## License

This project is open source under the MIT License.  Feel free to modify and use it as needed.