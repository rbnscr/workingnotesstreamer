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
        try { 
          frontmatter = jsyaml.load(yamlText) || {}; 
        } catch(e) { 
          console.warn(e); 
        }
        textRaw = textRaw.slice(end + 3).trim();
      }
    }

    notesContent[file] = { textRaw, frontmatter };

    const text = convertWikilinks(textRaw);
    const links = Array.from(text.matchAll(/\[.*?\]\((.*?)\)/g)).map(m => m[1]);
    const uniqueLinks = [...new Set(links)];
    uniqueLinks.forEach(link => {
      if (!index[link]) index[link] = [];
      index[link].push(file);
    });
  }
  backlinksMap = index;
}

function highlightPane(pane) {
  pane.style.backgroundColor = "#89c4fc67";
  setTimeout(() => (pane.style.backgroundColor = "white"), 300);
}

function truncatePreview(text, maxLength = 500) {
  if (text.length <= maxLength) return text;
  let truncated = text.slice(0, maxLength).replace(/\s+\S*$/, "");
  return truncated + "…";
}

function processLinks(pane) {
  pane.querySelectorAll("a").forEach(link => {
    const file = link.dataset.file || (link.getAttribute("href")?.trim() || link.textContent.trim().replace(/\s+/g, "_") + ".md");
    link.dataset.file = file;
    link.href = "#";

    if (!titlesMap[file]) link.classList.add("dead-link");

    link.addEventListener("click", e => {
      e.preventDefault();
      if (titlesMap[file]) {
        const paneIndex = openPanes.indexOf(pane.closest(".pane"));
        loadNote(file, paneIndex);
      }
    });
  });
}

// Create backlinks with styled boxes and markdown previews
function createBacklinks(filename) {
  if (!backlinksMap[filename]) return null;

  const bl = document.createElement("div");
  bl.className = "backlinks";
  bl.innerHTML = "<strong>Links to this note:</strong>";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "1fr 1fr";
  grid.style.gap = "1rem";

  backlinksMap[filename].forEach(src => {
    const note = notesContent[src];
    if (!note) return;

    // Create the <a> that wraps the whole box
    const a = document.createElement("a");
    a.dataset.file = src;
    a.href = "#";
    a.style.textDecoration = "none"; // remove underline for the whole box
    a.style.color = "inherit"; // inherit grey
    a.style.display = "block"

    const item = document.createElement("div");
    item.className = "backlink-item";
    item.style.background = "#f0f0f0";
    item.style.borderRadius = "8px";
    item.style.padding = "0.5rem";

    const title = document.createElement("div");
    title.textContent = titlesMap[src] || src;
    title.style.fontWeight = "bold";
    title.style.marginBottom = "0.25rem";


    // Preview text (markdown formatted)
    let previewText = note.frontmatter?.preview
      ? note.frontmatter.preview
      : note.textRaw.replace(/#.*\n/g, "").trim();
    previewText = truncatePreview(previewText, 250);
    previewText = convertWikilinks(previewText);

    const preview = document.createElement("div");
  preview.className = "backlink-preview";
  preview.innerHTML = marked.parse(previewText);

//   item.appendChild(title);
  item.appendChild(preview);
  a.appendChild(item);
  grid.appendChild(a);
  });

  bl.appendChild(grid);

  processLinks(bl);
  attachHoverPreviews(bl);
  return bl;
}



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
      previewText = convertWikilinks(previewText);
      tooltip.innerHTML = marked.parse(previewText);

      document.body.appendChild(tooltip);
      tooltip.style.display = "block";

      // Position relative to the link
      const rect = link.getBoundingClientRect();
      let left = rect.right + 8; // show to the right of the link
      let top = rect.top;

      // Calculate tooltip size
      const tooltipRect = tooltip.getBoundingClientRect();

      // Prevent overflow on the right
      if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 8; // show on the left instead
      }

      // Prevent overflow on the bottom
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - 8;
      }

      // Prevent top going offscreen
      if (top < 0) top = 8;

      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";

      const leaveHandler = () => {
        tooltip.remove();
        link.removeEventListener("mouseleave", leaveHandler);
      };
      link.addEventListener("mouseleave", leaveHandler);
    });
  });
}

async function loadNote(filename, clickedPaneIndex = null) {
  if (!titlesMap[filename]) {
    showTemplate(filename, clickedPaneIndex);
    return;
  }

  // ✅ fetch note if not yet loaded
  if (!notesContent[filename]) {
    try {
      const response = await fetch(NOTES_DIR + filename);
      if (!response.ok) throw new Error(`Failed to load ${filename}`);
      let textRaw = await response.text();
      let frontmatter = {};

      if (textRaw.startsWith("---")) {
        const end = textRaw.indexOf("---", 3);
        if (end !== -1) {
          const yamlText = textRaw.slice(3, end).trim();
          try { frontmatter = jsyaml.load(yamlText) || {}; } catch(e) { console.warn(e); }
          textRaw = textRaw.slice(end + 3).trim();
        }
      }
      notesContent[filename] = { textRaw, frontmatter };
    } catch (err) {
      console.error(err);
      showTemplate(filename, clickedPaneIndex);
      return;
    }
  }

  const { textRaw, frontmatter } = notesContent[filename];

  if (frontmatter.show === false) {
    showTemplate(filename, clickedPaneIndex);
    return;
  }

  const existing = openPanes.find(p => p.dataset.file === filename);
  if (existing) {
    highlightPane(existing);
    existing.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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

  if (frontmatter.last_updated) {
    const lastDiv = document.createElement("div");
    lastDiv.className = "last-updated";
    lastDiv.textContent = "Last updated: " + frontmatter.last_updated;
    lastDiv.style.marginTop = "0.5rem";
    lastDiv.style.fontSize = "0.85rem";
    lastDiv.style.color = "#666";
    fragment.appendChild(lastDiv);
  }
  
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

  pane.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
}


// Boot
(async function init() {
  const indexData = await fetch("notes_index.json").then(r => r.json());
  await buildBacklinksIndex(indexData);
  loadNote("index.md", 0);
})();
