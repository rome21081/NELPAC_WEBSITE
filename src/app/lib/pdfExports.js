import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import nelpacHeader from "../../../NELPACHEADER.png";

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = 281;

const text = (value, fallback = "—") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const amount = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const safeFilenamePart = (value, fallback) =>
  text(value, fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80) || fallback;

const imageFormat = (dataUrl) => {
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/webp/i.test(dataUrl)) return "WEBP";
  return "JPEG";
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Unable to read an image for the PDF."));
    reader.readAsDataURL(blob);
  });

const fetchImageData = async (url) => {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Unable to load PDF image (${response.status}).`);
  return blobToDataUrl(await response.blob());
};

const imageDimensions = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () =>
      reject(new Error("Unable to determine image dimensions."));
    image.src = dataUrl;
  });

const ensureSpace = (doc, y, requiredHeight) => {
  if (y + requiredHeight <= FOOTER_TOP - 5) return y;
  doc.addPage();
  return MARGIN;
};

const sectionTitle = (doc, label, y) => {
  const nextY = ensureSpace(doc, y, 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(label, MARGIN, nextY + 5.5);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(MARGIN, nextY + 8, PAGE_WIDTH - MARGIN, nextY + 8);
  doc.setTextColor(15, 23, 42);
  return nextY + 12;
};

const detailsTable = (doc, rows, y) => {
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.7,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        cellWidth: 38,
      },
      1: { cellWidth: 52 },
      2: {
        fontStyle: "bold",
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        cellWidth: 38,
      },
      3: { cellWidth: 52 },
    },
  });
  return doc.lastAutoTable.finalY + 7;
};

const documentHeader = async (doc, title, description, metadata) => {
  const headerData = await fetchImageData(nelpacHeader);
  const dimensions = await imageDimensions(headerData);
  let width = CONTENT_WIDTH;
  let height = width * (dimensions.height / dimensions.width);
  if (height > 31) {
    height = 31;
    width = height * (dimensions.width / dimensions.height);
  }
  const x = (PAGE_WIDTH - width) / 2;
  doc.addImage(
    headerData,
    imageFormat(headerData),
    x,
    MARGIN,
    width,
    height,
    undefined,
    "FAST",
  );

  let y = MARGIN + height + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(text(title), CONTENT_WIDTH - 12);
  doc.text(titleLines, PAGE_WIDTH / 2, y, { align: "center" });
  y += titleLines.length * 6.2;

  if (description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const descriptionLines = doc.splitTextToSize(
      text(description, ""),
      CONTENT_WIDTH - 18,
    );
    doc.text(descriptionLines, PAGE_WIDTH / 2, y, {
      align: "center",
      lineHeightFactor: 1.25,
    });
    y += descriptionLines.length * 4.4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(metadata.filter(Boolean).join("  |  "), PAGE_WIDTH / 2, y + 1, {
    align: "center",
    maxWidth: CONTENT_WIDTH,
  });
  y += 7;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 7;
};

const addFooters = (doc, submission) => {
  const pageCount = doc.getNumberOfPages();
  const generated = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generated}`, MARGIN, FOOTER_TOP + 5);
    doc.text(
      `Submission: ${text(submission.id)}  |  Reference: ${text(submission.reference_number)}`,
      PAGE_WIDTH / 2,
      FOOTER_TOP + 5,
      { align: "center", maxWidth: 95 },
    );
    doc.text(
      `Page ${page} of ${pageCount}`,
      PAGE_WIDTH - MARGIN,
      FOOTER_TOP + 5,
      { align: "right" },
    );
  }
};

const createDocument = () =>
  new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

