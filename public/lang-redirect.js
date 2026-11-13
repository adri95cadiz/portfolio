/* Language by browser preference on first visit (or the one the visitor picked). Crawlers are never redirected,
   so both / and /en/ get indexed and hreflang does the matching. */
(function () {
  try {
    if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent)) return;
    var here = document.documentElement.lang === 'en' ? 'en' : 'es';
    var saved = localStorage.getItem('ap-lang');
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    var want = saved || (/^es/i.test(langs[0]) || langs.some(function (l) { return /^es/i.test(l); }) && !/^en/i.test(langs[0]) ? 'es' : 'en');
    if (!saved) localStorage.setItem('ap-lang', want);
    if (want !== here) location.replace((want === 'en' ? '/en/' : '/') + location.search + location.hash);
  } catch (e) { /* storage blocked: stay on this page */ }
})();
  
