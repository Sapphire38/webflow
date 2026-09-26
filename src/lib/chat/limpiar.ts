/**
 * MiniMax a veces cuela palabras en chino o japonés en medio del castellano
 * (p. ej. "casi 持平"). Se sacan los ideogramas y los espacios que quedan dobles.
 */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]+/g;

export function sinCjk(texto: string): string {
  return texto.replace(CJK, "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:])/g, "$1");
}
