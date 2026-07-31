/* ============================================================
   CONFIG — edit these
   ============================================================ */
const GITHUB_USERNAME = "zoha-hasan"; // <-- change this

// Manual, since GitHub's public API has no "contribution hours" metric.
const CONTRIBUTION_HOURS = "—"; // e.g. "420+"

// Override auto-formatted names for specific repos.
// key = exact repo name on GitHub, value = display name.
const CUSTOM_REPO_NAMES = {
  "lulc_plugin_qgis": "QGIS LULC Plugin",
  // "your-repo-name": "Your Display Name",
};

// Acronyms that should stay fully uppercase when auto-formatting names.
const ACRONYMS = [
  "gis","qgis","lulc","gee","cmip6","cmip","ssp","gcm","api","postgis",
  "css","html","js","json","cnn","ndvi","dem","crs","sql","geojson","ui","ux"
];

// Repos to hide from the Field Notes grid (config repos, forks you don't want shown, etc.)
const HIDE_REPOS = [GITHUB_USERNAME + "." + "github.io"];

// Toolkit / Instruments chips
const INSTRUMENTS = [
  "Python", "QGIS", "Google Earth Engine", "PostGIS", "R",
  "Remote Sensing", "LULC Classification", "Watershed Delineation",
  "CMIP6 / Climate Modeling", "Web Mapping", "SQL", "Git"
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
    document.getElementById("stat-followers").textContent = user.followers ?? "—";
    document.getElementById("stat-hours").textContent = CONTRIBUTION_HOURS;
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

    // Most recently pushed repo drives the footer "Field Log" date
    const mostRecent = repos.reduce((a, b) => new Date(a.pushed_at) > new Date(b.pushed_at) ? a : b);
    document.getElementById("last-updated").textContent = formatFullDate(mostRecent.pushed_at);

    grid.innerHTML = repos.map(repo => {
      const title = formatRepoName(repo.name);
      const desc = repo.description
        ? repo.description
        : "A field note in progress — details coming soon.";
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
  }catch(err){
    console.warn("Could not load repos:", err);
    if (loadingEl) loadingEl.textContent = "Field notes couldn't be reached right now.";
  }
}

async function loadLanguages(repos){
  const container = document.getElementById("lang-bars");
  const loadingEl = document.getElementById("lang-loading");
  try{
    const subset = repos.slice(0, 12); // keep API calls reasonable
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

    // trigger width transition after paint
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
function renderInstruments(){
  const list = document.getElementById("instrument-list");
  list.innerHTML = INSTRUMENTS.map(item => `
    <span class="instrument-chip"><span class="dot"></span>${item}</span>
  `).join("");
}

/* ============================================================
   UI BEHAVIOR — nav, scroll progress, scroll-spy, compass touch
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
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + "%";
  }, { passive: true });
}

function initCompassTouch(){
  // Hover works on desktop via CSS; this adds tap support for touch devices.
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
  renderInstruments();
  initNav();
  initScrollProgress();
  initCompassTouch();
  loadProfile();
  loadRepos();
});
