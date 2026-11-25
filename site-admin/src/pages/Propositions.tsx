/**
 * PROPOSITIONS — produits proposés depuis l'app. Rien n'est publié sans décision de l'administrateur :
 *  - Accepter : le produit entre dans la base (nom et marque corrigeables) ; les emballages proposés ne sont
 *    importés que si l'administrateur le choisit, après relecture ;
 *  - Refuser : motif obligatoire (liste + précision facultative).
 * Chaque décision est confirmée par une fenêtre avant d'être envoyée.
 */
import { useCallback, useEffect, useState } from 'react';

import { EditeurEmballages } from '../composants/emballages';
import { Chargement, Icone, useUi } from '../composants/ui';
import { messageErreur } from '../services/api';
import {
  accepterProposition,
  bac,
  dateCourte,
  emballagesComplets,
  libelleCouche,
  listerPropositions,
  refuserProposition,
  type Emballage,
  type ListePropositions,
  type Proposition,
  type StatutProposition,
} from '../services/base';

const STATUTS: { id: StatutProposition; libelle: string }[] = [
  { id: 'en_attente', libelle: 'En attente' },
  { id: 'accepte', libelle: 'Acceptées' },
  { id: 'refuse', libelle: 'Refusées' },
];

const MOTIFS = ['Code-barres incorrect', 'Doublon', 'Informations insuffisantes', 'Pas un produit emballé', 'Autre'];

