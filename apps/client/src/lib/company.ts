import { useSyncExternalStore } from "react";

export interface CompanyProfile {
  name: string;
  email: string;
  address: string;
  phone: string;
}

const KEY = "sisarpras.company.v1";
const DEFAULT_PROFILE: CompanyProfile = { name: "Profil Instansi", email: "", address: "", phone: "" };
const CHANGE_EVENT = "sisarpras:company-updated";

export function getCompanyProfile(): CompanyProfile {
  try {
    const value = localStorage.getItem(KEY);
    return value ? { ...DEFAULT_PROFILE, ...JSON.parse(value) as Partial<CompanyProfile> } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveCompanyProfile(profile: CompanyProfile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useCompanyProfile() {
  return useSyncExternalStore(subscribe, getCompanyProfile, () => DEFAULT_PROFILE);
}

