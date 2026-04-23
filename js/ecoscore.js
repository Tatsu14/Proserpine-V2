/**
 * ecoscore.js - Moteur de calcul de l'éco-score
 */

const EcoScoreMath = {
    ACV_WEIGHTS: {
        carbon: 0.25,
        water: 0.20,
        biodiversity: 0.20,
        eutrophication: 0.15,
        airQuality: 0.10,
        fossilResources: 0.10
    },
    MODIFIERS: {
        packaging: {
            'BULK': +10, 'REUSABLE_GLASS': +10,
            'FULLY_RECYCLABLE': 0, 'PLASTIC_WRAP': -10, 'NON_RECYCLABLE': -20
        },
        transport: {
            'LOCAL_SHORT_CIRCUIT': +10, 'TRAIN': +5,
            'ROAD_TRUCK': -5, 'MARITIME': -5, 'AIR_FREIGHT': -30
        },
        agriculture: {
            'REGENERATIVE': +15, 'CERTIFIED_ORGANIC': +10,
            'CONVENTIONAL': -5, 'INTENSIVE': -15, 'DEFORESTATION_RISK': -40
        },
        processing: {
            'UNPROCESSED': +5, 'PROCESSED': -5, 'ULTRA_PROCESSED': -20
        }
    }
};

/**
 * Extrait les données et calcule l'éco-score final
 * @param {Object} donneesBrutes - Les données brutes issues de l'API
 * @returns {Object} { score: number, label: string, detail: string }
 */
export function calculerEcoScore(donneesBrutes) {
    // 1. Détermination du score de base
    // Dans un vrai système, on lirait les valeurs ACV (Analyse du Cycle de Vie) réelles.
    // L'API OpenFoodFacts fournit souvent un ecoscore_score. S'il existe, on l'utilise
    // comme base et on applique nos modificateurs (ou on le retourne tel quel).
    // Si non présent, on simule une base selon les nutriments/catégories pour la démo.
    
    let baseScore = 50; // Valeur par défaut moyenne
    
    if (donneesBrutes && donneesBrutes.ecoscore_score) {
        baseScore = Number(donneesBrutes.ecoscore_score);
    } else if (donneesBrutes && donneesBrutes.nutriscore_score) {
        // Fallback grossier si ecoscore absent mais nutriscore présent (inverse)
        baseScore = 100 - (Number(donneesBrutes.nutriscore_score) * 2); 
    }
    
    baseScore = Math.max(0, Math.min(100, baseScore)); // Clamp 0-100
    
    // 2. Calcul des modificateurs
    let totalModifiers = 0;
    let packagingTag = 'FULLY_RECYCLABLE'; // Par défaut
    
    // Analyse basique du packaging pour déterminer le modificateur
    if (donneesBrutes && donneesBrutes.packaging) {
        const pkg = donneesBrutes.packaging.toLowerCase();
        if (pkg.includes('verre') || pkg.includes('glass')) packagingTag = 'REUSABLE_GLASS';
        else if (pkg.includes('plastique') || pkg.includes('plastic')) packagingTag = 'NON_RECYCLABLE';
        else if (pkg.includes('carton') || pkg.includes('paper')) packagingTag = 'FULLY_RECYCLABLE';
    }
    
    totalModifiers += EcoScoreMath.MODIFIERS.packaging[packagingTag] || 0;
    
    // Analyse basique de l'agriculture (Bio)
    let agriTag = 'CONVENTIONAL';
    if (donneesBrutes && donneesBrutes.labels) {
        const labels = donneesBrutes.labels.toLowerCase();
        if (labels.includes('bio') || labels.includes('organic')) agriTag = 'CERTIFIED_ORGANIC';
    }
    
    totalModifiers += EcoScoreMath.MODIFIERS.agriculture[agriTag] || 0;
    
    // Clamp modificateurs entre -40 et +30 selon spec
    totalModifiers = Math.max(-40, Math.min(30, totalModifiers));
    
    // 3. Score final
    let scoreFinal = Math.floor(baseScore + totalModifiers);
    scoreFinal = Math.max(0, Math.min(100, scoreFinal));
    
    // 4. Détermination du label et détail
    let label = "";
    let detail = "";
    
    if (scoreFinal >= 75) {
        label = "Excellent";
        detail = "Ce produit a un très faible impact environnemental. Son cycle de vie, de la production à l'emballage, respecte les normes écologiques.";
    } else if (scoreFinal >= 50) {
        label = "Bon";
        detail = "Impact environnemental modéré. Des efforts ont été faits (ex: emballage recyclable ou agriculture responsable), mais des marges de progression existent.";
    } else if (scoreFinal >= 25) {
        label = "Moyen";
        detail = "L'impact écologique de ce produit est non négligeable. Pensez à vérifier ses emballages ou son origine.";
    } else {
        label = "Mauvais";
        detail = "Impact environnemental très élevé. Son cycle de production, son transport ou ses emballages pèsent lourdement sur la planète.";
    }
    
    return {
        score: scoreFinal,
        label: label,
        detail: detail,
        color: getColorForScore(scoreFinal)
    };
}

function getColorForScore(score) {
    if (score >= 75) return '#27AE60';      // Vert
    if (score >= 50) return '#00CC66';      // Vert clair
    if (score >= 25) return '#FF9800';      // Orange
    return '#E74C3C';                       // Rouge
}
