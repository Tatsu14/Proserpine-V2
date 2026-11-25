/**
 * RETOURS — avis, problèmes signalés et consignes signalées comme fausses (Firestore).
 * Un clic sur un statut le fait avancer (Nouveau → En cours → Traité) ; un clic sur une consigne ouvre le
 * produit dans « Produits » pour la corriger. Le rapport texte se colle dans une conversation Claude Code.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Chargement, Icone, useUi } from '../composants/ui';
import {
  BACS_APP,
  changerStatut,
  chargerRetours,
  construireRapport,
  FONCTIONNALITES,
  GRAVITES,
  libelle,
  noteMoyenne,
  ORIGINES_CONSIGNE,
  STATUTS,
  statutSuivant,
  TYPES_AVIS,
  type Statut,
  type TousLesRetours,
  type TypeRetour,
} from '../services/retours';

const ONGLETS: { id: TypeRetour; libelle: string }[] = [
  { id: 'avis', libelle: 'Avis' },
  { id: 'problemes', libelle: 'Problèmes' },
  { id: 'consignes', libelle: 'Consignes' },
];

const dateCourte = (d: Date | null) => (d ? d.toLocaleDateString('fr-BE') : '—');

function PuceStatut({ statut, onClick }: { statut: Statut; onClick: () => void }) {
  const classe = statut === 'traite' ? 'bon' : statut === 'en_cours' ? 'att' : 'rouge';
  return (
    <button
      className={`pastille ${classe}`}
      title="Cliquer pour passer au statut suivant"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {libelle(STATUTS, statut)}
    </button>
  );
}

function Bacs({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <span className="meta">Rien proposé</span>;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      {ids.map((id) => {
        const b = BACS_APP.find((x) => x.id === id);
        return (
          <span key={id} className="court">
            <span className="carre" style={{ background: b?.couleur ?? 'var(--discret)' }} />
            {b?.libelle ?? id}
          </span>
        );
      })}
    </span>
  );
}

export function Retours({ onNouveaux, onOuvrirProduit }: { onNouveaux: (n: number) => void; onOuvrirProduit: (ean: string) => void }) {
  const ui = useUi();
  const [onglet, setOnglet] = useState<TypeRetour>('consignes');
  const [filtre, setFiltre] = useState<'tous' | Statut>('tous');
  const [donnees, setDonnees] = useState<TousLesRetours | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const r = await chargerRetours();
    if (r.ok) setDonnees(r.donnees);
    else setErreur(r.erreur);
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const nouveaux = useMemo(
    () => (donnees ? [...donnees.avis, ...donnees.problemes, ...donnees.consignes].filter((r) => r.statut === 'nouveau').length : 0),
    [donnees],
  );
  useEffect(() => {
    if (donnees) onNouveaux(nouveaux);
  }, [donnees, nouveaux, onNouveaux]);

  async function avancer(type: TypeRetour, id: string, courant: Statut) {
    if (!donnees) return;
    const suivant = statutSuivant(courant);
    const maj = (s: Statut) => (d: TousLesRetours | null): TousLesRetours | null =>
      d && {
        ...d,
        [type]: (d[type] as { id: string; statut: Statut }[]).map((r) => (r.id === id ? { ...r, statut: s } : r)),
      };
    setDonnees(maj(suivant)); // affichage immédiat, annulé si l'écriture échoue
    if (!(await changerStatut(type, id, suivant))) {
      setDonnees(maj(courant));
      ui.toast("Le statut n'a pas pu être modifié.", true);
    }
  }

  async function copier(seulementNouveaux: boolean) {
    if (!donnees) return;
    const garder = <T extends { statut: Statut }>(l: T[]) => (seulementNouveaux ? l.filter((r) => r.statut === 'nouveau') : l);
    const choix = { avis: garder(donnees.avis), problemes: garder(donnees.problemes), consignes: garder(donnees.consignes) };
    if (choix.avis.length + choix.problemes.length + choix.consignes.length === 0) {
      ui.toast('Aucun retour à exporter.', true);
      return;
    }
    const rapport = construireRapport(choix);
    if (seulementNouveaux) {
      try {
        await navigator.clipboard.writeText(rapport);
        ui.toast('Rapport copié : collez-le dans une conversation Claude Code.');
      } catch {
        ui.toast('La copie a échoué : utilisez « Tout exporter ».', true);
      }
    } else {
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(new Blob([rapport], { type: 'text/plain;charset=utf-8' }));
      lien.download = `retours-proserpine-${new Date().toISOString().slice(0, 10)}.txt`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    }
  }

  const garde = <T extends { statut: Statut }>(l: T[]) => (filtre === 'tous' ? l : l.filter((r) => r.statut === filtre));
  const moyenne = donnees ? noteMoyenne(donnees.avis) : null;
  const bloquants = donnees ? donnees.problemes.filter((p) => p.gravite === 'bloquant' && p.statut !== 'traite').length : 0;
  const lignes = donnees ? garde(donnees[onglet] as { statut: Statut }[]).length : 0;

  return (
    <div className="main">
      <div className="haut">
        <div>
          <h1>Retours</h1>
          <div className="sous">Avis, problèmes signalés et consignes signalées comme fausses.</div>
        </div>
        <div className="droite">
          <button className="btn" onClick={() => copier(true)} disabled={!donnees}>
            <Icone nom="content_copy" />
            Copier les nouveaux pour Claude
          </button>
          <button className="btn" onClick={() => copier(false)} disabled={!donnees}>
            <Icone nom="download" />
            Tout exporter
          </button>
          <button className="btn" onClick={charger} disabled={chargement} aria-label="Actualiser" title="Actualiser">
            <Icone nom="refresh" />
          </button>
        </div>
      </div>
      <div className="corps">
        <div className="liste">
          {erreur ? <p className="erreur">{erreur}</p> : null}
          {chargement && !donnees ? <Chargement /> : null}
          {donnees ? (
            <>
              <div className="compteurs">
                <div className="cpt">
                  <b>{donnees.avis.length}</b>
                  <span>Avis</span>
                </div>
                <div className="cpt">
                  <b>{moyenne === null ? '—' : `${String(moyenne).replace('.', ',')}/5`}</b>
                  <span>Note moyenne</span>
                </div>
                <div className="cpt">
                  <b>{nouveaux}</b>
                  <span>Nouveaux</span>
                </div>
                <div className={`cpt${bloquants > 0 ? ' rouge' : ''}`}>
                  <b>{bloquants}</b>
                  <span>Problème{bloquants > 1 ? 's' : ''} bloquant{bloquants > 1 ? 's' : ''} ouvert{bloquants > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="filtres">
                <div className="onglets">
                  {ONGLETS.map((o) => (
                    <button key={o.id} className={`onglet${onglet === o.id ? ' on' : ''}`} onClick={() => setOnglet(o.id)}>
                      {o.libelle} <span>{donnees[o.id].length}</span>
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1 }} />
                <select className="choix" value={filtre} onChange={(e) => setFiltre(e.target.value as 'tous' | Statut)} aria-label="Filtrer par statut">
                  <option value="tous">Statut : tous</option>
                  {STATUTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
              </div>

              {lignes === 0 ? <div className="vide">Aucun retour ici.</div> : null}

              {onglet === 'consignes' && lignes > 0 ? (
                <table className="tab">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Consigne affichée</th>
                      <th>Proposé par l'utilisateur</th>
                      <th>Commentaire</th>
                      <th>Reçu le</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {garde(donnees.consignes).map((c) => (
                      <tr key={c.id} className="cliquable" title="Ouvrir ce produit dans « Produits »" onClick={() => onOuvrirProduit(c.ean)}>
                        <td>
                          <div className="nom">{c.nom || 'Produit sans nom'}</div>
                          <div className="mono">{c.ean}</div>
                        </td>
                        <td>
                          <Bacs ids={c.triAffiche} />
                          <div className="meta">{ORIGINES_CONSIGNE[c.origine] ?? c.origine}</div>
                        </td>
                        <td>
                          <Bacs ids={c.triSuggere} />
                        </td>
                        <td className="meta texte-long">{c.commentaire || '—'}</td>
                        <td className="meta court">{dateCourte(c.creeLe)}</td>
                        <td>
                          <PuceStatut statut={c.statut} onClick={() => avancer('consignes', c.id, c.statut)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              {onglet === 'avis' && lignes > 0 ? (
                <table className="tab">
                  <thead>
                    <tr>
                      <th>Fonctionnalité</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th>Commentaire</th>
                      <th>Appareil</th>
                      <th>Reçu le</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {garde(donnees.avis).map((a) => (
                      <tr key={a.id}>
                        <td className="nom court">{libelle(FONCTIONNALITES, a.fonctionnalite)}</td>
                        <td className="court">{libelle(TYPES_AVIS, a.type)}</td>
                        <td className="court">{a.note}/5</td>
                        <td className="texte-long">{a.commentaire || <span className="meta">—</span>}</td>
                        <td className="meta">
                          v{a.versionApp} · {a.plateforme}
                          {a.modeleAppareil ? ` · ${a.modeleAppareil}` : ''}
                        </td>
                        <td className="meta court">{dateCourte(a.creeLe)}</td>
                        <td>
                          <PuceStatut statut={a.statut} onClick={() => avancer('avis', a.id, a.statut)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              {onglet === 'problemes' && lignes > 0 ? (
                <table className="tab">
                  <thead>
                    <tr>
                      <th>Fonctionnalité</th>
                      <th>Gravité</th>
                      <th>Ce que faisait l'utilisateur</th>
                      <th>Description</th>
                      <th>Appareil</th>
                      <th>Reçu le</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {garde(donnees.problemes).map((p) => (
                      <tr key={p.id}>
                        <td className="nom court">{libelle(FONCTIONNALITES, p.fonctionnalite)}</td>
                        <td className="court">
                          <span className={`pastille ${p.gravite === 'bloquant' ? 'rouge' : 'gris'}`}>{libelle(GRAVITES, p.gravite)}</span>
                        </td>
                        <td className="meta">{p.action || '—'}</td>
                        <td className="texte-long">{p.description}</td>
                        <td className="meta">
                          v{p.versionApp} · {p.plateforme}
                          {p.modeleAppareil ? ` · ${p.modeleAppareil}` : ''}
                        </td>
                        <td className="meta court">{dateCourte(p.creeLe)}</td>
                        <td>
                          <PuceStatut statut={p.statut} onClick={() => avancer('problemes', p.id, p.statut)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              {lignes > 0 ? (
                <p className="aide">
                  Cliquez sur un statut pour le faire avancer : Nouveau → En cours → Traité.
                  {onglet === 'consignes' ? ' Un clic sur une ligne ouvre le produit dans « Produits » pour corriger sa consigne.' : ''} Les{' '}
                  200 retours les plus récents de chaque type sont chargés.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
