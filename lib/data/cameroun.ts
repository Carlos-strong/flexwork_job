/**
 * Données géographiques du Cameroun
 * Structure: Région → Ville → Quartiers
 */
export interface Quartier {
  nom: string;
  populaire?: boolean; // Quartier très demandé
}

export interface Ville {
  nom: string;
  quartiers: Quartier[];
}

export interface Region {
  nom: string;
  chefLieu: string;
  villes: Ville[];
}

export const cameroun: Region[] = [
  {
    nom: "Littoral",
    chefLieu: "Douala",
    villes: [
      {
        nom: "Douala",
        quartiers: [
          { nom: "Akwa", populaire: true },
          { nom: "Bonapriso", populaire: true },
          { nom: "Bonanjo" },
          { nom: "Bali" },
          { nom: "Deïdo" },
          { nom: "New Bell" },
          { nom: "Bépanda" },
          { nom: "Cité des Palmiers" },
          { nom: "Makepe", populaire: true },
          { nom: "Bonamoussadi", populaire: true },
          { nom: "Logbessou" },
          { nom: "Ndokoti" },
          { nom: "PK 14" },
          { nom: "PK 21" },
          { nom: "Yassa" },
          { nom: "Japoma" },
          { nom: "Bonabéri", populaire: true },
          { nom: "Village" },
          { nom: "Ndogpassi" },
          { nom: "Cité Sic" },
          { nom: "Logpom" },
          { nom: "Ndogbong" },
          { nom: "Kotto" },
          { nom: "Cité des Douanes" },
          { nom: "Terminus St-Michel" },
          { nom: "Youpwe" },
          { nom: "Bessengue" },
        ],
      },
      {
        nom: "Edéa",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Bilalang" },
          { nom: "Ekopé" },
          { nom: "Mbanda" },
          { nom: "Quartier Haoussa" },
          { nom: "Mbonjo" },
        ],
      },
      {
        nom: "Nkongsamba",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Melong" },
          { nom: "Baré" },
          { nom: "Mbo" },
          { nom: "Ekangté" },
        ],
      },
    ],
  },
  {
    nom: "Centre",
    chefLieu: "Yaoundé",
    villes: [
      {
        nom: "Yaoundé",
        quartiers: [
          { nom: "Bastos", populaire: true },
          { nom: "Mvan" },
          { nom: "Biyem-Assi", populaire: true },
          { nom: "Mendong" },
          { nom: "Nkolbisson" },
          { nom: "Etoudi" },
          { nom: "Mokolo" },
          { nom: "Briqueterie" },
          { nom: "Elig-Essono" },
          { nom: "Nlongkak" },
          { nom: "Mvog-Mbi" },
          { nom: "Emana" },
          { nom: "Ekounou" },
          { nom: "Odza", populaire: true },
          { nom: "Ngousso" },
          { nom: "Tsinga" },
          { nom: "Mfou" },
          { nom: "Nkolnda" },
          { nom: "Damas" },
          { nom: "Obili" },
          { nom: "Oyom-Abang" },
          { nom: "Melen" },
          { nom: "Cité Verte" },
          { nom: "Nkol-Eton" },
          { nom: "Ahala" },
          { nom: "Mimboman" },
          { nom: "Essos" },
          { nom: "Mvog-Ada" },
        ],
      },
      {
        nom: "Obala",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Efok" },
          { nom: "Nkolbogo" },
        ],
      },
      {
        nom: "Mbalmayo",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Mvog-Betsi" },
          { nom: "Abobo" },
        ],
      },
    ],
  },
  {
    nom: "Ouest",
    chefLieu: "Bafoussam",
    villes: [
      {
        nom: "Bafoussam",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Bamendzi" },
          { nom: "Banengo" },
          { nom: "Tamdja" },
          { nom: "Kouékong" },
          { nom: "Tougang", populaire: true },
          { nom: "Djeleng" },
        ],
      },
      {
        nom: "Dschang",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Foto" },
          { nom: "Foréké" },
          { nom: "Fiala" },
        ],
      },
      {
        nom: "Mbouda",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Babété" },
          { nom: "Bamesso" },
        ],
      },
      {
        nom: "Foumban",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Njissé" },
          { nom: "Koupa" },
        ],
      },
    ],
  },
  {
    nom: "Sud-Ouest",
    chefLieu: "Buéa",
    villes: [
      {
        nom: "Buéa",
        quartiers: [
          { nom: "Molyko" },
          { nom: "Muea" },
          { nom: "Bokwaongo" },
          { nom: "Great Soppo" },
          { nom: "Clarks Town" },
          { nom: "Bonduma" },
        ],
      },
      {
        nom: "Limbé",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Mile 2" },
          { nom: "Mile 3" },
          { nom: "Mile 4" },
          { nom: "Down Beach" },
          { nom: "Bota" },
          { nom: "Seme Beach" },
        ],
      },
      {
        nom: "Kumba",
        quartiers: [
          { nom: "Kumba Town" },
          { nom: "Fiango" },
          { nom: "Mbonge Road" },
          { nom: "Buea Road" },
        ],
      },
      {
        nom: "Tiko",
        quartiers: [
          { nom: "Tiko Town" },
          { nom: "Mondoni" },
          { nom: "Likomba" },
        ],
      },
    ],
  },
  {
    nom: "Nord-Ouest",
    chefLieu: "Bamenda",
    villes: [
      {
        nom: "Bamenda",
        quartiers: [
          { nom: "Commercial Avenue" },
          { nom: "Nkwen" },
          { nom: "Mankon" },
          { nom: "Mile 3" },
          { nom: "Mile 4" },
          { nom: "Old Town" },
          { nom: "Bambili" },
        ],
      },
      {
        nom: "Bali",
        quartiers: [
          { nom: "Bali Town" },
          { nom: "Bali Nyonga" },
        ],
      },
    ],
  },
  {
    nom: "Adamaoua",
    chefLieu: "Ngaoundéré",
    villes: [
      {
        nom: "Ngaoundéré",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Baladji" },
          { nom: "Bamyanga" },
          { nom: "Dang" },
          { nom: "Marza" },
          { nom: "Mbideng" },
        ],
      },
    ],
  },
  {
    nom: "Extrême-Nord",
    chefLieu: "Maroua",
    villes: [
      {
        nom: "Maroua",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Douggoï" },
          { nom: "Kakataré" },
          { nom: "Hardéo" },
          { nom: "Pitoaré" },
          { nom: "Domayo" },
        ],
      },
      {
        nom: "Kousséri",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Résidentiel" },
        ],
      },
    ],
  },
  {
    nom: "Nord",
    chefLieu: "Garoua",
    villes: [
      {
        nom: "Garoua",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Yelwa" },
          { nom: "Djamboutou" },
          { nom: "Poumpoumré" },
          { nom: "Laindé" },
        ],
      },
    ],
  },
  {
    nom: "Est",
    chefLieu: "Bertoua",
    villes: [
      {
        nom: "Bertoua",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Mokolo" },
          { nom: "Tindelo" },
          { nom: "Tigaza" },
        ],
      },
    ],
  },
  {
    nom: "Sud",
    chefLieu: "Ebolowa",
    villes: [
      {
        nom: "Ebolowa",
        quartiers: [
          { nom: "Centre-ville" },
          { nom: "Nko'ovos" },
          { nom: "Angalé" },
          { nom: "Mekalat" },
        ],
      },
    ],
  },
];

// API : Tous les pays disponibles
export const pays = [
  { code: "CM", nom: "Cameroun", indicatif: "+237", devise: "FCFA" },
];

// API : Toutes les villes (tous pays confondus)
export function getVilles(paysCode?: string): { nom: string; region: string }[] {
  if (paysCode && paysCode !== "CM") return [];
  return cameroun.flatMap((r) =>
    r.villes.map((v) => ({ nom: v.nom, region: r.nom }))
  );
}

// API : Quartiers d'une ville donnée
export function getQuartiers(villeNom: string): Quartier[] {
  for (const region of cameroun) {
    for (const ville of region.villes) {
      if (ville.nom.toLowerCase() === villeNom.toLowerCase()) {
        return ville.quartiers;
      }
    }
  }
  return [];
}

// API : Toutes les régions
export function getRegions(): { nom: string; chefLieu: string }[] {
  return cameroun.map((r) => ({ nom: r.nom, chefLieu: r.chefLieu }));
}
