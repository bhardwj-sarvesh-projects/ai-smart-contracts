export class UnicodeNormalizer {
  public static normalize(content: string): string {
    if (!content) return '';
    return content
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–]/g, '-');
  }
}
