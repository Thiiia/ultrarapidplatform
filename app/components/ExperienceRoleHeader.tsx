"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, SVGProps } from "react";
import ExperienceMobileNavigation from "@/app/components/ExperienceMobileNavigation";
import styles from "./ExperienceRoleHeader.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";

export type ExperienceRoleHeaderIcon = FC<SVGProps<SVGSVGElement>>;

export type ExperienceRoleNavigationItem = {
  label: string;
  href: string;
  width?: number;
  Icon?: ExperienceRoleHeaderIcon;
  ActiveIcon?: ExperienceRoleHeaderIcon;
  activePaths?: string[];
  matchNested?: boolean;
};

export type ExperienceRoleHeaderAction = {
  label: string;
  href?: string;
  width?: number;
  Icon?: ExperienceRoleHeaderIcon;
  disabled?: boolean;
  mobile?: boolean;
};

type ExperienceRoleHeaderProps = {
  role: string;
  navigationLabel: string;
  navigationItems: ExperienceRoleNavigationItem[];
  utilityItems?: ExperienceRoleHeaderAction[];
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

export default function ExperienceRoleHeader({
  role,
  navigationLabel,
  navigationItems,
  utilityItems = [],
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
        label: item.label,
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
              const Icon = current ? item.ActiveIcon ?? item.Icon : item.Icon;

              return (
                <Link
                  key={`${item.label}:${item.href}`}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={current ? "page" : undefined}
                  data-experience-component="navigation-link"
                  className={`${styles.navigationLink} ${
                    Icon ? styles.iconLink : styles.labelLink
                  }`}
                  style={item.width ? { width: item.width } : undefined}
                >
                  {Icon ? <Icon aria-hidden="true" /> : item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={`experience-role-utilities ${styles.utilities}`}>
          {utilityItems.map((item) => {
            const Icon = item.Icon;
            const current = item.href
              ? matchesPath(pathname, item.href)
              : false;
            const className = `${styles.utilityItem} ${
              Icon ? styles.iconUtility : ""
            }`;
            const style = {
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
                  aria-label={item.label}
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
                aria-label={item.label}
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
