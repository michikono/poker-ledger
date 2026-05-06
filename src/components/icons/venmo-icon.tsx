import { cn } from "@/lib/utils";

export type VenmoIconProps = {
  size?: number;
  className?: string;
  title?: string;
};

// Stylized Venmo mark: blue rounded square with a white "V". Not the
// official Venmo logo — used as a recognizable affordance, not as a
// brand asset.
export function VenmoIcon({
  size = 16,
  className,
  title = "Venmo",
}: VenmoIconProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block shrink-0", className)}
    >
      <title>{title}</title>
      <rect width="24" height="24" rx="5" fill="#3D95CE" />
      <path
        d="M16.7 6.6c.4.7.6 1.5.6 2.4 0 2.7-2.3 6.2-4.2 8.7H8.7L7.1 6.9l3.7-.4 1.1 7.6c.8-1.4 1.8-3.6 1.8-5.1 0-.8-.1-1.4-.3-1.8l3.3-.6z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
