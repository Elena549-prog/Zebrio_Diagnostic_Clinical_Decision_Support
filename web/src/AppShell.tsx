/**
 * AppShell — the Clinical Precision chrome: a single top app bar (brand, nav
 * tabs, search, and — when a case is open — the patient header plus "New
 * case"). The shell wraps every view.
 *
 * There is deliberately no left side-nav. The workspace is three columns
 * (evidence · reasoning tree · detail); a fourth navigation column only
 * duplicated identity already in the app bar and offered scroll anchors to
 * panes that are all on screen at once.
 */

import type { ReactNode } from "react";
import type { Case } from "./types.js";

export type View = "home" | "workspace" | "docs" | "tutorial";

interface Props {
  view: View;
  c: Case | null;
  onGo: (v: View) => void;
  onNewCase: () => void;
  children: ReactNode;
}

export function AppShell({ view, c, onGo, onNewCase, children }: Props) {
  const inCase = (view === "workspace" || view === "tutorial") && !!c;
  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-brand">
          <span className="logo">🌳</span>
          <div>
            <h1>Arbor</h1>
            <p className="appbar-tag">retraceable differential diagnosis</p>
          </div>
          <nav className="appbar-nav">
            <a className={view === "home" ? "active" : ""} onClick={() => onGo("home")}>
              Home
            </a>
            <a className={view === "docs" ? "active" : ""} onClick={() => onGo("docs")}>
              Recipes
            </a>
          </nav>
        </div>
        <div className="appbar-actions">
          {inCase ? (
            <div className="patient-header">
              <span className="ph-name">{c!.title}</span>
              <span className="ph-meta data-mono">
                {[
                  c!.presentation.demographics.ageYears != null && `age ${c!.presentation.demographics.ageYears}`,
                  c!.presentation.demographics.sex,
                  c!.presentation.demographics.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <button className="ghost" onClick={onNewCase}>+ New case</button>
            </div>
          ) : (
            <div className="appbar-search">
              <span className="msym">search</span>
              <input placeholder="Search…" type="text" />
            </div>
          )}
          <button className="icon-btn" title="Notifications">
            <span className="msym">notifications</span>
          </button>
          <button className="icon-btn" title="Settings">
            <span className="msym">settings</span>
          </button>
          <button className="icon-btn" title="Account">
            <span className="msym">account_circle</span>
          </button>
        </div>
      </header>

      <div className="shell-body">
        {children}
      </div>
    </div>
  );
}
