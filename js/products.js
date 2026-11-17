/*
  The whole catalogue lives here. To change a price, edit the number and
  push. To add a product, copy an entry and give it a new id.

  kind: 'cup'    one cup, price is per piece and includes name + caricature
        'family' a fixed set sold as one item
        'zine'   a photo zine

  size: capacity (e.g. '200 ml'), shown on the card and sent in the order message.
  shape: the shape number customers see in the order message; keep it
         stable once used (new shapes take the next free number).
  hint: shown on the card only.
  image: the plain shape, on the shape card.
  painted: a finished example, in the "How it turns out" strip (optional).
*/
window.SOT_DATA = {
  products: [
    { id: 'shape-1', kind: 'cup', shape: 1, name: 'Straight tumbler', size: '200 ml', price: 379, image: 'images/shape-1.jpg', painted: 'images/painted-1.jpg', fit: 'cover' },
    { id: 'shape-2', kind: 'cup', shape: 2, name: 'Short cup', size: '120 ml', price: 349, image: 'images/shape-2.jpg', painted: 'images/painted-2.jpg' },
    { id: 'shape-3', kind: 'cup', shape: 3, name: 'Handled mug (clay)', size: '375 ml', price: 449, image: 'images/shape-3.jpg', painted: 'images/painted-3.jpg' },
    { id: 'shape-4', kind: 'cup', shape: 4, name: 'Tea cup', size: '150 ml', price: 349, image: 'images/shape-4.jpg', painted: 'images/painted-4.jpg', fit: 'cover' },
    { id: 'shape-10', kind: 'cup', shape: 10, name: 'Tea cup cone', size: '120 ml', price: 349, image: 'images/shape-10.jpg', painted: 'images/painted-10.jpg' },
    { id: 'shape-5', kind: 'cup', shape: 5, name: 'Goblet', size: '300 ml', price: 599, image: 'images/shape-5.jpg', painted: 'images/painted-5.jpg' },
    { id: 'shape-6', kind: 'cup', shape: 6, name: 'Curved Kullhad', size: '300 ml', price: 499, image: 'images/shape-6.jpg', painted: 'images/painted-6.jpg', fit: 'cover' },
    { id: 'shape-7', kind: 'cup', shape: 7, name: 'Black clay goblet', size: '275 ml', price: 649, image: 'images/shape-7.jpg', painted: 'images/painted-7.jpg' },
    { id: 'shape-11', kind: 'cup', shape: 11, name: 'Jaam', size: '200 ml', price: 379, image: 'images/shape-11.jpg', painted: 'images/painted-11.jpg' },
    { id: 'shape-12', kind: 'cup', shape: 12, name: 'Jaam', size: '400 ml', price: 499, image: 'images/shape-12.jpg', painted: 'images/painted-12.jpg' },
    { id: 'shape-8', kind: 'cup', shape: 8, name: 'Cane-handle cup', size: '120 ml', price: 399, image: 'images/shape-8.jpg', painted: 'images/painted-8.jpg' },
    {
      id: 'family-set', kind: 'family', shape: 9, name: 'Family set',
      size: '6 cups (200 ml each) and 1 tray', price: 1299, image: 'images/shape-9.jpg', painted: 'images/painted-9.jpg',
      includes: 'Name, caricature and message on the set',
    },

    /* Tote bags. price: null shows "Price on WhatsApp" until she sets one.
       fields: the blanks the customer fills in for that design.
         type 'text'  one line, max = characters
         type 'lines' one entry per line, maxLines entries of max characters */
    {
      id: 'tote-receipt', kind: 'tote', name: 'Emotional Baggage', blurb: 'A receipt of your places and people',
      price: null, image: 'images/tote-receipt-black.jpg',
      images: { black: 'images/tote-receipt-black.jpg', natural: 'images/tote-receipt-natural.jpg' },
      fields: [
        { id: 'name', label: 'Name on the receipt', type: 'text', max: 16, placeholder: 'JETI' },
        { id: 'items', label: 'Items and how many', type: 'lines', maxLines: 5, max: 26, placeholder: 'First cafe date - 1\nLong drives - 14\nBad jokes - infinite' },
      ],
    },
    {
      id: 'tote-boarding', kind: 'tote', name: 'Destination: Us', blurb: 'A boarding pass from where you met to where you are',
      price: null, image: 'images/tote-boarding-black.jpg',
      images: { black: 'images/tote-boarding-black.jpg', natural: 'images/tote-boarding-natural.jpg' },
      fields: [
        { id: 'names', label: 'Passenger names', type: 'text', max: 22, placeholder: 'JETI' },
        { id: 'from', label: 'Where you met', type: 'text', max: 22, placeholder: 'College canteen' },
        { id: 'to', label: 'Where you are now', type: 'text', max: 22, placeholder: 'Wherever you are' },
        { id: 'date', label: 'Date', type: 'text', max: 14, placeholder: '14 Feb 2024' },
        { id: 'seat', label: 'Seat line (optional)', type: 'text', max: 20, placeholder: 'Window, obviously' },
      ],
    },
    {
      id: 'tote-rx', kind: 'tote', name: "Doctor's Orders", blurb: 'A prescription of the things that make them better',
      price: null, image: 'images/tote-rx-black.jpg',
      images: { black: 'images/tote-rx-black.jpg', natural: 'images/tote-rx-natural.jpg' },
      fields: [
        { id: 'patient', label: 'Patient name', type: 'text', max: 16, placeholder: 'JETI' },
        { id: 'diagnosis', label: 'Diagnosis', type: 'text', max: 14, placeholder: 'Too cute' },
        { id: 'meds', label: 'Medicines and doses', type: 'lines', maxLines: 4, max: 34, placeholder: 'Chai - twice daily\nLong drives - as needed' },
        { id: 'doctor', label: 'Doctor (who it is from)', type: 'text', max: 16, placeholder: 'Dr. JETI' },
      ],
    },
    {
      id: 'tote-ingredients', kind: 'tote', name: 'Made With', blurb: 'An ingredients label for the person you love',
      price: null, image: 'images/tote-ingredients-black.jpg',
      images: { black: 'images/tote-ingredients-black.jpg', natural: 'images/tote-ingredients-natural.jpg' },
      fields: [
        { id: 'name', label: 'Name', type: 'text', max: 16, placeholder: 'JETI' },
        { id: 'ingredients', label: 'Ingredients and percentages', type: 'lines', maxLines: 4, max: 22, placeholder: 'Chai 40%\nOverthinking 25%\nChaos 15%' },
      ],
    },
    {
      id: 'tote-tape', kind: 'tote', name: 'Side A / Side B', blurb: 'A mixtape of your inside jokes',
      price: null, image: 'images/tote-tape-black.jpg',
      images: { black: 'images/tote-tape-black.jpg', natural: 'images/tote-tape-natural.jpg' },
      fields: [
        { id: 'name', label: 'Whose mixtape', type: 'text', max: 16, placeholder: 'JETI' },
        { id: 'tracks', label: 'Track list (inside jokes, not real songs)', type: 'lines', maxLines: 8, max: 22, placeholder: 'The auto ride\nYou stole my fries' },
      ],
    },

    { id: 'zine-5x4', kind: 'zine', name: 'Zine, 5 × 4 in', size: '5 × 4 inches', price: 79, image: 'images/zine-1.jpg' },
    { id: 'zine-8x5', kind: 'zine', name: 'Zine, 8 × 5 in', size: '8 × 5 inches', price: 119, image: 'images/zine-2.jpg' },
  ],

  // What gets painted on a single cup. Pick one; "hobbies" already
  // includes the message, so the two never add up.
  styles: [
    { id: 'base', label: 'Caricature and name', hint: 'Included in the price', add: 0 },
    { id: 'message', label: 'Caricature, name and message', hint: '', add: 50 },
    { id: 'hobbies', label: 'Caricature, name, hobbies and message', hint: 'Hobbies, favourites or personality traits', add: 250 },
  ],

  // More than one person painted on the same cup.
  extraPerson: { add: 75, max: 4 },

  // Couple set = two cups of the same shape with name, caricature and
  // message. Price is 2 x cup price + extra (349 x 2 + 1 = 699).
  // To set a specific price for one shape, add couplePrice: 899 to it.
  coupleSet: { extra: 1 },

  zinePages: '8 to 14 pages',

  toteColours: [
    { id: 'black', label: 'Black bag, white print' },
    { id: 'natural', label: 'Natural canvas, black print' },
  ],
};
