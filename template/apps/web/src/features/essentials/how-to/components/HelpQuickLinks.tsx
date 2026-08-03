"use client";

import { Link } from "@carlonicora/nextjs-jsonapi/components";

export type HelpQuickLinkItem = {
  id: string;
  name: string;
  summary?: string;
  howToType: string;
  slug: string;
};

export function HelpQuickLinks({ heading, items }: { heading: string; items: HelpQuickLinkItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{heading}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/help/${item.howToType}/${item.slug}`}
              className="hover:bg-muted block rounded border p-3"
            >
              <div className="text-sm font-medium">{item.name}</div>
              {item.summary ? <div className="text-muted-foreground text-xs">{item.summary}</div> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
