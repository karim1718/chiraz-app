import { useEffect, useState } from 'react';

export function CustomerAvatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-neutral-200/90 object-cover shadow-sm"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700 shadow-sm"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
    >
      {initials}
    </div>
  );
}
