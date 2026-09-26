/** 1650, or "1418 BCE". */
export const formatYear = (y: number): string => (y < 0 ? `${-y} BCE` : String(y));

/** "Its echo, 2,300 years earlier" from the two works' years, or plain "Its echo" when either is undated. */
export function echoPhrase(from: number | undefined, to: number | undefined): string {
  if (from === undefined || to === undefined || from === to) return 'Its echo';
  const years = Math.abs(to - from).toLocaleString('en-US');
  return `Its echo, ${years} years ${to < from ? 'earlier' : 'later'}`;
}
