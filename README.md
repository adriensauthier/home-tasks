# HomeTasks — Vercel + Supabase

HomeTasks est une petite application web pour gérer les tâches ménagères d'une maison, d'une famille ou d'une colocation.

Elle permet de :

- utiliser des comptes nominatifs : `stephane`, `claudine`, `adrien`, `lea` ;
- définir son mot de passe à la première connexion ;
- voir uniquement ses propres tâches ;
- choisir une fréquence : une fois, chaque jour, chaque semaine, chaque mois ;
- suivre les tâches à faire, terminées ou en retard ;
- marquer une tâche comme faite ;
- archiver une tâche répétitive comme terminée et créer automatiquement la prochaine occurrence quand elle est terminée ;
- protéger l'app avec un mot de passe optionnel.

## Stack technique

- Next.js
- Vercel
- Supabase PostgreSQL

L'app n'utilise pas la clé publique Supabase côté navigateur. Les accès à la base passent par les routes API Next.js avec la clé `service_role`, stockée uniquement dans les variables d'environnement Vercel.

Le système de connexion repose sur quatre comptes fixes : `stephane`, `claudine`, `adrien` et `lea`. À la première connexion, chaque compte enregistre le mot de passe saisi.

## 1. Créer la base Supabase

1. Crée un compte sur Supabase.
2. Crée un nouveau projet.
3. Va dans `SQL Editor`.
4. Copie-colle le contenu de `supabase/schema.sql`.
5. Clique sur `Run`.

## 2. Récupérer les variables Supabase

Dans Supabase, va dans `Project Settings` > `API`.

Récupère :

- `Project URL` → à mettre dans `SUPABASE_URL` ;
- `service_role key` → à mettre dans `SUPABASE_SERVICE_ROLE_KEY`.

Attention : la clé `service_role` est secrète. Ne la mets jamais dans du code public côté navigateur.

## 3. Déployer sur Vercel

1. Crée un repo GitHub avec ce projet.
2. Va sur Vercel.
3. Clique sur `Add New...` > `Project`.
4. Importe ton repo GitHub.
5. Dans `Environment Variables`, ajoute au minimum :

```env
SUPABASE_URL=ton_project_url_supabase
SUPABASE_SERVICE_ROLE_KEY=ta_cle_service_role_supabase
```

6. Clique sur `Deploy`.

## 4. Lancer en local

Installe les dépendances :

```bash
npm install
```

Crée un fichier `.env.local` à partir de `.env.example`, puis lance :

```bash
npm run dev
```

L'app sera disponible sur :

```text
http://localhost:3000
```

## 5. Remarques importantes

- Vercel héberge l'app.
- Supabase stocke les données.
- La base est protégée par RLS et sans politique publique ; seules les routes API Next.js utilisent la clé serveur.
- Chaque compte ne voit que ses propres tâches.
- Si tu veux ajouter un nouveau membre, il faut créer un nouveau compte dans la table `app_users` puis le relier à une personne.
