# eCard — Final Use Case & Workflow

**Project name:** eCard  
**Frontend:** Angular  
**Backend + database:** required (API + persistent storage)  
**This document is the source of truth for implementation.**

---

## 1. Product summary

eCard is a public website where visitors choose a festival or occasion category, pick a free-to-use card template, add a custom message on the image, preview the result, then download it or share it (WhatsApp or email).

Admins sign in separately to manage categories, templates, licenses, and generated files. Visitors do **not** need an account.

---

## 2. Users and access

| Role | Who | Authentication | What they can do |
|------|-----|----------------|------------------|
| **Guest (visitor)** | Anyone who opens the site | None | Browse categories, view templates, customize, preview, download, share |
| **Admin** | Site operator | Secure login (session or JWT) | Full CRUD on categories and templates; publish/unpublish; cleanup generated files |

**Guest login is removed.** “Guest” means an unauthenticated public visitor.

**Admin credentials (development only):**
- Seed account: username `admin`, password `admin123`
- Password is **hashed** in the database (never stored in Angular source)
- Production: change the seed password immediately; do not hardcode credentials in the client

---

## 3. High-level screens

### Public (Guest)
1. Home — category list with search/filter  
2. Category gallery — 3 templates per page, pagination / load more  
3. Customize card — message + text options  
4. Preview card  
5. Download / Share  
6. Legal pages — Privacy, Terms, Image licenses / attribution  
7. Report content (simple form)

### Admin
1. Login  
2. Dashboard (counts: categories, templates, generated cards)  
3. Categories — create / edit / delete / publish  
4. Templates — upload / edit / delete / order / publish  
5. Generated files — list and cleanup  
6. Logout

---

## 4. Guest workflow (end-to-end)

```
Visit site
  → See published categories (Ganesh Festival Card, Diwali Card, Birthday Card, …)
  → Optional: search / filter categories
  → Select a category
  → See 3 published templates at a time (grid, mobile-friendly)
  → Pagination or Load more for the rest
  → Select one template
  → Enter custom message (multiline, local languages)
  → Adjust text: font, color, size, alignment, position (within safe area)
  → Click “Preview Card”
  → Review composed image (no watermark)
  → Choose:
        a) Download PNG or JPG (high resolution, auto dimensions)
        b) Share to WhatsApp (generated image)
        c) Email: enter recipient email → send that image to that address only
```

### Guest rules
- No login, no saved history in v1 (optional `GeneratedCard` exists for share/email/download, not for a guest account).
- Only **published** categories and **published** templates are visible.
- Empty state if a category has no published templates.
- Loading and error states on every network step.
- Accessibility: alt text on images, keyboard navigation, readable contrast.
- Character limit on the message (e.g. 200–300 characters) with a counter.

---

## 5. Admin workflow (end-to-end)

```
Open /admin/login
  → Sign in with seeded admin (hashed password)
  → Manage categories:
        create, edit, delete, publish/unpublish, display order
  → Manage templates in a category:
        upload image (type/size validation)
        set title, alt text, display order
        attach licensing metadata (source, license name, attribution, reuse confirmation)
        publish/unpublish
        delete
  → Cleanup generated card files (expired or unused)
  → Logout
```

### Admin rules
- All admin APIs require authorization.
- Upload validation: allowed types (JPEG, PNG, WebP), max file size, reject non-images.
- Only images the admin confirms as **free to use on this site** (no paid/copyrighted stock) may be published.
- Licensing metadata is mandatory before publish.
- Soft-delete or hard-delete: templates can be unpublished first; delete removes file from storage.

---

## 6. Categories (initial set)

Seed / example published categories:
- Ganesh Festival Card
- Diwali Card
- Birthday Card

Admin can add more (e.g. Wedding, New Year, Holi).

Each category: name, slug, description, cover image (optional), sort order, published flag.

---

## 7. Templates and licensing

Every template (`CardImage`) must store:
- Image file in **managed storage** (local folder in development; cloud-ready path for later)
- Category reference
- Title, alt text
- Sort order
- Published flag
- **License metadata (required to publish):**
  - Source URL or “original upload”
  - License type (e.g. CC0, CC BY, original)
  - Attribution text (if required)
  - Admin confirmation: “free to use on this website, not paid/copyright-restricted”

