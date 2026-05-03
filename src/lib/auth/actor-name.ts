type Decoded = { name?: string; email?: string };

export function getActorFirstName(decoded: Decoded): string {
  const name = decoded.name?.trim();
  if (!name) return "Anonymous";
  const firstToken = name.split(/\s+/)[0];
  return firstToken && firstToken.length > 0 ? firstToken : "Anonymous";
}
