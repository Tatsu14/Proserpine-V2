/**
 * PRODUITS — chercher un produit de la base, corriger son identité, saisir ses emballages
 * (la consigne « Vérifié par Proserpine »), ou ajouter un produit absent de la base.
 */
import { useCallback, useEffect, useState } from 'react';

import { EditeurEmballages } from '../composants/emballages';
import { Chargement, Icone, useUi } from '../composants/ui';
import { messageErreur } from '../services/api';
import {
  chercherProduits,
  creerProduit,
  emballagesComplets,
  lireEmballages,
  modifierProduit,
  ORIGINES,
  remplacerEmballages,
  type Emballage,
  type ProduitResume,
} from '../services/base';

type Filtre = 'tous' | 'a_saisir' | 'avec';

export function Produits({ termeInitial }: { termeInitial: string }) {
  const [terme, setTerme] = useState(termeInitial);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [resultats, setResultats] = useState<ProduitResume[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<ProduitResume | null>(null);
  const [ajout, setAjout] = useState(false);

  const chercher = useCallback(async (t: string) => {
    setChargement(true);
    setErreur(null);
    const r = await chercherProduits(t.trim());
    if (r.ok) setResultats(r.donnees.produits);
    else setErreur(messageErreur(r.erreur));
    setChargement(false);
  }, []);

  useEffect(() => {
    setTerme(termeInitial);
    chercher(termeInitial);
  }, [termeInitial, chercher]);

  const affiches = resultats.filter((p) => (filtre === 'tous' ? true : filtre === 'avec' ? p.nb_emballages > 0 : p.nb_emballages === 0));

  return (
    <div className="main">
      <div className="haut">
        <div>
          <h1>Produits</h1>
          <div className="sous">La base de Proserpine. Les emballages saisis ici deviennent la consigne « Vérifié par Proserpine ».</div>
        </div>
        <div className="droite">
          <button
            className="btn p"
            onClick={() => {
              setSelection(null);
              setAjout(true);
            }}
          >
            <Icone nom="add" />
            Ajouter un produit
          </button>
        </div>
      </div>
      <div className="corps">
        <div className="liste">
          <form
            className="filtres"
            onSubmit={(e) => {
              e.preventDefault();
              chercher(terme);
            }}
          >
            <label className="recherche">
              <Icone nom="search" />
              <input value={terme} maxLength={100} placeholder="Code-barres, nom ou marque" onChange={(e) => setTerme(e.target.value)} aria-label="Chercher un produit" />
            </label>
            <select className="choix" value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)} aria-label="Filtrer par consigne">
              <option value="tous">Emballages : tous</option>
              <option value="a_saisir">À saisir</option>
              <option value="avec">Avec consigne</option>
            </select>
          </form>
          {erreur ? <p className="erreur">{erreur}</p> : null}
          {chargement ? <Chargement /> : null}
          {!chargement && affiches.length > 0 ? (
            <table className="tab">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Consigne</th>
                </tr>
              </thead>
              <tbody>
                {affiches.map((p) => (
                  <tr
                    key={p.ean}
                    className={`cliquable${selection?.ean === p.ean ? ' sel' : ''}`}
                    onClick={() => {
                      setAjout(false);
                      setSelection(p);
                    }}
                  >
                    <td>
                      <div className="nom">{p.nom ?? 'Produit sans nom'}</div>
                      <div className="meta">{[p.marque, p.quantite].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="mono">{p.ean}</div>
                    </td>
                    <td>
                      {p.nb_emballages > 0 ? (
                        <span className="pastille bon">
                          <Icone nom="verified" taille={14} />
                          {p.nb_emballages} emballage{p.nb_emballages > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="pastille gris">À saisir</span>
                      )}
                      <div className="meta" style={{ marginTop: 4 }}>
                        {ORIGINES[p.origine] ?? p.origine}
                        {p.modifie_par_proserpine ? ' · corrigé' : ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {!chargement && !erreur && affiches.length === 0 ? <div className="vide">Aucun produit trouvé.</div> : null}
          {!chargement && resultats.length > 0 ? (
            <p className="aide">Les 30 premiers résultats, par ordre alphabétique. Précisez la recherche pour en voir d'autres.</p>
          ) : null}
        </div>
        {ajout ? (
          <FormulaireAjout
            onFermer={() => setAjout(false)}
            onCree={(p) => {
              setAjout(false);
              setResultats((r) => [p, ...r.filter((x) => x.ean !== p.ean)]);
              setSelection(p);
            }}
          />
        ) : null}
        {selection ? (
          <EditeurProduit
            key={selection.ean}
            produit={selection}
            onFermer={() => setSelection(null)}
            onEnregistre={(maj) => {
              setResultats((r) => r.map((x) => (x.ean === maj.ean ? maj : x)));
              setSelection(maj);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

const cleValide = (ean: string) => {
  if (!/^(\d{8}|\d{12,14})$/.test(ean)) return false;
  const chiffres = ean.split('').map(Number);
  const controle = chiffres.pop()!;
  const somme = chiffres.reverse().reduce((t, c, i) => t + c * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (somme % 10)) % 10 === controle;
};

function FormulaireAjout({ onFermer, onCree }: { onFermer: () => void; onCree: (p: ProduitResume) => void }) {
  const ui = useUi();
  const [ean, setEan] = useState('');
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');
  const [quantite, setQuantite] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const eanValide = cleValide(ean);
  const pret = eanValide && nom.trim().length >= 2 && !envoi;

  async function creer() {
    setEnvoi(true);
    const r = await creerProduit({ ean, nom: nom.trim(), marque: marque.trim(), quantite: quantite.trim() });
    setEnvoi(false);
    if (r.ok) {
      ui.toast('Produit ajouté. Saisissez maintenant ses emballages.');
      onCree({ ean, origine: 'proserpine', nom: nom.trim(), marque: marque.trim() || null, quantite: quantite.trim() || null, modifie_par_proserpine: false, nb_emballages: 0 });
    } else ui.toast(messageErreur(r.erreur), true);
  }

  return (
    <aside className="panneau">
      <div className="p-haut">
        <div>
          <h2>Nouveau produit</h2>
          <div className="meta" style={{ marginTop: 4 }}>
            Il sera visible dans l'app dès son ajout.
          </div>
        </div>
        <button className="btn-icone" onClick={onFermer} aria-label="Fermer">
          <Icone nom="close" />
        </button>
      </div>
      <div className="p-corps">
        <label className="lab" htmlFor="n-ean">
          Code-barres
        </label>
        <input
          id="n-ean"
          className={`champ${ean && !eanValide ? ' invalide' : ''}`}
          inputMode="numeric"
          value={ean}
          maxLength={14}
          placeholder="8, 12, 13 ou 14 chiffres"
          onChange={(e) => setEan(e.target.value.replace(/\D/g, '').slice(0, 14))}
        />
        {ean.length >= 8 && !eanValide ? <p className="erreur" style={{ marginTop: -8 }}>Ce code n'est pas valide : vérifiez les chiffres.</p> : null}
        <label className="lab" htmlFor="n-nom">
          Nom
        </label>
        <input id="n-nom" className="champ" value={nom} maxLength={150} onChange={(e) => setNom(e.target.value)} />
        <div className="grille">
          <div>
            <label className="lab" htmlFor="n-marque">
              Marque (facultatif)
            </label>
            <input id="n-marque" className="champ" value={marque} maxLength={100} onChange={(e) => setMarque(e.target.value)} />
          </div>
          <div>
            <label className="lab" htmlFor="n-qte">
              Quantité (facultatif)
            </label>
            <input id="n-qte" className="champ" value={quantite} maxLength={60} placeholder="Ex. : 1 L" onChange={(e) => setQuantite(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="p-pied">
        <button className="btn p grand" onClick={creer} disabled={!pret}>
          {envoi ? 'Envoi…' : 'Ajouter le produit'}
        </button>
      </div>
    </aside>
  );
}

const memes = (a: Emballage[], b: Emballage[]) => JSON.stringify(a) === JSON.stringify(b);

function EditeurProduit({ produit, onFermer, onEnregistre }: { produit: ProduitResume; onFermer: () => void; onEnregistre: (p: ProduitResume) => void }) {
  const ui = useUi();
  const [nom, setNom] = useState(produit.nom ?? '');
  const [marque, setMarque] = useState(produit.marque ?? '');
  const [quantite, setQuantite] = useState(produit.quantite ?? '');
  const [origine, setOrigine] = useState<Emballage[]>([]);
  const [emballages, setEmballages] = useState<Emballage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const r = await lireEmballages(produit.ean);
    if (r.ok) {
      const liste = r.donnees.emballages.map(({ niveau, couche, nom: n, bac, source, commentaire }) => ({ niveau, couche, nom: n, bac, source, commentaire }));
      setOrigine(liste);
      setEmballages(liste);
    } else setErreur(messageErreur(r.erreur));
    setChargement(false);
  }, [produit.ean]);

  useEffect(() => {
    charger();
  }, [charger]);

  const identiteModifiee = nom.trim() !== (produit.nom ?? '') || marque.trim() !== (produit.marque ?? '') || quantite.trim() !== (produit.quantite ?? '');
  const emballagesModifies = !chargement && !erreur && !memes(emballages, origine);
  const nomValide = nom.trim().length >= 2;
  const pret = (identiteModifiee || emballagesModifies) && nomValide && emballagesComplets(emballages) && !envoi;

  function enregistrer() {
    const parties = [identiteModifiee ? 'le nom, la marque ou la quantité' : null, emballagesModifies ? `les emballages (${emballages.length} élément${emballages.length > 1 ? 's' : ''})` : null].filter(Boolean);
    ui.confirmer({
      titre: 'Enregistrer les modifications ?',
      message:
        emballagesModifies && emballages.length === 0
          ? 'Tous les emballages de ce produit seront supprimés : la fiche reviendra au calcul d’Open Food Facts.'
          : `Vous modifiez ${parties.join(' et ')}. Le changement sera visible dans l'app${emballagesModifies ? ' comme consigne « Vérifié par Proserpine »' : ''}.`,
      confirmer: 'Enregistrer',
      onConfirmer: async () => {
        setEnvoi(true);
        let maj = produit;
        if (identiteModifiee) {
          const r = await modifierProduit({ ean: produit.ean, nom: nom.trim(), marque: marque.trim(), quantite: quantite.trim() });
          if (!r.ok) {
            setEnvoi(false);
            ui.toast(messageErreur(r.erreur), true);
            return;
          }
          maj = { ...maj, nom: nom.trim(), marque: marque.trim() || null, quantite: quantite.trim() || null, modifie_par_proserpine: true };
        }
        if (emballagesModifies) {
          const r = await remplacerEmballages(produit.ean, emballages);
          if (!r.ok) {
            setEnvoi(false);
            ui.toast(messageErreur(r.erreur), true);
            if (identiteModifiee) onEnregistre(maj);
            return;
          }
          maj = { ...maj, nb_emballages: r.donnees.nb_emballages ?? emballages.length };
          setOrigine(emballages);
        }
        setEnvoi(false);
        ui.toast('Modifications enregistrées.');
        onEnregistre(maj);
      },
    });
  }

  return (
    <aside className="panneau large">
      <div className="p-haut">
        <div>
          <h2>{produit.nom ?? 'Produit sans nom'}</h2>
          <div className="mono" style={{ marginTop: 4 }}>
            {produit.ean} · {ORIGINES[produit.origine] ?? produit.origine}
          </div>
        </div>
        <button className="btn-icone" onClick={onFermer} aria-label="Fermer">
          <Icone nom="close" />
        </button>
      </div>
      <div className="p-corps">
        <div className="grille trois">
          <div>
            <label className="lab" htmlFor="e-nom">
              Nom
            </label>
            <input id="e-nom" className={`champ${nomValide ? '' : ' invalide'}`} value={nom} maxLength={150} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <label className="lab" htmlFor="e-marque">
              Marque
            </label>
            <input id="e-marque" className="champ" value={marque} maxLength={100} onChange={(e) => setMarque(e.target.value)} />
          </div>
          <div>
            <label className="lab" htmlFor="e-qte">
              Quantité
            </label>
            <input id="e-qte" className="champ" value={quantite} maxLength={60} onChange={(e) => setQuantite(e.target.value)} />
          </div>
        </div>
        <div className="bloc-titre">Emballages (consigne de tri)</div>
        {chargement ? <Chargement /> : null}
        {erreur ? <p className="erreur">{erreur}</p> : null}
        {!chargement && !erreur ? <EditeurEmballages valeur={emballages} onChange={setEmballages} /> : null}
      </div>
      <div className="p-pied">
        <button className="btn p grand" onClick={enregistrer} disabled={!pret}>
          {envoi ? 'Envoi…' : 'Enregistrer les modifications'}
        </button>
        <button
          className="btn"
          style={{ height: 44 }}
          disabled={envoi || !(identiteModifiee || emballagesModifies)}
          onClick={() => {
            setNom(produit.nom ?? '');
            setMarque(produit.marque ?? '');
            setQuantite(produit.quantite ?? '');
            setEmballages(origine);
          }}
        >
          Annuler
        </button>
      </div>
    </aside>
  );
}
