/**
 * tri.js — Moteur d'analyse des consignes de tri
 * ---------------------------------------------------------------------------
 * Transforme les données brutes d'emballage (Open Food / Beauty / Products
 * Facts) en consignes de tri concrètes, conformes aux règles belges en
 * vigueur (Fost Plus — nouveau sac bleu P+MC — et intercommunales type
 * Intradel pour la Province de Liège).
 *
 * Pipeline :
 *   1. Sélection de la meilleure source de données (cascade de fiabilité)
 *   2. Extraction des composants (matériau + forme + code de recyclage)
 *   3. Résolution matériau × forme → catégorie de tri + conseil de préparation
 *   4. Fusion / déduplication + calcul d'un indice de fiabilité
 *   5. Génération des consignes en français naturel
 *
 * Contrat public (inchangé pour l'UI) :
 *   analyserEmballage(donneesBrutes) -> { composants, instructions, ... }
 *   où composants = [{ description, categorie, ...métadonnées }]
 * ---------------------------------------------------------------------------
 */

export const CATEGORIES = {
    pmc:      { title: 'Sac bleu (PMC)',     icon: 'recycling',   cssClass: 'bg-guide-pmc',      iconColor: '#FFF',                          guideType: 'pmc' },
    paper:    { title: 'Papiers & cartons',  icon: 'description', cssClass: 'bg-guide-paper',    iconColor: 'var(--color-guide-paper-text)', guideType: 'paper' },
    glass:    { title: 'Verre',              icon: 'liquor',      cssClass: 'bg-guide-glass',    iconColor: '#FFF',                          guideType: 'glass' },
    organic:  { title: 'Déchets organiques', icon: 'compost',     cssClass: 'bg-guide-organic',  iconColor: '#FFF',                          guideType: 'organic' },
    residual: { title: 'Déchets résiduels',  icon: 'delete',      cssClass: 'bg-guide-residual', iconColor: '#FFF',                          guideType: 'residual' },
    danger:   { title: 'Recyparc',           icon: 'warning',     cssClass: 'bg-guide-danger',   iconColor: '#FFF',                          guideType: 'danger' },
};

const NOMS_CATEGORIES = {
    pmc:      'le sac bleu (PMC)',
    paper:    'la collecte papiers-cartons',
    glass:    'la bulle à verre',
    organic:  'la collecte des déchets organiques',
    residual: 'la poubelle des déchets résiduels',
    danger:   'un Recyparc (déchet spécial)',
};

// Niveaux de fiabilité d'un composant détecté.
const FIABILITE = { HAUTE: 3, MOYENNE: 2, FAIBLE: 1 };

/* ===========================================================================
 * 1. TAXONOMIE DES MATÉRIAUX
 * Chaque matériau canonique pointe vers une catégorie par défaut. La forme
 * de l'emballage (voir plus bas) peut affiner ce choix.
 * =========================================================================== */

