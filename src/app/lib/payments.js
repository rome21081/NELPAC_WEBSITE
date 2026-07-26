const PAYMENT_STATUS_LABELS = {
  Pending: "Pending Verification",
  Paid: "Pending Verification",
  Partial: "Verified Partial",
  Verified: "Verified Paid",
  Rejected: "Rejected",
};

function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status || "Pending Verification";
}

function buildPaymentReturnUrl({ module, sourceId }) {
  if (typeof window === "undefined") return "";
  const url = new URL("/user/payment-confirmation", window.location.origin);
  url.searchParams.set("module", module);
  if (sourceId) url.searchParams.set("source", sourceId);
  url.searchParams.set("status", "Pending Verification");
  return url.toString();
}

function getGcashStoreUrl() {
  if (typeof window === "undefined") {
    return "https://play.google.com/store/apps/details?id=com.globe.gcash.android&hl=en&gl=US";
  }

  const userAgent = window.navigator.userAgent || "";
  if (/(iPhone|iPod|iPad)/i.test(userAgent)) {
    return "https://apps.apple.com/ph/app/gcash/id520020791";
  }

  return "https://play.google.com/store/apps/details?id=com.globe.gcash.android&hl=en&gl=US";
}

function openGcashStore() {
  window.location.href = getGcashStoreUrl();
}

export {
  buildPaymentReturnUrl,
  openGcashStore,
  paymentStatusLabel,
};
