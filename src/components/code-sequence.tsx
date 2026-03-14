"use client";

interface CodeSequenceProps {
  values: Array<number | null>;
  colorCount: number;
  className?: string;
  compact?: boolean;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CodeSequence({
  values,
  colorCount,
  className,
  compact = false
}: Readonly<CodeSequenceProps>) {
  const label = values.map((value) => value ?? "・").join(" ");

  if (colorCount > 6) {
    return <span className={joinClasses("code-sequence numeric", className)}>{label}</span>;
  }

  return (
    <span
      aria-label={label}
      className={joinClasses("code-sequence", compact && "compact", className)}
      role="img"
    >
      {values.map((value, index) => (
        <span
          key={`code-sequence-${index}-${value ?? "empty"}`}
          aria-hidden="true"
          className={joinClasses("code-badge", value === null ? "empty" : `color-${value}`)}
        />
      ))}
    </span>
  );
}
