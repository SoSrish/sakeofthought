/*
  The whole catalogue lives here. To change a price, edit the number and
  push. To add a product, copy an entry and give it a new id.

  kind: 'cup'    one cup, price is per piece and includes name + caricature
        'family' a fixed set sold as one item
        'zine'   a photo zine

  size: shown on the card and sent in the order message.
  hint: shown on the card only.
*/
window.SOT_DATA = {
  products: [
    { id: 'shape-1', kind: 'cup', shape: 1, name: 'Straight tumbler', size: '', price: 379, image: 'images/shape-1.jpg', fit: 'cover' },
    { id: 'shape-2', kind: 'cup', shape: 2, name: 'Short cup', size: '6 cm tall, 7 cm wide', price: 349, image: 'images/shape-2.jpg' },
    { id: 'shape-3', kind: 'cup', shape: 3, name: 'Handled mug (clay)', size: '9 cm tall, 11 cm wide', price: 449, image: 'images/shape-3.jpg' },
    { id: 'shape-4', kind: 'cup', shape: 4, name: 'Tea cup', size: '', hint: 'Price is for one cup', price: 349, image: 'images/shape-4.jpg' },
    { id: 'shape-5', kind: 'cup', shape: 5, name: 'Goblet', size: '', price: 599, image: 'images/shape-5.jpg' },
    { id: 'shape-6', kind: 'cup', shape: 6, name: 'Chai glass', size: '', price: 379, image: 'images/shape-6.jpg' },
    { id: 'shape-7', kind: 'cup', shape: 7, name: 'Black clay goblet', size: '12.5 cm tall, 5.5 cm wide', price: 649, image: 'images/shape-7.jpg' },
    { id: 'shape-8', kind: 'cup', shape: 8, name: 'Cane-handle cup', size: '2.9 in tall, 2.75 in wide', price: 399, image: 'images/shape-8.jpg' },
    {
      id: 'family-set', kind: 'family', shape: 9, name: 'Family set',
      size: '6 cups and 1 tray', price: 1299, image: 'images/shape-9.jpg',
      includes: 'Name, caricature and message on the set',
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
};
