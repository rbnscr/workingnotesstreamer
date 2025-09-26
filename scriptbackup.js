const container = document.getElementById("container");
const NOTES_DIR = "notes/";

let backlinksMap = {};
let titlesMap = {};
let notesContent = {};
let openPanes = [];

// Convert [[Note]] → [Note](Note.md)
function convertWikilinks(text) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (match, p1) => {
    const file = p1.trim().replace(/\s+/g, "_") + ".md";
    return `[${p1}](${file})`;
  });
}

// Preload notes & build backlinks
async function buildBacklinksIndex(indexData) {
  const index = {};
  for (const entry of indexData) {
    const file = entry.file;
    titlesMap[file] = entry.title;

    let textRaw = await fetch(NOTES_DIR + file)
      .then(r => r.ok ? r.text() : "")
      .catch(() => "");
    let frontmatter = {};

    if (textRaw.startsWith("---")) {
      const end = textRaw.indexOf("---", 3);
      if (end !== -1) {
        const yamlText = textRaw.slice(3, end).trim();
        try { frontmatter = jsyaml.load(yamlText); } catch(e) { console.warn(e); }
        textRaw = textRaw.slice(end + 3).trim();
      }
    }

    notesContent[file] = { textRaw, frontmatter };

    // Convert [[Note]] to links for backlinks
    const text = convertWikilinks(textRaw);
    const links = Array.from(text.matchAll(/\[.*?\]\((.*?)\)/g)).map(m => m[1]);
    const uniqueLinks = [...new Set(links)]; // deduplicate
    uniqueLinks.forEach(link => {
      if (!index[link]) index[link] = [];
      index[link].push(file);
    });
  }
  backlinksMap = index;
}

// Highlight a pane briefly
function highlightPane(pane) {
  pane.style.backgroundColor = "#89c4fc67";
  setTimeout(() => (pane.style.backgroundColor = "white"), 300);
}

// Truncate text cleanly
function truncatePreview(text, maxLength = 500) {
  if (text.length <= maxLength) return text;
  let truncated = text.slice(0, maxLength).replace(/\s+\S*$/, "");
  return truncated + "…";
}

// Process all links inside a pane or backlinks
function processLinks(pane) {
  pane.querySelectorAll("a").forEach(link => {
    const file = link.dataset.file || (link.getAttribute("href")?.trim() || link.textContent.trim().replace(/\s+/g, "_") + ".md");
    link.dataset.file = file;
    link.href = "#";

    if (!titlesMap[file]) link.classList.add("dead-link");

    link.addEventListener("click", e => {
      e.preventDefault();
      if (titlesMap[file]) {
        // Find parent note pane
        const paneIndex = openPanes.indexOf(pane.closest(".pane"));
        loadNote(file, paneIndex);
      }
    });
  });
}

// Create backlinks at the bottom
function createBacklinks(filename) {
  if (!backlinksMap[filename]) return null;
  const bl = document.createElement("div");
  bl.className = "backlinks";
  bl.innerHTML = "<strong>Backlinks:</strong>";

  backlinksMap[filename].forEach(src => {
    const linkDiv = document.createElement("div");
    linkDiv.className = "backlink-item";

    const a = document.createElement("a");
    a.textContent = titlesMap[src] || src;
    a.dataset.file = src;
    a.href = "#";

    linkDiv.appendChild(a);
    bl.appendChild(linkDiv);
  });

  processLinks(bl);
  attachHoverPreviews(bl);
  return bl;
}

// Show template for missing or hidden notes
function showTemplate(filename, clickedPaneIndex) {
  const position = clickedPaneIndex !== null ? clickedPaneIndex + 1 : openPanes.length;
  while (openPanes.length > position) {
    const removed = openPanes.pop();
    removed.remove();
  }

  const pane = document.createElement("div");
  pane.className = "pane";
  pane.dataset.file = filename;
  pane.innerHTML = "Nothing is here\n\nThis note is hidden or does not exist.";
  container.appendChild(pane);
  openPanes.push(pane);
  pane.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
}

// Hover previews
function attachHoverPreviews(pane) {
  pane.querySelectorAll("a[data-file]").forEach(link => {
    const target = link.dataset.file;
    const note = notesContent[target];
    if (!note) return;

    link.addEventListener("mouseenter", e => {
      const existing = document.querySelector(".note-preview");
      if (existing) existing.remove();

      const tooltip = document.createElement("div");
      tooltip.className = "note-preview";

      let previewText = note.frontmatter?.preview
        ? note.frontmatter.preview
        : note.textRaw.replace(/#.*\n/g, "").trim();
      previewText = truncatePreview(previewText, 500);
      tooltip.innerHTML = marked.parse(previewText);

      document.body.appendChild(tooltip);
      tooltip.style.display = "block";
      tooltip.style.left = e.pageX + 10 + "px";
      tooltip.style.top = e.pageY + 10 + "px";

      const moveHandler = ev => {
        tooltip.style.left = ev.pageX + 10 + "px";
        tooltip.style.top = ev.pageY + 10 + "px";
      };
      const leaveHandler = () => {
        tooltip.remove();
        link.removeEventListener("mousemove", moveHandler);
        link.removeEventListener("mouseleave", leaveHandler);
      };
      link.addEventListener("mousemove", moveHandler);
      link.addEventListener("mouseleave", leaveHandler);
    });
  });
}

// Load note into a pane
async function loadNote(filename, clickedPaneIndex = null) {
  if (!titlesMap[filename]) {
    showTemplate(filename, clickedPaneIndex);
    return;
  }

  const note = notesContent[filename];
  const { textRaw, frontmatter } = note;

  if (frontmatter.show === false) {
    showTemplate(filename, clickedPaneIndex);
    return;
  }

  const existing = openPanes.find(p => p.dataset.file === filename);
  if (existing) {
    highlightPane(existing);
    existing.scrollIntoView({ behavior: "smooth", inline: "center" , block: "nearest"});
    return;
  }

  const position = clickedPaneIndex !== null ? clickedPaneIndex + 1 : openPanes.length;
  while (openPanes.length > position) {
    const removed = openPanes.pop();
    removed.remove();
  }

  const pane = document.createElement("div");
  pane.className = "pane";
  pane.dataset.file = filename;
  pane.style.opacity = 0;

  const fragment = document.createDocumentFragment();

  const contentDiv = document.createElement("div");
  contentDiv.className = "pane-content";
  contentDiv.innerHTML = marked.parse(convertWikilinks(textRaw));
  fragment.appendChild(contentDiv);

  const bl = createBacklinks(filename, pane);
  if (bl) fragment.appendChild(bl);

  pane.appendChild(fragment);
  container.appendChild(pane);
  openPanes.push(pane);

  processLinks(pane);
  attachHoverPreviews(contentDiv);

  requestAnimationFrame(() => {
    pane.style.transition = "opacity 0.15s ease-in";
    pane.style.opacity = 1;
  });

  pane.scrollIntoView({ behavior: "smooth", inline: "end" , block: "nearest"});
}

// Boot
(async function init() {
  const indexData = await fetch("notes_index.json").then(r => r.json());
  await buildBacklinksIndex(indexData);
  loadNote("index.md", 0);
})();
