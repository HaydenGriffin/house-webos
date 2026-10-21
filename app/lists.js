/* Shopping lists: a to-do list's open items grouped by supermarket aisle, as the house's tablets group them. The aisle an
   item was given (an aisles sensor's `aisles` attribute, { aisle id: [item keys] }) wins; otherwise the keyword table below
   guesses; items for another shop ("Makkah: rice", "PL makaron", "(Polish shop)") get that shop's section after the aisles.
   Pure functions, so they run in Node for the tests. ES5 for the TV. */
(function () {
  'use strict';

  var AISLES = [
    ['produce', 'carrot', 'Fruit & veg', 'apple avocado banana berry berries blueberr broccoli cabbage carrot cauliflower celery cherry chilli coriander courgette cucumber garlic ginger grape herb kale kiwi leek lemon lettuce lime mango melon mint mushroom onion orange parsley parsnip peach pear pepper pineapple plum potato potat pumpkin radish rocket salad spinach spring onion squash strawberr sweetcorn tomato veg fruit beans green bean basil dill rosemary thyme beetroot aubergine asparagus jabłk banan cebul czosnek marchew ogór pomidor ziemniak sałat pietruszk koperek cytryn'],
    ['dairy', 'cheese', 'Dairy & eggs', 'egg milk butter cheese yogurt yoghurt cream skyr kefir halloumi mozzarella feta parmesan cheddar quark custard creme fraiche jaj mleko masło ser jogurt śmietan twaróg'],
    ['meat', 'foodSteak', 'Meat & fish', 'chicken beef pork lamb mince minced bacon ham sausage steak stake salmon tuna cod prawn fish turkey chorizo salami duck kurczak wołow wieprz szynk kiełbas ryb łosoś'],
    ['bakery', 'baguette', 'Bakery', 'bread bun buns roll bagel wrap tortilla croissant baguette pitta naan crumpet muffin cake chleb bułk'],
    ['frozen', 'snowflake', 'Frozen', 'frozen ice cream ice lolly peas chips pizza mrożon lody'],
    ['cupboard', 'packageVariantClosed', 'Cupboard', 'oat rice pasta noodle flour sugar salt pepper oil vinegar sauce ketchup mayo mustard stock spice paprika cumin cinnamon honey jam peanut butter nutella cereal granola chia seed nut almond lentil chickpea tin tinned can beans tomato puree passata soy coconut milk tea coffee cocoa chocolate biscuit crisps snack baking powder yeast vanilla dried syrup olive buttercream mąka cukier sól ryż makaron olej herbata kawa'],
    ['drinks', 'cupWater', 'Drinks', 'water juice squash cola lemonade beer wine prosecco gin vodka soda tonic sweet tea kombucha woda sok piwo wino'],
    ['toiletries', 'lotionOutline', 'Toiletries & health', 'toothpaste toothbrush shampoo conditioner soap shower gel deodorant razor tissue tissues toilet roll toilet paper cotton plaster paracetamol ibuprofen vitamin lotion sun cream suncream floss mouthwash tampon pad sanitary nappy wipes pasta do zębów papier toaletowy'],
    ['household', 'sprayBottle', 'Household', 'cif bleach detergent laundry washing up liquid dishwasher tablet sponge cloth bin bag bags foil clingfilm cling film kitchen roll baking paper battery batteries bulb candle cleaner spray softener fairy zip lock folia worki'],
  ];
  var OTHER = ['other', 'cartOutline', 'Other'];
  var ORDER = ['produce', 'bakery', 'meat', 'dairy', 'cupboard', 'drinks', 'frozen', 'household', 'toiletries', 'other'];
  /* "polish" only at the start, so furniture polish stays put. */
  var SHOPS = [
    ['polish', 'Polish shop', /\bpolish shop\b|^\s*(pl|polski|polish)\b/i],
    ['makkah', 'Makkah', /\bmakkah\b/i],
    ['home_bargains', 'Home Bargains', /\bhome ?bargains?\b|\bhomebargain/i],
  ];

  /* The key the house remembers an item's aisle by: lower case, no brackets or punctuation, a plural's s dropped. */
  function normalise(name) {
    return String(name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/ies$/, 'y').replace(/([a-z]{3})s$/, '$1');
  }
  function shopOf(name) {
    for (var i = 0; i < SHOPS.length; i++) if (SHOPS[i][2].test(String(name || ''))) return SHOPS[i];
    return null;
  }
  /* The name without its shop marker: "Makkah- rice" -> "Rice", "Berries (Polish shop)" -> "Berries". */
  function plainName(name) {
    var s = String(name || '').replace(/^\s*(makkah|home ?bargains?|homebargain|polish shop|polski|polish|pl)\b\s*[:\-–]?\s*/i, '')
      .replace(/\s*\((makkah|home ?bargains?|polish shop)\??\)/i, '').replace(/\s+(makkah|home ?bargains?|polish shop)\s*$/i, '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(name || '').trim();
  }
  /* { item key: aisle id } from an aisles sensor's `aisles` attribute ({ aisle id: [keys] }). */
  function known(aisles) {
    var out = {}, id, keys, i;
    for (id in aisles || {}) {
      if (!Object.prototype.hasOwnProperty.call(aisles, id)) continue;
      keys = aisles[id];
      if (Array.isArray(keys)) for (i = 0; i < keys.length; i++) out[keys[i]] = id;
    }
    return out;
  }
  function aisleById(id) {
    for (var i = 0; i < AISLES.length; i++) if (AISLES[i][0] === id) return { id: id, icon: AISLES[i][1], label: AISLES[i][2] };
    return { id: OTHER[0], icon: OTHER[1], label: OTHER[2] };
  }
  /* The remembered aisle, else the longest keyword found in the name, else Other. */
  function aisleOf(name, remembered) {
    var id = remembered && remembered[normalise(name)];
    if (id) return aisleById(id);
    var text = ' ' + String(name || '').toLowerCase() + ' ', best = null, bestLen = 0;
    for (var i = 0; i < AISLES.length; i++) {
      var words = AISLES[i][3].split(' ');
      for (var j = 0; j < words.length; j++) {
        if (words[j].length > 2 && text.indexOf(words[j]) >= 0 && words[j].length > bestLen) { best = AISLES[i][0]; bestLen = words[j].length; }
      }
    }
    return aisleById(best || OTHER[0]);
  }

  /* items: todo.get_items' items ({ uid, summary, status, description? }). Open ones only, in sections:
     [{ id, label, icon, items: [{ uid, name, item }] }], the aisles in walking order, then each other shop. aisles: the sensor's
     `aisles` attribute, or null to keep one plain section in the list's own order. */
  function group(items, aisles, grouped) {
    var open = (items || []).filter(function (it) { return it && it.status !== 'completed' && it.summary; });
    if (!grouped) return open.length ? [{ id: 'all', label: '', icon: '', items: open.map(row) }] : [];
    var remembered = known(aisles), by = {};
    open.forEach(function (it) {
      var shop = shopOf(it.summary), key = shop ? 'shop:' + shop[0] : aisleOf(it.summary, remembered).id;
      (by[key] = by[key] || []).push(row(it));
    });
    var out = [];
    ORDER.forEach(function (id) { if (by[id]) out.push({ id: id, label: aisleById(id).label, icon: aisleById(id).icon, items: by[id] }); });
    SHOPS.forEach(function (s) { if (by['shop:' + s[0]]) out.push({ id: 'shop:' + s[0], label: s[1], icon: 'storefrontOutline', items: by['shop:' + s[0]] }); });
    return out;
  }
  function row(it) { return { uid: it.uid, name: shopOf(it.summary) ? plainName(it.summary) : String(it.summary).trim(), item: it }; }

  window.HouseLists = { normalise: normalise, aisleOf: aisleOf, plainName: plainName, group: group };
})();
