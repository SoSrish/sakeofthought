(function () {
  'use strict';

  var CONFIG = window.SOT_CONFIG;
  var DATA = window.SOT_DATA;
  var STORAGE_KEY = 'sot-cart-v1';

  /* ---------- small helpers ---------- */

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var inr = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var product = function (id) { return DATA.products.filter(function (p) { return p.id === id; })[0]; };
  var style = function (id) { return DATA.styles.filter(function (s) { return s.id === id; })[0] || DATA.styles[0]; };
  var cups = function () { return DATA.products.filter(function (p) { return p.kind === 'cup'; }); };
  var totes = function () { return DATA.products.filter(function (p) { return p.kind === 'tote'; }); };
  var colour = function (id) { return (DATA.toteColours || []).filter(function (c) { return c.id === id; })[0] || (DATA.toteColours || [])[0]; };
  /* A product without a price yet (price: null) is quoted on WhatsApp. */
  var hasPrice = function (p) { return typeof p.price === 'number'; };
  var itemImage = function (item) {
    var p = product(item.productId);
    return (p.images && item.colour && p.images[item.colour]) || p.painted || p.image;
  };
  var totesVisible = !!CONFIG.showTotes || /[?&]preview=totes\b/.test(window.location.search);
  var clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };
  var plural = function (n, one, many) { return n === 1 ? one : many; };

  /* ---------- pricing: the only place prices are calculated ---------- */

  function couplePrice(p) {
    return p.couplePrice || p.price * 2 + DATA.coupleSet.extra;
  }

  function unitPrice(item) {
    var p = product(item.productId);
    if (p.kind !== 'cup') return hasPrice(p) ? p.price : 0;
    if (item.mode === 'couple') return couplePrice(p);
    return p.price + style(item.styleId).add + (item.people - 1) * DATA.extraPerson.add;
  }

  function lineTotal(item) { return unitPrice(item) * item.qty; }

  function subtotal() {
    return cart.items.reduce(function (sum, item) { return sum + lineTotal(item); }, 0);
  }

  /* Coupon or referral code. Known codes (CONFIG.coupons) are applied
     here; anything else is passed to WhatsApp for her to confirm. */
  function normaliseCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  }

  function couponInfo() {
    var code = details.code;
    if (!code) return null;
    var rule = (CONFIG.coupons || {})[code];
    if (!rule) return { code: code, known: false, off: 0 };
    var sub = subtotal();
    if (rule.minSubtotal && sub < rule.minSubtotal) {
      return { code: code, known: true, off: 0, needs: rule.minSubtotal };
    }
    var off = rule.percent ? Math.round(sub * rule.percent / 100) : Math.min(rule.flat || 0, sub);
    return { code: code, known: true, off: off };
  }

  function total() {
    var c = couponInfo();
    return subtotal() - (c ? c.off : 0);
  }

  function unpricedCount() {
    return cart.items.filter(function (item) { return !hasPrice(product(item.productId)); }).length;
  }

  function priceText(item, amount) {
    return hasPrice(product(item.productId)) ? inr(amount) : 'Price in chat';
  }

  function countItems() {
    return cart.items.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  /* What an item is, in words. Used by the cart and the WhatsApp message. */
  function describe(item) {
    var p = product(item.productId);
    var lines = [];
    var title;
    var unit = 'each';

    if (p.kind === 'cup' && item.mode === 'couple') {
      title = 'Couple set, 2 cups: ' + p.name;
      lines.push('Painting: name, caricature and message on both cups');
      unit = 'per set';
    } else if (p.kind === 'cup') {
      title = p.name;
      lines.push('Painting: ' + style(item.styleId).label.toLowerCase());
      if (item.people > 1) lines.push('People on each cup: ' + item.people);
    } else if (p.kind === 'tote') {
      title = 'Tote bag: ' + p.name;
      lines.push('Bag: ' + colour(item.colour).label.toLowerCase());
      var custom = item.custom || {};
      (p.fields || []).forEach(function (f) {
        var v = custom[f.id];
        if (!v) return;
        lines.push(f.label.replace(/ \(.*\)$/, '') + ': ' + (f.type === 'lines' ? v.split('\n').join(' / ') : v));
      });
      if (item.qr) lines.push('QR code to open: ' + item.qr);
    } else if (p.kind === 'family') {
      title = p.name + ', ' + p.size;
      lines.push('Painting: ' + p.includes.toLowerCase());
      unit = 'per set';
    } else {
      title = p.name;
      lines.push(DATA.zinePages);
    }
    if (p.size && p.kind === 'cup') lines.push('Capacity: ' + p.size);
    if (item.note) lines.push('Notes: ' + item.note);
    return { title: title, lines: lines, unit: unit, shape: p.shape };
  }

  /* ---------- cart state ---------- */

  var cart = { items: [], ref: '' };
  var details = { name: '', place: '', neededBy: '', occasion: '', code: '' };
  var justSent = false;

  function newRef() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return 'SOT-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + code;
  }

  function loadCart() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.items)) {
        cart.items = saved.items.filter(function (item) { return product(item.productId); });
        cart.ref = saved.ref || '';
      }
    } catch (e) { /* storage unavailable: the cart just lasts for this visit */ }
    if (!cart.ref) cart.ref = newRef();
  }

  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* ignore */ }
  }

  function sameItem(a, b) {
    return a.productId === b.productId && a.mode === b.mode && a.styleId === b.styleId &&
      a.people === b.people && a.note === b.note && (a.colour || '') === (b.colour || '') &&
      (a.qr || '') === (b.qr || '') && JSON.stringify(a.custom || {}) === JSON.stringify(b.custom || {});
  }

  function addToCart(item) {
    var existing = cart.items.filter(function (other) { return sameItem(other, item); })[0];
    if (existing) {
      existing.qty = clamp(existing.qty + item.qty, 1, 99);
    } else {
      item.key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      cart.items.push(item);
    }
    justSent = false;
    saveCart();
    renderCartCount();
  }

  /* ---------- WhatsApp ---------- */

  function waLink(text) {
    return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(text);
  }

  function formatDate(value) {
    var d = new Date(value + 'T00:00:00');
    if (isNaN(d)) return value;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function buildMessage() {
    var out = ['Hi ' + CONFIG.businessName + '! I would like to order:', ''];
    var hasCups = false;
    var hasZines = false;
    var hasTotes = false;
    var hasQr = false;

    cart.items.forEach(function (item, i) {
      var d = describe(item);
      var kind = product(item.productId).kind;
      if (kind === 'zine') hasZines = true;
      else if (kind === 'tote') { hasTotes = true; if (item.qr) hasQr = true; }
      else hasCups = true;
      out.push((i + 1) + '. *' + d.title + (d.shape ? ' (Shape ' + d.shape + ')' : '') + '* x ' + item.qty);
      d.lines.forEach(function (line) { out.push('   ' + line); });
      if (hasPrice(product(item.productId))) {
        out.push('   ' + inr(unitPrice(item)) + ' ' + d.unit + (item.qty > 1 ? ', ' + inr(lineTotal(item)) + ' in total' : ''));
      } else {
        out.push('   Price: please share');
      }
      out.push('');
    });

    var unpriced = unpricedCount();
    var plusNote = unpriced ? ' + tote price' : '';
    var coupon = couponInfo();
    if (coupon && coupon.off) {
      out.push('Subtotal: ' + inr(subtotal()));
      out.push('Code ' + coupon.code + ': -' + inr(coupon.off));
      out.push('*Total: ' + inr(total()) + plusNote + '* (shipping to be added)');
    } else {
      out.push('*Subtotal: ' + inr(subtotal()) + plusNote + '* (shipping to be added)');
      if (coupon) out.push('Coupon/referral code: ' + coupon.code + ' (please confirm)');
    }
    out.push('Order ref: ' + cart.ref);

    var extra = [];
    if (details.name) extra.push('Name: ' + details.name);
    if (details.place) extra.push('Deliver to: ' + details.place);
    if (details.neededBy) extra.push('Needed by: ' + formatDate(details.neededBy));
    if (details.occasion) extra.push('Occasion: ' + details.occasion);
    if (extra.length) out.push('', extra.join('\n'));

    var photos = [];
    if (hasCups) photos.push('reference photos for the caricatures');
    if (hasZines) photos.push('photos for the zine');
    if (hasQr) photos.push('link for the QR code');
    if (photos.length) out.push('', 'I will send the ' + photos.join(' and the ') + ' in this chat.');
    else if (hasTotes) out.push('', 'I will share anything else for the tote in this chat.');
    return out.join('\n');
  }

  /* Optional: log the order to a Google Sheet. Does nothing until
     CONFIG.sheetWebhookUrl is filled in. It records that the customer
     tapped Proceed, not that they sent the message or paid. */
  function logToSheet() {
    if (!CONFIG.sheetWebhookUrl) return;
    var order = {
      ref: cart.ref,
      name: details.name,
      place: details.place,
      neededBy: details.neededBy,
      occasion: details.occasion,
      code: details.code,
      discount: couponInfo() ? couponInfo().off : 0,
      subtotal: subtotal(),
      items: cart.items.map(function (item) {
        var d = describe(item);
        return { title: d.title, qty: item.qty, unitPrice: unitPrice(item), details: d.lines.join(' | ') };
      })
    };
    try {
      fetch(CONFIG.sheetWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(order)
      }).catch(function () { /* never block the order on logging */ });
    } catch (e) { /* ignore */ }
  }

  /* ---------- page: catalogue ---------- */

  function stepper(name, value, label) {
    return '<div class="stepper" role="group" aria-label="' + esc(label) + '">' +
      '<button type="button" data-step="-1" data-step-for="' + name + '" aria-label="Decrease">&minus;</button>' +
      '<output data-out="' + name + '">' + value + '</output>' +
      '<button type="button" data-step="1" data-step-for="' + name + '" aria-label="Increase">+</button>' +
      '</div>';
  }

  /* Card photo slider: the painted example first, then the plain shape.
     Swipe on phones; dots and arrows everywhere. */
  function gallery(p, fit) {
    var slides = [];
    if (p.images) {
      (DATA.toteColours || []).forEach(function (c) {
        if (p.images[c.id]) slides.push({ src: p.images[c.id], alt: p.name + ' tote, ' + c.label.toLowerCase(), cls: ' class="cover"', label: c.label });
      });
      fit = ' class="cover"';
    }
    if (!p.images && p.painted) slides.push({ src: p.painted, alt: p.name + ', hand-painted with a caricature and name', cls: '', label: 'Painted' });
    if (!p.images) slides.push({ src: p.image, alt: p.name + ', plain shape', cls: fit, label: 'Plain shape' });
    if (slides.length === 1) {
      return '<div class="product-media"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"' + fit + '></div>';
    }
    var id = 'g-' + p.id;
    return '<div class="product-media gallery" role="region" aria-roledescription="carousel" aria-label="Photos of ' + esc(p.name) + '">' +
      '<div class="gallery-track" id="' + id + '" tabindex="0">' +
      slides.map(function (s, i) {
        return '<div class="gallery-slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + slides.length + ': ' + s.label + '">' +
          '<img src="' + esc(s.src) + '" alt="' + esc(s.alt) + '" loading="lazy"' + s.cls + '></div>';
      }).join('') + '</div>' +
      '<button type="button" class="gallery-arrow prev" data-gallery-step="-1" aria-controls="' + id + '" aria-label="Previous photo" hidden>&#8249;</button>' +
      '<button type="button" class="gallery-arrow next" data-gallery-step="1" aria-controls="' + id + '" aria-label="Next photo">&#8250;</button>' +
      '<div class="gallery-dots">' + slides.map(function (s, i) {
        return '<button type="button" class="gallery-dot' + (i === 0 ? ' is-active' : '') + '" data-gallery-go="' + i + '" aria-controls="' + id + '" aria-label="Show photo ' + (i + 1) + ': ' + s.label + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
      }).join('') + '</div>' +
      '</div>';
  }

  function gallerySync(track) {
    var box = track.parentNode;
    var count = track.children.length;
    var index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    index = clamp(index, 0, count - 1);
    $$('.gallery-dot', box).forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
      if (i === index) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
    });
    $('.gallery-arrow.prev', box).hidden = index === 0;
    $('.gallery-arrow.next', box).hidden = index === count - 1;
  }

  function galleryGo(track, index) {
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  }

  function setupGalleries() {
    $$('.gallery-track').forEach(function (track) {
      var timer;
      track.addEventListener('scroll', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { gallerySync(track); }, 60);
      }, { passive: true });
      track.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var i = Math.round(track.scrollLeft / track.clientWidth) + (e.key === 'ArrowRight' ? 1 : -1);
        galleryGo(track, clamp(i, 0, track.children.length - 1));
      });
    });
  }

  function renderCatalogue() {
    var cards = DATA.products.filter(function (p) { return p.kind === 'cup' || p.kind === 'family'; }).map(function (p) {
      var fit = p.fit === 'cover' ? ' class="cover"' : '';
      return '<article class="product-card">' +
        gallery(p, fit) +
        '<div class="product-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="product-size">' + esc(p.size || p.hint || '\u00a0') + '</p>' +
        '<div class="product-foot">' +
        '<span class="price">' + inr(p.price) + '</span>' +
        '<button class="btn btn-dark btn-small" type="button" data-configure="' + p.id + '" aria-label="Customise ' + esc(p.name) + '">Customise</button>' +
        '</div></div></article>';
    });
    $('[data-cup-grid]').innerHTML = cards.join('');

    var toteGrid = $('[data-tote-grid]');
    if (toteGrid) {
      toteGrid.innerHTML = totes().map(function (p) {
        return '<article class="product-card">' +
          gallery(p, ' class="cover"') +
          '<div class="product-body">' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="product-size">' + esc(p.blurb || '') + '</p>' +
          '<div class="product-foot">' +
          '<span class="price">' + (hasPrice(p) ? inr(p.price) : 'Price on WhatsApp') + '</span>' +
          '<button class="btn btn-dark btn-small" type="button" data-configure="' + p.id + '" aria-label="Customise ' + esc(p.name) + ' tote">Customise</button>' +
          '</div></div></article>';
      }).join('');
    }
    $$('[data-totes]').forEach(function (el) { el.hidden = !totesVisible; });
    $$('[data-totes-preview]').forEach(function (el) { el.hidden = !(totesVisible && !CONFIG.showTotes); });


    var styles = DATA.styles.map(function (s) {
      return '<li><span>' + esc(s.label) + '</span><strong>' + (s.add ? '+' + inr(s.add) : 'Included') + '</strong></li>';
    });
    styles.push('<li><span>More than one person on the same cup</span><strong>+' + inr(DATA.extraPerson.add) + ' per extra person</strong></li>');
    $('[data-style-list]').innerHTML = styles.join('');

    var cheapest = cups().reduce(function (min, p) { return Math.min(min, couplePrice(p)); }, Infinity);
    $('[data-couple-from]').textContent = 'From ' + inr(cheapest);
    $('[data-family-price]').textContent = inr(product('family-set').price);

    $('[data-zine-pages]').textContent = DATA.zinePages;
    $('[data-zine-list]').innerHTML = DATA.products.filter(function (p) { return p.kind === 'zine'; }).map(function (p) {
      return '<div class="zine-option">' +
        '<div><h3>' + esc(p.size) + '</h3><p class="price">' + inr(p.price) + '</p></div>' +
        '<button class="btn btn-light btn-small" type="button" data-configure="' + p.id + '" aria-label="Add ' + esc(p.name) + ' to cart">Add to cart</button>' +
        '</div>';
    }).join('');
  }

  function renderLinks() {
    var custom = waLink('Hi ' + CONFIG.businessName + '! I am looking for something that is not in the catalogue. Here is what I have in mind:\n');
    var question = waLink('Hi ' + CONFIG.businessName + '! I have a question:\n');
    $$('[data-wa="custom"]').forEach(function (a) { a.href = custom; });
    $$('[data-wa="question"]').forEach(function (a) { a.href = question; });
    var n = CONFIG.whatsappNumber.replace(/^91/, '');
    $$('[data-wa-number]').forEach(function (el) { el.textContent = 'WhatsApp ' + n; });
    $$('[data-instagram]').forEach(function (a) { a.href = 'https://instagram.com/' + CONFIG.instagramHandle; });
    $$('[data-instagram-handle]').forEach(function (el) { el.textContent = '@' + CONFIG.instagramHandle; });
  }

  function renderCartCount() {
    var n = countItems();
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      el.classList.toggle('is-empty', n === 0);
    });
  }

  /* ---------- customise dialog ---------- */

  var configurator = $('#configurator');
  var configForm = $('[data-configurator]');
  var draft = null;

  function openConfigurator(productId, mode) {
    var p = product(productId);
    if (!p) return;
    draft = { productId: productId, mode: p.kind === 'cup' && mode === 'couple' ? 'couple' : 'single', styleId: DATA.styles[0].id, people: 1, qty: 1, note: '' };
    if (p.kind === 'tote') { draft.colour = DATA.toteColours[0].id; draft.custom = {}; draft.qr = ''; }
    renderConfigurator();
    if (!configurator.open) configurator.showModal();
  }

  function renderConfigurator() {
    var p = product(draft.productId);
    var html = '<div class="sheet-head">' +
      '<img class="sheet-thumb" data-sheet-thumb src="' + esc(itemImage(draft)) + '" alt="">' +
      '<div><h2 id="configurator-title">' + esc(p.kind === 'tote' ? 'Customise your tote' : p.kind === 'cup' ? 'Customise your cup' : p.name) + '</h2>' +
      '<p>' + esc(p.kind === 'tote' ? p.name + '. Fill in what you can, or send it in the chat.' : p.kind === 'cup' ? p.name : p.kind === 'family' ? p.size + '. ' + p.includes + '.' : DATA.zinePages + '. You share the photos in the WhatsApp chat.') + '</p></div>' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">&times;</button>' +
      '</div><div class="sheet-body">';

    if (p.kind === 'cup') {
      html += '<label class="field"><span class="field-label">Shape</span><select name="shape">' +
        cups().map(function (c) {
          return '<option value="' + c.id + '"' + (c.id === p.id ? ' selected' : '') + '>' + esc(c.name + (c.size ? ' (' + c.size + ')' : '')) + ', ' + inr(c.price) + '</option>';
        }).join('') + '</select></label>';

      html += '<fieldset class="field"><legend class="field-label">Order as</legend>' +
        choice('mode', 'single', 'Single cup', inr(p.price) + ' each, with caricature and name', draft.mode === 'single') +
        choice('mode', 'couple', 'Couple set, 2 cups', inr(couplePrice(p)) + ', with name, caricature and message', draft.mode === 'couple') +
        '</fieldset>';

      html += '<fieldset class="field" data-single-only><legend class="field-label">What should we paint?</legend>' +
        DATA.styles.map(function (s) {
          return choice('style', s.id, s.label, (s.add ? '+' + inr(s.add) : 'Included') + (s.hint && s.add ? '. ' + s.hint : ''), draft.styleId === s.id);
        }).join('') + '</fieldset>';

      html += '<div class="field field-row" data-single-only><div><span class="field-label">People painted on each cup</span>' +
        '<small>+' + inr(DATA.extraPerson.add) + ' for each extra person</small></div>' +
        stepper('people', draft.people, 'People painted on each cup') + '</div>';
    }

    if (p.kind === 'tote') {
      html += '<label class="field"><span class="field-label">Design</span><select name="design">' +
        totes().map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === p.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('') + '</select></label>';
      html += '<fieldset class="field"><legend class="field-label">Bag</legend>' +
        DATA.toteColours.map(function (c) {
          return choice('colour', c.id, c.label, '', draft.colour === c.id);
        }).join('') + '</fieldset>';
      (p.fields || []).forEach(function (f) {
        var val = esc(draft.custom[f.id] || '');
        var ph = esc(f.placeholder || '');
        if (f.type === 'lines') {
          html += '<label class="field"><span class="field-label">' + esc(f.label) + '</span>' +
            '<textarea name="f_' + f.id + '" rows="' + Math.min(f.maxLines, 5) + '" placeholder="' + ph + '">' + val + '</textarea>' +
            '<small>One per line, up to ' + f.maxLines + ', about ' + f.max + ' characters each.</small></label>';
        } else {
          html += '<label class="field"><span class="field-label">' + esc(f.label) + '</span>' +
            '<input type="text" name="f_' + f.id + '" maxlength="' + f.max + '" placeholder="' + ph + '" value="' + val + '"></label>';
        }
      });
      html += '<label class="field"><span class="field-label">Want a QR code on it? What should it open?</span>' +
        '<input type="text" name="qr" maxlength="120" placeholder="A song, a photo album, a voice note" value="' + esc(draft.qr) + '">' +
        '<small>Optional. Send the actual link in the WhatsApp chat and we will make the QR for you.</small></label>';
    }

    html += '<div class="field field-row"><span class="field-label" data-qty-label></span>' + stepper('qty', draft.qty, 'Quantity') + '</div>';

    var noteLabel = p.kind === 'zine' ? 'Who or what is it about? Any words for the cover?' : p.kind === 'tote' ? 'Anything else for this tote?' : 'Names, message and anything else to paint';
    html += '<label class="field"><span class="field-label">' + noteLabel + '</span>' +
      '<textarea name="note" rows="3" maxlength="400">' + esc(draft.note) + '</textarea>' +
      '<small>Optional. You can also share this in the chat.</small></label>';

    html += '</div><div class="sheet-foot"><div class="total"><span>Total</span><strong data-total></strong></div>' +
      '<button class="btn btn-dark" type="submit">Add to cart</button></div>';

    configForm.innerHTML = html;
    syncConfigurator();
  }

  function choice(name, value, label, hint, checked) {
    return '<label class="choice"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="choice-text"><span>' + esc(label) + '</span><small>' + esc(hint) + '</small></span></label>';
  }

  function syncConfigurator() {
    var p = product(draft.productId);
    var couple = draft.mode === 'couple';
    $$('[data-single-only]', configForm).forEach(function (el) { el.hidden = couple; });
    var qtyLabel = p.kind === 'zine' ? 'How many copies' : p.kind === 'tote' ? 'How many bags' : (couple || p.kind === 'family') ? 'How many sets' : 'How many cups';
    $('[data-qty-label]', configForm).textContent = qtyLabel;
    $$('[data-out="qty"]', configForm).forEach(function (el) { el.textContent = draft.qty; });
    $$('[data-out="people"]', configForm).forEach(function (el) { el.textContent = draft.people; });
    $('[data-total]', configForm).textContent = priceText(draft, lineTotal(draft));
    var thumb = $('[data-sheet-thumb]', configForm);
    if (thumb) thumb.src = itemImage(draft);
  }

  configForm.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'shape') {
      draft.productId = t.value;
      renderConfigurator();
      $('select[name="shape"]', configForm).focus();
      return;
    }
    if (t.name === 'design') {
      var keepColour = draft.colour;
      draft.productId = t.value; draft.custom = {};
      draft.colour = keepColour;
      renderConfigurator();
      $('select[name="design"]', configForm).focus();
      return;
    }
    if (t.name === 'colour') draft.colour = t.value;
    if (t.name === 'mode') draft.mode = t.value;
    if (t.name === 'style') draft.styleId = t.value;
    syncConfigurator();
  });

  configForm.addEventListener('input', function (e) {
    var n = e.target.name;
    if (n === 'note') draft.note = e.target.value.trim();
    if (n === 'qr') draft.qr = e.target.value.trim();
    if (n && n.indexOf('f_') === 0 && draft.custom) {
      var field = (product(draft.productId).fields || []).filter(function (f) { return 'f_' + f.id === n; })[0];
      var v = e.target.value;
      if (field && field.type === 'lines') {
        v = v.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, field.maxLines).join('\n');
      } else {
        v = v.trim();
      }
      draft.custom[n.slice(2)] = v;
    }
  });

  configForm.addEventListener('click', function (e) {
    var step = e.target.closest('[data-step]');
    if (step) {
      var field = step.getAttribute('data-step-for');
      var delta = Number(step.getAttribute('data-step'));
      if (field === 'qty') draft.qty = clamp(draft.qty + delta, 1, 99);
      if (field === 'people') draft.people = clamp(draft.people + delta, 1, DATA.extraPerson.max);
      syncConfigurator();
      return;
    }
    if (e.target.closest('[data-close]')) configurator.close();
  });

  configForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var item = {
      productId: draft.productId,
      mode: draft.mode,
      styleId: draft.mode === 'couple' ? DATA.styles[0].id : draft.styleId,
      people: draft.mode === 'couple' ? 1 : draft.people,
      qty: draft.qty,
      note: draft.note
    };
    if (product(item.productId).kind !== 'cup') { item.mode = 'single'; item.styleId = DATA.styles[0].id; item.people = 1; }
    if (product(item.productId).kind === 'tote') {
      item.colour = draft.colour;
      item.qr = draft.qr;
      item.custom = {};
      Object.keys(draft.custom).forEach(function (k) { if (draft.custom[k]) item.custom[k] = draft.custom[k]; });
    }
    addToCart(item);
    configurator.close();
    toast('Added to your cart', 'View cart');
  });

  /* ---------- cart dialog ---------- */

  var cartDialog = $('#cart');
  var cartEl = $('[data-cart]');

  function openCart() {
    renderCart();
    if (!cartDialog.open) cartDialog.showModal();
  }

  function minDate() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderCart() {
    var head = '<div class="sheet-head"><div><h2 id="cart-title">Your cart</h2></div>' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></div>';

    if (!cart.items.length) {
      cartEl.innerHTML = head + '<div class="sheet-body"><p class="empty">Your cart is empty. Pick a cup or a zine to get started.</p>' +
        '<a class="btn btn-dark" href="#catalogue" data-close>Browse the catalogue</a></div>';
      return;
    }

    var list = cart.items.map(function (item) {
      var p = product(item.productId);
      var d = describe(item);
      return '<li class="cart-item" data-key="' + item.key + '">' +
        '<img src="' + esc(itemImage(item)) + '" alt="">' +
        '<div class="cart-item-main"><h3>' + esc(d.title) + '</h3>' +
        d.lines.map(function (line) { return '<p>' + esc(line) + '</p>'; }).join('') +
        '<div class="cart-item-foot">' + stepper(item.key, item.qty, 'Quantity of ' + d.title) +
        '<strong>' + esc(priceText(item, lineTotal(item))) + '</strong></div>' +
        '<button type="button" class="link-btn" data-remove="' + item.key + '">Remove</button>' +
        '</div></li>';
    }).join('');

    var notice = justSent
      ? '<p class="notice">WhatsApp should have opened with your order. Press send there to place it. Didn\u2019t open? Tap the button again.</p>'
      : '';

    cartEl.innerHTML = head + '<div class="sheet-body">' + notice +
      '<ul class="cart-list">' + list + '</ul>' +
      '<div class="coupon">' +
      '<label class="field"><span class="field-label">Coupon or referral code</span>' +
      '<input type="text" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" value="' + esc(details.code) + '"></label>' +
      '<p class="coupon-status" data-code-status aria-live="polite"></p>' +
      '</div>' +
      '<fieldset class="details"><legend class="field-label">Delivery details</legend>' +
      '<p class="details-hint">Optional. You can also share these in the chat.</p>' +
      '<label class="field"><span class="field-label">Your name</span><input type="text" name="name" autocomplete="name" value="' + esc(details.name) + '"></label>' +
      '<label class="field"><span class="field-label">City and pincode</span><input type="text" name="place" autocomplete="address-level2" value="' + esc(details.place) + '"></label>' +
      '<div class="field-pair">' +
      '<label class="field"><span class="field-label">Needed by</span><input type="date" name="neededBy" min="' + minDate() + '" value="' + esc(details.neededBy) + '"></label>' +
      '<label class="field"><span class="field-label">Occasion</span><input type="text" name="occasion" value="' + esc(details.occasion) + '"></label>' +
      '</div><p class="details-hint">Orders take 10 to 12 days, 15 at most.</p>' +
      '</fieldset>' +
      '<p class="fine">Proceed to buy opens WhatsApp with your order written out. Nothing is sent until you press send. Orders are prepaid, and a confirmed order can\u2019t be cancelled.</p>' +
      '<button type="button" class="link-btn" data-clear>Clear cart</button>' +
      '</div>' +
      '<div class="sheet-foot sheet-foot-stack">' +
      '<div data-totals></div>' +
      '<a class="btn btn-whatsapp" data-proceed target="_blank" rel="noopener" href="' + esc(waLink(buildMessage())) + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>' +
      'Proceed to buy on WhatsApp</a>' +
      '</div>';
    renderTotals();
  }

  function renderTotals() {
    var box = $('[data-totals]', cartEl);
    if (!box) return;
    var c = couponInfo();
    var rows = '';
    if (c && c.off) {
      rows += '<div class="discount-row"><span>Subtotal</span><span>' + inr(subtotal()) + '</span></div>' +
        '<div class="discount-row"><span>Code ' + esc(c.code) + '</span><span>&minus;' + inr(c.off) + '</span></div>';
    }
    rows += '<div class="subtotal-row"><span>' + (c && c.off ? 'Total' : 'Subtotal') +
      ' <small>' + esc(CONFIG.shippingNote) + (unpricedCount() ? ' Tote prices are shared in the chat.' : '') + '</small></span><strong data-subtotal>' + inr(total()) + (unpricedCount() ? ' +' : '') + '</strong></div>';
    box.innerHTML = rows;

    var status = $('[data-code-status]', cartEl);
    if (status) {
      var text = '';
      if (c && c.off) text = 'Code applied: you save ' + inr(c.off) + '.';
      else if (c && c.needs) text = 'This code works on orders of ' + inr(c.needs) + ' or more.';
      else if (c) text = 'We\u2019ll check this code and apply it in the WhatsApp chat.';
      status.textContent = text;
      status.classList.toggle('is-applied', !!(c && c.off));
    }
  }

  function refreshProceed() {
    var a = $('[data-proceed]', cartEl);
    if (a) a.href = waLink(buildMessage());
  }

  cartEl.addEventListener('input', function (e) {
    var name = e.target.name;
    if (name === 'code') {
      details.code = normaliseCode(e.target.value);
      renderTotals();
      refreshProceed();
      return;
    }
    if (name in details) {
      details[name] = e.target.value.trim();
      refreshProceed();
    }
  });

  /* When the customer leaves the code box, show the code as it will be sent. */
  cartEl.addEventListener('change', function (e) {
    if (e.target.name === 'code') e.target.value = details.code;
  });

  cartEl.addEventListener('click', function (e) {
    var t = e.target;
    var step = t.closest('[data-step]');
    if (step) {
      var key = step.getAttribute('data-step-for');
      var item = cart.items.filter(function (i) { return i.key === key; })[0];
      if (item) {
        item.qty = clamp(item.qty + Number(step.getAttribute('data-step')), 1, 99);
        saveCart(); renderCartCount(); renderCart();
        var again = $('[data-step-for="' + key + '"][data-step="' + step.getAttribute('data-step') + '"]', cartEl);
        if (again) again.focus();
      }
      return;
    }
    var remove = t.closest('[data-remove]');
    if (remove) {
      cart.items = cart.items.filter(function (i) { return i.key !== remove.getAttribute('data-remove'); });
      saveCart(); renderCartCount(); renderCart();
      var closeBtn = $('[data-close]', cartEl);
      if (closeBtn) closeBtn.focus();
      return;
    }
    if (t.closest('[data-clear]')) {
      cart.items = []; cart.ref = newRef(); justSent = false;
      saveCart(); renderCartCount(); renderCart();
      return;
    }
    if (t.closest('[data-proceed]')) {
      refreshProceed();
      logToSheet();
      justSent = true;
      setTimeout(renderCart, 600);
      return;
    }
    if (t.closest('[data-close]')) cartDialog.close();
  });

  /* ---------- shared ---------- */

  var toastEl = $('[data-toast]');
  var toastTimer;
  function toast(text, action) {
    toastEl.innerHTML = '<span>' + esc(text) + '</span>' + (action ? '<button type="button" data-open-cart>' + esc(action) + '</button>' : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }

  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open-cart]');
    if (open) { toastEl.hidden = true; openCart(); return; }
    var step = e.target.closest('[data-gallery-step]');
    var go = e.target.closest('[data-gallery-go]');
    if (step || go) {
      var track = document.getElementById((step || go).getAttribute('aria-controls'));
      var now = Math.round(track.scrollLeft / track.clientWidth);
      galleryGo(track, step ? clamp(now + Number(step.getAttribute('data-gallery-step')), 0, track.children.length - 1)
                            : Number(go.getAttribute('data-gallery-go')));
      return;
    }
    var configure = e.target.closest('[data-configure]');
    if (configure) openConfigurator(configure.getAttribute('data-configure'), configure.getAttribute('data-mode'));
  });

  /* Tapping the dimmed area outside a sheet closes it. */
  [configurator, cartDialog].forEach(function (dialog) {
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  });

  /* ---------- phone menu ---------- */

  var nav = $('[data-nav]');
  var menuButton = $('[data-menu-toggle]');

  function setMenu(open) {
    if (!nav || !menuButton) return;
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (menuButton) {
    menuButton.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuButton.focus(); }
    });
  }

  loadCart();
  renderCatalogue();
  setupGalleries();
  renderLinks();
  renderCartCount();

  /* Exposed for testing in the browser console. */
  window.SOT_APP = { cart: cart, details: details, unitPrice: unitPrice, buildMessage: buildMessage, addToCart: addToCart };
})();
