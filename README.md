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

Replace the sample values with the school's approved public information. Do not put passwords, private keys, student records or other confidential information in this file or in a public repository.

To change colours, edit the CSS variables at the top of `style.css`. To change page content, edit the relevant sections in `index.html`.

## Deploying a separate school website

This repository is the reusable starter template. For an independent school website, create a separate repository for that school, copy the approved public website files into it, customise the school settings and content, and enable GitHub Pages for that repository.

Each school's private portal and records must be implemented separately with a secure backend and strict school-by-school access controls. GitHub Pages is static hosting; it does not provide secure user accounts or a private database.

## Important security boundary

This starter is a public information website only. It does not yet include admissions form processing, administrator login, teacher/parent/student accounts, payments, or a school database. Do not collect or publish confidential learner information through this static site.

## Platform

Built as a reusable website foundation by CRIPRI Technologies.
