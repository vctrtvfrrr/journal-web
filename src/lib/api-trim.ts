// Mirrors the API's trim, which also removes U+0085 unlike String.prototype.trim.
export const apiTrim = (value: string) => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, "");
