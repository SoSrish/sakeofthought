/*
  Site settings. Change these without touching the rest of the code.
*/
window.SOT_CONFIG = {
  businessName: 'SakeOfThought',

  // WhatsApp number in international format, digits only (91 = India).
  whatsappNumber: '917292015391',

  instagramHandle: 'sakeofthought',

  // Google Sheet logging is OFF while this is empty.
  // To turn it on, follow "Turning on the Google Sheet" in README.md,
  // then paste the Apps Script web app URL here.
  sheetWebhookUrl: '',

  // Coupon codes the site applies on its own (customers can still type
  // any code, e.g. a friend's referral code; unknown codes are sent to
  // WhatsApp for you to confirm). Codes are visible in the site's source,
  // so only list codes you are happy to be public.
  //   percent: 10      -> 10% off the subtotal
  //   flat: 50         -> Rs 50 off
  //   minSubtotal: 999 -> only on orders of Rs 999 or more (optional)
  coupons: {
    // 'DIWALI10': { percent: 10, minSubtotal: 999 },
  },

  // Shown in the cart and in the WhatsApp message.
  shippingNote: 'Shipping is added in the chat, based on your order and pincode.',
};
