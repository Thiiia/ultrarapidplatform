import Link from "next/link";

export type ExperienceNavigationItem = {
  label: string;
  href: string;
  current?: boolean;
};

export default function ExperienceMobileNavigation({
  items,
  label,
}: {
  items: ExperienceNavigationItem[];
  label: string;
}) {
  return (
    <details className="experience-mobile-navigation">
      <summary className="experience-button experience-button--secondary">
        Menu
      </summary>
      <nav
        className="experience-mobile-navigation__links experience-navigation"
        aria-label={`${label} menu`}
        data-experience-component="navigation"
      >
        {items.map((item) => (
          <Link
            key={`${item.label}:${item.href}`}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
