"use client";

import { useSyncExternalStore } from "react";
import { SIDEBAR_STORAGE_KEY } from "./sidebar-boot";

/** Persisted desktop sidebar state. Applied to <html data-sidebar> so CSS sizes the sidebar. */
const EVENT = "ucp:sidebar";

export type SidebarState = "expanded" | "collapsed";

function read(): SidebarState {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function applySidebarState(state: SidebarState) {
  if (state === "collapsed") document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
}

export function setSidebarState(state: SidebarState) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // Storage unavailable (private mode): state still applies for this page view.
  }
  applySidebarState(state);
  window.dispatchEvent(new Event(EVENT));
}

export function useSidebarState(): SidebarState {
  return useSyncExternalStore(subscribe, read, () => "expanded");
}