const MATERIAUX = {
    // Plastiques (tous acceptés dans le nouveau sac bleu belge)
    pet:        { categorie: 'pmc',      label: 'Plastique PET',                 code: 'PET 1' },
    hdpe:       { categorie: 'pmc',      label: 'Plastique PEHD',                code: 'PE-HD 2' },
    pvc:        { categorie: 'pmc',      label: 'Plastique PVC',                 code: 'PVC 3' },
    ldpe:       { categorie: 'pmc',      label: 'Plastique souple PEBD',         code: 'PE-LD 4' },
    pp:         { categorie: 'pmc',      label: 'Plastique PP',                  code: 'PP 5' },
    ps:         { categorie: 'pmc',      label: 'Plastique PS',                  code: 'PS 6' },
    plastique:  { categorie: 'pmc',      label: 'Emballage en plastique' },
    film:       { categorie: 'pmc',      label: 'Film / sac plastique' },
    // Exceptions plastiques NON recyclables → résiduels
    eps:        { categorie: 'residual', label: 'Polystyrène expansé (frigolite)' },
    multicouche:{ categorie: 'residual', label: 'Emballage multicouche / complexe' },
    bioplastique:{ categorie: 'residual', label: 'Plastique compostable' },
    // Métaux (sac bleu)
    aluminium:  { categorie: 'pmc',      label: 'Emballage en aluminium',        code: 'ALU 41' },
    acier:      { categorie: 'pmc',      label: 'Emballage en acier',            code: 'FE 40' },
    metal:      { categorie: 'pmc',      label: 'Emballage métallique' },
    // Cartons à boisson (sac bleu)
    brique:     { categorie: 'pmc',      label: 'Carton à boisson (brique)' },
    // Verre (bulle à verre)
    verre:      { categorie: 'glass',    label: 'Emballage en verre',            code: 'GL 70' },
    // Papier / carton
    papier:     { categorie: 'paper',    label: 'Emballage en papier',           code: 'PAP 22' },
    carton:     { categorie: 'paper',    label: 'Emballage en carton',           code: 'C/PAP 81' },
    // Divers
    bois:       { categorie: 'residual', label: 'Emballage en bois',             code: 'FOR 50' },
    liege:      { categorie: 'residual', label: 'Bouchon en liège' },
    textile:    { categorie: 'residual', label: 'Textile / fibre' },
    ceramique:  { categorie: 'danger',   label: 'Céramique / porcelaine' },
    // Déchets spéciaux → Recyparc
    pile:       { categorie: 'danger',   label: 'Pile / batterie' },
    deee:       { categorie: 'danger',   label: 'Déchet électrique/électronique (DEEE)' },
    dangereux:  { categorie: 'danger',   label: 'Produit dangereux / chimique' },
};

const LIBELLE_FORME = {
    bouteille: 'Bouteille', flacon: 'Flacon', canette: 'Canette', conserve: 'Boîte de conserve',
    bocal: 'Bocal', pot: 'Pot', barquette: 'Barquette', film: 'Film', sachet: 'Sachet',
    couvercle: 'Couvercle', bouchon: 'Bouchon', etui: 'Étui', boite: 'Boîte', tube: 'Tube',
    brique: 'Brique', etiquette: 'Étiquette',
};

/* ===========================================================================
 * 2. RÈGLES DE DÉTECTION SUR TEXTE LIBRE
 * Ordonnées : les cas spécifiques avant les cas génériques. Le texte est
 * d'abord normalisé (minuscules, sans accents), les motifs sont donc écrits
 * sans accents.
 * =========================================================================== */

