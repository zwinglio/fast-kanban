// Built-in board icons (24×24 line art). Ids must match server/boardIcons.ts.
export interface BoardIconDef {
  id: string;
  label: string;
  paths: string[];
}

export const BOARD_ICONS: BoardIconDef[] = [
  {
    id: "rocket",
    label: "Rocket",
    paths: [
      "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z",
      "M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z",
      "M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0",
      "M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5",
    ],
  },
  {
    id: "briefcase",
    label: "Briefcase",
    paths: ["M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2", "M2 13h20"],
  },
  { id: "code", label: "Code", paths: ["M16 18l6-6-6-6", "M8 6l-6 6 6 6"] },
  {
    id: "bug",
    label: "Bug",
    paths: ["M8 7a4 4 0 0 1 8 0v1H8z", "M6 10h12v4a6 6 0 0 1-12 0z", "M12 10v10", "M3 14h3M18 14h3M4 8l2 2M20 8l-2 2M4 20l2-2M20 20l-2-2"],
  },
  {
    id: "palette",
    label: "Palette",
    paths: [
      "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.3-4-7.8-9-7.8z",
      "M7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01",
    ],
  },
  { id: "megaphone", label: "Megaphone", paths: ["M3 10v4a1 1 0 0 0 1 1h3l7 4V5L7 9H4a1 1 0 0 0-1 1z", "M18 9a4 4 0 0 1 0 6"] },
  { id: "book", label: "Book", paths: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z", "M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"] },
  { id: "flask", label: "Flask", paths: ["M9 3h6", "M10 3v6l-5.4 9.4A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.6L14 9V3", "M7.5 15h9"] },
  {
    id: "heart",
    label: "Heart",
    paths: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"],
  },
  { id: "star", label: "Star", paths: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"] },
  { id: "bolt", label: "Bolt", paths: ["M13 2L4 14h7l-1 8 9-12h-7z"] },
  {
    id: "globe",
    label: "Globe",
    paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M3 12h18", "M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"],
  },
  { id: "target", label: "Target", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"] },
  { id: "chart", label: "Chart", paths: ["M3 3v18h18", "M7 16v-4", "M12 16V8", "M17 16v-7"] },
  { id: "cart", label: "Cart", paths: ["M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6", "M10 21h.01M17 21h.01"] },
  { id: "mobile", label: "Mobile", paths: ["M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M11 18h2"] },
  { id: "home", label: "Home", paths: ["M3 10.5L12 3l9 7.5", "M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"] },
];

export function findBoardIcon(id: string | null | undefined): BoardIconDef | undefined {
  return id ? BOARD_ICONS.find((i) => i.id === id) : undefined;
}
