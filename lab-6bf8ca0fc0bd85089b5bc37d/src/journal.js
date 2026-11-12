"use strict";

const Journal = (() => {
  const labels = Object.freeze({ orbit: "Soustava", surface: "Povrch a klima", civic: "Civilizace" });
  const inferred = new WeakMap();

  function category(entry) {
    if (Object.hasOwn(labels, entry.category)) return entry.category;
    if (inferred.has(entry)) return inferred.get(entry);
    const kind = entry.kind ?? "", message = entry.message ?? "";
    let result = "other";

    // Older positions have event text and a handful of structured event kinds.
    if (/^(world-loss|crew-loss|flight-|orbit-)/.test(kind)) result = "orbit";
    else if (/^(settlement-|population-anomaly|patron-)/.test(kind)) result = "civic";
    else if (/vytvořil kráter|poškodil širší okolí kráteru/i.test(message)) result = "surface";
    else if (/dráh|gravita|oběžn|soustav|byla vypuštěna|přesun pásma|míří do slunce|průlet|asteroid|komet|družic|sond|vzorky ze světa|kosmodrom|meziplanetární|odstart|náklad|osídlovací loď/i.test(message)) result = "orbit";
    else if (/mraz|mráz|mrzn|obleva|bouř|srážk|blesk|požár|such|láv|povod|záplav|zaplavení|vegetac|zeleň|mikrob|původní život|biosfér|první zvěř|porost|ochlad|ohřev|ledová pokrývka|útočišti/i.test(message)) result = "surface";
    else if (/osad|kmen|civiliz|výprav|patron|základn|elektrár|teraformer|zásob|měst|výzkum|monument|přístav|obchod|střet|boj|obrán|lovc|hlad|vír|těžeb|továrn|vlád|soběstač|převah|soupeření|sdílejí/i.test(message)) result = "civic";
    inferred.set(entry, result);
    return result;
  }

  const routine = entry => /vysílá lovce za stádem|hledá vodu a potravu/i.test(entry.message);

  function matches(entry, scope, quiet = false) {
    return (scope === "all" || category(entry) === scope) && (!quiet || !routine(entry));
  }

  return { labels, category, matches };
})();
