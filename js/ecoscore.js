/**
 * ecoscore.js — Moteur de calcul de l'éco-score
 * ---------------------------------------------------------------------------
 * Évalue l'impact environnemental d'un produit sur une échelle 0-100 (+ note
 * A→E) en exploitant au maximum les données disponibles, du plus fiable au
 * plus incertain :
 *
 *   MODE A — Éco-Score / Green-Score officiel présent (Open Food Facts) :
 *            on s'appuie sur le score officiel et on en décompose les
 *            contributions (production, origine/transport, emballage, espèces
 *            menacées) pour un affichage transparent. Aucune double pénalité.
 *
 *   MODE B — Aucun éco-score officiel (produits cosmétiques / ménagers, ou
 *            fiche incomplète) : on calcule une ESTIMATION bornée à partir de
 *            l'emballage, des labels, de l'origine et du degré de
 *            transformation (NOVA). Clairement signalée comme estimation.
 *
 * Contrat public (compatible UI) :
 *   calculerEcoScore(donneesBrutes) -> { score, label, detail, color, ... }
 * ---------------------------------------------------------------------------
 */

import { analyserEmballage } from './tri.js';

/* ===========================================================================
 * Constantes
 * =========================================================================== */

// Bornes appliquées à l'ensemble des modificateurs en mode estimation.
const MODIF_MIN = -30;
const MODIF_MAX = 25;

// Correspondance note (grade) → score représentatif (milieu de plage officielle).
const GRADE_VERS_SCORE = { a: 85, b: 70, c: 50, d: 30, e: 10 };

// Modificateurs du mode estimation (points), volontairement modérés.
const POIDS = {
    labels: {
        bio: 10, organic: 10, 'eu-organic': 10,
        fairtrade: 5, 'fair-trade': 5, 'max-havelaar': 5,
        'sustainable-seafood-msc': 5, 'responsible-aquaculture-asc': 5,
        'rainforest-alliance': 5, 'fsc': 4, 'ecolabel': 5, 'eu-ecolabel': 5,
    },
    novaGroup: { 1: 4, 2: 0, 3: -4, 4: -8 },
    palmOil: { durable: -2, nonDurable: -8 },
};

/* ===========================================================================
 * Point d'entrée public
 * =========================================================================== */

/**
 * Extrait les données et calcule l'éco-score final.
 * @param {Object} donneesBrutes - Données brutes issues de l'API
 * @returns {{ score:number, grade:string, label:string, detail:string,
 *             color:string, fiabilite:string, estimation:boolean,
 *             contributions:Array }}
 */
export function calculerEcoScore(donneesBrutes) {
    const d = donneesBrutes && typeof donneesBrutes === 'object' ? donneesBrutes : {};

    const officiel = lireScoreOfficiel(d);
    return officiel ? evaluerDepuisOfficiel(d, officiel) : estimerScore(d);
}

/* ===========================================================================
 * MODE A — Score officiel Open Food Facts
 * =========================================================================== */

// Récupère un score officiel 0-100 si disponible (Eco-Score / Green-Score).
function lireScoreOfficiel(d) {
    const dataScore = d.ecoscore_data && typeof d.ecoscore_data.score === 'number'
        ? d.ecoscore_data.score : null;
    const topScore = typeof d.ecoscore_score === 'number' ? d.ecoscore_score : null;

    let score = dataScore ?? topScore;
    let grade = (d.ecoscore_grade || (d.ecoscore_data && d.ecoscore_data.grade) || '').toLowerCase();

    // Un grade « unknown »/« not-applicable » n'est pas exploitable.
    if (grade && !GRADE_VERS_SCORE[grade]) grade = '';

    if (score == null && grade) score = GRADE_VERS_SCORE[grade];
    if (score == null) return null;

    return { score: clamp(score, 0, 100), grade };
}

