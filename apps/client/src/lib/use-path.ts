import { useLocation } from "react-router-dom";

/** Current pathname, so layout pieces don't each import the router. */
export function usePath(): string {
  return useLocation().pathname;
}
