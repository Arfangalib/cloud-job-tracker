import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from "docx";

/**
 * Render tailored ATS documents from the JSON draft produced by tailor.js.
 *
 * ATS-friendliness rules followed here: single column, real selectable text,
 * standard section headings, no tables/images/text boxes, standard fonts.
 */

export const DOCUMENT_FORMATS = ["pdf", "docx"];
export const DOCUMENT_KINDS = ["resume", "coverLetter"];

export const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

function buildResumeModel({ draft, resume, user, job }) {
  const parsed = resume?.parsed || {};
  return {
    name: user?.name || "Candidate",
    contact: [user?.email, job?.location].filter(Boolean).join("  |  "),
    headline: draft?.resumeHeadline || `${job?.title || "Software Engineer"} candidate`,
    summary: job?.match?.summary || "",
    sections: [
      { title: "Core Skills", items: dedupe(parsed.skills), inline: true },
      { title: "Highlights", items: draft?.bulletSuggestions || [] },
      { title: "Projects", items: parsed.projects || [] },
      { title: "Education", items: parsed.education || [] }
    ].filter((section) => section.items && section.items.length)
  };
}

function buildCoverLetterModel({ draft, job, user }) {
  const paragraphs = (draft?.coverLetterDraft || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return {
    name: user?.name || "Candidate",
    contact: user?.email || "",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    recipient: [job?.company, job?.location].filter(Boolean).join(", "),
    subject: `Re: ${job?.title || "Application"}${job?.company ? ` at ${job.company}` : ""}`,
    paragraphs: paragraphs.length ? paragraphs : ["Thank you for considering my application."]
  };
}

function dedupe(list) {
  return [...new Set((list || []).map((item) => String(item).trim()).filter(Boolean))];
}

/* ---------------------------------- PDF ---------------------------------- */

function pdfToBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 56 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function pdfHeading(doc, text) {
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a").text(text.toUpperCase());
  doc
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#999999")
    .stroke();
  doc.moveDown(0.4);
  doc.fillColor("#000000");
}

export function renderResumePdf({ draft, resume, user, job }) {
  const model = buildResumeModel({ draft, resume, user, job });
  return pdfToBuffer((doc) => {
    doc.font("Helvetica-Bold").fontSize(20).text(model.name);
    if (model.contact) doc.font("Helvetica").fontSize(10).fillColor("#444444").text(model.contact);
    doc.moveDown(0.5);
    doc.font("Helvetica-Oblique").fontSize(11).fillColor("#000000").text(model.headline);

    if (model.summary) {
      pdfHeading(doc, "Summary");
      doc.font("Helvetica").fontSize(10).text(model.summary, { align: "left" });
    }

    for (const section of model.sections) {
      pdfHeading(doc, section.title);
      doc.font("Helvetica").fontSize(10);
      if (section.inline) {
        doc.text(section.items.join("  •  "));
      } else {
        for (const item of section.items) {
          doc.text(`•  ${item}`, { indent: 4, paragraphGap: 2 });
        }
      }
    }
  });
}

export function renderCoverLetterPdf({ draft, job, user }) {
  const model = buildCoverLetterModel({ draft, job, user });
  return pdfToBuffer((doc) => {
    doc.font("Helvetica-Bold").fontSize(16).text(model.name);
    if (model.contact) doc.font("Helvetica").fontSize(10).fillColor("#444444").text(model.contact);
    doc.fillColor("#000000").moveDown(1);
    doc.font("Helvetica").fontSize(10).text(model.date);
    if (model.recipient) doc.text(model.recipient);
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text(model.subject);
    doc.moveDown(0.5).font("Helvetica").fontSize(10.5);
    for (const paragraph of model.paragraphs) {
      doc.text(paragraph, { align: "left", paragraphGap: 8, lineGap: 2 });
    }
  });
}

/* --------------------------------- DOCX ---------------------------------- */

function docxHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text: text, bold: true, size: 22 })]
  });
}

function docxBullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text })] });
}

async function docxToBuffer(children) {
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: {}, children }]
  });
  return Packer.toBuffer(doc);
}

export async function renderResumeDocx({ draft, resume, user, job }) {
  const model = buildResumeModel({ draft, resume, user, job });
  const children = [
    new Paragraph({ children: [new TextRun({ text: model.name, bold: true, size: 40 })] })
  ];
  if (model.contact) {
    children.push(new Paragraph({ children: [new TextRun({ text: model.contact, color: "444444" })] }));
  }
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: model.headline, italics: true })]
    })
  );

  if (model.summary) {
    children.push(docxHeading("Summary"));
    children.push(new Paragraph({ children: [new TextRun({ text: model.summary })] }));
  }

  for (const section of model.sections) {
    children.push(docxHeading(section.title));
    if (section.inline) {
      children.push(new Paragraph({ children: [new TextRun({ text: section.items.join("  •  ") })] }));
    } else {
      for (const item of section.items) children.push(docxBullet(item));
    }
  }

  return docxToBuffer(children);
}

export async function renderCoverLetterDocx({ draft, job, user }) {
  const model = buildCoverLetterModel({ draft, job, user });
  const children = [
    new Paragraph({ children: [new TextRun({ text: model.name, bold: true, size: 32 })] })
  ];
  if (model.contact) {
    children.push(new Paragraph({ children: [new TextRun({ text: model.contact, color: "444444" })] }));
  }
  children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: model.date })] }));
  if (model.recipient) children.push(new Paragraph({ children: [new TextRun({ text: model.recipient })] }));
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: model.subject, bold: true })]
    })
  );
  for (const paragraph of model.paragraphs) {
    children.push(
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 160 }, children: [new TextRun({ text: paragraph })] })
    );
  }
  return docxToBuffer(children);
}

/** Dispatch to the right renderer. Returns a Buffer. */
export async function renderDocument({ kind, format, draft, resume, user, job }) {
  if (kind === "resume" && format === "pdf") return renderResumePdf({ draft, resume, user, job });
  if (kind === "resume" && format === "docx") return renderResumeDocx({ draft, resume, user, job });
  if (kind === "coverLetter" && format === "pdf") return renderCoverLetterPdf({ draft, job, user });
  if (kind === "coverLetter" && format === "docx") return renderCoverLetterDocx({ draft, job, user });
  const error = new Error("Unsupported document kind/format combination.");
  error.status = 400;
  throw error;
}
