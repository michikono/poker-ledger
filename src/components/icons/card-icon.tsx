import { cn } from "@/lib/utils";

export type CardIconProps = {
  size?: number;
  className?: string;
};

export function CardIcon({ size = 24, className }: CardIconProps) {
  return (
    <svg
      role="img"
      aria-label="Poker Ledger"
      width={size}
      height={size}
      viewBox="0 0 24 32"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="30"
        rx="3"
        ry="3"
        fill="var(--card)"
        stroke="var(--felt)"
        strokeWidth="2"
      />
      <path
        d="M12 8 C 9 11, 7 13, 7 16 C 7 18.5, 9 20, 11 19.5 L 11 22 L 13 22 L 13 19.5 C 15 20, 17 18.5, 17 16 C 17 13, 15 11, 12 8 Z"
        fill="var(--felt)"
      />
      <circle cx="6" cy="6" r="1.2" fill="var(--chip-gold)" />
      <circle cx="18" cy="26" r="1.2" fill="var(--chip-gold)" />
    </svg>
  );
}