function evaluerDepuisOfficiel(d, officiel) {
    const score = Math.round(officiel.score);
    const grade = officiel.grade || gradeDepuisScore(score);

    // Décomposition transparente à partir des ajustements officiels OFF.
    const contributions = [];
    const adj = (d.ecoscore_data && d.ecoscore_data.adjustments) || {};

    ajouterContribution(contributions, 'Système de production / labels', valeurAjustement(adj.production_system));
    ajouterContribution(contributions, 'Origine & transport des ingrédients', valeurAjustement(adj.origins_of_ingredients));
    ajouterContribution(contributions, 'Emballage', valeurAjustement(adj.packaging));
    ajouterContribution(contributions, 'Risque pour les espèces menacées', valeurAjustement(adj.threatened_species));

    return finaliser({
        score, grade,
        contributions,
        fiabilite: 'haute',
        estimation: false,
        introDetail: 'Calculé à partir de l’Éco-Score officiel (analyse du cycle de vie Agribalyse).',
    });
}

/* ===========================================================================
 * MODE B — Estimation (pas de score officiel)
 * =========================================================================== */

function estimerScore(d) {
    let base = 50;                 // Neutre par défaut.
    let fiabilite = 'faible';
    const contributions = [];

    // Le degré de transformation (NOVA) ajuste la base.
    const nova = Number(d.nova_group);
    if (POIDS.novaGroup[nova] !== undefined) {
        base += POIDS.novaGroup[nova];
        fiabilite = 'moyenne';
        ajouterContribution(contributions, 'Degré de transformation (NOVA)', POIDS.novaGroup[nova]);
    }

    // Emballage : on réutilise le moteur de tri pour juger la recyclabilité.
    const emballage = evaluerEmballage(d);
    if (emballage.points !== 0 || emballage.detecte) {
        ajouterContribution(contributions, 'Emballage', emballage.points);
        if (emballage.detecte) fiabilite = fiabilite === 'faible' ? 'moyenne' : fiabilite;
    }

    // Labels environnementaux.
    const pointsLabels = evaluerLabels(d);
    if (pointsLabels !== 0) {
        ajouterContribution(contributions, 'Labels environnementaux', pointsLabels);
        fiabilite = 'moyenne';
    }

    // Huile de palme.
    const pointsPalme = evaluerHuilePalme(d);
    if (pointsPalme !== 0) ajouterContribution(contributions, 'Huile de palme', pointsPalme);

    // Origine / transport.
    const pointsOrigine = evaluerOrigine(d);
    if (pointsOrigine !== 0) ajouterContribution(contributions, 'Origine & transport', pointsOrigine);

    // La base intègre déjà NOVA ; on borne la somme des autres modificateurs.
    const modifHorsNova = clamp(
        contributions.filter(c => c.label !== 'Degré de transformation (NOVA)')
                     .reduce((s, c) => s + c.points, 0),
        MODIF_MIN, MODIF_MAX
    );
    const scoreFinal = clamp(Math.round(base + modifHorsNova), 0, 100);

    return finaliser({
        score: scoreFinal,
        grade: gradeDepuisScore(scoreFinal),
        contributions,
        fiabilite,
        estimation: true,
        introDetail: 'Estimation Proserpine : aucun éco-score officiel n’est disponible pour ce produit.',
    });
}

// Évalue la recyclabilité de l'emballage via le moteur de tri (tri.js).
function evaluerEmballage(d) {
    const { composants } = analyserEmballage(d);
    if (!composants || composants.length === 0) return { points: 0, detecte: false };

    const cats = composants.map(c => c.categorie);
    const aVerre = cats.includes('glass');
    const aResiduel = cats.includes('residual');
    const aDanger = cats.includes('danger');
    const toutRecyclable = cats.every(c => ['pmc', 'paper', 'glass', 'organic'].includes(c));

    let points = 0;
    if (aVerre) points += 4;                 // Verre réutilisable / consigné.
    if (toutRecyclable) points += 4;         // Emballage entièrement trié/recyclé.
    if (aResiduel) points -= 6;              // Fraction non recyclable.
    if (aDanger) points -= 10;               // Composant problématique.

    return { points: clamp(points, -12, 10), detecte: true };
}

function evaluerLabels(d) {
    const tags = labelsTags(d);
    let points = 0;
    const vus = new Set();
    for (const tag of tags) {
        const cle = tag.replace(/^[a-z]{2}:/, '');
        for (const [motif, val] of Object.entries(POIDS.labels)) {
            if (cle.includes(motif) && !vus.has(motif)) {
                vus.add(motif);
                points += val;
            }
        }
    }
    return clamp(points, 0, 15);
}

