// Noms volontairement fictifs : patronymes inventés, à consonance "maquette".
export const NOMS_FICTIFS = [
  'Testard', 'Exemplier', 'Fictelle', 'Maquetton', 'Prototel', 'Démonval', 'Simulard', 'Essayan',
  'Brouillon', 'Pilotier', 'Modelin', 'Ébauchet', 'Esquissot', 'Croquerel', 'Factisse', 'Imaginel',
  'Supposin', 'Hypothès', 'Virtuelle', 'Placebois', 'Fantômat', 'Chimérand', 'Inventin', 'Fabulier',
  'Factotum', 'Lambdin', 'Quidamet', 'Untelier', 'Duponsard', 'Martinval', 'Durandel', 'Machinet',
  'Trucheau', 'Bidulon', 'Chosier', 'Tartempion', 'Pseudonel', 'Anonymat', 'Gabarit', 'Patronel',
  'Calquin', 'Mockeret', 'Dummard', 'Samplet', 'Fakenval', 'Postichet', 'Leurrier', 'Mirageot',
];

export const PRENOMS = [
  'Thomas', 'Nicolas', 'Julien', 'Sébastien', 'Mathieu', 'Antoine', 'Pierre', 'Romain', 'Laurent',
  'Olivier', 'David', 'Stéphane', 'Christophe', 'Frédéric', 'Jérôme', 'Yann', 'Kevin', 'Mehdi',
  'Sophie', 'Nathalie', 'Isabelle', 'Céline', 'Aurélie', 'Émilie', 'Claire', 'Camille', 'Laura',
  'Sandrine', 'Karine', 'Virginie', 'Hélène', 'Marion', 'Inès', 'Léa', 'Amandine', 'Fatima',
];

export const FORMES_SOCIETE: Record<string, string[]> = {
  installateur: ['Chauffage {n}', '{n} Thermique', '{n} Énergies', 'SARL {n} Chauffage', 'Ets {n}', '{n} Confort Habitat'],
  fumiste: ['Fumisterie {n}', '{n} Ramonage', 'Atelier {n} Fumisterie', '{n} Cheminées', 'Âtre {n}'],
  bureau_etudes: ['BET {n}', '{n} Ingénierie', 'Fluides {n} Conseil', '{n} Études Thermiques'],
  distributeur: ['{n} Distribution', 'Négoce {n}', 'Comptoir {n}', '{n} Matériaux Pro'],
};

export const FONCTIONS: Record<string, string[]> = {
  installateur: ['Gérant', 'Chef d’entreprise', 'Responsable technique', 'Conducteur de travaux'],
  fumiste: ['Gérant', 'Artisan fumiste', 'Chef d’atelier'],
  bureau_etudes: ['Ingénieur fluides', 'Chargé d’affaires', 'Directeur technique'],
  distributeur: ['Chef d’agence', 'Responsable achats', 'Vendeur comptoir', 'Chef de rayon chauffage'],
};

export const RUES = [
  'rue des Artisans', 'zone artisanale des Prés', 'rue de l’Industrie', 'avenue de la Gare', 'rue du Moulin',
  'impasse des Forges', 'ZA du Bois Joli', 'rue Pasteur', 'route de la Vallée', 'parc d’activités des Landes',
  'rue des Tanneurs', 'chemin des Vignes', 'rue Ampère', 'allée des Érables', 'rue Gustave Eiffel',
];

export const NOTES_VISITE = [
  'Intéressé par la gamme conduits double paroi pour un chantier de rénovation.',
  'Stock à revoir, rupture sur les raccords inox en début de mois.',
  'Questions sur la mise en conformité des conduits pour poêle à granulés.',
  'Présentation de la gamme ventilation, à recontacter pour un chiffrage.',
  'Client satisfait des délais de livraison, souhaite une formation pour ses équipes.',
  'Concurrence agressive sur les prix, demande un geste commercial.',
  'Projet de chaufferie collective en cours, besoin d’une étude de dimensionnement.',
  'RAS, visite de courtoisie.',
  'Remise de documentation technique et catalogue tarifs.',
  'Problème de SAV réglé, relation apaisée.',
  'Gros chantier prévu au printemps, à suivre de près.',
  'Contact absent, échange rapide avec l’assistante.',
];

export const PROCHAINES_ACTIONS = [
  'Envoyer le chiffrage',
  'Relancer le devis',
  'Envoyer la documentation technique',
  'Planifier une démonstration',
  'Proposer une formation',
  'Rappeler pour le chantier',
  'Organiser une visite de l’usine',
  'Faire un point sur le stock',
];

export const OBJETS_DEVIS = [
  'Conduits double paroi inox',
  'Kit de tubage flexible',
  'Système ventouse concentrique',
  'Conduit de cheminée modulaire',
  'Gaines et bouches de ventilation',
  'Chaufferie collective : conduits et accessoires',
  'Raccordement poêle à granulés',
  'Rénovation de conduit collectif',
];

export const MOTIFS_PERTE = ['Prix', 'Délais', 'Fidélité à un concurrent', 'Projet abandonné', 'Pas de réponse'];
