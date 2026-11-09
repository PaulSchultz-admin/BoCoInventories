// The site-wide copyright pages, reached from the home page's Copyrights
// menu (see Layouts.jsx). Their content lives in the "home" dataset and is
// admin-editable like About/Contact. An adminOnly page shows grayed out in
// the menu, and can't be opened, until an admin logs in.
export const COPYRIGHT_PAGES = [
  { path: "policy", page: "copyright-policy", label: "Policy and procedures" },
  { path: "submissions", page: "copyright-submissions", label: "Submissions and permissions" },
  { path: "info", page: "copyright-info", label: "View copyright info", adminOnly: true }
];
