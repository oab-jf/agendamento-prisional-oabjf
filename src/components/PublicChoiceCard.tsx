import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onIntent?: () => void;
};

export function PublicChoiceCard({
  title,
  description,
  icon,
  selected = false,
  disabled = false,
  onClick,
  onIntent,
}: Props) {
  return (
    <button
      type="button"
      className={
        "public-choice-card" +
        (selected ? " public-choice-card--selected" : "") +
        (disabled ? " public-choice-card--disabled" : "")
      }
      disabled={disabled}
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
    >
      {icon && <span className="public-choice-card__icon">{icon}</span>}
      <span className="public-choice-card__content">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="public-choice-card__state" aria-hidden>
        {selected ? <Check size={18} /> : <ChevronRight size={18} />}
      </span>
    </button>
  );
}
