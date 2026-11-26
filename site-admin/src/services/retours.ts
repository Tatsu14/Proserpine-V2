/**
 * Retours des utilisateurs (Firestore) : avis, problèmes signalés, consignes signalées comme fausses.
 * Les règles Firestore n'autorisent la lecture et le changement de statut qu'aux comptes administrateurs.
 * Mêmes collections et mêmes libellés que l'application.
 */
import { collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';

import { auth, db } from './firebase';

export const COLLECTIONS = { avis: 'retours_avis', problemes: 'retours_signalements', consignes: 'retours_consignes' } as const;
export type TypeRetour = keyof typeof COLLECTIONS;

/** Bacs de l'app (identifiants des catégories de tri). */
export const BACS_APP = [
  { id: 'pmc', libelle: 'PMC', couleur: '#3498DB' },
  { id: 'paper', libelle: 'Papiers & cartons', couleur: '#F1C40F' },
  { id: 'glass', libelle: 'Verre', couleur: '#95A5A6' },
  { id: 'organic', libelle: 'Déchets organiques', couleur: '#27AE60' },
  { id: 'residual', libelle: 'Déchets résiduels', couleur: '#4a4a4a' },
  { id: 'danger', libelle: 'Recyparc', couleur: '#E74C3C' },
] as const;

export const FONCTIONNALITES = [
  { id: 'scan', libelle: 'Scan' },
  { id: 'recherche', libelle: 'Recherche' },
  { id: 'guide', libelle: 'Guide de tri' },
  { id: 'indice', libelle: "Indice d'impact" },
  { id: 'profil', libelle: 'Profil' },
  { id: 'autre', libelle: 'Autre' },
] as const;

export const TYPES_AVIS = [
  { id: 'idee', libelle: 'Idée' },
  { id: 'difficulte', libelle: 'Difficulté' },
  { id: 'design', libelle: 'Design' },
  { id: 'eloge', libelle: 'Éloge' },
] as const;

export const GRAVITES = [
  { id: 'genant', libelle: 'Gênant' },
  { id: 'bloquant', libelle: 'Bloquant' },
] as const;

export const ORIGINES_CONSIGNE: Record<string, string> = {
  lu: 'Lue sur l’emballage',
  deduit: 'Déduite',
  choisi: 'Choisie par l’utilisateur',
  verifie: 'Vérifiée par Proserpine',
};

export const STATUTS = [
  { id: 'nouveau', libelle: 'Nouveau' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'traite', libelle: 'Traité' },
] as const;
export type Statut = (typeof STATUTS)[number]['id'];

export const LIMITE = 200;

export const libelle = (liste: readonly { id: string; libelle: string }[], id: string) => liste.find((e) => e.id === id)?.libelle ?? id;

type Commun = {
  id: string;
  creeLe: Date | null;
  statut: Statut;
  versionApp: string;
  plateforme: string;
  versionSysteme: string | null;
  modeleAppareil: string | null;
};
export type Avis = Commun & { fonctionnalite: string; type: string; note: number; commentaire: string };
export type Probleme = Commun & { fonctionnalite: string; gravite: string; action: string; description: string };
export type Consigne = Commun & {
  ean: string;
  nom: string;
  triAffiche: string[];
  detailAffiche: string;
  origine: string;
  triSuggere: string[];
  commentaire: string;
};

type Donnees = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const statut = (v: unknown): Statut => (STATUTS.some((s) => s.id === v) ? (v as Statut) : 'nouveau');
const date = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

function commun(id: string, d: Donnees): Commun {
  return {
    id,
    creeLe: date(d.creeLe),
    statut: statut(d.statut),
    versionApp: txt(d.versionApp) || 'inconnue',
    plateforme: txt(d.plateforme) || 'inconnue',
    versionSysteme: txt(d.versionSysteme) || null,
    modeleAppareil: txt(d.modeleAppareil) || null,
  };
}

async function lire(nom: string): Promise<{ id: string; d: Donnees }[]> {
  const instantane = await getDocs(query(collection(db, nom), orderBy('creeLe', 'desc'), limit(LIMITE)));
  return instantane.docs.map((s) => ({ id: s.id, d: s.data() as Donnees }));
}

export type TousLesRetours = { avis: Avis[]; problemes: Probleme[]; consignes: Consigne[] };

/** Charge les trois types de retours. Erreur = règles Firestore qui refusent ce compte, ou réseau. */
const NOMS: Record<TypeRetour, string> = { avis: 'avis', problemes: 'problèmes', consignes: 'consignes (ancien formulaire)' };

/** Lit une collection ; en cas de refus, renvoie une liste vide et le code d'erreur Firestore. */
async function lireSure(nom: string): Promise<{ lignes: { id: string; d: Donnees }[]; code: string | null }> {
  try {
    return { lignes: await lire(nom), code: null };
  } catch (e) {
    return { lignes: [], code: (e as { code?: string })?.code ?? 'inconnu' };
  }
}

/**
 * Charge les trois types de retours, chacun séparément : si Firestore en refuse un (règles), les autres
 * s'affichent quand même, et le message dit exactement lequel est refusé.
 */
export async function chargerRetours(): Promise<{ ok: true; donnees: TousLesRetours; erreur: string | null } | { ok: false; erreur: string }> {
  // Les consignes signalées passent depuis la mise à jour 2 par la base Proserpine (section « Signalements ») :
  // l'ancienne collection Firestore n'est plus lue (sa règle n'a jamais été publiée, elle est restée vide).
  const sansConsignes = { lignes: [] as { id: string; d: Donnees }[], code: null };
  const [a, p, c] = await Promise.all([lireSure(COLLECTIONS.avis), lireSure(COLLECTIONS.problemes), Promise.resolve(sansConsignes)]);
  const refus = (['avis', 'problemes', 'consignes'] as TypeRetour[]).filter((_t, k) => [a, p, c][k].code !== null);
  if (refus.length === 3 && [a, p, c].every((x) => x.code !== 'permission-denied')) {
    return { ok: false, erreur: 'Chargement des retours impossible. Vérifiez votre connexion.' };
  }
  const erreur = refus.length
    ? `Firestore refuse la lecture de : ${refus
        .map((t) => `${NOMS[t]} (collection « ${COLLECTIONS[t]} », ${[a, p, c][(['avis', 'problemes', 'consignes'] as TypeRetour[]).indexOf(t)].code})`)
        .join(' ; ')}. Vérifiez la règle de cette collection dans Firestore (Règles) : elle doit utiliser estAdmin(), qui doit contenir l'UID de ce compte (${auth.currentUser?.uid ?? '?'}).`
    : null;
  return {
    ok: true,
    erreur,
    donnees: {
      avis: a.lignes.map(({ id, d }) => ({
        ...commun(id, d),
        fonctionnalite: txt(d.fonctionnalite),
        type: txt(d.type),
        note: typeof d.note === 'number' ? d.note : 0,
        commentaire: txt(d.commentaire),
      })),
      problemes: p.lignes.map(({ id, d }) => ({
        ...commun(id, d),
        fonctionnalite: txt(d.fonctionnalite),
        gravite: txt(d.gravite),
        action: txt(d.action),
        description: txt(d.description),
      })),
      consignes: c.lignes.map(({ id, d }) => ({
        ...commun(id, d),
        ean: txt(d.ean),
        nom: txt(d.nom),
        triAffiche: liste(d.triAffiche),
        detailAffiche: txt(d.detailAffiche),
        origine: txt(d.origine),
        triSuggere: liste(d.triSuggere),
        commentaire: txt(d.commentaire),
      })),
    },
  };
}

/** Les règles n'autorisent à modifier que le statut. */
export async function changerStatut(type: TypeRetour, id: string, s: Statut): Promise<boolean> {
  try {
    await updateDoc(doc(db, COLLECTIONS[type], id), { statut: s });
    return true;
  } catch {
    return false;
  }
}

export function statutSuivant(s: Statut): Statut {
  const i = STATUTS.findIndex((x) => x.id === s);
  return STATUTS[(i + 1) % STATUTS.length].id;
}

export function noteMoyenne(avis: Avis[]): number | null {
  if (avis.length === 0) return null;
  return Math.round((avis.reduce((t, a) => t + a.note, 0) / avis.length) * 10) / 10;
}

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : 'date inconnue');
const citer = (t: string) => JSON.stringify(t.replace(/\s+/g, ' ').trim());
const appareil = (r: Commun) => [`v${r.versionApp}`, r.plateforme, r.versionSysteme, r.modeleAppareil].filter(Boolean).join(' ');
const bacs = (ids: string[]) => (ids.length ? ids.map((b) => libelle(BACS_APP, b)).join(' + ') : 'rien');

