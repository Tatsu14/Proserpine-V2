/**
 * api.js - Cascade de recherche API
 * Implémente la recherche prioritaire : Open Food Facts -> Open Beauty Facts -> Open Products Facts
 */

const APIS = [
    { id: 'openfoodfacts', url: 'https://world.openfoodfacts.org' },
    { id: 'openbeautyfacts', url: 'https://world.openbeautyfacts.org' },
    { id: 'openproductsfacts', url: 'https://world.openproductsfacts.org' }
];

/**
 * Recherche un produit par son code-barres (EAN)
 * Parcourt les API en cascade et s'arrête à la première correspondance trouvée.
 * @param {string} ean Le code EAN scanné ou entré manuellement
 * @returns {Object|null} Objet produit normalisé ou null si introuvable
 */
export async function rechercherProduitParEAN(ean) {
    for (const api of APIS) {
        try {
            const response = await fetch(`${api.url}/api/v2/product/${ean}.json`);
            
            // Si la requête échoue techniquement (ex: 404, 500), on passe à la suivante
            if (!response.ok) continue;
            
            const data = await response.json();
            
            // status: 1 indique que le produit a été trouvé
            if (data.status === 1 && data.product) {
                return normaliserProduit(data.product, api.id);
            }
        } catch (error) {
            console.error(`Erreur fetch EAN via ${api.id}:`, error);
        }
    }
    
    // Si la boucle se termine sans rien trouver
    return null;
}

/**
 * Recherche textuelle de produits
 * Lance les requêtes en parallèle sur les 3 API, puis agrège et déduplique.
 * @param {string} terme Le terme de recherche
 * @returns {Array} Liste des produits trouvés
 */
export async function rechercherProduitParTexte(terme) {
    const termEncoded = encodeURIComponent(terme);
    
    // Requêtes parallèles pour des résultats plus rapides en recherche temps réel
    const fetchPromises = APIS.map(async (api) => {
        try {
            // Utilisation de l'API de recherche V1 (search.pl) qui est plus tolérante pour le texte complet
            const response = await fetch(`${api.url}/cgi/search.pl?search_terms=${termEncoded}&json=1&page_size=20`);
            if (!response.ok) return [];
            
            const data = await response.json();
            if (data.products && data.products.length > 0) {
                return data.products.map(p => normaliserProduit(p, api.id));
            }
        } catch (error) {
            console.error(`Erreur fetch texte via ${api.id}:`, error);
        }
        return [];
    });
    
    const resultsArrays = await Promise.all(fetchPromises);
    const allResults = resultsArrays.flat();
    
    // Déduplication par EAN
    const uniqueResultsMap = new Map();
    allResults.forEach(product => {
        // On évite les produits sans nom ni marque pour garder des résultats propres
        if (!uniqueResultsMap.has(product.ean) && product.nom !== 'Produit inconnu') {
            uniqueResultsMap.set(product.ean, product);
        }
    });
    
    return Array.from(uniqueResultsMap.values());
}

/**
 * Normalise les données brutes provenant de n'importe quelle instance d'Open (Food/Beauty/Products) Facts
 * Produit un objet standardisé pour toute l'application.
 * @param {Object} donneesBrutes Les données JSON de l'API
 * @param {string} source L'ID de l'API source
 * @returns {Object} Le produit normalisé
 */
export function normaliserProduit(donneesBrutes, source) {
    return {
        ean: donneesBrutes.code || donneesBrutes.id || '',
        nom: donneesBrutes.product_name_fr || donneesBrutes.product_name || 'Produit inconnu',
        marque: donneesBrutes.brands || 'Marque inconnue',
        categorie: donneesBrutes.categories || '',
        imageUrl: donneesBrutes.image_url || donneesBrutes.image_front_url || null,
        ingredients: donneesBrutes.ingredients_text_fr || donneesBrutes.ingredients_text || null,
        emballage: donneesBrutes.packaging || null,
        pays_origine: donneesBrutes.origins || null,
        source: source,
        donnees_brutes: donneesBrutes // Conservé pour le calcul de l'éco-score
    };
}
