# SakeOfThought website

A single landing page: browse the catalogue, build a cart, and send the
whole order to WhatsApp. No backend, no build step, no database.

## How an order travels

1. The customer picks shapes, painting options and quantities. The cart
   is kept in their own browser.
2. **Proceed to buy on WhatsApp** opens a chat with the business number,
   with the full order already written out (items, sizes, customisation,
   quantities, subtotal, order ref, and any delivery details they typed).
3. Nothing reaches you until the customer presses send in WhatsApp.
   Reference photos, shipping cost and payment are all handled in that chat.

## Files

```
index.html            the page
css/styles.css        layout and colours
css/fonts.css         the three brand fonts, hosted with the site
js/config.js          WhatsApp number, Instagram handle, Sheet URL
js/products.js        every product, price and add-on
js/app.js             catalogue, cart and WhatsApp message
images/               product photos
google-sheet/Code.gs  optional order log (off by default)
```

## Put it on GitHub Pages

1. Create a repository and push everything in this folder to `main`.
2. In the repository: **Settings > Pages > Build and deployment**.
   Source: *Deploy from a branch*. Branch: `main`, folder `/ (root)`.
3. The site appears at `https://<username>.github.io/<repo>/` after a
   minute or two. Every push to `main` updates it.

The `.nojekyll` file tells GitHub to serve the files as they are.

## Change a price

Open `js/products.js`.

- Cup and zine prices: the `price` on each product.
- Message and hobbies add-ons: `add` in the `styles` list.
- Extra person on a cup: `extraPerson.add` (and `max` people per cup).
- Couple set: worked out as `2 x cup price + coupleSet.extra`, so a
  Rs 349 cup gives Rs 699. To fix a different price for one shape, add
  `couplePrice: 899` to that product.
- Family set: the `price` on `family-set`.

Save, commit, push. Nothing else needs to change; the catalogue, the
cart and the WhatsApp message all read from this file.

## Add or change a product

Copy an entry in `products.js`, give it a new `id`, and put its photo in
`images/`. `kind` is `cup`, `family` or `zine`. Square-ish photos on a
plain background look best. Removing an entry removes it from the site.

## Change the WhatsApp number or Instagram

`js/config.js`. The number is digits only with the country code first
(`91` then the ten digits).

## Turning on the Google Sheet

Off by default. When on, each tap on *Proceed to buy* also adds a row to
a sheet. It records that the customer tapped the button, not that they
sent the message or paid, so treat WhatsApp as the source of truth.

1. Create a Google Sheet in her account.
2. **Extensions > Apps Script**. Replace the contents with
   `google-sheet/Code.gs` and save.
3. **Deploy > New deployment > Web app**. Execute as: *Me*.
   Who has access: *Anyone*. Deploy and copy the web app URL.
4. Paste that URL into `sheetWebhookUrl` in `js/config.js` and push.

About safety: the URL is visible in the site code, so anyone could post
junk rows to it. It cannot be used to read the sheet, and the script
trims long text and neutralises formulas. Keep the Google account on
2-step verification. If junk ever becomes a problem, make a new
deployment (new URL) and update `config.js`.

When the sheet is on, the privacy text in `index.html` already covers
it ("We keep a basic record of each order").

## Things to review before going live

- **Privacy and policy text** in `index.html` ("Good to know" and "Your
  privacy"). It makes promises on her behalf, such as deleting reference
  photos after delivery. Edit anything she does not want to commit to.
- **Zine pages**: `zinePages` in `products.js` says "8 to 14 pages".
- **Shape 4 photo** shows six cups while the price is per cup. The card
  says so; swap `images/shape-4.jpg` for a single cup when there is one.
- **Shape names** ("Cane-handle cup" and so on) are placeholders.

## Fonts

Amatic SC, Poppins and Courier Prime, all under the SIL Open Font
License, served from `fonts/` so no visitor data goes to a font service.
