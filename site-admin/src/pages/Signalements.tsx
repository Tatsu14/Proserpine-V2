/**
 * SIGNALEMENTS — erreurs signalées depuis la fiche produit de l'app :
 *  - consigne : élément par élément, le bac affiché et le bac proposé (ou un élément manquant) ;
 *  - produit  : nom, marque, quantité faux, ou le code-barres correspond à un autre produit.
 * Un clic sur « Corriger » ouvre le produit dans « Produits ». Le statut avance d'un clic.
 */
import { useCallback, useEffect, useState } from 'react';

import { Chargement, Icone, useUi } from '../composants/ui';
import { messageErreur } from '../services/api';
import {
  BACS_APP,
  changerStatutSignalement,
  CHAMPS_PRODUIT,
  dateCourte,
  listerSignalements,
  ORIGINES_CONSIGNE,
  type ListeSignalements,
  type Signalement,
  type StatutSignalement,
} from '../services/base';

const STATUTS: { id: StatutSignalement; libelle: string }[] = [
  { id: 'nouveau', libelle: 'Nouveaux' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'traite', libelle: 'Traités' },
];
const SUIVANT: Record<StatutSignalement, StatutSignalement> = { nouveau: 'en_cours', en_cours: 'traite', traite: 'nouveau' };
const LIBELLE_STATUT: Record<StatutSignalement, string> = { nouveau: 'Nouveau', en_cours: 'En cours', traite: 'Traité' };
const CLASSE_STATUT: Record<StatutSignalement, string> = { nouveau: 'rouge', en_cours: 'att', traite: 'bon' };

function Bac({ id }: { id: string | null }) {
  if (!id) return <span className="meta">Je ne sais pas</span>;
  const b = BACS_APP[id];
  return (
    <span className="court">
      <span className="carre" style={{ background: b?.couleur ?? 'var(--discret)' }} />
      {b?.libelle ?? id}
    </span>
  );
}

function Detail({ s }: { s: Signalement }) {
  if (s.type === 'produit') {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: s.correction ? 6 : 0 }}>
          {s.champs.map((c) => (
            <span key={c} className="pastille att">
              {CHAMPS_PRODUIT[c] ?? c}
            </span>
          ))}
        </div>
        {s.correction ? <div>« {s.correction} »</div> : null}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {s.elements.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <b>{e.nom}</b>
          {e.ajoute ? (
            <>
              <span className="pastille gris">manquant</span>
              <Icone nom="arrow_forward" taille={16} />
              <Bac id={e.bac_propose} />
            </>
          ) : (
            <>
              <Bac id={e.bac_affiche} />
              <Icone nom="arrow_forward" taille={16} />
              <Bac id={e.bac_propose} />
            </>
          )}
        </div>
      ))}
      {s.elements.length === 0 ? <span className="meta">Aucun élément précisé</span> : null}
      {s.origine ? <span className="meta">Consigne affichée : {ORIGINES_CONSIGNE[s.origine] ?? s.origine}</span> : null}
    </div>
  );
}

export function Signalements({ onCompteur, onOuvrirProduit }: { onCompteur: (n: number) => void; onOuvrirProduit: (ean: string) => void }) {
  const ui = useUi();
  const [statut, setStatut] = useState<StatutSignalement>('nouveau');
  const [donnees, setDonnees] = useState<ListeSignalements | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const r = await listerSignalements(statut);
    if (r.ok) {
      setDonnees(r.donnees);
      onCompteur(r.donnees.compteurs.nouveau);
    } else setErreur(messageErreur(r.erreur));
    setChargement(false);
  }, [statut, onCompteur]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function avancer(s: Signalement) {
    const r = await changerStatutSignalement(s.id, SUIVANT[s.statut]);
    if (r.ok) {
      ui.toast(`Statut : ${LIBELLE_STATUT[SUIVANT[s.statut]]}.`);
      charger();
    } else ui.toast(messageErreur(r.erreur), true);
  }

  const liste = donnees?.signalements ?? [];

  return (
    <div className="main">
      <div className="haut">
        <div>
          <h1>Signalements</h1>
          <div className="sous">Erreurs signalées depuis la fiche produit : consigne de tri ou informations du produit.</div>
        </div>
        <div className="droite">
          <button className="btn" onClick={charger} disabled={chargement}>
            <Icone nom="refresh" />
            Actualiser
          </button>
        </div>
      </div>
      <div className="corps">
        <div className="liste">
          <div className="onglets" style={{ marginBottom: 16 }}>
            {STATUTS.map((s) => (
              <button key={s.id} className={`onglet${statut === s.id ? ' on' : ''}`} onClick={() => setStatut(s.id)}>
                {s.libelle} <span>{donnees?.compteurs[s.id] ?? '—'}</span>
              </button>
            ))}
          </div>
          {erreur ? <p className="erreur">{erreur}</p> : null}
          {chargement && !donnees ? <Chargement /> : null}
          {liste.length > 0 ? (
            <table className="tab">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Type</th>
                  <th>Erreur signalée</th>
                  <th>Commentaire</th>
                  <th>Reçu le</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="nom">{s.nom_produit ?? 'Produit sans nom'}</div>
                      <div className="mono">{s.ean}</div>
                      <div className="meta">{s.compte ? `compte ${s.compte}…` : 'compte effacé'}</div>
                    </td>
                    <td className="court">
                      <span className={`pastille ${s.type === 'consigne' ? 'bon' : 'gris'}`}>{s.type === 'consigne' ? 'Consigne' : 'Produit'}</span>
                    </td>
                    <td>
                      <Detail s={s} />
                    </td>
                    <td className="meta texte-long">{s.commentaire ?? '—'}</td>
                    <td className="meta court">{dateCourte(s.cree_le)}</td>
                    <td>
                      <button className={`pastille ${CLASSE_STATUT[s.statut]}`} title="Cliquer pour passer au statut suivant" onClick={() => avancer(s)}>
                        {LIBELLE_STATUT[s.statut]}
                      </button>
                    </td>
                    <td className="court">
                      {s.dans_base ? (
                        <button className="btn" onClick={() => onOuvrirProduit(s.ean)}>
                          <Icone nom="edit" taille={18} />
                          Corriger
                        </button>
                      ) : (
                        <span className="meta" title="Ce produit vient d'Open Food Facts : ajoutez-le dans « Produits » pour le corriger.">
                          Pas dans la base
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !chargement && !erreur ? (
            <div className="vide">Aucun signalement ici.</div>
          ) : null}
          {liste.length > 0 ? (
            <p className="aide">
              Cliquez sur un statut pour le faire avancer : Nouveau → En cours → Traité. « Corriger » ouvre le produit dans « Produits ».
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
