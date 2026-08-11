/* ============================================================
   CONFIG — edit these
   ============================================================ */
const GITHUB_USERNAME = "zoha-hasan"; // <-- change this

// Override auto-formatted names for specific repos.
const CUSTOM_REPO_NAMES = {
  "lulc_plugin_qgis": "QGIS LULC Plugin",
};

// Acronyms that should stay fully uppercase when auto-formatting names.
const ACRONYMS = [
  "gis","qgis","lulc","gee","cmip6","cmip","ssp","gcm","api","postgis",
  "css","html","js","json","cnn","ndvi","dem","crs","sql","geojson","ui","ux"
];

// Repos to hide from the Field Notes grid
const HIDE_REPOS = [GITHUB_USERNAME + "." + "github.io"];

// Software/platforms GitHub can't detect on its own
const TOOLKIT = [
  "QGIS", "ArcMap", "Google Earth Engine", "PostGIS", "Visual Studio Code",
  "ERDAS Imagine", "Jupyter Notebook", "MATLAB", "AutoCAD"
];

// Analytical methods and workflows
const METHODS = [
  "LULC Classification", "Watershed Delineation", "Run-off Modelling",
  "Climate Projection & Bias Correction", "Remote Sensing Analysis", "Web Mapping",
  "QGIS Plugin Development", "Statistical Analysis", "Data Structures & Algorithms",
  "Photogrammetry", "Image Processing", "C++", "Numerical Analysis"
];

/* ============================================================
   HELPERS
   ============================================================ */
function formatRepoName(raw){
  if (CUSTOM_REPO_NAMES[raw]) return CUSTOM_REPO_NAMES[raw];
  return raw
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map(word => {
      const lower = word.toLowerCase();
      if (ACRONYMS.includes(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatFullDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function fetchReadmeExcerpt(repoName){
  try{
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/readme`,
      { headers: { Accept: "application/vnd.github.raw" } }
    );
    if (!res.ok) return null;
    const raw = await res.text();
    return extractExcerpt(raw);
  }catch(err){
    return null;
  }
}

function extractExcerpt(markdown){
  const lines = markdown.split(/\r?\n/);
  for (let line of lines){
    if (/^\s*```/.test(line)) continue;
    const clean = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/^#+\s*/, "")
      .replace(/[*_`>]/g, "")
      .trim();
    if (clean.length > 25 && !/^!\[/.test(line)){
      return clean.length > 140 ? clean.slice(0, 137).trim() + "…" : clean;
    }
  }
  return null;
}

async function fetchCommitCount(repoName){
  try{
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/commits?per_page=1`
    );
    if (!res.ok) return 0;
    const link = res.headers.get("Link");
    if (link){
      const match = link.match(/&page=(\d+)>;\s*rel="last"/);
      if (match) return parseInt(match[1], 10);
    }
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  }catch(err){
    return 0;
  }
}

async function loadTotalCommits(repos){
  try{
    const counts = await Promise.all(repos.map(r => fetchCommitCount(r.name)));
    const total = counts.reduce((a, b) => a + b, 0);
    document.getElementById("stat-commits").textContent = total.toLocaleString();
  }catch(err){
    console.warn("Could not load commit totals:", err);
  }
}

async function loadContributionsThisYear(){
  try{
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`);
    if (!res.ok) throw new Error("contributions fetch failed");
    const data = await res.json();
    const totals = Object.values(data.total || {});
    const thisYear = totals.length ? totals[totals.length - 1] : null;
    document.getElementById("stat-contrib").textContent = thisYear !== null ? thisYear.toLocaleString() : "—";
  }catch(err){
    console.warn("Could not load contributions:", err);
    document.getElementById("stat-contrib").textContent = "—";
  }
}

/* ============================================================
   GITHUB DATA
   ============================================================ */
async function loadProfile(){
  try{
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`);
    if (!res.ok) throw new Error("profile fetch failed");
    const user = await res.json();

    document.getElementById("avatar").src = user.avatar_url;
    document.getElementById("display-name").textContent = user.name || user.login;
    document.getElementById("stat-repos").textContent = user.public_repos ?? "—";
    document.getElementById("stat-joined").textContent = formatDate(user.created_at);
  }catch(err){
    console.warn("Could not load GitHub profile:", err);
  }
}

async function loadRepos(){
  const grid = document.getElementById("repo-grid");
  const loadingEl = document.getElementById("repo-loading");
  try{
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
    if (!res.ok) throw new Error("repo fetch failed");
    let repos = await res.json();

    repos = repos
      .filter(r => !r.fork)
      .filter(r => !HIDE_REPOS.includes(r.name));

    if (loadingEl) loadingEl.remove();

    if (repos.length === 0){
      grid.innerHTML = `<p class="loading-msg">No field notes logged yet.</p>`;
      return;
    }

    const mostRecent = repos.reduce((a, b) => new Date(a.pushed_at) > new Date(b.pushed_at) ? a : b);
    document.getElementById("last-updated").textContent = formatFullDate(mostRecent.pushed_at);

    const excerpts = await Promise.all(
      repos.map(repo => fetchReadmeExcerpt(repo.name))
    );

    grid.innerHTML = repos.map((repo, i) => {
      const title = formatRepoName(repo.name);
      const desc = excerpts[i]
        || repo.description
        || "A field note in progress.. details coming soon.";
      const tags = [repo.language, ...(repo.topics || [])]
        .filter(Boolean)
        .slice(0, 4);

      return `
        <a class="postcard" href="${repo.html_url}" target="_blank" rel="noopener">
          <h3 class="postcard-title">${title}</h3>
          <p class="postcard-desc">${desc}</p>
          <div class="postcard-tags">
            ${tags.map(t => `<span class="tag-chip">${t}</span>`).join("")}
          </div>
        </a>
      `;
    }).join("");

    loadLanguages(repos);
    loadTotalCommits(repos);
  }catch(err){
    console.warn("Could not load repos:", err);
    if (loadingEl) loadingEl.textContent = "Field notes couldn't be reached right now.";
  }
}

async function loadLanguages(repos){
  const container = document.getElementById("lang-bars");
  const loadingEl = document.getElementById("lang-loading");
  try{
    const subset = repos.slice(0, 12);
    const results = await Promise.all(
      subset.map(r => fetch(r.languages_url).then(res => res.ok ? res.json() : {}).catch(() => ({})))
    );

    const totals = {};
    results.forEach(langObj => {
      Object.entries(langObj).forEach(([lang, bytes]) => {
        totals[lang] = (totals[lang] || 0) + bytes;
      });
    });

    const totalBytes = Object.values(totals).reduce((a, b) => a + b, 0);
    if (loadingEl) loadingEl.remove();

    if (totalBytes === 0){
      container.innerHTML = `<p class="loading-msg">Not enough charted terrain yet.</p>`;
      return;
    }

    const sorted = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    container.innerHTML = sorted.map(([lang, bytes]) => {
      const pct = ((bytes / totalBytes) * 100).toFixed(1);
      return `
        <div class="legend-row">
          <span class="legend-name">${lang}</span>
          <div class="legend-track"><div class="legend-fill" style="width:${pct}%"></div></div>
          <span class="legend-pct">${pct}%</span>
        </div>
      `;
    }).join("");

    requestAnimationFrame(() => {
      document.querySelectorAll(".legend-fill").forEach(el => {
        const w = el.style.width;
        el.style.width = "0%";
        requestAnimationFrame(() => { el.style.width = w; });
      });
    });
  }catch(err){
    console.warn("Could not load languages:", err);
    if (loadingEl) loadingEl.textContent = "Legend couldn't be charted right now.";
  }
}

/* ============================================================
   STATIC CONTENT — instruments
   ============================================================ */
function renderChipList(containerId, items){
  const list = document.getElementById(containerId);
  list.innerHTML = items.map(item => `
    <span class="instrument-chip"><span class="dot"></span>${item}</span>
  `).join("");
}

/* ============================================================
   UI BEHAVIOR — nav, scroll progress, scroll-spy, compass touch, route pin, vine growth
   ============================================================ */
function initNav(){
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const sections = document.querySelectorAll(".section");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const id = "#" + entry.target.id;
        buttons.forEach(b => b.classList.toggle("active", b.dataset.target === id));
      }
    });
  }, { threshold: 0.5 });
  sections.forEach(s => spy.observe(s));
}

