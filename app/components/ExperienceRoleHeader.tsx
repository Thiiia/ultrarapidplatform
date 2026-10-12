"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, FC, SVGProps } from "react";
import ExperienceMobileNavigation from "@/app/components/ExperienceMobileNavigation";
import styles from "./ExperienceRoleHeader.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";

export type ExperienceRoleHeaderIcon = FC<SVGProps<SVGSVGElement>>;

export type ExperienceRoleNavigationGlyph =
  | "home"
  | "lessons"
  | "builder"
  | "progress"
  | "play"
  | "assignments"
  | "classes"
  | "students";

export type ExperienceRoleNavigationItem = {
  label: string;
  href: string;
  icon?: ExperienceRoleNavigationGlyph;
  activePaths?: string[];
  matchNested?: boolean;
};

export type ExperienceRoleHeaderAction = {
  label: string;
  ariaLabel?: string;
  mobileLabel?: string;
  href?: string;
  width?: number;
  Icon?: ExperienceRoleHeaderIcon;
  disabled?: boolean;
  mobile?: boolean;
  variant?: "profile";
};

type ExperienceRoleHeaderProps = {
  role: string;
  navigationLabel: string;
  navigationItems: ExperienceRoleNavigationItem[];
  utilityItems?: ExperienceRoleHeaderAction[];
  identityLabel?: string;
  logoutLabel: string;
};

function cleanPath(href: string) {
  return href.split(/[?#]/, 1)[0];
}

function matchesPath(pathname: string, href: string, matchNested = true) {
  const target = cleanPath(href);
  return (
    pathname === target ||
    (matchNested && target !== "/" && pathname.startsWith(`${target}/`))
  );
}

function isNavigationItemCurrent(
  pathname: string,
  item: ExperienceRoleNavigationItem,
) {
  return (
    matchesPath(pathname, item.href, item.matchNested) ||
    (item.activePaths ?? []).some((path) => matchesPath(pathname, path))
  );
}

function NavigationGlyph({ name }: { name: ExperienceRoleNavigationGlyph }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return <svg {...shared}><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></svg>;
    case "lessons":
      return <svg {...shared}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5z" /></svg>;
    case "builder":
      return <svg {...shared}><path d="m14.5 6.5 3 3M4 20l4-.8L19 8.2a2.1 2.1 0 0 0-3-3L5 16.2z" /><path d="M4 20h16" /></svg>;
    case "progress":
      return <svg {...shared}><path d="M4 20V12M10 20V5M16 20v-8M22 20H2" /></svg>;
    case "play":
      return <svg {...shared}><path d="m8 5 11 7-11 7z" /></svg>;
    case "assignments":
      return <svg {...shared}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></svg>;
    case "classes":
      return <svg {...shared}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "students":
      return <svg {...shared}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M17 11h6" /></svg>;
  }
}

export default function ExperienceRoleHeader({
  role,
  navigationLabel,
  navigationItems,
  utilityItems = [],
  identityLabel,
  logoutLabel,
}: ExperienceRoleHeaderProps) {
  const pathname = usePathname();
  const mobileItems = [
    ...navigationItems.map((item) => ({
      label: item.label,
      href: item.href,
      current: isNavigationItemCurrent(pathname, item),
    })),
    ...utilityItems
      .filter((item) => item.mobile && item.href)
      .map((item) => ({
        label: item.mobileLabel ?? item.label,
        href: item.href as string,
        current: matchesPath(pathname, item.href as string),
      })),
    { label: logoutLabel, href: "/auth/logout", current: false },
  ];

  return (
    <header
      className={`experience-role-header experience-role-header--wide-nav ${styles.header}`}
    >
      <div className={`experience-role-header-inner ${styles.inner}`}>
        <div className={`experience-role-brand-group ${styles.brandGroup}`}>
          <div className={styles.logoFrame}>
            <URIcon aria-label="UltraRapid" />
          </div>

          <nav
            aria-label={navigationLabel}
            className={`experience-navigation experience-desktop-navigation ${styles.navigation}`}
            data-experience-component="navigation"
            data-experience-role={role.toLowerCase()}
          >
            {navigationItems.map((item) => {
              const current = isNavigationItemCurrent(pathname, item);

              return (
                <Link
                  key={`${item.label}:${item.href}`}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  data-experience-component="navigation-link"
                  className={styles.navigationLink}
                >
                  {item.icon ? (
                    <span className={styles.navigationIcon}>
                      <NavigationGlyph name={item.icon} />
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={`experience-role-utilities ${styles.utilities}`}>
          {identityLabel ? (
            <span className={styles.identity}>{identityLabel}</span>
          ) : null}
          {utilityItems.map((item) => {
            const Icon = item.Icon;
            const current = item.href
              ? matchesPath(pathname, item.href)
              : false;
            const className = `${styles.utilityItem} ${
              Icon ? styles.iconUtility : ""
            } ${item.variant === "profile" ? styles.profileUtility : ""}`;
            const style: CSSProperties = {
              ...(item.width ? { width: item.width } : {}),
              ...(item.disabled
                ? { background: "transparent", cursor: "default" }
                : {}),
            };
            const content = Icon ? (
              <Icon aria-hidden="true" />
            ) : (
              item.label
            );

            if (item.disabled) {
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-label={item.ariaLabel ?? item.label}
                  className={className}
                  disabled
                  style={style}
                >
                  {content}
                </button>
              );
            }

            if (!item.href) return null;

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.ariaLabel ?? item.label}
                aria-current={current ? "page" : undefined}
                className={className}
                style={style}
              >
                {content}
              </Link>
            );
          })}

          <a
            href="/auth/logout"
            aria-label={logoutLabel}
            className={`${styles.utilityItem} ${styles.logout}`}
          >
            {logoutLabel}
          </a>
        </div>

        <ExperienceMobileNavigation items={mobileItems} label={role} />
      </div>
    </header>
  );
}
