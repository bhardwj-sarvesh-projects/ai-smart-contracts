export class WhitespaceNormalizer {
  public static normalize(content: string): string {
    if (!content) return '';
    let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    result = result.split('\n').map(line => line.trimEnd()).join('\n');
    return result.trim() + '\n';
  }
}