const REGLES_MATERIAU = [
    // --- Déchets spéciaux (priorité absolue) ---
    { re: /\bpiles?\b|\bbatteries?\b|accumulateur|\bdeee\b|electronique|electrique|ampoule|tube\s+neon|cartouche\s+d.encre/i, mat: 'pile' },
    { re: /produit\s+(chimique|toxique|dangereux)|solvant|peinture|aerosol\s+(sous\s+pression|de\s+peinture)|bouchon\s+de\s+securite\s+enfant|insecticide|pesticide/i, mat: 'dangereux' },

    // --- Exceptions plastiques (avant le plastique générique) ---
    { re: /frigolite|polystyrene\s+expanse|\beps\b|styrofoam|barquette\s+(de\s+)?(viande|fruits?)\s+(en\s+)?polystyrene/i, mat: 'eps' },
    { re: /multicouche|multi[\s-]?couche|complexe(\s+plast)?|aluminis|metallis|doypack|gourde\s+souple/i, mat: 'multicouche' },

    // --- Exceptions papier (avant le papier générique) ---
    { re: /papier\s+(de\s+)?cuiss?on|papier\s+sulfurise|baking\s+paper|papier\s+(gras|souille|absorbant|peint)|essuie[\s-]?tout|mouchoir/i, categorie: 'residual', label: 'Papier souillé / cuisson' },

    // --- Cartons à boisson (avant carton générique) ---
    { re: /brique[s]?\s+(de\s+|alimentaire)|carton[s]?\s+a\s+boisson|tetra[\s-]?pak?|elopak|combibloc/i, mat: 'brique' },

    // --- Codes résine plastiques (spécifiques) ---
    { re: /\bpete?\b|polyethylene\s+terephtalate|\b0?1\s*pet/i, mat: 'pet' },
    { re: /\bpehd\b|\bhdpe\b|\bpe-?hd\b|polyethylene\s+haute\s+densite|\b0?2\s*pe/i, mat: 'hdpe' },
    { re: /\bpvc\b|polychlorure|\b0?3\s*pvc/i, mat: 'pvc' },
    { re: /\bpebd\b|\bldpe\b|\bpe-?ld\b|polyethylene\s+basse\s+densite|\b0?4\s*pe/i, mat: 'ldpe' },
    { re: /\bpp\b|polypropylene|\b0?5\s*pp/i, mat: 'pp' },
    { re: /\bps\b|polystyrene(?!\s+expanse)|\b0?6\s*ps/i, mat: 'ps' },
    { re: /\bpla\b|acide\s+polylactique|biosource/i, mat: 'bioplastique' },

    // --- Compostable certifié → organique ---
    { re: /compostable|biodegradable|ok\s+compost|home\s+compost/i, categorie: 'organic', label: 'Emballage compostable certifié' },

    // --- Plastiques génériques ---
    { re: /polyester|sachet|sac\s+plast|pochette|blister|opercule|barquette\s+plast|pot\s+plast|tube\s+plast|flacon\s+plast|bouteille\s+plast|bidon|film\s+plast|cellophane|kunststof/i, mat: 'plastique' },
    { re: /\bfilm\b|wrapper|emballage\s+souple/i, mat: 'film' },
    { re: /plastique|plastic\b/i, mat: 'plastique' },

    // --- Métaux ---
    { re: /aluminium|aluminum|\balu\b|papier\s+(d.)?alu/i, mat: 'aluminium' },
    { re: /acier|fer\s+blanc|fer-blanc|tinplate|\bblik\b/i, mat: 'acier' },
    { re: /canette|cannette|boite\s+(de\s+)?conserve|conserve|capsule|opercule\s+metal|barquette\s+(alu|metal)|metaal|\bzinc\b|\bfer\b|\bmetal\b/i, mat: 'metal' },

    // --- Verre ---
    { re: /\bverre\b|\bglass\b|\bglas\b|bocal|bouteille\s+(en\s+)?verre|pot\s+(en\s+)?verre|flacon\s+(en\s+)?verre/i, mat: 'verre' },

    // --- Papier / carton ---
    { re: /\bcarton\b|cardboard|karton|boite\s+(en\s+)?carton|emballage\s+carton|\bc\/pap\b|ondule/i, mat: 'carton' },
    { re: /\bpapier\b|\bpaper\b|kraft|notice|brochure|etui|etiquette|\bpap\b/i, mat: 'papier' },

    // --- Divers ---
    { re: /\bbois\b|\bwood\b|\bhout\b/i, mat: 'bois' },
    { re: /\bliege\b|\bcork\b|kurk/i, mat: 'liege' },
    { re: /\btextile\b|\bcoton\b|\bjute\b|tissu/i, mat: 'textile' },
    { re: /ceramique|porcelaine|faience|\bgres\b/i, mat: 'ceramique' },
];

/* ===========================================================================
 * 3. FORMES D'EMBALLAGE (pour affiner la catégorie et le conseil)
 * =========================================================================== */

const REGLES_FORME = [
    { re: /bouteille|bottle|fles/i,                 forme: 'bouteille' },
    { re: /flacon/i,                                forme: 'flacon' },
    { re: /canette|cannette|drink[\s-]?can|\bcan\b/i, forme: 'canette' },
    { re: /boite\s+(de\s+)?conserve|conserve|food[\s-]?can|tin[\s-]?can/i, forme: 'conserve' },
    { re: /bocal|jar/i,                             forme: 'bocal' },
    { re: /\bpot\b|\btub\b|ravier|godet/i,          forme: 'pot' },
    { re: /barquette|tray/i,                        forme: 'barquette' },
    { re: /\bfilm\b|wrapper|cellophane/i,           forme: 'film' },
    { re: /\bsachet\b|\bsac\b|\bbag\b|pochette/i,   forme: 'sachet' },
    { re: /couvercle|\blid\b|opercule/i,            forme: 'couvercle' },
    { re: /bouchon|\bcap\b|capsule/i,               forme: 'bouchon' },
    { re: /\betui\b|sleeve|fourreau|manchon/i,      forme: 'etui' },
    { re: /\bboite\b|\bbox\b/i,                     forme: 'boite' },
    { re: /\btube\b/i,                              forme: 'tube' },
    { re: /brique|brick|tetra/i,                    forme: 'brique' },
    { re: /\betiquette\b|label/i,                   forme: 'etiquette' },
];

