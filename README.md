# Ancestrio Family Tree App

This repository is a static frontend app for building and viewing family trees, with Firebase for auth and data.

## Cost policy

Do not use Firebase Storage or any service that costs money in this project.

## Project layout

```
.
|- index.html                 # landing/home page
|- pages/                     # app pages (auth, dashboard, editor, tree, contact, demo, store)
|- scripts/                   # JavaScript modules
|- styles/                    # shared and page-specific CSS
|- images/                    # person photos and static assets
|- data/                      # local demo data
|- firebase.json              # Firebase hosting + Firestore config
|- firestore.rules            # Firestore security rules
|- firestore.indexes.json     # Firestore indexes
```

## Single source of truth for Firebase config

Use only the root files:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

## Entry points

- Public home: `index.html`
- App auth: `pages/auth.html`
- Dashboard: `pages/dashboard.html`
- Editor: `pages/editor.html`
- Viewer: `pages/tree.html`
- Demo viewer: `pages/demo-tree.html`
- Store: `pages/store.html`

## Store order capture

- Store ordering is lead capture only in v1 (no payment checkout flow yet).
- Email notifications are sent through Formspree or FormSubmit from the store order form.
- Configure the endpoint in `pages/store.html` on `#orderForm[data-formspree-endpoint]`.
- Valid endpoint formats:
  - Formspree: `https://formspree.io/f/<FORM_ID>`
  - FormSubmit AJAX: `https://formsubmit.co/ajax/<YOUR_EMAIL>`
- Notes for FormSubmit:
  - `/ajax/...` is recommended because it returns verifiable API success/error responses.
  - `/el/...` is an Email Link page flow and should be used as a link destination, not as the store order endpoint.
  - For classic form POST endpoints, use `https://formsubmit.co/<YOUR_EMAIL_OR_RANDOM_STRING>`.
  - First submissions may require FormSubmit activation via email before delivery begins.
- If a user is signed in, the order is also written to Firestore collection: `storeOrders`.

## UI style ownership

- `styles/shell.css` is the canonical source for shared shell primitives:
  - global spacing/control tokens
  - shared button geometry
  - shared surface/card tokens
  - site/app container and header shells
- `styles/pages/*.css` owns page composition and intentional page variants only.
- `styles/base.css` and `styles/components.css` contain legacy/feature styles and should not redefine shell primitives for `body.site-shell`.
- Keep these class/selector contracts stable because they are used by scripts:
  - IDs and classes in `pages/*.html` for controls, modals, and forms
  - button classes such as `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.tool-btn`, `.dashboard-fab`, `.product-cta`
