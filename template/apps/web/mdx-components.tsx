import type { MDXComponents } from "mdx/types";
import { Link } from "@/i18n/routing";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Override links for internal routing
    a: ({ href, children, ...props }) => {
      if (href?.startsWith("http")) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      }
      return (
        <Link href={href || "/"} {...props}>
          {children}
        </Link>
      );
    },

    Link,

    ...components,
  };
}