/* ===========================================================================
 * 4. CORRESPONDANCE TAGS OFF NORMALISÉS → matériau / forme
 * Couvre la taxonomie Open Food Facts (packaging_materials_tags,
 * packaging_shapes_tags et le tableau structuré v2 `packagings`).
 * =========================================================================== */

const TAG_MATERIAU = {
    'en:plastic': 'plastique', 'fr:plastique': 'plastique',
    'en:pet': 'pet', 'en:pet-polyethylene-terephthalate': 'pet', 'en:1-pet-pete': 'pet', 'en:opaque-pet': 'pet',
    'en:hdpe-high-density-polyethylene': 'hdpe', 'en:2-pehd-hdpe': 'hdpe', 'en:pehd': 'hdpe',
    'en:pvc-polyvinyl-chloride': 'pvc', 'en:3-pvc-v': 'pvc',
    'en:ldpe-low-density-polyethylene': 'ldpe', 'en:4-pebd-ldpe': 'ldpe',
    'en:pp-polypropylene': 'pp', 'en:5-pp-polypropylene': 'pp',
    'en:ps-polystyrene': 'ps', 'en:6-ps-polystyrene': 'ps',
    'en:eps-expanded-polystyrene': 'eps', 'en:expanded-polystyrene': 'eps',
    'en:other-plastics': 'plastique', 'en:7-o-other-plastics': 'plastique',
    'en:pla-polylactic-acid': 'bioplastique', 'en:bioplastic': 'bioplastique',
    'en:aluminium': 'aluminium', 'en:aluminum': 'aluminium', 'en:41-alu': 'aluminium',
    'en:steel': 'acier', 'en:40-fe': 'acier', 'en:tinplate': 'acier',
    'en:metal': 'metal',
    'en:glass': 'verre', 'en:71-clear-glass': 'verre', 'en:72-green-glass': 'verre', 'en:73-brown-glass': 'verre',
    'en:paper': 'papier', 'en:22-pap': 'papier',
    'en:cardboard': 'carton', 'en:corrugated-cardboard': 'carton', 'en:non-corrugated-cardboard': 'carton',
    'en:paperboard': 'carton', 'en:81-c-pap': 'carton', 'en:84-c-pap': 'carton',
    'en:beverage-carton': 'brique', 'en:tetra-pak': 'brique',
    'en:wood': 'bois', 'en:50-for': 'bois',
    'en:cork': 'liege', 'en:textile': 'textile', 'en:cotton': 'textile',
    'en:ceramic': 'ceramique', 'en:porcelain': 'ceramique',
};

const TAG_FORME = {
    'en:bottle': 'bouteille', 'en:flacon': 'flacon',
    'en:can': 'canette', 'en:drink-can': 'canette', 'en:beverage-can': 'canette',
    'en:food-can': 'conserve', 'en:tin-can': 'conserve',
    'en:jar': 'bocal', 'en:pot': 'pot', 'en:tub': 'pot',
    'en:tray': 'barquette', 'en:film': 'film', 'en:plastic-film': 'film', 'en:wrapper': 'film',
    'en:bag': 'sachet', 'en:sachet': 'sachet', 'en:pouch': 'sachet',
    'en:lid': 'couvercle', 'en:cap': 'bouchon', 'en:bottle-cap': 'bouchon',
    'en:sleeve': 'etui', 'en:box': 'boite', 'en:case': 'boite',
    'en:tube': 'tube', 'en:brick': 'brique', 'en:label': 'etiquette',
    'en:blister': 'film',
};

// Repli par sous-chaîne pour les tags hors liste (maximise la couverture).
function tagVersMateriau(tag) {
    if (TAG_MATERIAU[tag]) return TAG_MATERIAU[tag];
    if (/glass|verre/.test(tag)) return 'verre';
    if (/cardboard|carton/.test(tag)) return 'carton';
    if (/paper|papier/.test(tag)) return 'papier';
    if (/alumin/.test(tag)) return 'aluminium';
    if (/steel|tinplate|acier/.test(tag)) return 'acier';
    if (/metal/.test(tag)) return 'metal';
    if (/wood|bois/.test(tag)) return 'bois';
    if (/expanded-polystyrene|styrofoam/.test(tag)) return 'eps';
    if (/plastic|plastique|\bpet\b|hdpe|ldpe|polypropylene|polyethylene/.test(tag)) return 'plastique';
    return null;
}