async function downloadPreRegistrationPdf(registration) {
  const event = registration.events || {};
  const church = registration.local_churches || {};
  const delegates = [...(registration.event_registration_delegates || [])].sort(
    (a, b) => Number(a.row_number) - Number(b.row_number),
  );
  const doc = createDocument();
  let y = await documentHeader(doc, event.title, event.description, [
    formatDate(event.event_date),
    text(event.venue, "Venue TBA"),
  ]);

  y = sectionTitle(doc, "Section 1: Church and Delegate Information", y);
  y = detailsTable(
    doc,
    [
      ["District", text(church.district), "Local Church", text(church.name)],
      [
        "Local Church Worker",
        text(registration.local_church_worker),
        "Worker Contact",
        text(registration.worker_contact_number),
      ],
      [
        "Church President",
        text(registration.local_church_president),
        "President Contact",
        text(registration.president_contact_number),
      ],
      [
        "Male Delegates",
        text(registration.male_delegate_count, "0"),
        "Female Delegates",
        text(registration.female_delegate_count, "0"),
      ],
      [
        "Total Delegates",
        text(registration.total_delegate_count, "0"),
        "Total Payment",
        amount(registration.expected_total),
      ],
    ],
    y,
  );

  y = sectionTitle(doc, "Section 2: Delegate List", y);
  autoTable(doc, {
    startY: y,
    head: [["No.", "Name", "Age", "Gender", "Health Condition"]],
    body: delegates.length
      ? delegates.map((delegate, index) => [
          delegate.row_number || index + 1,
          text(delegate.name),
          text(delegate.age),
          text(delegate.gender),
          text(delegate.health_condition, "None"),
        ])
      : [["—", "No delegates recorded", "—", "—", "—"]],
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 24 },
      4: { cellWidth: 48 },
    },
  });
  y = doc.lastAutoTable.finalY + 7;

  y = sectionTitle(doc, "Section 3: Payment Details", y);
  y = detailsTable(
    doc,
    [
      [
        "Registration Fee",
        `${amount(registration.fee_per_delegate)} / delegate`,
        "GCash Mode",
        text(registration.gcash_mode_of_payment),
      ],
      [
        "Date of Payment",
        formatDate(registration.payment_date),
        "Reference Number",
        text(registration.reference_number),
      ],
      [
        "Total Payment",
        amount(registration.expected_total),
        "Payment Status",
        text(registration.payment_status),
      ],
    ],
    y,
  );
  addFooters(doc, registration);
  doc.save(
    `Pre-Registration_${safeFilenamePart(event.title, "Event")}_${safeFilenamePart(church.name, "LocalChurch")}.pdf`,
  );
}

async function downloadMerchPreorderPdf(preorder) {
  const form = preorder.merch_preorder_forms || {};
  const church = preorder.local_churches || {};
  const doc = createDocument();
  let y = await documentHeader(doc, form.title, form.description, [
    formatDate(form.preorder_date),
  ]);

  y = sectionTitle(doc, "Section 1: Church Information", y);
  y = detailsTable(
    doc,
    [
      ["District", text(church.district), "Local Church", text(church.name)],
      [
        "Church President",
        text(preorder.local_church_president),
        "President Contact",
        text(preorder.president_contact_number),
      ],
    ],
    y,
  );

  y = sectionTitle(doc, "Section 2: Order Details", y);
  if (form.merch_type === "Shirt") {
    const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
    const grouped = new Map();
    (preorder.merch_shirt_order_items || []).forEach((item) => {
      if (!grouped.has(item.color))
        grouped.set(
          item.color,
          Object.fromEntries(sizes.map((size) => [size, 0])),
        );
      grouped.get(item.color)[item.size] = Number(item.quantity || 0);
    });
    const rows = [...grouped.entries()].map(([color, quantities]) => {
      const values = sizes.map((size) => quantities[size] || 0);
      return [color, ...values, values.reduce((sum, value) => sum + value, 0)];
    });
    autoTable(doc, {
      startY: y,
      head: [["Color", ...sizes, "Total"]],
      body: rows.length ? rows : [["No shirt items", 0, 0, 0, 0, 0, 0, 0]],
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN, bottom: 20 },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        halign: "center",
        fontSize: 8.5,
      },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        halign: "center",
      },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 42 } },
    });
    y = doc.lastAutoTable.finalY + 7;
  } else {
    const merchName =
      form.merch_type === "Others"
        ? text(form.custom_merch_name, "Other Merch")
        : "Lace";
    y = detailsTable(
      doc,
      [
        [
          form.merch_type === "Others" ? "Name of Merch" : "Merch Type",
          merchName,
          "Total Number of Orders",
          text(preorder.total_quantity, "0"),
        ],
      ],
      y,
    );
  }

  y = sectionTitle(doc, "Section 3: Payment Details", y);
  const merchName =
    form.merch_type === "Others"
      ? text(form.custom_merch_name, "Merch")
      : text(form.merch_type, "Merch");
  y = detailsTable(
    doc,
    [
      [
        `${merchName} Fee`,
        `${amount(preorder.fee_per_item)} / item`,
        "GCash Mode",
        text(preorder.gcash_mode_of_payment),
      ],
      [
        "Date of Payment",
        formatDate(preorder.payment_date),
        "Reference Number",
        text(preorder.reference_number),
      ],
      [
        "Total Payment",
        amount(preorder.expected_total),
        "Payment Status",
        text(preorder.payment_status),
      ],
    ],
    y,
  );
  addFooters(doc, preorder);
  doc.save(
    `Merch-PreOrder_${safeFilenamePart(form.title, "Merch")}_${safeFilenamePart(church.name, "LocalChurch")}.pdf`,
  );
}

export { downloadMerchPreorderPdf, downloadPreRegistrationPdf };
