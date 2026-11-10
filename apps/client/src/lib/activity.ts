/** Activity feed entry (client-side only; never sent to the server). */
export interface ActivityEntry {
  id: string;
  kind: "create" | "update" | "delete" | "move" | "condition" | "procurement" | "stock";
  title: string;
  detail: string;
  at: string;
}