/* ===========================================================================
 * 5. RÉSOLUTION matériau × forme → composant de tri
 * =========================================================================== */

// Conseils de préparation selon la forme (ou, à défaut, la catégorie).
function conseilPreparation(categorie, forme) {
    if (categorie === 'glass')    return 'videz les contenants en verre (inutile de les rincer) et retirez bouchons et couvercles';
    if (categorie === 'danger')   return 'ne jetez jamais ces éléments avec les ordures ménagères, déposez-les au Recyparc';
    if (categorie === 'pmc') {
        if (forme === 'bouteille' || forme === 'flacon') return 'videz et aplatissez les bouteilles puis revissez le bouchon';
        if (forme === 'canette')   return 'videz les canettes sans les écraser complètement';
        if (forme === 'conserve')  return 'videz les boîtes de conserve';
        if (forme === 'brique')    return 'videz et aplatissez les briques';
        if (forme === 'film' || forme === 'sachet') return 'glissez les films et sachets vides en vrac dans le sac';
    }
    if (categorie === 'paper' && (forme === 'boite' || forme === 'etui')) return 'aplatissez les cartons propres et secs';
    return null;
}

// Construit un composant complet à partir d'un matériau (clé MATERIAUX),
// d'une forme éventuelle et de surcharges (label/catégorie explicites).
function construireComposant(mat, forme, surcharge = {}, fiabilite = FIABILITE.MOYENNE) {
    const base = mat && MATERIAUX[mat] ? MATERIAUX[mat] : null;
    const categorie = surcharge.categorie || (base && base.categorie);
    if (!categorie) return null;

    let label = surcharge.label || (base && base.label) || 'Emballage';
    // Affine le libellé avec la forme quand c'est pertinent.
    if (forme && base && !surcharge.label) {
        const formeLisible = LIBELLE_FORME[forme];
        if (formeLisible) label = `${formeLisible} — ${base.label.toLowerCase()}`;
    }

    return {
        description: label,
        categorie,
        materiau: mat || null,
        forme: forme || null,
        code: (base && base.code) || null,
        conseil: conseilPreparation(categorie, forme),
        fiabilite,
    };
}

/* ===========================================================================
 * 6. EXTRACTEURS PAR SOURCE
 * =========================================================================== */

