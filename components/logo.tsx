// SPDX-License-Identifier: Apache-2.0
//
// Brand lockup: the shield mark plus the product name.
//
// The name is rendered as TEXT rather than using seath-aid-wordmark.png, for
// two reasons. The wordmark is dark green on transparency, so it would become
// invisible the moment the `.dark` theme in app/globals.css is switched on
// (it is defined but not currently activated in app/layout.tsx). And real text
// stays selectable, translatable, and readable by a screen reader.
//
// The mark itself is decorative — the name sits right next to it — so its alt
// is deliberately empty rather than repeating "Seath Aid" to assistive tech.
//
// It points at the generated 192px icon, not the 1024px source in
// public/images: next.config.mjs sets `images.unoptimized`, so whatever is
// referenced is what ships, and the source file is 142 KB for a 24px slot.

import Image from "next/image";
import Link from "next/link";

export function Logo({
  href = "/",
  size = 24,
  className = "",
}: {
  /** Where the lockup links to. Pass null to render it as plain content. */
  href?: string | null;
  size?: number;
  className?: string;
}) {
  const content = (
    <>
      <Image
        src="/icon-192.png"
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        style={{ width: size, height: size }}
      />
      <span className="text-sm font-medium tracking-tight">Seath Aid</span>
    </>
  );

  const classes = `inline-flex items-center gap-2 ${className}`;

  if (href === null) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={`${classes} hover:opacity-80`}>
      {content}
    </Link>
  );
}
