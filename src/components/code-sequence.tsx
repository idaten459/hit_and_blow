"use client";

interface CodeSequenceProps {
  values: Array<number | null>;
  colorCount: number;
  className?: string;
  compact?: boolean;
  wrap?: boolean;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CodeSequence({
  values,
  colorCount,
  className,
  compact = false,
  wrap = false
}: Readonly<CodeSequenceProps>) {
  const label = values.map((value) => value ?? "・").join(" ");

  if (colorCount > 6) {
    if (wrap) {
      return (
        <span
          aria-label={label}
          className={joinClasses("code-sequence numeric wrap", compact && "compact", className)}
          role="img"
        >
          {values.map((value, index) => (
            <span
              key={`code-sequence-numeric-${index}-${value ?? "empty"}`}
              aria-hidden="true"
              className={joinClasses("numeric-token", compact && "compact", value === null && "empty")}
            >
              {value ?? "-"}
            </span>
          ))}
        </span>
      );
    }

    return (
      <span
        aria-label={label}
        className={joinClasses("code-sequence numeric", className)}
        role="img"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={joinClasses("code-sequence", compact && "compact", wrap && "wrap", className)}
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
