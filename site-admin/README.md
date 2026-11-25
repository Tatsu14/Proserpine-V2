# Proserpine — site d'administration

Site web (React + Vite) réservé à l'administrateur de Proserpine : propositions de produits, base de produits
(identité et emballages = consigne « Vérifié par Proserpine »), retours des utilisateurs.

- Connexion : compte Firebase du projet `proserpine-5eadf` (e-mail + mot de passe).
- Base de produits : uniquement via la fonction serveur `proserpine-api` (Supabase), qui vérifie le jeton
  Firebase et n'autorise que les comptes administrateurs (liste dans la fonction).
- Retours : Firestore, lisibles seulement par les comptes administrateurs (règles Firestore).

Ce dossier est indépendant du reste du dépôt (l'ancienne version web de Proserpine, à la racine).

```bash
npm install
npm run dev      # site local
npm run build    # vérification des types + construction dans dist/
```

Hébergement : Vercel, projet `proserpine-admin`, dossier racine `site-admin`.
