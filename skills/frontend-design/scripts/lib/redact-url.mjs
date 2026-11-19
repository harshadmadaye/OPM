// Strips credentials from http(s) URLs so reports, stdout and error messages never carry them.
export function redactUrl(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.href;
  } catch {
    return url;
  }
}
