/**
 * Site d'administration de Proserpine : connexion, puis menu (Propositions, Produits, Retours).
 * Le compteur de propositions en attente est chargé dès l'ouverture (décision du 24/11 : pas de message
 * à chaque proposition, mais un compteur visible en arrivant sur le site).
 */
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

import { FournisseurUi, Icone } from './composants/ui';
import { Connexion } from './pages/Connexion';
import { Produits } from './pages/Produits';
import { Propositions } from './pages/Propositions';
import { Retours } from './pages/Retours';
import { messageErreur } from './services/api';
import { listerPropositions } from './services/base';
import { auth } from './services/firebase';

type Page = 'propositions' | 'produits' | 'retours';
const PAGES: Page[] = ['propositions', 'produits', 'retours'];

function pageDepuisAdresse(): Page {
  const p = window.location.hash.replace('#/', '') as Page;
  return PAGES.includes(p) ? p : 'propositions';
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="plein">Chargement…</div>;
  return <FournisseurUi>{user ? <Espace user={user} /> : <Connexion />}</FournisseurUi>;
}

function Espace({ user }: { user: User }) {
  const [page, setPage] = useState<Page>(pageDepuisAdresse);
  const [attente, setAttente] = useState<number | null>(null);
  const [nouveaux, setNouveaux] = useState<number | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [produitDemande, setProduitDemande] = useState({ terme: '', fois: 0 });

  // Premier appel : vérifie que ce compte est bien administrateur, et charge le compteur.
  useEffect(() => {
    listerPropositions('en_attente').then((r) => {
      if (r.ok) setAttente(r.donnees.compteurs.en_attente);
      else if (r.erreur === 'reserve_administrateur') setRefus(messageErreur(r.erreur));
    });
  }, []);

  useEffect(() => {
    const suivre = () => setPage(pageDepuisAdresse());
    window.addEventListener('hashchange', suivre);
    return () => window.removeEventListener('hashchange', suivre);
  }, []);

  const aller = (p: Page) => {
    window.location.hash = `/${p}`;
    setPage(p);
  };
  const ouvrirProduit = useCallback((ean: string) => {
    setProduitDemande((d) => ({ terme: ean, fois: d.fois + 1 }));
    window.location.hash = '/produits';
    setPage('produits');
  }, []);

  if (refus) {
    return (
      <div className="plein">
        <Icone nom="lock" taille={40} />
        <div>
          <b style={{ color: 'var(--texte)' }}>{refus}</b>
          <p style={{ marginTop: 6 }}>Connecté avec {user.email}.</p>
        </div>
        <button className="btn" onClick={() => signOut(auth)}>
          Se déconnecter
        </button>
      </div>
    );
  }

  const entrees: { id: Page; icone: string; libelle: string; badge: number | null }[] = [
    { id: 'propositions', icone: 'inbox', libelle: 'Propositions', badge: attente },
    { id: 'produits', icone: 'inventory_2', libelle: 'Produits', badge: null },
    { id: 'retours', icone: 'forum', libelle: 'Retours', badge: nouveaux },
  ];

  return (
    <div className="cadre">
      <aside className="lat">
        <div className="logo">
          <img src="/logo.png" alt="" />
          <div>
            <b>Proserpine</b>
            <small>Administration</small>
          </div>
        </div>
        <nav className="nav">
          {entrees.map((e) => (
            <button key={e.id} className={page === e.id ? 'on' : ''} onClick={() => aller(e.id)} aria-current={page === e.id ? 'page' : undefined}>
              <Icone nom={e.icone} />
              {e.libelle}
              {e.badge ? <span className="badge">{e.badge}</span> : null}
            </button>
          ))}
          <div className="sep" />
          <button disabled>
            <Icone nom="insights" />
            Indicateurs<span className="bientot">plus tard</span>
          </button>
          <button disabled>
            <Icone nom="history" />
            Journal<span className="bientot">plus tard</span>
          </button>
        </nav>
        <div className="compte">
          <div>Connecté : {user.email}</div>
          <button onClick={() => signOut(auth)}>
            <Icone nom="logout" taille={18} />
            Se déconnecter
          </button>
        </div>
      </aside>
      {page === 'propositions' ? <Propositions onCompteur={setAttente} /> : null}
      {page === 'produits' ? <Produits key={produitDemande.fois} termeInitial={produitDemande.terme} /> : null}
      {/* Les retours restent chargés en arrière-plan pour tenir le compteur du menu à jour. */}
      <div style={{ display: page === 'retours' ? 'contents' : 'none' }}>
        <Retours onNouveaux={setNouveaux} onOuvrirProduit={ouvrirProduit} />
      </div>
    </div>
  );
}
