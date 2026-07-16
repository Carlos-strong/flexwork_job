/**
 * Service de génération de contrat au format DOCX (Word).
 *
 * Utilise la bibliothèque "docx" pour produire un document .docx professionnel
 * reproduisant le modèle juridique du contrat de prestation Flexwork.
 *
 * Articles :
 *   Article 1  → Objet du contrat
 *   Article 2  → Jalons et livrables
 *   Article 3  → Durée d'exécution
 *   Article 4  → Rémunération et modalités de paiement
 *   Article 5  → Statut du prestataire
 *   Article 6  → Propriété intellectuelle
 *   Article 7  → Confidentialité
 *   Article 8  → Résiliation
 *   Article 9  → Responsabilité
 *   Article 10 → Droit applicable et litiges
 *   Article 11 → Signature électronique
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  TabStopType,
  TabStopPosition,
  LevelFormat,
  VerticalAlign,
} from "docx";
import type { ContractTemplateData } from "./contract-template.service";

// ── Design tokens (matching the platform's palette) ───────────
const INK = "14213D";
const GREEN = "1F7A5C";
const GREEN_SOFT = "E4F1EC";
const MUTED = "6B7280";
const LINE = "DADFDD";
const PAPER = "F5F6F4";

const FONT_BODY = "Georgia";
const FONT_SANS = "Calibri";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("fr-FR") + " €";

const hairline = {
  top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

function h1(text: string, num?: number): Paragraph {
  return new Paragraph({
    spacing: { before: 420, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 6 },
    },
    children: [
      new TextRun({
        text: num ? `Article ${num} — ` : "",
        font: FONT_SANS,
        color: GREEN,
        bold: true,
        size: 20,
      }),
      new TextRun({
        text,
        font: FONT_SANS,
        color: INK,
        bold: true,
        size: 20,
        allCaps: true,
        characterSpacing: 10,
      }),
    ],
  });
}

function body(text: string, opts: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 160, line: 300 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({ text, font: FONT_BODY, size: 21, color: INK, ...opts } as any),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "clause-bullets", level: 0 },
    spacing: { after: 80, line: 290 },
    children: [new TextRun({ text, font: FONT_BODY, size: 21, color: INK })],
  });
}

function label(text: string): TextRun {
  return new TextRun({ text, font: FONT_SANS, size: 16, color: MUTED, bold: true });
}
function value(text: string): TextRun {
  return new TextRun({ text, font: FONT_SANS, size: 19, color: INK });
}

interface Party {
  name: string;
  form: string;
  address: string;
  siret: string;
  rep?: string;
}

function partyBlock(titleEyebrow: string, p: Party, isClient: boolean): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: hairline.top,
      bottom: hairline.bottom,
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: titleEyebrow.toUpperCase(),
                    font: FONT_SANS,
                    size: 15,
                    color: GREEN,
                    bold: true,
                    characterSpacing: 14,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: p.name,
                    font: FONT_SANS,
                    size: 24,
                    bold: true,
                    color: INK,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  label(isClient ? "Forme juridique  " : "Statut  "),
                  value(p.form),
                ],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [label("Adresse  "), value(p.address)],
              }),
              new Paragraph({
                spacing: { after: isClient ? 40 : 0 },
                children: [label("SIRET  "), value(p.siret)],
              }),
              ...(isClient && p.rep
                ? [
                    new Paragraph({
                      children: [label("Représentée par  "), value(p.rep)],
                    }),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });
}

function milestoneTable(
  milestones: Array<{
    title: string;
    description?: string;
    amount: number;
    delay: string;
    unit?: string;
  }>,
  total: number
): Table {
  const headerCell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: INK },
      margins: { top: 90, bottom: 90, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({
              text,
              font: FONT_SANS,
              size: 15,
              color: "FFFFFF",
              bold: true,
              characterSpacing: 6,
            }),
          ],
        }),
      ],
    });

  const cell = (
    text: string,
    align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
    opts: { fill?: string; mono?: boolean; color?: string; bold?: boolean } = {}
  ) =>
    new TableCell({
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, fill: opts.fill || "FFFFFF" },
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({
              text,
              font: opts.mono ? "Consolas" : FONT_SANS,
              size: 18,
              color: opts.color || INK,
              bold: !!opts.bold,
            }),
          ],
        }),
      ],
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("#"),
        headerCell("LIVRABLE / JALON"),
        headerCell("UNITÉ"),
        headerCell("PRIX", AlignmentType.RIGHT),
        headerCell("DÉLAI", AlignmentType.RIGHT),
      ],
    }),
    ...milestones.map((m, i) => {
      const num = String(i + 1).padStart(2, "0");
      const unit = m.unit || "Forfait";
      const amount = m.amount;
      const fill = i % 2 ? PAPER : "FFFFFF";
      return new TableRow({
        children: [
          cell(num, AlignmentType.LEFT, { mono: true, color: MUTED, fill }),
          cell(
            m.title +
              (m.description ? `\n${m.description}` : ""),
            AlignmentType.LEFT,
            { fill }
          ),
          cell(unit, AlignmentType.LEFT, { fill }),
          cell(fmt(amount), AlignmentType.RIGHT, { mono: true, fill }),
          cell(m.delay, AlignmentType.RIGHT, { fill }),
        ],
      });
    }),
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 10, color: INK },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "MONTANT TOTAL DU CONTRAT",
                  font: FONT_SANS,
                  size: 16,
                  bold: true,
                  color: MUTED,
                  characterSpacing: 6,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 10, color: INK },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: fmt(total),
                  font: "Consolas",
                  size: 20,
                  bold: true,
                  color: GREEN,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          columnSpan: 1,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 10, color: INK },
          },
          children: [new Paragraph("")],
        }),
      ],
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [700, 4300, 1500, 1800, 1550],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
}

function sigCell(
  sideLabel: string,
  p: Party,
  isClient: boolean
): TableCell {
  return new TableCell({
    margins: { top: 200, right: isClient ? 300 : 0, left: isClient ? 0 : 300 },
    children: [
      new Paragraph({
        spacing: { after: 8 },
        children: [
          new TextRun({
            text: sideLabel,
            font: FONT_SANS,
            size: 15,
            bold: true,
            color: GREEN,
            characterSpacing: 10,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 4 },
        children: [
          new TextRun({
            text: p.name,
            font: FONT_SANS,
            size: 19,
            bold: true,
            color: INK,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: isClient ? (p.rep || "") : p.form,
            font: FONT_SANS,
            size: 16,
            color: MUTED,
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
          left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
          right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: GREEN_SOFT },
                margins: { top: 180, bottom: 180, left: 180, right: 180 },
                children: [
                  new Paragraph({
                    spacing: { after: 6 },
                    children: [
                      new TextRun({
                        text: "SIGNATURE ÉLECTRONIQUE",
                        font: FONT_SANS,
                        size: 13,
                        bold: true,
                        color: GREEN,
                        characterSpacing: 10,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 4 },
                    children: [
                      new TextRun({
                        text: "☐ En attente de signature",
                        font: FONT_SANS,
                        size: 17,
                        color: MUTED,
                        italics: true,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 2 },
                    children: [
                      new TextRun({
                        text: "Horodatage : ______________________",
                        font: "Consolas",
                        size: 14,
                        color: MUTED,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 2 },
                    children: [
                      new TextRun({
                        text: "Identifiant de signature : ______________________",
                        font: "Consolas",
                        size: 14,
                        color: MUTED,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Adresse IP : ______________________",
                        font: "Consolas",
                        size: 14,
                        color: MUTED,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function signatureBlock(clientParty: Party, freelancerParty: Party): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4650, 4650],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          sigCell("POUR LE CLIENT", clientParty, true),
          sigCell("POUR LE PRESTATAIRE", freelancerParty, false),
        ],
      }),
    ],
  });
}

// ── Main generation function ────────────────────────────────

/**
 * Génère un contrat de prestation au format DOCX (Buffer).
 * Prêt à être téléchargé ou stocké.
 */
