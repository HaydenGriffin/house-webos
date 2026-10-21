/* Themes. The default look is style.css alone and this script changes nothing for it. A theme is one more stylesheet
   laid over style.css, chosen by "theme" in the config (or ?theme= in the URL, for trying one in the demo); its fonts
   are fetched only when it's chosen. An unknown name keeps the default look. */
(function () {
  'use strict';

  var THEMES = { afterglow: 'themes/afterglow/afterglow.css' };
  var SHOW_ANYWAY_MS = 2000;

  function pick(config, search) {
    var m = /[?&]theme=([A-Za-z0-9_-]+)/.exec(search || '');
    var name = String((m && m[1]) || (config && config.theme) || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(THEMES, name) ? name : '';
  }

  /* The page stays transparent until the theme's stylesheet is in, so the default look never flashes first; opacity
     rather than visibility, because app.js gives the first control focus meanwhile and hidden controls can't take it.
     If the sheet can't load, the theme is dropped and the default look shows. */
  function apply(doc, name, later) {
    if (!name) return null;
    var root = doc.documentElement, body = doc.body, link = doc.createElement('link'), shown = false;
    function show() { if (!shown) { shown = true; body.style.opacity = ''; } }
    root.setAttribute('data-theme', name);
    body.style.opacity = '0';
    link.rel = 'stylesheet';
    link.href = THEMES[name];
    link.onload = show;
    link.onerror = function () { root.removeAttribute('data-theme'); show(); };
    (later || setTimeout)(show, SHOW_ANYWAY_MS);
    doc.getElementsByTagName('head')[0].appendChild(link);
    return link;
  }

  window.HOUSE_THEME = { themes: THEMES, pick: pick, apply: apply };
  apply(document, pick(window.HOUSE_CONFIG, location.search));
})();
