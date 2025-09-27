const fs = require("fs");
const path = require("path");
const jsyaml = require("js-yaml");

const NOTES_DIR = path.join(__dirname, "notes");
const OUTPUT_FILE = path.join(__dirname, "notes_index.json");

const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith(".md"));

const notes = [];

for (const file of files) {
  const fullPath = path.join(NOTES_DIR, file);
  let content = fs.readFileSync(fullPath, "utf-8");

  let frontmatter = {};
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) {
      const yamlText = content.slice(3, end).trim();
      frontmatter = jsyaml.load(yamlText) || {};
      content = content.slice(end + 3).trim();
    }
  }

  notes.push({
    file,
    title: frontmatter.title || file.replace(".md", ""),
    content,
    frontmatter
  });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(notes, null, 2), "utf-8");
console.log("notes_index.json generated!");
