// How often I want to be in touch with a contact. Shared by the forms (client)
// and the database queries (server), so it must not import anything server-only.
export const CONTACT_FREQUENCIES = [
  { value: "week", label: "Раз в неделю", interval: "7 days" },
  { value: "two_weeks", label: "Раз в 2 недели", interval: "14 days" },
  { value: "month", label: "Раз в месяц", interval: "1 month" },
  { value: "quarter", label: "Раз в 3 месяца", interval: "3 months" },
  { value: "half_year", label: "Раз в полгода", interval: "6 months" },
  { value: "year", label: "Раз в год", interval: "1 year" },
] as const;

export type ContactFrequency = (typeof CONTACT_FREQUENCIES)[number]["value"];

export const NO_FREQUENCY_LABEL = "Не задана";

export function isContactFrequency(value: string): value is ContactFrequency {
  return CONTACT_FREQUENCIES.some((f) => f.value === value);
}

export function frequencyLabel(value: string | null): string {
  return (
    CONTACT_FREQUENCIES.find((f) => f.value === value)?.label ??
    NO_FREQUENCY_LABEL
  );
}
