# CRIPRI Universal School Website

A lightweight, reusable public website starter for schools, maintained by CRIPRI Technologies.

This starter uses plain HTML, CSS and JavaScript. It has no build step, framework, paid hosting dependency or external JavaScript package.

## Included

- Responsive school homepage
- About, learning, admissions, community updates and contact sections
- Mobile navigation
- School-specific settings in one place
- GitHub Pages-compatible static hosting

## Preview

https://cripri-solutions.github.io/cripri-universal-school-website/

GitHub may take a few minutes to publish a new commit.

## Customising a school website

Open `script.js` and edit the `SCHOOL_SETTINGS` object:

```js
const SCHOOL_SETTINGS = {
  name: "Your School",
  tagline: "Welcome to a school community where every learner matters.",
  email: "info@example.com",
  phone: "+000 000 000 000",
  location: "School location"
};
```

Replace the sample values with the school's approved public information. You can also set `initial`, `primaryColor`, and `accentColor`. Add a public `logoUrl` to display the school logo and an optional `heroImageUrl` for a banner photograph. Use images that the school owns or has permission to publish. Do not put passwords, private keys, student records or other confidential information in this file or in a public repository.

To change page content, edit the relevant sections in `index.html`. The school colours can be set in `SCHOOL_SETTINGS`; the CSS variables in `style.css` provide the default theme.

## Deploying a separate school website

This repository is the reusable starter template. For an independent school website, create a separate repository for that school, copy the approved public website files into it, customise the school settings and content, and enable GitHub Pages for that repository.

Each school's private portal and records must be implemented separately with a secure backend and strict school-by-school access controls. GitHub Pages is static hosting; it does not provide secure user accounts or a private database.

## Important security boundary

This starter is a public information website only. It does not yet include admissions form processing, administrator login, teacher/parent/student accounts, payments, or a school database. Do not collect or publish confidential learner information through this static site.

## Platform

Built as a reusable website foundation by CRIPRI Technologies.

## Illustrative photography

The starter currently uses illustrative photographs hosted by Unsplash for the school-life gallery and a classroom image for the hero banner. They are examples only, not photographs of a real CRIPRI client school. Before launching a school's site, replace them with photographs supplied by that school with appropriate permission and consent, especially where learners are identifiable. The gallery photo source pages are:

- Quilia: https://unsplash.com/photos/students-in-classroom-with-teacher-presenting-zFSo6bnZJTw
- Yogendra Singh: https://unsplash.com/photos/girls-in-classroom-M92wusZZ_qg
- jason hu: https://unsplash.com/photos/students-studying-at-tables-in-a-library-EP8lBWLFLkg

Images are loaded from Unsplash's image CDN, so an internet connection is required to display them. For a production deployment, prefer school-approved images stored in a school-controlled location.
