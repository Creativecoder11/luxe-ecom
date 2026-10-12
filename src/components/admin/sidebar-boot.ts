/** Shared by the server layout (pre-paint script) and the client sidebar store. */
export const SIDEBAR_STORAGE_KEY = "ucp.admin.sidebar";

/** Inline pre-paint script: avoids a flash of the expanded sidebar on full page loads. */
export const sidebarBootScript = `try{if(localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)})==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;
