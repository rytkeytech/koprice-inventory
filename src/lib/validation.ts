// Form checks shared by the login, sign-up and password forms.
// Each returns a plain-English message, or null when the value is fine.

export const MIN_PASSWORD_LENGTH = 8;

export function checkEmail(email: string) {
  if (!email.trim()) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "That email address doesn't look right.";
  }
  return null;
}

export function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function checkFullName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Enter your full name.";
  if (trimmed.length > 120) return "Name is too long.";
  return null;
}

/** Ghana phone numbers: 10 digits starting with 0, or +233 followed by 9 digits. */
export function checkPhone(phone: string) {
  const digits = phone.replace(/[\s-]/g, "");
  if (!digits) return "Enter your phone number.";
  if (!/^(0\d{9}|\+233\d{9})$/.test(digits)) {
    return "Enter a valid phone number, e.g. 024 123 4567.";
  }
  return null;
}

export function normalisePhone(phone: string) {
  return phone.replace(/[\s-]/g, "");
}

/** Only allow redirects to paths inside this app (blocks "//evil.com"). */
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
