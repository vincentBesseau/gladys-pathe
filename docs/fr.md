# Pathé

Films actuellement à l'affiche dans votre cinéma Pathé, affichés dans le
widget "Prochaines sorties" de Gladys.

## Important : intégration non officielle

Cette intégration lit les données JSON publiques que **pathe.fr utilise déjà
pour afficher ses propres pages** — le même contenu que vous verriez en
ouvrant la page de votre cinéma dans un navigateur, rien de plus. Elle n'est
ni développée, ni approuvée, ni affiliée à Pathé. Pathé peut changer son
site à tout moment et casser cette intégration sans préavis.

Aucune API payante, aucun identifiant extrait d'une application n'est
utilisé. Un point mérite d'être signalé clairement : les pages web de
pathe.fr sont protégées contre les robots (Akamai) et cette intégration ne
les charge jamais ; en revanche, l'API JSON sous-jacente qu'elles appellent
rejette une identification honnête (elle répond 403 à un User-Agent qui se
présente comme cette intégration) mais répond normalement quand aucun
User-Agent n'est envoyé du tout. Ce choix est documenté et assumé — voir le
README du dépôt pour le raisonnement complet.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Lancez l'action **Trouver mon cinéma** : laissez le champ vide pour lister
   les 5 cinémas Pathé les plus proches de votre maison Gladys (si sa
   position est renseignée), ou tapez une ville pour chercher parmi tous les
   cinémas. Le résultat s'affiche sous le bouton, au format
   `Nom du cinéma — Ville (12.3 km) (ID: cinema-pathe-rennes)` (la distance
   n'apparaît que pour une recherche par proximité).
3. Copiez l'identifiant du cinéma souhaité dans le champ **Identifiant du
   cinéma**, puis enregistrez.

Si aucune maison Gladys n'a de position renseignée, laisser le champ vide
liste tous les cinémas Pathé (comportement de repli).

Les films à l'affiche aujourd'hui dans ce cinéma apparaissent alors dans le
widget "Prochaines sorties" du tableau de bord. En cliquant sur une affiche,
la fiche du film affiche un tableau des horaires de séances du jour dans ce
cinéma (heure et version, VF/VOST). Contrairement aux intégrations UGC et
CGR, il n'y a pas de bande-annonce ici : le CDN vidéo de pathe.fr
(`media.pathe.fr`) refuse toute lecture directe sans provenir d'une page
pathe.fr elle-même, donc le lien ne fonctionnerait jamais pour vous.

## Limites connues (v1)

- Un seul cinéma à la fois par installation de l'intégration.
- Uniquement les films et horaires du jour même (pas de vue sur demain ou les
  jours suivants).
- La liste des cinémas est une liste statique maintenue à la main (voir le
  README du dépôt) : un nouveau cinéma Pathé peut ne pas encore y apparaître.

## Dépannage

L'intégration journalise tout ce qu'elle fait : consultez les logs de
l'intégration depuis l'interface Gladys (ou `docker logs` sur l'hôte) avec
`LOG_LEVEL=debug` pour le détail complet.