function normaliser(texte) {
    return String(texte).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normaliserTag(tag) {
    // Les tags OFF arrivent parfois sans préfixe de langue.
    const t = String(tag).toLowerCase().trim();
    return t.includes(':') ? t : `en:${t}`;
}

function detecterForme(texteNorm) {
    for (const r of REGLES_FORME) if (r.re.test(texteNorm)) return r.forme;
    return null;
}

function detecterMateriau(texteNorm) {
    for (const regle of REGLES_MATERIAU) {
        if (regle.re.test(texteNorm)) {
            return { mat: regle.mat || null, categorie: regle.categorie, label: regle.label };
        }
    }
    return null;
}

// 6.a — Tableau structuré OFF v2 (`packagings`) : source la plus fiable.
function extraireDepuisStructure(donnees) {
    const liste = Array.isArray(donnees.packagings) ? donnees.packagings : [];
    const composants = [];

    for (const item of liste) {
        const matTag = item.material || item.material_tag || null;
        const formeTag = item.shape || item.shape_tag || null;
        const mat = matTag ? tagVersMateriau(normaliserTag(matTag)) : null;
        const forme = formeTag ? (TAG_FORME[normaliserTag(formeTag)] || null) : null;
        if (!mat) continue;

        const comp = construireComposant(mat, forme, {}, FIABILITE.HAUTE);
        if (comp) composants.push(comp);
    }
    return composants;
}

// 6.b — Texte libre (packaging_text_fr / packaging_text / packaging legacy).
function extraireDepuisTexte(texte) {
    const fragments = String(texte).split(/[\n\r;,•·]+|\s\+\s/);
    const composants = [];

    for (const frag of fragments) {
        const propre = frag
            .replace(/^\s*\d+\s*([×xX]\s*)?/, '')          // "2x ", "1 "
            .replace(/\s+a\s+recycler\.?\s*$/i, '')
            .replace(/\s+recyclable\.?\s*$/i, '')
            .replace(/\s+a\s+jeter\.?\s*$/i, '')
            .trim();
        if (propre.length < 3) continue;

        const norm = normaliser(propre);
        const hit = detecterMateriau(norm);
        if (!hit) continue;

        const forme = detecterForme(norm);
        const comp = construireComposant(hit.mat, forme, hit, FIABILITE.MOYENNE);
        if (!comp) continue;

        // On préfère le libellé réel saisi dans la fiche produit (plus parlant).
        comp.description = propre.charAt(0).toUpperCase() + propre.slice(1);
        composants.push(comp);
    }
    return composants;
}

// 6.c — Tags normalisés (packaging_tags + materials/shapes).
function extraireDepuisTags(donnees) {
    const matTags = [
        ...(donnees.packaging_materials_tags || []),
        ...(donnees.packaging_tags || []),
    ];
    const shapeTags = donnees.packaging_shapes_tags || [];
    const matUniques = [...new Set(matTags.map(tagVersMateriau).filter(Boolean))];

    // Une forme « globale » n'est appliquée que si l'emballage est mono-matériau
    // et mono-forme (sinon on risque d'associer la mauvaise forme au matériau).
    const formeGlobale = (shapeTags.length === 1 && matUniques.length === 1)
        ? (TAG_FORME[shapeTags[0]] || null)
        : null;

    const composants = [];
    for (const tag of matTags) {
        const mat = tagVersMateriau(tag);
        if (!mat) continue;
        const comp = construireComposant(mat, formeGlobale, {}, FIABILITE.MOYENNE);
        if (comp) composants.push(comp);
    }
    return composants;
}

// 6.d — Estimation de repli à partir de la catégorie produit (faible fiabilité).
// Remplace l'ancien message « pas assez de données » par une hypothèse plausible.
const ESTIMATIONS_CATEGORIE = [
    { re: /\b(eaux?|water|sodas?|soft-drink|limonade|jus|juice|boissons?|beverage)\b/i, mat: 'pet',    forme: 'bouteille' },
    { re: /\b(bieres?|beer|vins?|wine|spiritueux)\b/i,                                  mat: 'verre',  forme: 'bouteille' },
    { re: /\b(conserves?|canned|thon|sardine|legumes?-en-conserve)\b/i,                 mat: 'acier',  forme: 'conserve' },
    { re: /\b(yaourts?|yogurt|yoghurt|creme-fraiche|desserts?-lactes?)\b/i,              mat: 'pp',     forme: 'pot' },
    { re: /\b(biscuits?|cereales?|pates|pasta|riz|farines?|sucres?)\b/i,                 mat: 'carton', forme: 'boite' },
    { re: /\b(laits?|milk)\b/i,                                                          mat: 'brique', forme: 'brique' },
    { re: /\b(shampoings?|shampoo|gel-douche|savon-liquide|cosmetics?|lotions?)\b/i,     mat: 'hdpe',   forme: 'flacon' },
];

function estimerDepuisCategorie(donnees) {
    const source = normaliser([
        donnees.categories || '',
        (donnees.categories_tags || []).join(' '),
    ].join(' '));
    if (!source.trim()) return [];

    for (const est of ESTIMATIONS_CATEGORIE) {
        if (est.re.test(source)) {
            const comp = construireComposant(est.mat, est.forme, {}, FIABILITE.FAIBLE);
            if (comp) {
                comp.description += ' (estimation)';
                comp.estimation = true;
                return [comp];
            }
        }
    }
    return [];
}

/* ===========================================================================
 * 7. FUSION / DÉDUPLICATION
 * =========================================================================== */

function fusionner(composants) {
    const vus = new Map();
    for (const c of composants) {
        // Clé : catégorie + matériau + forme (évite les doublons stricts).
        const cle = `${c.categorie}|${c.materiau || ''}|${c.forme || ''}`;
        const existant = vus.get(cle);
        if (!existant || c.fiabilite > existant.fiabilite) {
            vus.set(cle, c);
        }
    }
    return Array.from(vus.values());
}

/* ===========================================================================
 * 8. GÉNÉRATION DES CONSIGNES EN FRANÇAIS
 * =========================================================================== */

function listerNaturellement(items) {
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];
}

