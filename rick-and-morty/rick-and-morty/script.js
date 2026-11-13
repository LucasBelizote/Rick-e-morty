const API_URL = "https://rickandmortyapi.com/api";

const state = {
  page: 1,
  name: "",
  status: "",
  totalPages: 1,
};

const el = {
  cards: document.getElementById("cards"),
  message: document.getElementById("message"),
  search: document.getElementById("search"),
  status: document.getElementById("status"),
  filters: document.getElementById("filters"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageInfo: document.getElementById("page-info"),
  statCharacters: document.getElementById("stat-characters"),
  statLocations: document.getElementById("stat-locations"),
  statEpisodes: document.getElementById("stat-episodes"),
};

const STATUS_PT = { Alive: "Vivo", Dead: "Morto", unknown: "Desconhecido" };
const SPECIES_PT = { Human: "Humano", Alien: "Alienígena", Robot: "Robô", Animal: "Animal", Humanoid: "Humanoide", Disease: "Doença", Cronenberg: "Cronenberg", Poopybutthole: "Poopybutthole", Mythological: "Mitológico", unknown: "Desconhecida" };
const GENDER_PT = { Male: "Masculino", Female: "Feminino", Genderless: "Sem gênero", unknown: "Desconhecido" };

const traduzir = (mapa, valor) => mapa[valor] || valor;

/* ---------- Requisições ---------- */

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Erro ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function loadStats() {
  try {
    const [characters, locations, episodes] = await Promise.all([
      fetchJSON(`${API_URL}/character`),
      fetchJSON(`${API_URL}/location`),
      fetchJSON(`${API_URL}/episode`),
    ]);
    el.statCharacters.textContent = characters.info.count;
    el.statLocations.textContent = locations.info.count;
    el.statEpisodes.textContent = episodes.info.count;
  } catch {
    el.statCharacters.textContent = el.statLocations.textContent = el.statEpisodes.textContent = "—";
  }
}

// Busca o nome do primeiro episódio de cada personagem em uma única chamada
async function loadFirstEpisodes(characters) {
  const ids = [...new Set(characters.map((c) => c.episode[0]?.split("/").pop()).filter(Boolean))];
  if (!ids.length) return {};

  const data = await fetchJSON(`${API_URL}/episode/${ids.join(",")}`);
  const list = Array.isArray(data) ? data : [data];
  return Object.fromEntries(list.map((ep) => [String(ep.id), `${ep.episode} - ${ep.name}`]));
}

async function loadCharacters() {
  showSkeletons();
  setMessage("");

  const params = new URLSearchParams({ page: state.page });
  if (state.name) params.set("name", state.name);
  if (state.status) params.set("status", state.status);

  try {
    const data = await fetchJSON(`${API_URL}/character?${params}`);
    state.totalPages = data.info.pages;

    let episodes = {};
    try {
      episodes = await loadFirstEpisodes(data.results);
    } catch {
      /* se falhar, os cards seguem sem o episódio */
    }

    renderCards(data.results, episodes);
    setMessage(`${data.info.count} personagem(ns) encontrado(s).`);
  } catch (error) {
    el.cards.innerHTML = "";
    state.totalPages = 1;
    if (error.status === 404) {
      setMessage("Nenhum personagem encontrado com esses filtros.");
    } else {
      setMessage("Não foi possível carregar os dados. Verifique sua conexão e tente novamente.", true);
    }
  }

  updatePagination();
}

/* ---------- Renderização ---------- */

function createInfo(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "card__info";

  const labelEl = document.createElement("span");
  labelEl.className = "card__label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "card__value";
  valueEl.textContent = value;

  wrapper.append(labelEl, valueEl);
  return wrapper;
}

// Imagem substituta (SVG embutido) usada se a foto não carregar de jeito nenhum
function placeholderImage(name) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">` +
    `<rect width="300" height="300" fill="#1d2646"/>` +
    `<circle cx="150" cy="150" r="90" fill="#151c33" stroke="#97ce4c" stroke-width="6"/>` +
    `<text x="150" y="185" font-family="Arial, sans-serif" font-size="100" font-weight="bold" fill="#97ce4c" text-anchor="middle">${initial}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Carrega a foto com até 2 novas tentativas antes de usar a imagem substituta
function setupImage(img, character) {
  const MAX_RETRIES = 2;
  let attempts = 0;

  img.addEventListener("error", () => {
    if (attempts < MAX_RETRIES) {
      attempts++;
      setTimeout(() => {
        const separator = character.image.includes("?") ? "&" : "?";
        img.src = `${character.image}${separator}tentativa=${attempts}`;
      }, 800 * attempts);
    } else {
      img.src = placeholderImage(character.name);
    }
  });

  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.alt = `Foto de ${character.name}`;
  img.src = character.image;
}

function createCard(character, episodes) {
  const card = document.createElement("article");
  card.className = "card";

  const imageBox = document.createElement("div");
  imageBox.className = "card__image";
  const img = document.createElement("img");
  setupImage(img, character);
  imageBox.appendChild(img);

  const body = document.createElement("div");
  body.className = "card__body";

  const name = document.createElement("h3");
  name.className = "card__name";
  name.textContent = character.name;

  const status = document.createElement("span");
  status.className = "card__status";
  const dot = document.createElement("span");
  const statusClass = character.status === "Alive" ? "alive" : character.status === "Dead" ? "dead" : "";
  dot.className = `card__dot ${statusClass}`;
  status.append(
    dot,
    document.createTextNode(`${traduzir(STATUS_PT, character.status)} - ${traduzir(SPECIES_PT, character.species)}`)
  );

  const firstEpisodeId = character.episode[0]?.split("/").pop();

  body.append(
    name,
    status,
    createInfo("Gênero", traduzir(GENDER_PT, character.gender)),
    createInfo("Origem", character.origin.name),
    createInfo("Última localização conhecida", character.location.name),
    createInfo("Primeira aparição", episodes[firstEpisodeId] || "Não disponível")
  );

  card.append(imageBox, body);
  return card;
}

function renderCards(characters, episodes) {
  const fragment = document.createDocumentFragment();
  characters.forEach((character) => fragment.appendChild(createCard(character, episodes)));
  el.cards.replaceChildren(fragment);
}

function showSkeletons() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 8; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton";
    fragment.appendChild(sk);
  }
  el.cards.replaceChildren(fragment);
}

function setMessage(text, isError = false) {
  el.message.textContent = text;
  el.message.classList.toggle("error", isError);
}

function updatePagination() {
  el.pageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= state.totalPages;
}

/* ---------- Eventos ---------- */

let debounceTimer;
el.search.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.name = el.search.value.trim();
    state.page = 1;
    loadCharacters();
  }, 400);
});

el.status.addEventListener("change", () => {
  state.status = el.status.value;
  state.page = 1;
  loadCharacters();
});

el.filters.addEventListener("submit", (event) => event.preventDefault());

function goToPage(page) {
  state.page = page;
  loadCharacters();
  document.getElementById("personagens").scrollIntoView({ behavior: "smooth" });
}

el.prev.addEventListener("click", () => goToPage(state.page - 1));
el.next.addEventListener("click", () => goToPage(state.page + 1));

/* ---------- Início ---------- */

loadStats();
loadCharacters();