function initScrollProgress(){
  const bar = document.getElementById("scroll-progress");
  const pin = document.getElementById("route-pin");
  const routeLine = document.querySelector(".route-line");
  const vinePath = document.getElementById("vine-path");
  const vineLength = vinePath ? vinePath.getTotalLength() : 0;
  if (vinePath){
    vinePath.style.strokeDasharray = vineLength;
    vinePath.style.strokeDashoffset = vineLength;
  }

  function update(){
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + "%";

    if (vinePath && vineLength){
      vinePath.style.strokeDashoffset = vineLength - (vineLength * (pct / 100));
    }

    if (pin && routeLine){
      const lineTop = routeLine.offsetTop;
      const lineBottom = lineTop + routeLine.offsetHeight;
      const viewportCenter = scrollTop + window.innerHeight / 2;
      const clamped = Math.min(Math.max(viewportCenter, lineTop), lineBottom);
      pin.style.top = clamped + "px";
      pin.classList.toggle("visible", viewportCenter > lineTop + 20 && viewportCenter < lineBottom - 20);
    }
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

function initCompassTouch(){
  const wrap = document.getElementById("compass-wrap");
  wrap.addEventListener("click", () => {
    const isActive = wrap.classList.toggle("active");
    wrap.setAttribute("aria-expanded", isActive ? "true" : "false");
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      wrap.click();
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  renderChipList("toolkit-list", TOOLKIT);
  renderChipList("methods-list", METHODS);
  initNav();
  initScrollProgress();
  initCompassTouch();
  loadProfile();
  loadRepos();
  loadContributionsThisYear();
});