export type TemplateValue = string | number | boolean | null | undefined;

export function renderTemplate(
  template: string,
  replacements: Record<string, TemplateValue>,
  resolveVariable?: (name: string) => TemplateValue,
): string {
  const normalized = new Map(
    Object.entries(replacements).map(([key, value]) => [key.toLowerCase(), String(value ?? "")]),
  );

  return template.replace(/\{([^{}]+)\}/gi, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (key.toLowerCase().startsWith("var:") && resolveVariable) {
      return String(resolveVariable(key.slice(4).trim()) ?? "");
    }
    return normalized.get(key.toLowerCase()) ?? match;
  });
}