export async function generateContractDocx(
  data: ContractTemplateData
): Promise<Buffer> {
  const reference = data.reference;
  const missionTitle = data.missionTitle;
  const missionDescription = data.missionDescription;

  const clientParty: Party = {
    name: data.clientCompanyName,
    form: data.clientLegalForm,
    address: data.clientAddress,
    siret: data.clientSiret,
    rep: `${data.clientRepresentative}, ${data.clientRepresentativeTitle}`,
  };

  const freelancerParty: Party = {
    name: data.freelancerName,
    form: data.freelancerStatus,
    address: data.freelancerAddress,
    siret: data.freelancerSiret,
  };

  const milestones = data.milestones;
  const total = data.totalAmount;

  const contractTypeLabel =
    data.contractType === "FIXED" ? "Prix fixe" : "Taux horaire";

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "clause-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "—",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 360, hanging: 260 } },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT_BODY, size: 21, color: INK },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [
                  { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                ],
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: LINE,
                    space: 6,
                  },
                },
                children: [
                  new TextRun({
                    text: "CONTRAT DE PRESTATION DE SERVICES",
                    font: FONT_SANS,
                    size: 14,
                    color: MUTED,
                    characterSpacing: 8,
                  }),
                  new TextRun({
                    text: `\t${reference}`,
                    font: "Consolas",
                    size: 14,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Page ",
                    font: FONT_SANS,
                    size: 14,
                    color: MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_SANS,
                    size: 14,
                    color: MUTED,
                  }),
                  new TextRun({
                    text: " / ",
                    font: FONT_SANS,
                    size: 14,
                    color: MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_SANS,
                    size: 14,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── Title block ──
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({
                text: "RÉFÉRENCE " + reference,
                font: FONT_SANS,
                size: 15,
                color: GREEN,
                bold: true,
                characterSpacing: 12,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Contrat de prestation de services",
                font: FONT_SANS,
                size: 40,
                bold: true,
                color: INK,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: missionTitle,
                font: FONT_BODY,
                size: 24,
                italics: true,
                color: MUTED,
              }),
            ],
          }),

          // ── Parties ──
          partyBlock("Le client", clientParty, true),
          new Paragraph({
            spacing: { before: 140, after: 140 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "ET",
                font: FONT_SANS,
                size: 15,
                color: MUTED,
                bold: true,
                characterSpacing: 20,
              }),
            ],
          }),
          partyBlock("Le prestataire", freelancerParty, false),

          new Paragraph({
            spacing: { before: 260, after: 160, line: 300 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `Ci-après désignés ensemble « les Parties », il a été convenu et arrêté ce qui suit, dans le cadre de la mission référencée ${reference} initiée sur la plateforme.`,
                font: FONT_BODY,
                size: 21,
                italics: true,
                color: MUTED,
              }),
            ],
          }),

          // ── Article 1 ──
          h1("Objet du contrat", 1),
          body(
            `Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalise, à titre indépendant, la mission suivante pour le compte du Client : « ${missionTitle} ».`
          ),
          body(missionDescription),
          body(
            "Le Prestataire s'engage à exécuter cette mission avec diligence, dans le respect des règles de l'art et des délais fixés à l'Article 3, en toute indépendance quant à l'organisation de son travail."
          ),

          // ── Article 2 ──
          h1("Jalons et livrables", 2),
          body(
            "La mission est décomposée en jalons, chacun correspondant à un livrable distinct, à un prix forfaitaire et à un délai d'exécution propres. Un jalon est considéré comme achevé lorsque le livrable correspondant a été transmis au Client et validé par celui-ci."
          ),
          milestoneTable(milestones, total),
          new Paragraph({ spacing: { before: 200 } }),
          body(
            `Le régime de rémunération applicable est : ${contractTypeLabel}. Toute modification du périmètre d'un jalon fait l'objet d'un avenant écrit entre les Parties, y compris via l'espace de négociation de la plateforme.`
          ),

          // ── Article 3 ──
          h1("Durée d'exécution", 3),
          body(
            `La mission débute le ${data.startDate} pour une durée estimée de ${data.duration}, soit une échéance prévisionnelle au ${data.endDate}. Cette durée est indicative et pourra être ajustée d'un commun accord en fonction de l'avancement réel des jalons.`
          ),
          body(
            "Le présent contrat prend effet à sa signature par les deux Parties et s'achève à la validation et au paiement du dernier jalon, sauf résiliation anticipée dans les conditions prévues à l'Article 8."
          ),

          // ── Article 4 ──
          h1("Rémunération et modalités de paiement", 4),
          body(
            `En contrepartie de la réalisation de la mission, le Client versera au Prestataire la somme totale de ${fmt(total)} HT, répartie par jalon conformément au tableau de l'Article 2.`
          ),
          body(
            "Le paiement de chaque jalon est déclenché selon les modalités suivantes :"
          ),
          bullet(
            "Le Prestataire transmet le livrable correspondant au jalon via l'espace de travail du projet ;"
          ),
          bullet(
            "Le Client dispose d'un délai de sept (7) jours calendaires pour valider le livrable ou formuler des demandes de modification motivées ;"
          ),
          bullet(
            "À défaut de contestation dans ce délai, le jalon est réputé accepté et son paiement est déclenché automatiquement ;"
          ),
          bullet(
            "Les fonds sont versés au Prestataire selon les modalités de paiement de la plateforme, déduction faite des frais de service applicables."
          ),

          // ── Article 5 ──
          h1("Statut du prestataire", 5),
          body(
            "Le Prestataire exerce sa mission en toute indépendance, sans lien de subordination juridique avec le Client. Il détermine librement son organisation, ses méthodes et ses horaires de travail, sous la seule réserve du respect des délais convenus à l'Article 3."
          ),
          body(
            "Le Prestataire est seul responsable de ses obligations sociales, fiscales et déclaratives liées à son statut, telles que rappelées en en-tête du présent contrat."
          ),

          // ── Article 6 ──
          h1("Propriété intellectuelle", 6),
          body(
            "Sous réserve du complet paiement des sommes dues au titre du présent contrat, le Prestataire cède au Client, à titre exclusif, l'ensemble des droits patrimoniaux de propriété intellectuelle afférents aux livrables développés spécifiquement dans le cadre de la mission, pour le monde entier et pour la durée légale de protection de ces droits."
          ),
          body(
            "Cette cession ne s'étend pas aux outils, bibliothèques, composants génériques ou méthodologies propres au Prestataire, préexistants ou développés en dehors du cadre strict de la mission, sur lesquels le Prestataire conserve l'intégralité de ses droits."
          ),

          // ── Article 7 ──
          h1("Confidentialité", 7),
          body(
            "Chaque Partie s'engage à conserver strictement confidentielles toutes les informations de nature technique, commerciale ou financière dont elle aurait connaissance à l'occasion de l'exécution du présent contrat, et à ne les utiliser qu'aux fins de la réalisation de la mission."
          ),
          body(
            "Cette obligation perdure pendant toute la durée du contrat et pour une période de deux (2) ans à compter de son terme, quelle qu'en soit la cause."
          ),

          // ── Article 8 ──
          h1("Résiliation", 8),
          body(
            "Chaque Partie peut résilier le présent contrat de plein droit, sans préavis, en cas de manquement grave de l'autre Partie à ses obligations, non réparé dans un délai de quinze (15) jours suivant une mise en demeure restée sans effet."
          ),
          body(
            "En cas de résiliation anticipée, les jalons achevés et validés à la date de résiliation restent dus et sont réglés selon les modalités de l'Article 4. Les jalons non engagés ne donnent lieu à aucun paiement."
          ),

          // ── Article 9 ──
          h1("Responsabilité", 9),
          body(
            "Le Prestataire est tenu à une obligation de moyens dans l'exécution de sa mission. Sa responsabilité ne pourra être engagée qu'en cas de faute prouvée, et sera en tout état de cause limitée au montant total perçu au titre du présent contrat."
          ),

          // ── Article 10 ──
          h1("Droit applicable et litiges", 10),
          body(
            "Le présent contrat est soumis au droit français. En cas de différend relatif à sa formation, son exécution ou son interprétation, les Parties s'efforceront de trouver une solution amiable avant toute action contentieuse. À défaut d'accord amiable, les tribunaux compétents du ressort du siège social du Client seront seuls compétents."
          ),

          // ── Article 11 ──
          h1("Signature électronique", 11),
          body(
            "Les Parties conviennent que le présent contrat est conclu et signé par voie électronique, par l'intermédiaire du procédé de signature électronique proposé par la plateforme. Conformément aux articles 1366 et 1367 du Code civil et au règlement (UE) n° 910/2014 (« eIDAS »), la signature électronique ainsi apposée a la même valeur probante qu'une signature manuscrite et fait pleinement foi entre les Parties."
          ),
          body(
            "Le procédé retenu permet d'identifier chaque signataire avec certitude et garantit que la signature est liée au présent contrat de telle sorte que toute modification ultérieure de celui-ci soit détectable. Chaque signature est horodatée et associée à un identifiant unique et à l'adresse IP du signataire, éléments consignés dans le certificat de signature et le journal de preuve (audit trail) annexés au présent contrat et conservés par la plateforme pendant la durée légale applicable."
          ),
          body(
            "En signant électroniquement le présent contrat, chaque Partie reconnaît avoir pu consulter l'intégralité de son contenu avant signature, renonce à contester la recevabilité, la validité ou la force probante du mode de preuve électronique ainsi constitué, et accepte que le certificat de signature associé fasse partie intégrante du présent contrat."
          ),

          // ── Signatures ──
          new Paragraph({ children: [new PageBreak()] }),
          h1("Signatures électroniques"),
          body(
            "Fait électroniquement, en un exemplaire numérique unique faisant foi entre les Parties, qui reconnaissent avoir pris connaissance de l'ensemble des clauses qui précèdent, les accepter sans réserve, et consentir à signer le présent contrat par voie électronique dans les conditions décrites à l'Article 11."
          ),
          new Paragraph({ spacing: { before: 300 } }),
          signatureBlock(clientParty, freelancerParty),
          new Paragraph({
            spacing: { before: 260, line: 280 },
            children: [
              new TextRun({
                text: "Le certificat de signature électronique, comprenant l'horodatage, l'identifiant et l'adresse IP de chaque signataire, sera généré automatiquement à l'issue du processus de signature et annexé au présent contrat.",
                font: FONT_SANS,
                size: 15,
                italics: true,
                color: MUTED,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
