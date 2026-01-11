/*
 * ADHD Scheduler WebApp
 *
 * This Express application provides a minimal example of how to integrate with
 * Google Calendar, Gmail and Drive to create a personalised daily schedule
 * for users with ADHD and addictions. It demonstrates multi‑language support
 * (English, Hebrew and Russian) via i18next and sets up Google OAuth2
 * authentication. The schedule itself is based on evidence‑based time
 * management strategies referenced in the accompanying plan document.
 *
 * Note: This is a skeleton implementation. You must install dependencies
 * (npm install) and configure your .env file with valid Google OAuth
 * credentials before running the application. Additional error handling,
 * persistent storage and production hardening are required for a real system.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const fs = require('fs');
const path = require('path');

// Load translation resources from the locales folder.  The keys
// correspond to supported languages.  Adding a new language simply
// requires providing a new JSON file in the locales directory and
// adding it to this object.
const resources = {
  en: { translation: require('./locales/en.json') },
  he: { translation: require('./locales/he.json') },
  ru: { translation: require('./locales/ru.json') }
};

// Initialise i18next with basic options.  The language detector
// middleware will examine the Accept‑Language header or a lang query
// parameter and set req.language accordingly.  Fallback to English.
i18next
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    resources,
    fallbackLng: 'en',
    preload: Object.keys(resources),
    detection: {
      // allow users to specify ?lang=en or header Accept-Language
      order: ['querystring', 'header'],
      lookupQuerystring: 'lang'
    }
  });

const app = express();

// Attach i18next middleware to Express
app.use(i18nextMiddleware.handle(i18next));

// Parse URL‑encoded bodies (e.g. from forms)
app.use(bodyParser.urlencoded({ extended: false }));

// Set up session management.  In production you should store sessions in
// a persistent store such as Redis and set a secure cookie.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: true
  })
);

// Configure Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes define the permissions we request from the user.  We require
// access to the Calendar for scheduling events, Gmail for sending
// emails and Drive to read/write files in the user’s Drive (e.g. for
// journals).  userinfo.email scope is added to verify the user’s
// identity.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Build the HTML for the landing page.  We use the translation
 * function req.t provided by i18next to insert localised strings.
 *
 * If the user is authenticated (tokens stored in the session), show
 * buttons to generate a schedule and log out.  Otherwise, present a
 * link to initiate Google sign‑in.
 *
 * @param {Request} req Express request
 * @returns {string} HTML markup
 */
function buildIndexHtml(req) {
  const t = req.t;
  let actions;
  if (req.session.tokens) {
    actions = `
      <form action="/schedule" method="post">
        <button type="submit">${t('generateSchedule')}</button>
      </form>
      <form action="/logout" method="post">
        <button type="submit">${t('logout')}</button>
      </form>
    `;
  } else {
    actions = `<a href="/auth/google">${t('login')}</a>`;
  }
  return `
    <!DOCTYPE html>
    <html lang="${req.language}">
      <head>
        <meta charset="utf-8">
        <title>${t('title')}</title>
        <style>
          body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
          h1 { color: #333; }
          button, a { padding: 0.6rem 1rem; margin-top: 1rem; font-size: 1rem; text-decoration: none; }
          form { margin-bottom: 0.5rem; }
        </style>
      </head>
      <body>
        <h1>${t('title')}</h1>
        ${actions}
      </body>
    </html>
  `;
}

// Landing page
app.get('/', (req, res) => {
  const html = buildIndexHtml(req);
  res.send(html);
});

// Initiate OAuth flow by redirecting the user to Google’s consent screen
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

// OAuth2 callback endpoint.  Google will redirect back here with a code
// parameter if the user consents.  Exchange the code for tokens and
// store them in the session.  Afterwards redirect to the homepage.
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing code parameter');
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/');
  } catch (err) {
    console.error('Error exchanging code for token', err);
    res.status(500).send('Authentication failed');
  }
});

// Generate a daily schedule and insert events into Google Calendar.  This
// endpoint uses a POST request to avoid accidentally scheduling tasks via
// browser prefetch.  A real application would allow the user to
// customise the schedule rather than using a fixed template.
app.post('/schedule', async (req, res) => {
  if (!req.session.tokens) {
    return res.redirect('/');
  }
  // Authorise API clients with stored tokens
  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Determine the date we’re scheduling for (today in the Asia/Jerusalem
  // timezone).  If desired, you could accept a query parameter for the
  // date.
  const timezone = 'Asia/Jerusalem';
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Template tasks based on the plan document.  Adjust times as needed.
  const tasks = [
    { start: '07:00', end: '07:30', summary: 'Morning routine & hygiene' },
    { start: '07:30', end: '08:00', summary: 'Breakfast & medication check' },
    { start: '08:00', end: '09:30', summary: 'Focused work session 1' },
    { start: '09:30', end: '09:45', summary: 'Short break' },
    { start: '09:45', end: '11:15', summary: 'Focused work session 2' },
    { start: '11:15', end: '11:30', summary: 'Outdoor movement / stretching' },
    { start: '11:30', end: '12:00', summary: 'Email & admin check' },
    { start: '12:00', end: '12:30', summary: 'Lunch' },
    { start: '12:30', end: '13:00', summary: 'Mindfulness / therapy exercise' },
    { start: '13:00', end: '14:30', summary: 'Creative project or hobby' },
    { start: '14:30', end: '15:00', summary: 'Break / snack' },
    { start: '15:00', end: '16:30', summary: 'Work session 3' },
    { start: '16:30', end: '17:00', summary: 'Exercise / physical activity' },
    { start: '17:00', end: '18:00', summary: 'Personal errands & household chores' },
    { start: '18:00', end: '19:00', summary: 'Dinner and downtime' },
    { start: '19:00', end: '19:30', summary: 'Reflection & journal entry' },
    { start: '19:30', end: '20:30', summary: 'Leisure time (hobby, social)' },
    { start: '20:30', end: '21:00', summary: 'Prepare for next day' },
    { start: '21:00', end: '21:30', summary: 'Evening routine & hygiene' }
  ];

  // Prepare event objects for insertion into Calendar
  const events = tasks.map(task => {
    const startDateTime = new Date(`${dateStr}T${task.start}:00`);
    const endDateTime = new Date(`${dateStr}T${task.end}:00`);
    return {
      summary: task.summary,
      start: { dateTime: startDateTime.toISOString(), timeZone: timezone },
      end: { dateTime: endDateTime.toISOString(), timeZone: timezone },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };
  });

  // Insert each event.  We collect the promises to wait for all
  // insertions before sending the response.
  try {
    const insertions = events.map(event =>
      calendar.events.insert({ calendarId: 'primary', requestBody: event })
    );
    await Promise.all(insertions);
  } catch (err) {
    console.error('Error inserting events', err);
    return res.status(500).send('Failed to create calendar events');
  }

  // Compose and send a summary email via Gmail
  try {
    const emailLines = [
      'Subject: Your ADHD schedule has been created',
      '',
      'Hello,',
      '',
      'Your daily schedule has been added to your Google Calendar. Stay focused and be kind to yourself!',
      '',
      '— Your ADHD Personal Coach'
    ];
    const message = emailLines.join('\r\n');
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
  } catch (err) {
    console.error('Error sending summary email', err);
    // Do not fail the entire request if email sending fails
  }

  res.send('Schedule created and summary email sent. You may close this page.');
});

// Log out by destroying the session
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ADHD Scheduler app listening at http://localhost:${PORT}`);
});