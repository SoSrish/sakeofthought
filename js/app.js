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
  var clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };
  var plural = function (n, one, many) { return n === 1 ? one : many; };

  /* ---------- pricing: the only place prices are calculated ---------- */

  function couplePrice(p) {
    return p.couplePrice || p.price * 2 + DATA.coupleSet.extra;
  }

  function unitPrice(item) {
    var p = product(item.productId);
    if (p.kind !== 'cup') return p.price;
    if (item.mode === 'couple') return couplePrice(p);
    return p.price + style(item.styleId).add + (item.people - 1) * DATA.extraPerson.add;
  }

  function lineTotal(item) { return unitPrice(item) * item.qty; }

  function subtotal() {
    return cart.items.reduce(function (sum, item) { return sum + lineTotal(item); }, 0);
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
      title = 'Couple set, 2 cups: ' + p.name + ' (Shape ' + p.shape + ')';
      lines.push('Painting: name, caricature and message on both cups');
      unit = 'per set';
    } else if (p.kind === 'cup') {
      title = p.name + ' (Shape ' + p.shape + ')';
      lines.push('Painting: ' + style(item.styleId).label.toLowerCase());
      if (item.people > 1) lines.push('People on each cup: ' + item.people);
    } else if (p.kind === 'family') {
      title = p.name + ', ' + p.size + ' (Shape ' + p.shape + ')';
      lines.push('Painting: ' + p.includes.toLowerCase());
      unit = 'per set';
    } else {
      title = p.name;
      lines.push(DATA.zinePages);
    }
    if (p.size && p.kind === 'cup') lines.push('Size: ' + p.size);
    if (item.note) lines.push('Notes: ' + item.note);
    return { title: title, lines: lines, unit: unit };
  }

  /* ---------- cart state ---------- */

  var cart = { items: [], ref: '' };
  var details = { name: '', place: '', neededBy: '', occasion: '' };
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
      a.people === b.people && a.note === b.note;
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

    cart.items.forEach(function (item, i) {
      var d = describe(item);
      var kind = product(item.productId).kind;
      if (kind === 'zine') hasZines = true; else hasCups = true;
      out.push((i + 1) + '. *' + d.title + '* x ' + item.qty);
      d.lines.forEach(function (line) { out.push('   ' + line); });
      out.push('   ' + inr(unitPrice(item)) + ' ' + d.unit + (item.qty > 1 ? ', ' + inr(lineTotal(item)) + ' in total' : ''));
      out.push('');
    });

    out.push('*Subtotal: ' + inr(subtotal()) + '* (shipping to be added)');
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
    out.push('', 'I will send the ' + photos.join(' and the ') + ' in this chat.');
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

  function renderCatalogue() {
    var cards = DATA.products.filter(function (p) { return p.kind !== 'zine'; }).map(function (p) {
      var fit = p.fit === 'cover' ? ' class="cover"' : '';
      return '<article class="product-card">' +
        '<div class="product-media"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"' + fit + '></div>' +
        '<div class="product-body">' +
        '<p class="product-shape">Shape ' + p.shape + '</p>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="product-size">' + esc(p.size || p.hint || '\u00a0') + '</p>' +
        '<div class="product-foot">' +
        '<span class="price">' + inr(p.price) + '</span>' +
        '<button class="btn btn-dark btn-small" type="button" data-configure="' + p.id + '" aria-label="Customise ' + esc(p.name) + '">Customise</button>' +
        '</div></div></article>';
    });
    $('[data-cup-grid]').innerHTML = cards.join('');

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
    renderConfigurator();
    if (!configurator.open) configurator.showModal();
  }

  function renderConfigurator() {
    var p = product(draft.productId);
    var html = '<div class="sheet-head">' +
      '<img class="sheet-thumb" src="' + esc(p.image) + '" alt="">' +
      '<div><h2 id="configurator-title">' + esc(p.kind === 'zine' ? p.name : p.kind === 'family' ? p.name : 'Customise your cup') + '</h2>' +
      '<p>' + esc(p.kind === 'cup' ? 'Shape ' + p.shape + ', ' + p.name : p.kind === 'family' ? p.size + '. ' + p.includes + '.' : DATA.zinePages + '. You share the photos in the WhatsApp chat.') + '</p></div>' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">&times;</button>' +
      '</div><div class="sheet-body">';

    if (p.kind === 'cup') {
      html += '<label class="field"><span class="field-label">Shape</span><select name="shape">' +
        cups().map(function (c) {
          return '<option value="' + c.id + '"' + (c.id === p.id ? ' selected' : '') + '>' + esc(c.name) + ', ' + inr(c.price) + '</option>';
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

    html += '<div class="field field-row"><span class="field-label" data-qty-label></span>' + stepper('qty', draft.qty, 'Quantity') + '</div>';

    var noteLabel = p.kind === 'zine' ? 'Who or what is it about? Any words for the cover?' : 'Names, message and anything else to paint';
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
    var qtyLabel = p.kind === 'zine' ? 'How many copies' : (couple || p.kind === 'family') ? 'How many sets' : 'How many cups';
    $('[data-qty-label]', configForm).textContent = qtyLabel;
    $$('[data-out="qty"]', configForm).forEach(function (el) { el.textContent = draft.qty; });
    $$('[data-out="people"]', configForm).forEach(function (el) { el.textContent = draft.people; });
    $('[data-total]', configForm).textContent = inr(lineTotal(draft));
  }

  configForm.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'shape') {
      draft.productId = t.value;
      renderConfigurator();
      $('select[name="shape"]', configForm).focus();
      return;
    }
    if (t.name === 'mode') draft.mode = t.value;
    if (t.name === 'style') draft.styleId = t.value;
    syncConfigurator();
  });

  configForm.addEventListener('input', function (e) {
    if (e.target.name === 'note') draft.note = e.target.value.trim();
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
        '<img src="' + esc(p.image) + '" alt="">' +
        '<div class="cart-item-main"><h3>' + esc(d.title) + '</h3>' +
        d.lines.map(function (line) { return '<p>' + esc(line) + '</p>'; }).join('') +
        '<div class="cart-item-foot">' + stepper(item.key, item.qty, 'Quantity of ' + d.title) +
        '<strong>' + inr(lineTotal(item)) + '</strong></div>' +
        '<button type="button" class="link-btn" data-remove="' + item.key + '">Remove</button>' +
        '</div></li>';
    }).join('');

    var notice = justSent
      ? '<p class="notice">WhatsApp should have opened with your order. Press send there to place it. Didn\u2019t open? Tap the button again.</p>'
      : '';

    cartEl.innerHTML = head + '<div class="sheet-body">' + notice +
      '<ul class="cart-list">' + list + '</ul>' +
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
      '<div class="subtotal-row"><span>Subtotal <small>' + esc(CONFIG.shippingNote) + '</small></span><strong data-subtotal>' + inr(subtotal()) + '</strong></div>' +
      '<a class="btn btn-whatsapp" data-proceed target="_blank" rel="noopener" href="' + esc(waLink(buildMessage())) + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>' +
      'Proceed to buy on WhatsApp</a>' +
      '</div>';
  }

  function refreshProceed() {
    var a = $('[data-proceed]', cartEl);
    if (a) a.href = waLink(buildMessage());
  }

  cartEl.addEventListener('input', function (e) {
    var name = e.target.name;
    if (name in details) {
      details[name] = e.target.value.trim();
      refreshProceed();
    }
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
    var configure = e.target.closest('[data-configure]');
    if (configure) openConfigurator(configure.getAttribute('data-configure'), configure.getAttribute('data-mode'));
  });

  /* Tapping the dimmed area outside a sheet closes it. */
  [configurator, cartDialog].forEach(function (dialog) {
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  });

  loadCart();
  renderCatalogue();
  renderLinks();
  renderCartCount();

  /* Exposed for testing in the browser console. */
  window.SOT_APP = { cart: cart, details: details, unitPrice: unitPrice, buildMessage: buildMessage, addToCart: addToCart };
})();
