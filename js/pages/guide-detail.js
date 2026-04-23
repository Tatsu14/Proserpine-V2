import { initAuth } from '../auth.js';

initAuth();

document.getElementById('btn-back').addEventListener('click', () => {
    window.history.back();
});

// Base de données statique pour le guide
const guideData = {
    'pmc': {
        color: 'var(--color-guide-pmc)',
        textColor: '#FFF',
        icon: 'recycling',
        title: 'Sac bleu (PMC)',
        desc: 'Destiné aux emballages en Plastique, Métal et Cartons à boisson.',
        accepted: [
            'Bouteilles et flacons en plastique',
            'Emballages métalliques (boîtes de conserve, canettes, barquettes en aluminium)',
            'Cartons à boisson (lait, jus)',
            'Films plastiques, sacs et sachets',
            'Pots et raviers en plastique (yaourt, beurre)'
        ],
        refused: [
            'Emballages avec un bouchon de sécurité enfant <span class="badge-danger">DANGEREUX</span>',
            'Emballages de produits chimiques ou toxiques <span class="badge-danger">DANGEREUX</span>',
            'Frigolite (polystyrène expansé)',
            'Objets en plastique (jouets, seaux)'
        ],
        tip: 'Écrasez vos bouteilles en plastique dans le sens de la longueur et remettez le bouchon pour gagner de la place.'
    },
    'paper': {
        color: 'var(--color-guide-paper)',
        textColor: 'var(--color-guide-paper-text)',
        icon: 'description',
        title: 'Papiers & cartons',
        desc: 'Collecte des papiers et cartons propres et secs.',
        accepted: [
            'Boîtes en carton',
            'Journaux, magazines, publicités',
            'Papiers d\'écriture, enveloppes',
            'Sacs en papier'
        ],
        refused: [
            'Papiers gras ou souillés (boîtes de pizza sales)',
            'Mouchoirs en papier, essuie-tout (→ Organique)',
            'Papier peint',
            'Papiers plastifiés ou métallisés'
        ],
        tip: 'Ficelez bien vos papiers et cartons avec de la ficelle naturelle ou placez-les dans une boîte fermée pour éviter qu\'ils ne s\'envolent.'
    },
    'organic': {
        color: 'var(--color-guide-organic)',
        textColor: '#FFF',
        icon: 'compost',
        title: 'Déchets organiques',
        desc: 'Destiné aux déchets biodégradables de cuisine et de jardin.',
        accepted: [
            'Restes de repas (sans os ni arêtes)',
            'Épluchures de fruits et légumes',
            'Marc de café, sachets de thé',
            'Fleurs fanées, petites plantes',
            'Essuie-tout et mouchoirs en papier non souillés par des produits chimiques'
        ],
        refused: [
            'Langes / Couches',
            'Cendres de bois ou de charbon',
            'Litières non biodégradables',
            'Plastiques dits "biodégradables" (sauf sacs compostables agréés)'
        ]
    },
    'glass': {
        color: 'var(--color-guide-glass)',
        textColor: '#FFF',
        icon: 'liquor',
        title: 'Verre',
        desc: 'Uniquement pour les emballages en verre transparent. À déposer dans les bulles à verre.',
        accepted: [
            'Bouteilles en verre transparent (vides)',
            'Bocaux et pots en verre transparent (vides)'
        ],
        refused: [
            'Verre plat (vitres, miroirs)',
            'Verre résistant à la chaleur (Pyrex)',
            'Porcelaine, céramique, terre cuite',
            'Ampoules et tubes néons <span class="badge-danger">DANGEREUX</span>'
        ],
        tip: 'Séparez le verre coloré (bulles vertes) du verre blanc (bulles blanches).'
    },
    'residual': {
        color: 'var(--color-guide-residual)',
        textColor: '#FFF',
        icon: 'delete',
        title: 'Déchets résiduels',
        desc: 'La poubelle noire ou le conteneur gris. Pour tout ce qui ne se recycle pas ailleurs.',
        accepted: [
            'Langes / Couches',
            'Restes de repas très gras, os, litières',
            'Objets en plastique (non emballages)',
            'Cassettes audio/vidéo',
            'Filtres à café avec marc (si pas de tri organique)'
        ],
        refused: [
            'Piles et batteries <span class="badge-danger">DANGEREUX</span>',
            'Produits toxiques <span class="badge-danger">DANGEREUX</span>',
            'Déchets électriques ou électroniques',
            'Tout ce qui va dans les autres poubelles de tri'
        ]
    },
    'danger': {
        color: 'var(--color-guide-danger)',
        textColor: '#FFF',
        icon: 'warning',
        title: 'Recyparc',
        desc: 'Les déchets qui nécessitent un traitement spécifique en raison de leur toxicité ou encombrement.',
        accepted: [
            'Piles et batteries',
            'Restes de peintures, solvants, huiles de vidange',
            'Déchets d\'équipements électriques et électroniques (DEEE)',
            'Ampoules économiques, tubes néon',
            'Médicaments périmés (à rapporter en pharmacie de préférence)'
        ],
        refused: [
            'Déchets explosifs ou radioactifs',
            'Amiante non préparé spécifiquement'
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    
    const data = guideData[type];
    if (!data) {
        document.getElementById('title').textContent = "Catégorie inconnue";
        return;
    }
    
    const header = document.getElementById('header');
    header.style.backgroundColor = data.color;
    header.style.color = data.textColor;
    
    // Adjust back button color if text is dark
    if (data.textColor !== '#FFF') {
        document.getElementById('btn-back').style.color = data.textColor;
        document.getElementById('btn-back').style.backgroundColor = 'rgba(0,0,0,0.1)';
    }
    
    document.getElementById('icon').textContent = data.icon;
    document.getElementById('title').textContent = data.title;
    document.getElementById('desc').textContent = data.desc;
    
    const accList = document.getElementById('accepted-list');
    data.accepted.forEach(item => {
        accList.innerHTML += `
            <div class="list-item-guide">
                <span class="material-symbols-rounded item-icon-guide">check</span>
                <div>${item}</div>
            </div>
        `;
    });
    
    const refList = document.getElementById('refused-list');
    data.refused.forEach(item => {
        refList.innerHTML += `
            <div class="list-item-guide">
                <span class="material-symbols-rounded item-icon-guide">close</span>
                <div class="text-danger-bold">${item}</div>
            </div>
        `;
    });
    
    if (data.tip) {
        document.getElementById('local-tip').classList.remove('d-none');
        document.getElementById('local-tip').classList.add('d-flex');
        document.getElementById('tip-text').textContent = data.tip;
    }
});
