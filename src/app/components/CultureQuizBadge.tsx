import { cultureQuizPlaceLabel } from "@/utils/culture-quiz";

interface Props {
  place: number;
  points: number;
}

export default function CultureQuizBadge({ place, points }: Props) {
  const label = cultureQuizPlaceLabel(place);
  if (!label) return null;
  return (
    <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
      Culture Quiz · {label} · +{points}
    </span>
  );
}
