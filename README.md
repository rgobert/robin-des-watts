# Robin des Watts · « Mon année 2 »

Ce que nous avons construit en 60 minutes pour la Product Builder Arena (Battle 2, 14 octobre 2026). Le défi : l'anniversaire d'une cliente mylight150.

Claire a des panneaux solaires et une batterie virtuelle. Elle fête sa première année avec mylight150, deux semaines avant la hausse des prix du 1er novembre. L'app lui montre :
- ce que sa première année lui a rapporté ;
- ce que la hausse va lui coûter ;
- le réglage qui compense cette hausse.

Le CPO suit en direct, dans un back-office, ce que les clients activent.

## Vidéos
[![Mon année 2 : un seul réglage gratuit compense la hausse](videos/mon-annee-2.jpg)](videos/mon-annee-2_20s.mp4)

- [**Mon année 2**](videos/mon-annee-2_20s.mp4) (20 s) : la rétro d'anniversaire, puis le simulateur qui fait passer l'année 2 de −184 € à +202 €.
- [**Piloter, c'est mieux**](videos/piloter-cest-mieux_bo_27s.mp4) (27 s) : le back-office live, côté CPO.

## Écrans
- **`/` · Rétro.** La hausse du 1/11, chiffrée pour Claire, puis sa première année racontée en slides.
- **`/annee-2` · Simulateur.** Il rejoue les 35 040 pas de 15 min de 2026 avec les leviers choisis : MySmartPilot, ballon à midi, électroménager décalé, capacité 20/100/300 kWh. Il classe ensuite ces leviers honnêtement, y compris le piège à éviter : passer à 300 kWh coûte plus cher que ce que l'on stocke.
- **`/admin` · Back-office live.** Il reçoit les gestes du front en direct : pages ouvertes, leviers testés, activations, changements de formule. Le parc affiché est simulé et étiqueté comme tel.

## Données
Toutes les données sont **fictives**. Les organisateurs les ont fournies pour le challenge, et nous les avons pré-agrégées dans `app/data/`. Claire Martin est un personnage.

## Stack
AdonisJS 7, Inertia et React 19, Tailwind v4, SQLite. Le simulateur tourne côté serveur et ses scénarios sont pré-calculés au démarrage. L'état de la démo est gardé en mémoire et partagé par tous les visiteurs.

```bash
npm ci
cp .env.example .env   # puis : node ace generate:key
npm run dev            # http://localhost:3333
```

Node >= 24. Pour le déploiement, un `Dockerfile` est fourni (1 seule instance : l'état de la démo est en mémoire).

## Équipe
Romain Gobert et Gabrielle Tanneau.
