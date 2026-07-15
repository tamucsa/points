import type { LucideIcon } from "lucide-react";
import {
  CHECKIN_METHOD_LABELS,
  CHECKIN_TYPE_LABELS,
  SCOPE_LABELS,
} from "@/utils/constants";
import {
  CATEGORY_ICONS,
  CHECKIN_METHOD_ICONS,
  CHECKIN_TYPE_ICONS,
  ICON_SIZES,
  SCOPE_ICONS,
} from "@/utils/icons";

type IconSize = keyof typeof ICON_SIZES;

interface IconLabelProps {
  icon: LucideIcon;
  label: string;
  size?: IconSize;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  /** When set, label becomes an external link (e.g. Google Maps). */
  href?: string | null;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export default function IconLabel({
  icon: Icon,
  label,
  size = "md",
  className = "",
  iconClassName = "text-subtitle",
  labelClassName = "",
  href,
  onClick,
}: IconLabelProps) {
  const text = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`font-medium text-primary underline-offset-2 hover:underline ${labelClassName}`}
    >
      {label}
    </a>
  ) : (
    <span className={labelClassName}>{label}</span>
  );

  return (
    <span
      className={`inline-flex items-center gap-1.5 leading-none ${className}`}
    >
      <Icon
        className={`shrink-0 ${ICON_SIZES[size]} ${iconClassName}`}
        aria-hidden
      />
      {text}
    </span>
  );
}

interface BadgeProps {
  scope?: string;
  checkInType?: string;
  checkInMethod?: string;
  className?: string;
}

export function ScopeBadge({
  scope,
  className = "",
}: {
  scope: string;
  className?: string;
}) {
  const Icon = SCOPE_ICONS[scope];
  const label = SCOPE_LABELS[scope] ?? scope;
  if (!Icon) return <span className={className}>{label}</span>;
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  );
}

export function CategoryBadge({
  category,
  className = "",
}: {
  category: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  if (!Icon) return <span className={className}>{category}</span>;
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={category} size="sm" />
    </span>
  );
}

export function CheckInTypeBadge({ checkInType, className = "" }: BadgeProps) {
  const Icon = CHECKIN_TYPE_ICONS[checkInType ?? ""];
  const label = CHECKIN_TYPE_LABELS[checkInType ?? ""] ?? checkInType;
  if (!Icon || !label) return null;
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  );
}

export function CheckInMethodBadge({
  checkInMethod,
  className = "",
}: BadgeProps) {
  const Icon = CHECKIN_METHOD_ICONS[checkInMethod ?? ""];
  const label = CHECKIN_METHOD_LABELS[checkInMethod ?? ""] ?? checkInMethod;
  if (!Icon || !label) return <span className={className}>{label}</span>;
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  );
}
