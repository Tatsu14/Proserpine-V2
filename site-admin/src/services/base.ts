/**
 * Base de produits : types, libellés et actions d'administration (via la fonction serveur).
 * Mêmes valeurs que l'application (src/services/base-produits.ts et admin-base.ts du dépôt Proserpine).
 */
import { appelerApi, type ReponseApi } from './api';

/** Les 7 bacs de la base (table prive.bacs), avec la couleur de la carte de tri de l'app. */
export const BACS = [
  { id: 'pmc', libelle: 'Sac bleu (PMC)', court: 'PMC', couleur: '#3498DB' },
  { id: 'papier_carton', libelle: 'Papiers & cartons', court: 'Papiers & cartons', couleur: '#F1C40F' },
  { id: 'verre_transparent', libelle: 'Verre transparent', court: 'Verre transparent', couleur: '#95A5A6' },
  { id: 'verre_colore', libelle: 'Verre coloré', court: 'Verre coloré', couleur: '#9B7030' },
  { id: 'organique', libelle: 'Déchets organiques', court: 'Organiques', couleur: '#27AE60' },
  { id: 'residuel', libelle: 'Déchets résiduels', court: 'Résiduels', couleur: '#4a4a4a' },
  { id: 'recyparc', libelle: 'Recyparc', court: 'Recyparc', couleur: '#E74C3C' },
] as const;
export type Bac = (typeof BACS)[number]['id'];

export const COUCHES = [
  { id: 'contenant', libelle: 'Contenant' },
  { id: 'fermeture', libelle: 'Fermeture' },
  { id: 'sur_emballage', libelle: 'Suremballage' },
  { id: 'etiquette', libelle: 'Étiquette' },
  { id: 'calage', libelle: 'Calage' },
  { id: 'autre', libelle: 'Autre' },
] as const;
export type Couche = (typeof COUCHES)[number]['id'];

export const NIVEAUX = [
  { id: 'unite', libelle: 'Unité' },
  { id: 'pack', libelle: 'Lot' },
] as const;
export type Niveau = (typeof NIVEAUX)[number]['id'];

export const SOURCES = [
  { id: 'moi', libelle: 'Moi' },
  { id: 'intradel', libelle: 'Intradel' },
  { id: 'off', libelle: 'Open Food Facts' },
  { id: 'doute', libelle: 'Doute' },
] as const;
export type Source = (typeof SOURCES)[number]['id'];

export const ORIGINES: Record<string, string> = {
  off: 'Open Food Facts',
  obf: 'Open Beauty Facts',
  opf: 'Open Products Facts',
  proserpine: 'Ajouté par Proserpine',
};

export const bac = (id: string | null) => BACS.find((b) => b.id === id) ?? null;
export const libelleCouche = (id: string) => COUCHES.find((c) => c.id === id)?.libelle ?? id;

export type StatutProposition = 'en_attente' | 'accepte' | 'refuse';
export type EmballagePropose = { niveau: Niveau; couche: Couche; nom: string; bac: Bac | null };

export type Proposition = {
  id: number;
  ean: string;
  nom: string;
  marque: string | null;
  emballages_proposes: EmballagePropose[] | null;
  statut: StatutProposition;
  motif_refus: string | null;
  cree_le: string;
  traite_le: string | null;
  utilisateur_id: string | null;
  deja_connu: boolean;
  nb_meme_code: number;
};

export type ListePropositions = { compteurs: Record<StatutProposition, number>; propositions: Proposition[] };

/** Un emballage tel que l'administrateur le saisit (avec sa source et un commentaire). */
export type Emballage = {
  niveau: Niveau;
  couche: Couche;
  nom: string;
  bac: Bac | null;
  source: Source;
  commentaire: string | null;
};

export type ProduitResume = {
  ean: string;
  origine: string;
  nom: string | null;
  marque: string | null;
  quantite: string | null;
  modifie_par_proserpine: boolean;
  nb_emballages: number;
};

export type FicheEmballages = { ean: string; nom: string | null; marque: string | null; emballages: (Emballage & { id: number })[] };

/** Limites de la base pour l'administration. */
export const MAX_EMBALLAGES = 20;

/** Première lettre en majuscule (« sachet plastique » → « Sachet plastique »), le reste inchangé. */
export const majuscule = (texte: string) => {
  const t = texte.trim();
  return t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);
};
const propres = (liste: Emballage[]) => liste.map((e) => ({ ...e, nom: majuscule(e.nom) }));

export const emballagesComplets = (liste: Emballage[]) => liste.every((e) => e.nom.trim().length > 0);

export const listerPropositions = (statut: StatutProposition): Promise<ReponseApi<ListePropositions>> =>
  appelerApi<ListePropositions>('admin_lister_propositions', { statut });

export const accepterProposition = (id: number, c: { nom: string; marque: string; emballages: Emballage[] | null }) =>
  appelerApi('admin_decider', { id, decision: 'accepter', ...c, emballages: c.emballages ? propres(c.emballages) : null });

export const refuserProposition = (id: number, motif: string) => appelerApi('admin_decider', { id, decision: 'refuser', motif });

export const chercherProduits = (terme: string) => appelerApi<{ produits: ProduitResume[] }>('admin_chercher_produits', { terme });

export const creerProduit = (p: { ean: string; nom: string; marque: string; quantite: string }) => appelerApi('admin_creer_produit', p);

export const modifierProduit = (p: { ean: string; nom: string; marque: string; quantite: string }) =>
  appelerApi('admin_modifier_produit', p);

export const lireEmballages = (ean: string) => appelerApi<FicheEmballages>('admin_lire_emballages', { ean });

export const remplacerEmballages = (ean: string, emballages: Emballage[]) =>
  appelerApi<{ nb_emballages: number }>('admin_remplacer_emballages', { ean, emballages: propres(emballages) });

export const dateCourte = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-BE') : '—');