function evaluerHuilePalme(d) {
    const analysis = (d.ingredients_analysis_tags || []).join(' ');
    const labels = labelsTags(d).join(' ');
    if (/palm-oil-free/.test(analysis)) return 0;
    if (/palm-oil/.test(analysis)) {
        return /rspo|sustainable-palm|durable/.test(labels) ? POIDS.palmOil.durable : POIDS.palmOil.nonDurable;
    }
    return 0;
}

function evaluerOrigine(d) {
    const proche = /\b(belgi|belgium|france|french|netherlands|pays-bas|germany|allemagne|luxembourg|europe|european-union)\b/i;
    const lointain = /\b(china|chine|japan|india|inde|brazil|bresil|argentin|peru|chile|chili|south-africa|kenya|new-zealand|australia|usa|united-states|mexico|thailand|vietnam)\b/i;

    const champs = [
        d.origins || '',
        (d.origins_tags || []).join(' '),
        d.manufacturing_places || '',
        (d.manufacturing_places_tags || []).join(' '),
        (d.countries_tags || []).join(' '),
    ].join(' ').toLowerCase();

    if (!champs.trim()) return 0;
    if (proche.test(champs)) return 5;
    if (lointain.test(champs)) return -8;
    return 0;
}

/* ===========================================================================
 * Helpers communs
 * =========================================================================== */

function labelsTags(d) {
    if (Array.isArray(d.labels_tags) && d.labels_tags.length) return d.labels_tags;
    if (typeof d.labels === 'string') {
        return d.labels.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

// Lit la valeur d'un ajustement OFF (objet { value: number }).
function valeurAjustement(adj) {
    if (!adj || typeof adj !== 'object') return 0;
    const v = Number(adj.value);
    return Number.isFinite(v) ? Math.round(v) : 0;
}

function ajouterContribution(liste, label, points) {
    if (points && Number.isFinite(points)) liste.push({ label, points });
}

function gradeDepuisScore(score) {
    if (score >= 80) return 'a';
    if (score >= 60) return 'b';
    if (score >= 40) return 'c';
    if (score >= 20) return 'd';
    return 'e';
}

// Assemble le résultat final (label, détail textuel, couleur).
function finaliser({ score, grade, contributions, fiabilite, estimation, introDetail }) {
    const label = LIBELLE_GRADE[grade] || LIBELLE_GRADE[gradeDepuisScore(score)];

    // Construit un détail lisible : intro + principal point fort / faible.
    const tries = [...contributions].sort((a, b) => b.points - a.points);
    const fort = tries.find(c => c.points > 0);
    const faible = [...tries].reverse().find(c => c.points < 0);

    let detail = introDetail + ' ' + (PHRASE_GRADE[grade] || PHRASE_GRADE[gradeDepuisScore(score)]);
    if (fort)   detail += ` Point fort : ${fort.label.toLowerCase()}.`;
    if (faible) detail += ` Point faible : ${faible.label.toLowerCase()}.`;
    if (estimation) detail += ' (Estimation — à affiner avec les données du fabricant.)';

    return {
        score,
        grade: grade.toUpperCase(),
        label,
        detail,
        color: couleurPourScore(score),
        fiabilite,
        estimation,
        contributions,
    };
}

const LIBELLE_GRADE = { a: 'Excellent', b: 'Bon', c: 'Moyen', d: 'Médiocre', e: 'Mauvais' };

const PHRASE_GRADE = {
    a: 'Ce produit a un très faible impact environnemental sur l’ensemble de son cycle de vie.',
    b: 'Ce produit a un impact environnemental maîtrisé, avec quelques marges de progression.',
    c: 'Ce produit a un impact environnemental modéré ; certains aspects pèsent sur son bilan.',
    d: 'Ce produit a un impact environnemental élevé : production, transport ou emballage sont à surveiller.',
    e: 'Ce produit a un impact environnemental très élevé sur son cycle de vie.',
};

function couleurPourScore(score) {
    if (score >= 80) return '#1E8449';   // Vert foncé (A)
    if (score >= 60) return '#27AE60';   // Vert (B)
    if (score >= 40) return '#F1C40F';   // Jaune (C)
    if (score >= 20) return '#E67E22';   // Orange (D)
    return '#E74C3C';                     // Rouge (E)
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
