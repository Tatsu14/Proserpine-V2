/** Connexion par e-mail et mot de passe (compte administrateur créé dans la console Firebase). */
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';

import { Icone } from '../composants/ui';
import { auth } from '../services/firebase';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-email': 'Cette adresse e-mail n’est pas valide.',
  'auth/too-many-requests': 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
  'auth/network-request-failed': 'Connexion impossible. Vérifiez votre connexion internet.',
  'auth/user-disabled': 'Ce compte est désactivé.',
};

export function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setErreur(MESSAGES[code] ?? 'La connexion a échoué. Réessayez.');
      setEnvoi(false);
    }
  }

  return (
    <div className="connexion">
      <div className="cote">
        <div>
          <div className="logo">
            <img src="/logo.png" alt="" />
            <div>
              <b>Proserpine</b>
              <small>Administration</small>
            </div>
          </div>
          <h2>
            La base de produits
            <br />
            de Proserpine.
          </h2>
          <p>Relisez les produits proposés par les utilisateurs, corrigez les consignes de tri et suivez les retours.</p>
        </div>
        <div className="bas">Accès réservé au compte administrateur.</div>
      </div>
      <div className="formulaire">
        <form className="carte-cx" onSubmit={envoyer}>
          <h1>Connexion</h1>
          <div className="sous">Avec le compte administrateur de Proserpine.</div>
          <label className="lab" htmlFor="email">
            Adresse e-mail
          </label>
          <input id="email" className="champ" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="lab" htmlFor="mdp">
            Mot de passe
          </label>
          <input
            id="mdp"
            className="champ"
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
          {erreur ? <p className="erreur">{erreur}</p> : null}
          <button className="btn p" type="submit" disabled={envoi}>
            {envoi ? 'Connexion…' : 'Se connecter'}
          </button>
          <div className="note">
            <Icone nom="lock" taille={18} />
            Un autre compte peut se connecter, mais ne verra aucune donnée.
          </div>
        </form>
      </div>
    </div>
  );
}