export function Propositions({ onCompteur }: { onCompteur: (n: number) => void }) {
  const [statut, setStatut] = useState<StatutProposition>('en_attente');
  const [donnees, setDonnees] = useState<ListePropositions | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<number | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const r = await listerPropositions(statut);
    if (r.ok) {
      setDonnees(r.donnees);
      onCompteur(r.donnees.compteurs.en_attente);
      const liste = r.donnees.propositions;
      setSelection((s) => (s !== null && liste.some((p) => p.id === s) ? s : (liste[0]?.id ?? null)));
    } else setErreur(messageErreur(r.erreur));
    setChargement(false);
  }, [statut, onCompteur]);

  useEffect(() => {
    charger();
  }, [charger]);

  const liste = donnees?.propositions ?? [];
  const choisie = liste.find((p) => p.id === selection) ?? null;

  return (
    <div className="main">
      <div className="haut">
        <div>
          <h1>Propositions</h1>
          <div className="sous">Produits proposés depuis l'app. Rien n'est publié sans votre accord.</div>
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
                  <th>Code-barres</th>
                  <th>Emballages proposés</th>
                  <th>{statut === 'en_attente' ? 'Proposé le' : 'Traité le'}</th>
                  <th>À noter</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((p) => {
                  const n = p.emballages_proposes?.length ?? 0;
                  return (
                    <tr key={p.id} className={`cliquable${p.id === selection ? ' sel' : ''}`} onClick={() => setSelection(p.id)}>
                      <td>
                        <div className="nom">{p.nom}</div>
                        <div className="meta">{p.marque ?? '—'}</div>
                      </td>
                      <td className="mono">{p.ean}</td>
                      <td className={n ? '' : 'meta'}>{n ? `${n} élément${n > 1 ? 's' : ''}` : 'Aucun'}</td>
                      <td className="meta court">{dateCourte(statut === 'en_attente' ? p.cree_le : p.traite_le)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {p.nb_meme_code > 1 ? <span className="pastille att">Proposé {p.nb_meme_code} fois</span> : null}
                          {p.deja_connu && p.statut === 'en_attente' ? <span className="pastille att">Déjà dans la base</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : !chargement && !erreur ? (
            <div className="vide">Aucune proposition ici.</div>
          ) : null}
        </div>
        {choisie ? <Panneau key={choisie.id} p={choisie} onFermer={() => setSelection(null)} onTraitee={charger} /> : null}
      </div>
    </div>
  );
}

function Panneau({ p, onFermer, onTraitee }: { p: Proposition; onFermer: () => void; onTraitee: () => void }) {
  const ui = useUi();
  const proposes = p.emballages_proposes ?? [];
  const enAttente = p.statut === 'en_attente';
  const [nom, setNom] = useState(p.nom);
  const [marque, setMarque] = useState(p.marque ?? '');
  const [importer, setImporter] = useState(false);
  const [emballages, setEmballages] = useState<Emballage[]>(
    proposes.map((e) => ({ ...e, source: e.bac ? 'moi' : 'doute', commentaire: 'Proposé par un utilisateur' })),
  );
  const [motif, setMotif] = useState<string | null>(null);
  const [precision, setPrecision] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const nomValide = nom.trim().length >= 2 && nom.trim().length <= 150;
  const peutAccepter = nomValide && (!importer || (emballages.length > 0 && emballagesComplets(emballages))) && !envoi;
  const texteMotif = [motif, precision.trim()].filter(Boolean).join(' : ').slice(0, 300);

  function accepter() {
    const avec = importer ? ` avec ${emballages.length} emballage${emballages.length > 1 ? 's' : ''}` : ', sans emballages';
    ui.confirmer({
      titre: 'Accepter la proposition ?',
      message: `« ${nom.trim()} » (${p.ean}) sera ajouté à la base${avec}. Il deviendra visible par tous les utilisateurs.`,
      confirmer: 'Accepter',
      onConfirmer: async () => {
        setEnvoi(true);
        const r = await accepterProposition(p.id, { nom: nom.trim(), marque: marque.trim(), emballages: importer ? emballages : null });
        setEnvoi(false);
        if (r.ok) {
          ui.toast('Proposition acceptée : le produit est dans la base.');
          onTraitee();
        } else ui.toast(messageErreur(r.erreur), true);
      },
    });
  }

  function refuser() {
    if (!texteMotif) {
      ui.toast('Choisissez un motif de refus (ou écrivez une précision).', true);
      return;
    }
    ui.confirmer({
      titre: 'Refuser la proposition ?',
      message: `Motif : « ${texteMotif} ». Le produit ne sera pas ajouté.`,
      confirmer: 'Refuser',
      danger: true,
      onConfirmer: async () => {
        setEnvoi(true);
        const r = await refuserProposition(p.id, texteMotif);
        setEnvoi(false);
        if (r.ok) {
          ui.toast('Proposition refusée.');
          onTraitee();
        } else ui.toast(messageErreur(r.erreur), true);
      },
    });
  }

  return (
    <aside className={`panneau${importer ? ' large' : ''}`}>
      <div className="p-haut">
        <div>
          <h2>{p.nom}</h2>
          <div className="mono" style={{ marginTop: 4 }}>
            {p.ean} · {p.utilisateur_id ? `compte ${p.utilisateur_id.slice(0, 6)}…` : 'compte effacé'} · proposé le {dateCourte(p.cree_le)}
          </div>
        </div>
        <button className="btn-icone" onClick={onFermer} aria-label="Fermer">
          <Icone nom="close" />
        </button>
      </div>
      <div className="p-corps">
        {p.nb_meme_code > 1 ? (
          <div className="alerte">
            <Icone nom="info" taille={18} />
            Ce code a été proposé {p.nb_meme_code} fois.
          </div>
        ) : null}
        {p.deja_connu && enAttente ? (
          <div className="alerte">
            <Icone nom="info" taille={18} />
            Ce produit est déjà dans la base : accepter ne créera pas de doublon.
          </div>
        ) : null}
        {!enAttente ? (
          <div className="info">
            <Icone nom={p.statut === 'accepte' ? 'check_circle' : 'block'} taille={18} />
            {p.statut === 'accepte' ? `Acceptée le ${dateCourte(p.traite_le)}.` : `Refusée le ${dateCourte(p.traite_le)}. Motif : ${p.motif_refus ?? '—'}`}
          </div>
        ) : null}

        <div className="grille">
          <div>
            <label className="lab" htmlFor="nom">
              {enAttente ? 'Nom (corrigez si besoin)' : 'Nom'}
            </label>
            <input id="nom" className={`champ${nomValide ? '' : ' invalide'}`} value={nom} maxLength={150} disabled={!enAttente} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <label className="lab" htmlFor="marque">
              Marque
            </label>
            <input id="marque" className="champ" value={marque} maxLength={100} disabled={!enAttente} onChange={(e) => setMarque(e.target.value)} />
          </div>
        </div>

        <div className="bloc-titre">Emballages proposés</div>
        {proposes.length === 0 ? <p className="meta" style={{ marginBottom: 14 }}>Aucun emballage proposé.</p> : null}
        {!importer
          ? proposes.map((e, i) => {
              const b = bac(e.bac);
              return (
                <div key={i} className="emb">
                  <span className="carre" style={{ background: b?.couleur ?? 'var(--discret)' }} />
                  <div>
                    <b>{e.nom}</b>
                    <div className="meta">
                      {libelleCouche(e.couche)} · {b?.libelle ?? 'bac inconnu'}
                      {e.niveau === 'pack' ? ' · lot' : ''}
                    </div>
                  </div>
                </div>
              );
            })
          : null}
        {enAttente && proposes.length > 0 ? (
          <>
            <div className="bascule">
              <button className={importer ? '' : 'on'} onClick={() => setImporter(false)}>
                Ne pas importer
              </button>
              <button className={importer ? 'on' : ''} onClick={() => setImporter(true)}>
                Importer après relecture
              </button>
            </div>
            {importer ? (
              <>
                <p className="aide" style={{ margin: '0 0 10px' }}>
                  Relisez chaque élément : il deviendra une consigne affichée à tous comme « Vérifié par Proserpine ».
                </p>
                <EditeurEmballages valeur={emballages} onChange={setEmballages} />
              </>
            ) : null}
          </>
        ) : null}

        {enAttente ? (
          <>
            <div className="trait" />
            <div className="bloc-titre">Refuser ? Choisissez un motif</div>
            <div className="puces">
              {MOTIFS.map((m) => (
                <button key={m} className={`puce${motif === m ? ' on' : ''}`} onClick={() => setMotif(motif === m ? null : m)}>
                  {m}
                </button>
              ))}
            </div>
            <label className="lab" htmlFor="precision">
              Précision (facultatif)
            </label>
            <input
              id="precision"
              className="champ"
              value={precision}
              maxLength={200}
              placeholder="Ex. : le code correspond à un autre produit"
              onChange={(e) => setPrecision(e.target.value)}
            />
          </>
        ) : null}
      </div>
      {enAttente ? (
        <div className="p-pied">
          <button className="btn p grand" onClick={accepter} disabled={!peutAccepter}>
            <Icone nom="check" />
            Accepter
          </button>
          <button className="btn d grand" onClick={refuser} disabled={envoi}>
            <Icone nom="block" />
            Refuser
          </button>
        </div>
      ) : null}
    </aside>
  );
}