/** Rapport texte à coller dans une conversation Claude Code pour analyser les retours. */
export function construireRapport(r: TousLesRetours, maintenant = new Date()): string {
  const l: string[] = [];
  l.push('# Retours utilisateurs — application Proserpine', '', `Rapport généré le ${jour(maintenant)}.`);
  l.push(
    "Contexte : Proserpine est une application mobile (guide de tri des déchets, scan de codes-barres, indice d'impact). Les retours ci-dessous sont anonymes.",
    '',
    '## Demande',
    'Analyse ces retours puis :',
    '1. dégage les thèmes récurrents ;',
    '2. liste les problèmes bloquants ou gênants à corriger en priorité ;',
    '3. propose des améliorations, classées par impact et par effort estimé, en citant les retours qui les justifient.',
    '',
  );
  l.push(`## Avis (${r.avis.length})`);
  if (r.avis.length) l.push(`Note moyenne : ${noteMoyenne(r.avis)} / 5.`, '');
  for (const a of r.avis) {
    l.push(
      `- ${jour(a.creeLe)} | ${libelle(FONCTIONNALITES, a.fonctionnalite)} | ${libelle(TYPES_AVIS, a.type)} | ${a.note}/5 | ${appareil(a)} | ${a.statut} | ${a.commentaire ? citer(a.commentaire) : '(sans commentaire)'}`,
    );
  }
  l.push('', `## Problèmes signalés (${r.problemes.length})`);
  for (const p of r.problemes) {
    l.push(
      `- ${jour(p.creeLe)} | ${libelle(FONCTIONNALITES, p.fonctionnalite)} | ${libelle(GRAVITES, p.gravite)} | ${appareil(p)} | ${p.statut} | ${p.action ? citer(p.action) : '(non précisé)'} | ${citer(p.description)}`,
    );
  }
  if (r.consignes.length) l.push('', `## Consignes signalées comme fausses (${r.consignes.length})`);
  for (const c of r.consignes) {
    l.push(
      `- ${jour(c.creeLe)} | ${c.ean} ${citer(c.nom)} | affiché : ${bacs(c.triAffiche)}${c.detailAffiche ? ` (${citer(c.detailAffiche)})` : ''} | origine : ${ORIGINES_CONSIGNE[c.origine] ?? c.origine} | suggéré : ${bacs(c.triSuggere)} | ${c.statut} | ${c.commentaire ? citer(c.commentaire) : '(sans commentaire)'}`,
    );
  }
  l.push('');
  return l.join('\n');
}
