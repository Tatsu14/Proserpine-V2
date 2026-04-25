export const CATEGORIES = {
    pmc:      { title: 'Sac bleu (PMC)',     icon: 'recycling',   cssClass: 'bg-guide-pmc',      iconColor: '#FFF',                          guideType: 'pmc' },
    paper:    { title: 'Papiers & cartons',  icon: 'description', cssClass: 'bg-guide-paper',    iconColor: 'var(--color-guide-paper-text)', guideType: 'paper' },
    glass:    { title: 'Verre',              icon: 'liquor',      cssClass: 'bg-guide-glass',    iconColor: '#FFF',                          guideType: 'glass' },
    organic:  { title: 'Déchets organiques', icon: 'compost',     cssClass: 'bg-guide-organic',  iconColor: '#FFF',                          guideType: 'organic' },
    residual: { title: 'Déchets résiduels',  icon: 'delete',      cssClass: 'bg-guide-residual', iconColor: '#FFF',                          guideType: 'residual' },
    danger:   { title: 'Recyparc',           icon: 'warning',     cssClass: 'bg-guide-danger',   iconColor: '#FFF',                          guideType: 'danger' },
};

// Règles ordonnées par priorité : les cas spécifiques avant les cas génériques
const REGLES = [
    // Briques alimentaires → PMC (avant "carton" générique → papier)
    { regex: /brique[s]?\s+de\s+(lait|jus|boisson)|carton[s]?\s+[àa]\s+boisson|tetra[\s-]?pak?/i, categorie: 'pmc' },
    // Papier cuisson / sulfurisé → Résiduel (avant "papier" générique → papier)
    { regex: /papier\s+(de\s+)?cuis[s]?on|papier\s+sulfuris[eé]|baking\s+paper/i, categorie: 'residual' },
    // Polystyrène expansé / frigolite → Résiduel (avant "plastique" générique → PMC)
    { regex: /frigolite|polystyr[eè]ne\s+expan[sé]|\beps\b|styrofoam/i, categorie: 'residual' },
    // Films multicouches / aluminisés → Résiduel
    { regex: /film\s+aluminisé|multi[\s-]?couche[s]?|complexe\s+plast/i, categorie: 'residual' },

    // Plastiques → PMC
    { regex: /plastique|polypropyl[eè]ne|\bpp\b|poly[eé]thyl[eè]ne|\bpe\b|\bpet\b|\bhdpe\b|\bpehd\b|\bpvc\b|polyester|polystyr[eè]ne|film\s+plast|sachet|sac\s+plast|flacon\s+plast|bouteille\s+plast|barquette\s+plast|pot\s+plast|opercule\s+plast|couvercle\s+plast|bouchon\s+plast|bidon|pochette/i, categorie: 'pmc' },
    // Métaux → PMC
    { regex: /aluminium|aluminum|\balu\b|acier|canette|bo[îi]te\s+de\s+conserve|capsule|opercule\s+(m[eé]tal|alu)|barquette\s+(alu|m[eé]tal)|\bm[eé]tal\b|zinc|\bfer\b/i, categorie: 'pmc' },

    // Verre → Verre
    { regex: /\bverre\b|bocal|pot\s+(en\s+)?verre|bouteille\s+(en\s+)?verre|flacon\s+(en\s+)?verre|\bglass\b/i, categorie: 'glass' },

    // Carton / Papier → Papier & cartons
    { regex: /\bcarton\b|cardboard|\bpap\b|c\/pap|\bpapier\b|\bpaper\b|kraft|[eé]tui|notice|brochure|bo[îi]te\s+carton|emballage\s+carton/i, categorie: 'paper' },

    // Bois → Résiduel
    { regex: /\bbois\b|\bwood\b/i, categorie: 'residual' },
    // Compostable → Organique
    { regex: /compostable|biodégradable|bio[\s-]?sourcé/i, categorie: 'organic' },
    // Dangereux → Recyparc
    { regex: /\bpile[s]?\b|\bbatterie[s]?\b|accumulateur|déchets?\s+[eé]lectronique|\bdeee\b/i, categorie: 'danger' },
];

// Mapping tags normalisés Open Food Facts → catégorie + description française
const TAGS_MAP = {
    'en:plastic':         { categorie: 'pmc',      description: 'Emballage en plastique' },
    'en:plastic-bottle':  { categorie: 'pmc',      description: 'Bouteille en plastique' },
    'en:plastic-bag':     { categorie: 'pmc',      description: 'Sachet en plastique' },
    'en:plastic-pouch':   { categorie: 'pmc',      description: 'Sachet souple' },
    'en:aluminium':       { categorie: 'pmc',      description: 'Emballage en aluminium' },
    'en:aluminum':        { categorie: 'pmc',      description: 'Emballage en aluminium' },
    'en:metal':           { categorie: 'pmc',      description: 'Emballage métallique' },
    'en:steel':           { categorie: 'pmc',      description: 'Emballage en acier' },
    'en:drink-can':       { categorie: 'pmc',      description: 'Canette' },
    'en:food-can':        { categorie: 'pmc',      description: 'Boîte de conserve' },
    'en:beverage-carton': { categorie: 'pmc',      description: 'Brique / Carton à boisson' },
    'en:cardboard':       { categorie: 'paper',    description: 'Emballage en carton' },
    'en:cardboard-box':   { categorie: 'paper',    description: 'Boîte en carton' },
    'en:paper':           { categorie: 'paper',    description: 'Emballage en papier' },
    'en:glass':           { categorie: 'glass',    description: 'Emballage en verre' },
    'en:glass-bottle':    { categorie: 'glass',    description: 'Bouteille en verre' },
    'en:glass-jar':       { categorie: 'glass',    description: 'Bocal en verre' },
    'en:wood':            { categorie: 'residual', description: 'Emballage en bois' },
};

