const normalizePhilippineMobile = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if ((raw.startsWith("+63") || digits.length === 12) && /^639\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits.slice(0, 11);
};

const isValidPhilippineMobile = (value) =>
  /^09\d{9}$/.test(normalizePhilippineMobile(value));

const philippineMobileError =
  "Enter an 11-digit Philippine mobile number starting with 09.";

const philippineMobileInputProps = {
  type: "tel",
  inputMode: "numeric",
  pattern: "09[0-9]{9}",
  maxLength: 11,
  placeholder: "09XXXXXXXXX",
};

export {
  isValidPhilippineMobile,
  normalizePhilippineMobile,
  philippineMobileError,
  philippineMobileInputProps,
};