function genererInstructions(composants) {
    if (composants.length === 0) return null;

    // Regroupement par catégorie.
    const parCategorie = {};
    composants.forEach(c => {
        (parCategorie[c.categorie] ||= []).push(c.description.toLowerCase());
    });

    const parties = Object.entries(parCategorie).map(([cat, descs]) => {
        const uniques = [...new Set(descs)];
        return `${listerNaturellement(uniques)} dans ${NOMS_CATEGORIES[cat]}`;
    });

    let phrase;
    if (parties.length === 1) {
        phrase = `Placez ${parties[0]}.`;
    } else {
        const derniere = parties.pop();
        phrase = `Séparez les éléments avant de trier : ${parties.join(', ')} et ${derniere}.`;
    }

    // Conseils de préparation (dédupliqués).
    const conseils = [...new Set(composants.map(c => c.conseil).filter(Boolean))];
    if (conseils.length > 0) {
        const formate = conseils.map(c => c.charAt(0).toUpperCase() + c.slice(1));
        phrase += ` Pensez à : ${formate.join(' ; ')}.`;
    }

    // Avertissement si les consignes reposent sur une estimation.
    if (composants.some(c => c.estimation)) {
        phrase += ' Ces consignes sont estimées d’après la catégorie du produit : vérifiez l’emballage réel.';
    }

    return phrase;
}

/* ===========================================================================
 * 9. POINT D'ENTRÉE PUBLIC
 * =========================================================================== */

/**
 * Analyse les données brutes d'un produit et retourne les consignes de tri.
 * Parcourt les sources de la plus fiable à la moins fiable.
 *
 * @param {Object} donneesBrutes - Données brutes d'une instance Open*Facts
 * @returns {{ composants: Array, instructions: string|null, source: string, fiabilite: string }}
 */
export function analyserEmballage(donneesBrutes) {
    if (!donneesBrutes || typeof donneesBrutes !== 'object') {
        return resultatVide();
    }

    // Cascade de sources, de la plus fiable à la plus incertaine.
    const sources = [
        { id: 'structure', extraire: () => extraireDepuisStructure(donneesBrutes) },
        { id: 'texte_fr',  extraire: () => texteValide(donneesBrutes.packaging_text_fr) ? extraireDepuisTexte(donneesBrutes.packaging_text_fr) : [] },
        { id: 'texte',     extraire: () => texteValide(donneesBrutes.packaging_text)    ? extraireDepuisTexte(donneesBrutes.packaging_text)    : [] },
        { id: 'tags',      extraire: () => extraireDepuisTags(donneesBrutes) },
        { id: 'legacy',    extraire: () => texteLegacyValide(donneesBrutes.packaging)   ? extraireDepuisTexte(donneesBrutes.packaging)         : [] },
        { id: 'estimation',extraire: () => estimerDepuisCategorie(donneesBrutes) },
    ];

    for (const source of sources) {
        const composants = fusionner(source.extraire());
        if (composants.length > 0) {
            return {
                composants,
                instructions: genererInstructions(composants),
                source: source.id,
                fiabilite: niveauFiabiliteGlobal(composants),
            };
        }
    }

    return resultatVide();
}

function texteValide(t) {
    return typeof t === 'string' && t.trim().length > 5;
}

function texteLegacyValide(t) {
    // Le champ legacy `packaging` contient parfois une valeur numérique parasite.
    return texteValide(t) && !/^\d+(\.\d+)?$/.test(t.trim());
}

function niveauFiabiliteGlobal(composants) {
    const min = Math.min(...composants.map(c => c.fiabilite));
    return min >= FIABILITE.HAUTE ? 'haute' : min >= FIABILITE.MOYENNE ? 'moyenne' : 'faible';
}

function resultatVide() {
    return { composants: [], instructions: null, source: 'aucune', fiabilite: 'aucune' };
}
