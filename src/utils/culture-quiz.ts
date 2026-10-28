export const CULTURE_QUIZ_PLACES = [1, 2, 3] as const;

export type CultureQuizPlace = (typeof CULTURE_QUIZ_PLACES)[number];

export interface CultureQuizAssignment {
  memberId: string;
  place: CultureQuizPlace;
}

export function isCultureQuizPlace(value: number): value is CultureQuizPlace {
  return value === 1 || value === 2 || value === 3;
}

export function cultureQuizPoints(place: CultureQuizPlace): number {
  if (place === 1) return 3;
  if (place === 2) return 2;
  return 1;
}

export function cultureQuizPlaceLabel(place: number): string {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return "";
}

/** A member can hold one place. Several members can share a place. */
export function cultureQuizAssignmentError(
  assignments: CultureQuizAssignment[],
): string | null {
  const seen = new Set<string>();
  for (const row of assignments) {
    if (!isCultureQuizPlace(row.place)) {
      return "Each result needs a 1st, 2nd, or 3rd place.";
    }
    if (seen.has(row.memberId)) {
      return "A member can only hold one Culture Quiz place.";
    }
    seen.add(row.memberId);
  }
  return null;
}

export function checkInRemovalSummary(input: {
  eventName: string;
  checkInPoints: number;
  quizPoints: number;
}): string {
  const parts: string[] = [];
  if (input.checkInPoints > 0) {
    const noun = input.checkInPoints === 1 ? "point" : "points";
    parts.push(`${input.checkInPoints} check-in ${noun}`);
  }
  if (input.quizPoints > 0) {
    const noun = input.quizPoints === 1 ? "point" : "points";
    parts.push(`${input.quizPoints} Culture Quiz ${noun}`);
  }
  if (parts.length === 0) {
    return `This removes their attendance for ${input.eventName}. This check-in was not counting toward points, so totals stay the same.`;
  }
  const deducted =
    parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`;
  return `This removes their attendance for ${input.eventName} and deducts ${deducted}.`;
}
