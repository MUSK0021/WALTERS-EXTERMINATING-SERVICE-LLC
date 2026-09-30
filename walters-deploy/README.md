# Walters Exterminating Service

The website for Walters Exterminating Service, Northeast Philadelphia.
Family owned since April 1963. Live at **bugwalters.com**.

This is the **built site**, ready to deploy. There is nothing to install, nothing
to compile and no build step.

```
public/        the site: 14 pages, images, fonts, sitemap, robots
api/           the contact form handler (one file, no dependencies)
vercel.json    routes, redirects from the old URLs, security headers, caching
```

## Deploying on Vercel

1. Put these files in a GitHub repo (drag the three items above into the
   browser uploader, or push with git).
2. In Vercel: **Add New → Project → Import** that repo.
3. **Change nothing.** Framework preset *Other*, build command empty, install
   command empty, root directory `./`. `vercel.json` already declares
   `outputDirectory: public`, which is all Vercel needs.
4. **Deploy.**

If Vercel guesses a framework and fills in a build command, clear it. There is
nothing to build.

## Turning the contact form on

Until you do this the form lands on its "that did not send" page.

In **Vercel → Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `SMTP_HOST` | your mail host, e.g. `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the full mailbox address |
| `SMTP_PASS` | an **app password** for that mailbox, not the normal password |
| `MAIL_TO` | `info@bugwalters.com` |

Then **redeploy** (Deployments → the newest one → Redeploy). Environment
variables are only read at deploy time, so setting them without redeploying
changes nothing. Send yourself a test through `/contact/` afterwards.

## The domain

Vercel → **Settings → Domains** → add `bugwalters.com` and `www.bugwalters.com`,
then set the DNS records it shows you. HTTPS is automatic.

Do this last, after the test email works: the cutover is immediate and the old
site is live right now. Worth knowing: the old site posts its contact and
referral forms over plain **HTTP**, so names, emails and phone numbers travel in
clear text. That is the strongest reason to move.

Every old URL 301s to the right new page, so existing links and search rankings
survive:

| Old | New |
|---|---|
| `/id1.html` | `/about/` |
| `/id2.html` | `/services/` |
| `/id72.html` | `/bed-bugs/` |
| `/id21.html` | `/what-it-costs/` |
| `/id17.html`, `/id4.html` | `/contact/` |
| `/id70.html` | `/pictures/` |

## Changing the site later

These files are **generated**. Editing the HTML by hand works once and is then
overwritten the next time the site is built, and `vercel.json` carries a hash of
the one inline script, so hand-editing that will make browsers block it.

The generator lives in the full repository, where every word on the site is in a
single file (`src/content.py`) with the house rules written above it. Use that
to make changes, then copy the rebuilt `public/`, `api/` and `vercel.json` here.