const NOMS_CATEGORIES = {
    pmc:      'le sac bleu (PMC)',
    paper:    'la collecte papier/carton',
    glass:    'la bulle à verre',
    organic:  'la collecte des déchets organiques',
    residual: 'la poubelle des déchets résiduels',
    danger:   'un Recyparc',
};

function detecterCategorie(texte) {
    for (const regle of REGLES) {
        if (regle.regex.test(texte)) return regle.categorie;
    }
    return null;
}

function extraireComposants(texte) {
    const lignes = texte.split(/[\n\r;]+/);
    const composants = [];

    for (const ligne of lignes) {
        const propre = ligne
            .replace(/^\s*\d+(\s*[×xX])?\s+/, '')
            .replace(/\s+[àa]\s+recycler\.?\s*$/i, '')
            .replace(/\s+recyclable\.?\s*$/i, '')
            .trim();

        if (propre.length < 3) continue;

        const categorie = detecterCategorie(propre);
        if (categorie) {
            composants.push({
                description: propre.charAt(0).toUpperCase() + propre.slice(1),
                categorie,
            });
        }
    }

    return composants;
}

function analyserDepuisTags(donneesBrutes) {
    const tags = [
        ...(donneesBrutes.packaging_tags || []),
        ...(donneesBrutes.packaging_materials_tags || []),
    ];

    const composants = [];
    const seenCats = new Set();

    for (const tag of tags) {
        const mapped = TAGS_MAP[tag];
        if (mapped && !seenCats.has(mapped.categorie)) {
            seenCats.add(mapped.categorie);
            composants.push({ description: mapped.description, categorie: mapped.categorie });
        }
    }

    return composants;
}

function genererInstructions(composants) {
    if (composants.length === 0) return null;

    if (composants.length === 1) {
        return `Mettez ${composants[0].description.toLowerCase()} dans ${NOMS_CATEGORIES[composants[0].categorie]}.`;
    }

    const parCategorie = {};
    composants.forEach(c => {
        if (!parCategorie[c.categorie]) parCategorie[c.categorie] = [];
        parCategorie[c.categorie].push(c.description.toLowerCase());
    });

    const parties = Object.entries(parCategorie).map(([cat, descs]) => {
        const items = descs.length === 1
            ? descs[0]
            : descs.slice(0, -1).join(', ') + ' et ' + descs[descs.length - 1];
        return `${items} dans ${NOMS_CATEGORIES[cat]}`;
    });

    if (parties.length === 1) {
        return `Mettez ${parties[0]}.`;
    }

    const derniere = parties.pop();
    return `Séparez les éléments avant de trier : ${parties.join(', ')} et ${derniere}.`;
}

/**
 * Analyse les données brutes d'un produit et retourne les consignes de tri.
 * @param {Object} donneesBrutes - Données brutes de l'API Open Food Facts
 * @returns {{ composants: Array, instructions: string|null }}
 */
export function analyserEmballage(donneesBrutes) {
    // Priorité 1 : texte français détaillé (le plus fiable)
    const texteFr = donneesBrutes.packaging_text_fr;
    if (texteFr && texteFr.trim().length > 5) {
        const composants = extraireComposants(texteFr);
        if (composants.length > 0) {
            return { composants, instructions: genererInstructions(composants) };
        }
    }

    // Priorité 2 : texte générique
    const texteGen = donneesBrutes.packaging_text;
    if (texteGen && texteGen.trim().length > 5) {
        const composants = extraireComposants(texteGen);
        if (composants.length > 0) {
            return { composants, instructions: genererInstructions(composants) };
        }
    }

    // Priorité 3 : tags normalisés
    const composantsTags = analyserDepuisTags(donneesBrutes);
    if (composantsTags.length > 0) {
        return { composants: composantsTags, instructions: genererInstructions(composantsTags) };
    }

    // Priorité 4 : champ "packaging" legacy (texte libre, ignorer les valeurs numériques)
    const legacy = donneesBrutes.packaging;
    if (typeof legacy === 'string' && legacy.trim().length > 5 && !/^\d+(\.\d+)?$/.test(legacy.trim())) {
        const composants = extraireComposants(legacy);
        if (composants.length > 0) {
            return { composants, instructions: genererInstructions(composants) };
        }
    }

    return { composants: [], instructions: null };
}
