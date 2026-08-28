// Resolve a school name - either our canonical name or the way an opponent
// feed spells it - to its logo slug, or null if it is not a Big North school.
// Used by split-schedule.js to tag each served game with the crest(s) the
// calendar should show: the reporting school always, and the opponent too when
// the opponent is also a conference school.
//
// Deliberately conservative: a wrong crest is worse than a missing one, so a
// name that does not clearly resolve returns null and simply shows no crest.

const path = require('path');
const schools = require(path.join(__dirname, '..', 'data', 'schools.json'));
const LIST = Array.isArray(schools) ? schools : (schools.schools || schools);

function norm(s) {
    return String(s || '').toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\bsaint\b/g, 'st')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(high|school|schools|regional|senior|hs|the)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

// canonical name -> slug
const BY_KEY = new Map();
for (const s of LIST) BY_KEY.set(norm(s.name), s.slug);

// Shorter spellings opponents commonly use that the canonical normalisation
// misses. "Northern Valley Regional High" with no Demarest/Old Tappan suffix is
// intentionally absent - it cannot be told apart from the other NV school, so
// those games show one crest rather than risk the wrong one.
const ALIASES = {
    'holy angels': 'holy-angels',
    'academy of holy angels': 'holy-angels',
    'iha': 'immaculate-heart',
    'immaculate heart': 'immaculate-heart',
    'st joseph': 'st-joseph',
    'st joseph montvale': 'st-joseph',
    'st josephs': 'st-joseph',
    'bergen tech': 'bergen-tech',
    'bergen county tech': 'bergen-tech',
    'bergen county technical': 'bergen-tech',
    'depaul': 'depaul-catholic',
    'de paul': 'depaul-catholic',
    'de paul catholic': 'depaul-catholic',
    'don bosco': 'don-bosco',
    'don bosco prep': 'don-bosco',
    'dwight morrow': 'dwight-morrow',
    'fairlawn': 'fair-lawn',
    'pcti': 'passaic-county-tech',
    'passaic county tech': 'passaic-county-tech',
    'passaic county technical': 'passaic-county-tech',
    'passaic tech': 'passaic-county-tech',
    'nv demarest': 'nv-demarest',
    'northern valley demarest': 'nv-demarest',
    'demarest': 'nv-demarest',
    'nv old tappan': 'nv-old-tappan',
    'northern valley old tappan': 'nv-old-tappan',
    'old tappan': 'nv-old-tappan',
};

function logoSlug(name) {
    const k = norm(name);
    if (!k) return null;
    if (BY_KEY.has(k)) return BY_KEY.get(k);
    if (ALIASES[k]) return ALIASES[k];
    return null;
}

module.exports = { logoSlug, norm };
