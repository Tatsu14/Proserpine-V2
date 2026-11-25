/**
 * Appels à la fonction serveur « proserpine-api » (base de produits Supabase).
 * Le serveur vérifie le jeton Firebase et refuse toute action d'administration à un autre compte
 * que ceux autorisés : masquer un écran ne suffirait pas, c'est le serveur qui protège.
 * Aucune fonction ne lève d'exception : on reçoit { ok: true, donnees } ou { ok: false, erreur }.
 */
import { auth } from './firebase';

export const URL_API = 'https://xocrwnuwzhkdehrqwfgo.supabase.co/functions/v1/proserpine-api';

export type ReponseApi<T> = { ok: true; donnees: T } | { ok: false; erreur: string; statut: number };

const MESSAGES: Record<string, string> = {
  non_connecte: 'Connectez-vous pour continuer.',
  non_authentifie: 'Votre session a expiré. Reconnectez-vous.',
  reserve_administrateur: 'Ce compte n’est pas autorisé à administrer Proserpine.',
  ean_invalide: 'Ce code-barres n’est pas valide (vérifiez les chiffres).',
  nom_invalide: 'Le nom doit faire entre 2 et 150 caractères.',
  marque_invalide: 'La marque ou la quantité est trop longue.',
  emballages_invalides: 'Un des emballages est incomplet ou incorrect.',
  motif_requis: 'Indiquez un motif de refus.',
  deja_connu: 'Ce produit est déjà dans la base.',
  deja_traitee: 'Cette proposition a déjà été traitée.',
  non_trouve: 'Élément introuvable.',
  terme_invalide: 'Recherche trop longue.',
  reseau: 'Connexion impossible. Vérifiez votre connexion internet.',
  delai: 'Le serveur met trop de temps à répondre. Réessayez.',
  erreur_serveur: 'Une erreur est survenue côté serveur. Réessayez plus tard.',
};

export const messageErreur = (code: string) => MESSAGES[code] ?? MESSAGES.erreur_serveur;

async function envoyer<T>(jeton: string, action: string, params: Record<string, unknown>): Promise<ReponseApi<T>> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 15_000);
  try {
    const reponse = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ ...params, action }),
      signal: controleur.signal,
    });
    const corps = (await reponse.json().catch(() => null)) as { ok?: boolean; donnees?: T; erreur?: string } | null;
    if (reponse.ok && corps?.ok) return { ok: true, donnees: corps.donnees as T };
    return { ok: false, erreur: typeof corps?.erreur === 'string' ? corps.erreur : 'erreur_serveur', statut: reponse.status };
  } catch (e) {
    return { ok: false, erreur: e instanceof DOMException && e.name === 'AbortError' ? 'delai' : 'reseau', statut: 0 };
  } finally {
    clearTimeout(minuterie);
  }
}

/** Appelle une action ; si le jeton a expiré (401), en redemande un neuf et réessaie une fois. */
export async function appelerApi<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<ReponseApi<T>> {
  const user = auth.currentUser;
  if (!user) return { ok: false, erreur: 'non_connecte', statut: 0 };
  let jeton: string;
  try {
    jeton = await user.getIdToken();
  } catch {
    return { ok: false, erreur: 'reseau', statut: 0 };
  }
  const premier = await envoyer<T>(jeton, action, params);
  if (premier.ok || premier.statut !== 401) return premier;
  try {
    jeton = await user.getIdToken(true);
  } catch {
    return premier;
  }
  return envoyer<T>(jeton, action, params);
}