Public pages show attribution when the license requires it.

---

## 8. Custom message on the image

Visitor controls:
- Message text (multiline; Unicode / local languages)
- Font family (small preset list)
- Color
- Size
- Alignment (left / center / right)
- Position (drag or presets: top / center / bottom, within a safe area)

**Preview Card** renders the composed image before download/share.

Output:
- PNG or JPG
- No watermark
- High resolution
- Dimensions follow the source template (auto width/height)

---

## 9. Download and share

| Action | Behavior |
|--------|----------|
| **Download** | Browser download of generated PNG or JPG |
| **WhatsApp** | Share the **generated image** (Web Share API / download-then-share; fallback: download + instructions if the browser cannot attach a file) |
| **Email** | Form: recipient email only → backend sends **that image** to that address only (no CC/BCC list in v1) |

Rate-limit download, WhatsApp-trigger, and email-send per IP to reduce abuse.

---

## 10. Data model

### User
- id, username, passwordHash, role (`admin`), createdAt, updatedAt  
- Seed one admin user

### Category
- id, name, slug, description, coverImageUrl (optional), sortOrder, isPublished  
- createdAt, updatedAt, owner (admin user id)

### CardImage (template)
- id, categoryId, title, altText, storagePath / url, sortOrder, isPublished  
- licenseSource, licenseType, attributionText, reuseConfirmed (boolean)  
- createdAt, updatedAt, owner (admin user id)

### GeneratedCard (optional but recommended)
- id, cardImageId, publicToken (for short-lived access if needed)  
- storagePath / url, format (png/jpg)  
- message snapshot / style snapshot (JSON)  
- createdAt, expiresAt  
- Used for email attachment, WhatsApp handoff, and **admin cleanup**

Audit fields on all entities: `createdAt`, `updatedAt`, `owner` where an actor exists.

---

## 11. Security and operations

- Hash admin passwords; HTTPS in production  
- Admin-only routes and APIs  
- Upload: MIME + extension check, size limit; no executable uploads  
- Image storage: local disk for MVP (`/uploads/templates`, `/uploads/generated`); design so cloud (e.g. S3) can replace later  
- Rate limiting on login, upload, generate, email  
- Backups of database and uploaded templates  
- Clear error messages for users; no stack traces in the UI  
- Generated files expire; admin can delete them; scheduled cleanup job is allowed later

---

## 12. Usability and legal

- Mobile-first layout; 3-up grid on desktop, stacked or 1–2 columns on small screens  
- Search/filter categories  
- Preview before download  
- Loading, empty, and error states  
- Alt text, keyboard support  
- Pages: Privacy Policy, Terms of Use, Image license / attribution  
- “Report this content” with category/template id and optional comment

---

## 13. Out of scope for v1 (explicit)

- Guest accounts, saved cards, favorites  
- Payments or paid templates  
- Social login  
- Multi-admin roles beyond a single `admin` role  
- In-app WhatsApp Business API (use share/download of the image)  
- Sending email to multiple recipients in one request

---

## 14. Implementation sequence (build order)

1. Angular app `ecard` + API + database schema and admin seed  
2. Public category list + gallery (3 per page, pagination/load more)  
3. Customize + Preview (compose text on image)  
4. Download PNG/JPG  
5. WhatsApp share of generated image  
6. Email: recipient address + send image  
7. Admin login (hashed seed user)  
8. Admin category + template CRUD, publish, order, upload validation, license fields  
9. Generated-file cleanup  
10. Legal pages + report content  
11. Hardening: rate limits, empty/error states, accessibility pass  

---

## 15. Success criteria

- Visitor never needs to log in to complete a card.  
- Admin cannot publish a template without license/reuse confirmation.  
- Gallery shows exactly **3** templates per page (or per load-more batch).  
- Preview matches downloaded/shared image (no watermark).  
- Email goes only to the address the visitor entered.  
- Seed `admin` / `admin123` works in development only and is hashed at rest.  
