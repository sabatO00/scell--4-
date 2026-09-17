/* ==========================================================================
   S CELL — App principal (SPA leve com roteamento por hash)
   ========================================================================== */

const app = document.getElementById("app");
let currentFilters = { modelos: [], armazenamentos: [], condicoes: [], bateria: null, precoMax: 6000, busca: "" };
let currentSort = "recentes";

/* ==========================================================================
   SUPABASE — banco de dados na nuvem
   Tudo que o admin adiciona/edita/remove é salvo aqui e aparece na hora
   para qualquer pessoa que visitar o site, sem precisar mexer em arquivos.
   As chaves abaixo são seguras de ficarem públicas no código: a proteção
   de verdade é feita pelas regras (RLS) configuradas no Supabase, que só
   permitem ESCRITA para quem estiver logado como admin.
   ========================================================================== */
const SUPABASE_URL = "https://qkmtthqnhznsvdusfybl.supabase.co";
const SUPABASE_KEY = "sb_publishable_YucgZNMcw4-odOYXY2WE7g_LxlShroa";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Cache em memória: carregado uma vez ao abrir o site (e sempre que o admin
   salva algo), para o resto do app poder ler os dados sem precisar de
   async/await em toda parte. */
let _cache = { products: null, services: null, config: null };
let _isAdmin = false;

async function fetchKV(key, fallback) {
  try {
    const { data, error } = await supa.from("kv_store").select("value").eq("key", key).single();
    if (error || !data) return JSON.parse(JSON.stringify(fallback));
    return data.value;
  } catch (e) { return JSON.parse(JSON.stringify(fallback)); }
}
async function saveKV(key, value) {
  try {
    const { error } = await supa.from("kv_store").upsert({ key, value, updated_at: new Date().toISOString() });
    return !error;
  } catch (e) { return false; }
}
async function loadAllData() {
  const [products, services, config] = await Promise.all([
    fetchKV("products", IPHONES),
    fetchKV("services", SERVICOS),
    fetchKV("config", SCELL_CONFIG),
  ]);
  _cache = { products, services, config };
}

const getProducts = () => _cache.products || IPHONES;
const getServices = () => _cache.services || SERVICOS;
const getConfig = () => ({ ...SCELL_CONFIG, ..._cache.config });

const Store = {
  async saveProducts(list) {
    const ok = await saveKV("products", list);
    if (ok) _cache.products = list;
    return ok;
  },
  async saveServices(list) {
    const ok = await saveKV("services", list);
    if (ok) _cache.services = list;
    return ok;
  },
  async saveConfig(cfg) {
    const ok = await saveKV("config", cfg);
    if (ok) _cache.config = cfg;
    return ok;
  },
  async resetAll() {
    await Promise.all([
      saveKV("products", IPHONES),
      saveKV("services", SERVICOS),
      saveKV("config", SCELL_CONFIG),
    ]);
    await loadAllData();
  },
  exportJSON() {
    return JSON.stringify({ products: getProducts(), services: getServices(), config: getConfig() }, null, 2);
  },
  async importJSON(text) {
    const data = JSON.parse(text);
    if (data.products) await this.saveProducts(data.products);
    if (data.services) await this.saveServices(data.services);
    if (data.config) await this.saveConfig(data.config);
  },
};

/* ---------------- Utils ---------------- */
/* Imagem de reserva — evita que uma foto quebrada estrague o layout do card */
const IMG_FALLBACK = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231E1E22'/%3E%3Cg fill='none' stroke='%236B6B72' stroke-width='10'%3E%3Crect x='140' y='90' width='120' height='220' rx='18'/%3E%3Cline x1='170' y1='120' x2='230' y2='120'/%3E%3Ccircle cx='200' cy='280' r='8' fill='%236B6B72'/%3E%3C/g%3E%3C/svg%3E";
const imgOnError = `this.onerror=null;this.src='${IMG_FALLBACK}';`;

const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parcelaValor = (preco, n) => money(preco / n);
const byId = (id) => getProducts().find((p) => p.id === id);
const svc = (id) => getServices().find((s) => s.id === id);
const slugify = (s) => s.toString().toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* Comprime uma foto enviada pelo admin (redimensiona + converte para JPEG)
   antes de guardar, para caber no armazenamento do navegador. */
function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

function statusBadges(p) {
  let b = "";
  if (p.precoPromo) b += `<span class="badge badge-oferta">OFERTA</span>`;
  if (p.status === "ultimas") b += `<span class="badge badge-ultima">ÚLTIMA UNIDADE</span>`;
  if (p.destaque && p.status !== "ultimas") b += `<span class="badge badge-destaque">DESTAQUE</span>`;
  if (p.status === "esgotado") b += `<span class="badge badge-esgotado">ESGOTADO</span>`;
  return b;
}

function batteryPill(bateria) {
  if (!bateria) return "";
  const color = bateria >= 90 ? "var(--success)" : bateria >= 80 ? "var(--warn)" : "var(--danger)";
  return `<span class="battery-pill"><span class="bar"><span style="width:${bateria}%;background:${color}"></span></span>${bateria}%</span>`;
}

/* ---------------- Mensagens WhatsApp (uma diferente para cada finalidade e cada serviço) ---------------- */
const waMsg = {
  produto: (p) => `Olá, ${getConfig().companyName}! Tenho interesse no ${p.nome} ${p.armazenamento}, pelo valor de ${money(p.precoPromo || p.preco)}. Gostaria de saber mais informações.`,
  compraDireta: (p) => `Olá, ${getConfig().companyName}! Quero comprar o ${p.nome} ${p.armazenamento} por ${money(p.precoPromo || p.preco)}. Como faço para finalizar?`,
  carrinho: (itens, total) => {
    const linhas = itens.map((i) => `${i.nome} ${i.armazenamento} — ${money((i.precoPromo || i.preco))} x${i.qtd}`).join("\n");
    return `Olá, ${getConfig().companyName}! Gostaria de fazer um pedido:\n\n${linhas}\n\nTotal: ${money(total)}\n\nGostaria de saber como podemos prosseguir.`;
  },
  // Mensagem específica por serviço de assistência — cada serviço gera um texto diferente,
  // usando o nome e o preço daquele serviço. Se o admin preencher "mensagem" personalizada
  // no cadastro do serviço, essa é usada no lugar do texto padrão.
  servico: (s) => {
    if (s.mensagem && s.mensagem.trim()) return s.mensagem.trim();
    const valor = s.preco ? `Vi que o valor é a partir de ${money(s.preco)}.` : `Vi que esse serviço é sob orçamento.`;
    return `Olá, ${getConfig().companyName}! Gostaria de solicitar o serviço de ${s.nome} para o meu iPhone. ${valor} Podem me passar mais detalhes e prazo?`;
  },
  assistenciaGeral: () => `Olá, ${getConfig().companyName}! Gostaria de saber mais sobre a assistência técnica de iPhones.`,
  orcamento: (modelo, servico, valor) => `Olá, ${getConfig().companyName}! Gostaria de solicitar um orçamento.\n\nAparelho: ${modelo}\nServiço: ${servico}\nEstimativa: ${valor}\n\nGostaria de confirmar o valor exato após avaliação.`,
  solicitacao: (d) => `Olá, ${getConfig().companyName}!\n\nGostaria de solicitar uma assistência técnica.\n\nNome: ${d.nome}\nAparelho: ${d.modelo}\nProblema: ${d.problema}\nServiço: ${d.servico}\n\nGostaria de saber o valor e disponibilidade.`,
  contato: () => `Olá, ${getConfig().companyName}! Gostaria de tirar uma dúvida.`,
};

/* ---------------- Carrinho ---------------- */
const Cart = {
  key: "scell_cart",
  get() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } },
  save(items) { localStorage.setItem(this.key, JSON.stringify(items)); updateCartUI(); },
  add(id) {
    const p = byId(id);
    if (!p || p.status === "esgotado") return;
    const items = this.get();
    const found = items.find((i) => i.id === id);
    if (found) { found.qtd += 1; } else { items.push({ id, qtd: 1 }); }
    this.save(items);
    toast(`${p.nome} adicionado ao carrinho`);
  },
  remove(id) { this.save(this.get().filter((i) => i.id !== id)); },
  setQty(id, qtd) {
    const items = this.get();
    const it = items.find((i) => i.id === id);
    if (!it) return;
    it.qtd = Math.max(1, qtd);
    this.save(items);
  },
  clear() { this.save([]); },
  detailed() { return this.get().map((i) => { const p = byId(i.id); return p ? { ...p, qtd: i.qtd } : null; }).filter(Boolean); },
  total() { return this.detailed().reduce((s, i) => s + (i.precoPromo || i.preco) * i.qtd, 0); },
  count() { return this.get().reduce((s, i) => s + i.qtd, 0); },
};

function updateCartUI() {
  document.getElementById("cartCount").textContent = Cart.count();
  renderCartDrawer();
}

/* ---------------- Header scroll + menu mobile ---------------- */
window.addEventListener("scroll", () => {
  document.getElementById("siteHeader").classList.toggle("scrolled", window.scrollY > 30);
});
function toggleMobileMenu(open) { document.getElementById("mobileMenu").classList.toggle("open", open); }

/* ---------------- Carrinho drawer ---------------- */
function toggleCart(open) {
  document.getElementById("cartOverlay").classList.toggle("open", open);
  document.getElementById("cartDrawer").classList.toggle("open", open);
}
function renderCartDrawer() {
  const items = Cart.detailed();
  const wrap = document.getElementById("cartItems");
  const footer = document.getElementById("cartFooter");
  if (items.length === 0) {
    wrap.innerHTML = `<div class="cart-empty"><p>Seu carrinho está vazio.</p></div>`;
    footer.classList.add("hidden");
    return;
  }
  footer.classList.remove("hidden");
  wrap.innerHTML = items.map((i) => `
    <div class="cart-item">
      <img src="${i.imagens[0]}" alt="${i.nome}" onerror="${imgOnError}">
      <div class="info">
        <h4>${i.nome} ${i.armazenamento}</h4>
        <p>${i.cor} • ${i.condicao}</p>
        <p>${money(i.precoPromo || i.preco)}</p>
        <div class="qty-control">
          <button aria-label="Diminuir" onclick="Cart.setQty('${i.id}', ${i.qtd - 1})">−</button>
          <span>${i.qtd}</span>
          <button aria-label="Aumentar" onclick="Cart.setQty('${i.id}', ${i.qtd + 1})">+</button>
        </div>
        <a class="remove-item" onclick="Cart.remove('${i.id}')">Remover</a>
      </div>
    </div>
  `).join("");
  document.getElementById("cartTotal").textContent = money(Cart.total());
  document.getElementById("cartCheckoutBtn").setAttribute("href", waLink(waMsg.carrinho(items, Cart.total())));
}

/* ==========================================================================
   ROTEADOR
   ========================================================================== */
function router() {
  const hash = location.hash || "#/";
  const [, path, param] = hash.split("/");
  toggleMobileMenu(false);
  window.scrollTo(0, 0);
  setActiveNav(hash);

  if (!path) return renderHome();
  if (path === "iphones") return renderCatalog();
  if (path === "produto" && param) return renderProductDetail(param);
  if (path === "assistencia") return renderAssistencia();
  if (path === "sobre") return renderSobre();
  if (path === "contato") return renderContato();
  if (path === "privacidade") return renderPrivacidade();
  if (path === "termos") return renderTermos();
  if (path === "admin") return renderAdminGate();
  return renderHome();
}
window.addEventListener("hashchange", router);

function setActiveNav(hash) {
  document.querySelectorAll(".nav-desktop a, .mobile-menu a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === hash || (hash === "#/" && a.getAttribute("href") === "#/"));
  });
}

/* ---------------- HOME ---------------- */
function renderHome() {
  const produtos = getProducts();
  const ofertas = produtos.filter((p) => p.precoPromo);
  const vitrine = [...produtos].sort((a, b) => b.vendidos - a.vendidos).slice(0, 3);

  app.innerHTML = `
  <section class="hero">
    <div class="container">
      <div>
        <div class="hero-eyebrow"><span class="dot"></span> Assistência técnica especializada</div>
        <h1>Seu próximo <span class="metal-text">iPhone</span> está aqui.</h1>
        <p class="lead">iPhones selecionados, atendimento de confiança e assistência técnica especializada.</p>
        <div class="hero-ctas">
          <a href="#/iphones" class="btn btn-primary">Ver iPhones</a>
          <a href="#/assistencia" class="btn btn-outline">Assistência Técnica</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="ring r2"></div>
        <div class="ring r1"></div>
        <div class="phone-mock"><div class="screen"><img src="assets/logo.png" alt="S CELL"></div></div>
      </div>
    </div>
  </section>

  <section class="benefits">
    <div class="container grid">
      ${benefitItem("Aparelhos avaliados e selecionados pela S CELL.", "iPhones selecionados")}
      ${benefitItem("Atendimento transparente e seguro.", "Compra segura")}
      ${benefitItem("Seu aparelho cuidado por profissionais.", "Assistência especializada")}
      ${benefitItem("Fale diretamente com a S CELL pelo WhatsApp.", "Atendimento rápido")}
    </div>
  </section>

  ${ofertas.length ? `
  <section class="section">
    <div class="container">
      <div class="section-head">
        <div><h2>Ofertas da S CELL</h2><p>Condições especiais por tempo limitado, direto da nossa seleção.</p></div>
        <a href="#/iphones" class="btn btn-outline btn-sm">Ver todos</a>
      </div>
      <div class="product-grid">${ofertas.map(productCard).join("")}</div>
    </div>
  </section>` : ""}

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="section-head">
        <div><h2>Encontre seu próximo iPhone</h2><p>Modelos mais procurados, testados e prontos para uso.</p></div>
        <a href="#/iphones" class="btn btn-outline btn-sm">Catálogo completo</a>
      </div>
      <div class="product-grid">${vitrine.length ? vitrine.map(productCard).join("") : emptyProductsMsg()}</div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="calc-box" style="max-width:none; display:flex; align-items:center; justify-content:space-between; gap: 24px; flex-wrap:wrap;">
        <div>
          <h2 style="font-size:1.5rem; margin-bottom:8px;">Seu iPhone nas mãos de quem entende.</h2>
          <p style="color:var(--text-dim); max-width:480px;">Conte com a S CELL para diagnóstico, manutenção e reparos no seu aparelho.</p>
        </div>
        <a href="#/assistencia" class="btn btn-primary">Solicitar assistência</a>
      </div>
    </div>
  </section>
  `;
}
function benefitItem(desc, title) {
  return `<div class="benefit"><div class="icon">${iconCheck()}</div><h4>${title}</h4><p>${desc}</p></div>`;
}
function emptyProductsMsg() {
  return `<div class="empty-state" style="grid-column:1/-1"><h3>Nenhum iPhone cadastrado no momento.</h3><p>Volte em breve.</p></div>`;
}

function productCard(p) {
  const esgotado = p.status === "esgotado";
  return `
  <div class="product-card">
    <a href="#/produto/${p.id}" class="thumb">
      <div class="badges">${statusBadges(p)}</div>
      <img src="${p.imagens[0]}" alt="${p.nome} ${p.armazenamento}" loading="lazy" onerror="${imgOnError}">
    </a>
    <div class="body">
      <a href="#/produto/${p.id}"><h3>${p.nome}</h3></a>
      <div class="specs">${p.armazenamento} • ${p.cor}</div>
      <div class="meta-row">
        <span>${p.condicao}</span>
        ${p.bateria ? batteryPill(p.bateria) : ""}
      </div>
      <div class="price-row">
        ${p.precoPromo ? `<div class="price-old">${money(p.preco)}</div>` : ""}
        <div class="price-now">${money(p.precoPromo || p.preco)}</div>
        <div class="price-parcel">12x de ${parcelaValor(p.precoPromo || p.preco, p.parcelas || 12)}</div>
      </div>
      <div class="card-ctas">
        <a href="#/produto/${p.id}" class="btn btn-outline">Ver detalhes</a>
        <a class="btn btn-whatsapp" target="_blank" href="${waLink(waMsg.produto(p))}">WhatsApp</a>
      </div>
    </div>
  </div>`;
}

function iconCheck() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
}

/* ---------------- CATÁLOGO ---------------- */
function renderCatalog() {
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / iPhones</div>
      <h1>Catálogo de iPhones</h1>
      <p>Filtre por modelo, armazenamento, condição, bateria e preço para encontrar o aparelho ideal.</p>
      <div class="search-bar mt-lg" style="max-width:480px;">
        <input id="searchInput" type="text" placeholder="O que você está procurando?" value="${currentFilters.busca}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
      </div>
    </div>
  </section>
  <section class="section" style="padding-top:30px">
    <div class="container catalog-layout">
      <aside class="filters">
        <h3>Filtros</h3>
        <details class="filter-group" open>
          <summary>Modelo</summary>
          <div class="filter-options">${["iPhone 11","iPhone 12","iPhone 13","iPhone 14","iPhone 15","iPhone 16","iPhone 17","Outros"].map(m => checkboxRow("modelo", m)).join("")}</div>
        </details>
        <details class="filter-group">
          <summary>Armazenamento</summary>
          <div class="filter-options">${["64GB","128GB","256GB","512GB","1TB"].map(m => checkboxRow("armazenamento", m)).join("")}</div>
        </details>
        <details class="filter-group">
          <summary>Condição</summary>
          <div class="filter-options">${["Novo","Seminovo","Usado"].map(m => checkboxRow("condicao", m)).join("")}</div>
        </details>
        <details class="filter-group">
          <summary>Faixa de preço</summary>
          <div class="price-slider">
            <input type="range" id="priceRange" min="0" max="6000" step="100" value="${currentFilters.precoMax}">
            <div class="values"><span>R$ 0</span><span id="priceMaxLabel">${money(currentFilters.precoMax)}</span></div>
          </div>
        </details>
        <details class="filter-group">
          <summary>Saúde da bateria</summary>
          <div class="filter-options">
            ${[100,95,90,85].map(v => `<label><input type="radio" name="bateria" value="${v}" ${currentFilters.bateria == v ? "checked" : ""}> ${v === 100 ? "100%" : v + "%+"}</label>`).join("")}
            <label><input type="radio" name="bateria" value="" ${!currentFilters.bateria ? "checked" : ""}> Qualquer</label>
          </div>
        </details>
        <a class="clear-filters" onclick="clearFilters()">Limpar filtros</a>
      </aside>
      <div>
        <div class="catalog-toolbar">
          <span class="result-count" id="resultCount"></span>
          <select class="select-sort" id="sortSelect">
            <option value="recentes">Mais recentes</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
            <option value="mais-vendidos">Mais vendidos</option>
          </select>
        </div>
        <div class="product-grid" id="catalogGrid"></div>
      </div>
    </div>
  </section>
  `;

  document.getElementById("sortSelect").value = currentSort;
  document.getElementById("searchInput").addEventListener("input", (e) => { currentFilters.busca = e.target.value; renderCatalogGrid(); });
  document.getElementById("priceRange").addEventListener("input", (e) => {
    currentFilters.precoMax = Number(e.target.value);
    document.getElementById("priceMaxLabel").textContent = money(currentFilters.precoMax);
    renderCatalogGrid();
  });
  document.getElementById("sortSelect").addEventListener("change", (e) => { currentSort = e.target.value; renderCatalogGrid(); });
  document.querySelectorAll('input[name="bateria"]').forEach(r => r.addEventListener("change", (e) => { currentFilters.bateria = e.target.value ? Number(e.target.value) : null; renderCatalogGrid(); }));
  document.querySelectorAll('.filter-options input[type=checkbox]').forEach(cb => cb.addEventListener("change", onFilterCheckbox));

  renderCatalogGrid();
}

function checkboxRow(group, value) {
  const key = group === "modelo" ? "modelos" : group === "armazenamento" ? "armazenamentos" : "condicoes";
  const checked = currentFilters[key].includes(value) ? "checked" : "";
  return `<label><input type="checkbox" data-group="${group}" value="${value}" ${checked}> ${value}</label>`;
}
function onFilterCheckbox(e) {
  const group = e.target.dataset.group;
  const key = group === "modelo" ? "modelos" : group === "armazenamento" ? "armazenamentos" : "condicoes";
  const val = e.target.value;
  if (e.target.checked) currentFilters[key].push(val);
  else currentFilters[key] = currentFilters[key].filter((v) => v !== val);
  renderCatalogGrid();
}
function clearFilters() {
  currentFilters = { modelos: [], armazenamentos: [], condicoes: [], bateria: null, precoMax: 6000, busca: "" };
  renderCatalog();
}

function filteredProducts() {
  return getProducts().filter((p) => {
    if (currentFilters.modelos.length && !currentFilters.modelos.includes(p.modelo)) return false;
    if (currentFilters.armazenamentos.length && !currentFilters.armazenamentos.includes(p.armazenamento)) return false;
    if (currentFilters.condicoes.length && !currentFilters.condicoes.includes(p.condicao)) return false;
    if (currentFilters.bateria && (p.bateria || 0) < currentFilters.bateria) return false;
    if ((p.precoPromo || p.preco) > currentFilters.precoMax) return false;
    if (currentFilters.busca) {
      const q = currentFilters.busca.toLowerCase();
      const hay = `${p.nome} ${p.modelo} ${p.armazenamento} ${p.cor} ${p.condicao}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (currentSort === "menor-preco") return (a.precoPromo || a.preco) - (b.precoPromo || b.preco);
    if (currentSort === "maior-preco") return (b.precoPromo || b.preco) - (a.precoPromo || a.preco);
    if (currentSort === "mais-vendidos") return (b.vendidos || 0) - (a.vendidos || 0);
    return new Date(b.dataAdicionado || 0) - new Date(a.dataAdicionado || 0);
  });
}

function renderCatalogGrid() {
  const list = filteredProducts();
  document.getElementById("resultCount").textContent = `${list.length} iPhone${list.length === 1 ? "" : "s"} encontrado${list.length === 1 ? "" : "s"}`;
  const grid = document.getElementById("catalogGrid");
  grid.innerHTML = list.length ? list.map(productCard).join("") : `
    <div class="empty-state" style="grid-column:1/-1">
      <h3>Nenhum iPhone encontrado.</h3>
      <p>Tente ajustar os filtros ou limpar a busca.</p>
    </div>`;
}

/* ---------------- PRODUTO ---------------- */
function renderProductDetail(id) {
  const p = byId(id);
  if (!p) { app.innerHTML = `<div class="section container text-center"><h2>Produto não encontrado</h2><a class="btn btn-outline mt-lg" href="#/iphones">Voltar ao catálogo</a></div>`; return; }
  const esgotado = p.status === "esgotado";

  app.innerHTML = `
  <section class="page-hero" style="padding-bottom:0">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / <a href="#/iphones">iPhones</a> / ${p.nome} ${p.armazenamento}</div>
    </div>
  </section>
  <section class="section" style="padding-top:24px">
    <div class="container product-detail">
      <div>
        <div class="gallery-main"><img id="galleryMain" src="${p.imagens[0]}" alt="${p.nome}" onerror="${imgOnError}"></div>
        ${p.imagens.length > 1 ? `<div class="gallery-thumbs">${p.imagens.map((img, i) => `<img src="${img}" onclick="document.getElementById('galleryMain').src='${img}'" onerror="${imgOnError}">`).join("")}</div>` : ""}
      </div>
      <div>
        <div class="badges" style="position:static; display:flex; margin-bottom:14px;">${statusBadges(p)}</div>
        <h1 class="pd-title">${p.nome} ${p.armazenamento}</h1>
        <div class="pd-condition">
          <span>${p.condicao}</span> • ${batteryPill(p.bateria)}
        </div>

        <table class="spec-table">
          <tr><td>Modelo</td><td>${p.modelo}</td></tr>
          <tr><td>Armazenamento</td><td>${p.armazenamento}</td></tr>
          <tr><td>Cor</td><td>${p.cor}</td></tr>
          <tr><td>Condição</td><td>${p.condicao}</td></tr>
          ${p.bateria ? `<tr><td>Saúde da bateria</td><td>${p.bateria}%</td></tr>` : ""}
          <tr><td>Garantia</td><td>${p.garantia}</td></tr>
          <tr><td>Estoque</td><td>${esgotado ? "Esgotado" : `${p.estoque} unidade${p.estoque > 1 ? "s" : ""}`}</td></tr>
        </table>

        <div class="pd-price-box">
          ${p.precoPromo ? `<div class="price-old">${money(p.preco)}</div>` : ""}
          <div class="price-now" style="font-size:2rem">${money(p.precoPromo || p.preco)}</div>
          <div class="price-parcel">ou 12x de ${parcelaValor(p.precoPromo || p.preco, 12)}</div>
        </div>

        <div class="pd-actions">
          <button class="btn btn-primary" ${esgotado ? "disabled" : ""} onclick="Cart.add('${p.id}')">${esgotado ? "Esgotado" : "Comprar agora"}</button>
          <a class="btn btn-whatsapp" target="_blank" href="${waLink(waMsg.produto(p))}">Tenho interesse pelo WhatsApp</a>
        </div>

        <p class="pd-desc">${p.descricao}</p>
      </div>
    </div>
  </section>
  `;
}

/* ---------------- ASSISTÊNCIA TÉCNICA ---------------- */
function renderAssistencia() {
  const servicos = getServices();
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / Assistência Técnica</div>
      <h1>Seu iPhone nas mãos de quem entende.</h1>
      <p>Conte com a S CELL para diagnóstico, manutenção e reparos no seu aparelho.</p>
    </div>
  </section>

  <section class="section" style="padding-top:20px">
    <div class="container">
      <div class="section-head"><div><h2>Nossos serviços</h2></div></div>
      <div class="services-grid">
        ${servicos.filter(s => s.ativo).map(s => `
          <div class="service-card">
            <h4>${s.nome}</h4>
            <p>${s.descricao}</p>
            <div class="service-price">${s.preco ? "A partir de " + money(s.preco) : "Sob orçamento"}</div>
            <a class="btn btn-outline btn-sm" target="_blank" href="${waLink(waMsg.servico(s))}">Solicitar</a>
          </div>
        `).join("") || `<p style="color:var(--text-dim)">Nenhum serviço cadastrado no momento.</p>`}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="section-head"><div><h2>Estime o valor do reparo</h2><p>Selecione o modelo e o problema para ver uma estimativa.</p></div></div>
      <div class="calc-box">
        <div class="calc-row">
          <div class="field">
            <label>Modelo do iPhone</label>
            <select id="calcModelo">
              <option value="">Selecione o modelo</option>
              ${Object.keys(ESTIMATIVAS).map(m => `<option value="${m}">${m}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Problema</label>
            <select id="calcServico" disabled>
              <option value="">Selecione o modelo primeiro</option>
            </select>
          </div>
        </div>
        <div id="calcResult" class="calc-result hidden">
          <div class="value" id="calcValue"></div>
          <p class="calc-note">O valor apresentado é uma estimativa. O preço final poderá variar após a avaliação técnica do aparelho.</p>
          <a class="btn btn-whatsapp mt-lg" id="calcWaBtn" target="_blank">Solicitar orçamento pelo WhatsApp</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="section-head"><div><h2>Solicite sua assistência</h2><p>Preencha o formulário e envie sua solicitação direto pelo WhatsApp.</p></div></div>
      <form id="assistForm" class="calc-box" style="max-width:720px">
        <div class="form-grid">
          <div class="field"><label>Nome</label><input required type="text" name="nome"></div>
          <div class="field"><label>WhatsApp</label><input required type="tel" name="whatsapp"></div>
          <div class="field"><label>Modelo do iPhone</label><input required type="text" name="modelo" placeholder="Ex: iPhone 13"></div>
          <div class="field">
            <label>Serviço desejado</label>
            <select name="servico" required>
              <option value="">Selecione</option>
              ${servicos.filter(s=>s.ativo).map(s => `<option value="${s.nome}">${s.nome}</option>`).join("")}
            </select>
          </div>
          <div class="field full"><label>Problema apresentado</label><input required type="text" name="problema"></div>
          <div class="field full"><label>Observações</label><textarea name="obs" placeholder="Opcional"></textarea></div>
        </div>
        <button type="submit" class="btn btn-primary btn-block mt-lg">Solicitar atendimento</button>
      </form>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="section-head"><div><h2>Acompanhamento da assistência</h2><p>Etapas do seu atendimento, do recebimento até a finalização.</p></div></div>
      <div class="calc-box" style="max-width:none">
        <div class="timeline">
          ${ETAPAS_ASSISTENCIA.map((etapa, i) => `
            <div class="timeline-step ${i <= 2 ? "active" : ""}">
              <div class="line"></div>
              <div class="dot">${i + 1}</div>
              <p>${etapa}</p>
            </div>
          `).join("")}
        </div>
        <p class="calc-note text-center">Exemplo ilustrativo. O status real do seu aparelho será informado pela equipe S CELL.</p>
      </div>
    </div>
  </section>
  `;

  document.getElementById("calcModelo").addEventListener("change", (e) => {
    const modeloSel = document.getElementById("calcServico");
    const modelo = e.target.value;
    document.getElementById("calcResult").classList.add("hidden");
    if (!modelo) { modeloSel.disabled = true; modeloSel.innerHTML = `<option value="">Selecione o modelo primeiro</option>`; return; }
    modeloSel.disabled = false;
    modeloSel.innerHTML = `<option value="">Selecione o problema</option>` + Object.keys(ESTIMATIVAS[modelo]).map(k => { const s = svc(k); return `<option value="${k}">${s ? s.nome : k}</option>`; }).join("");
  });
  document.getElementById("calcServico").addEventListener("change", (e) => {
    const modelo = document.getElementById("calcModelo").value;
    const servicoId = e.target.value;
    if (!servicoId) return document.getElementById("calcResult").classList.add("hidden");
    const valor = ESTIMATIVAS[modelo][servicoId];
    const valorTxt = valor ? money(valor) : "Sob orçamento";
    document.getElementById("calcValue").textContent = valorTxt;
    document.getElementById("calcResult").classList.remove("hidden");
    const s = svc(servicoId);
    document.getElementById("calcWaBtn").href = waLink(waMsg.orcamento(modelo, s ? s.nome : servicoId, valorTxt));
  });

  document.getElementById("assistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    window.open(waLink(waMsg.solicitacao(d)), "_blank");
    toast("Solicitação enviada — abrindo WhatsApp");
    e.target.reset();
  });
}

/* ---------------- SOBRE ---------------- */
function renderSobre() {
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / Sobre Nós</div>
      <h1>Sobre a S CELL</h1>
    </div>
  </section>
  <section class="section" style="padding-top:20px">
    <div class="container about-grid">
      <div class="about-visual"><img src="assets/logo.png" alt="S CELL"></div>
      <div>
        <p style="color:var(--text-dim); font-size:1.05rem; line-height:1.8;">
          A S CELL nasceu com um propósito simples: oferecer iPhones de procedência confiável e um atendimento técnico à altura de quem depende do próprio aparelho todos os dias.
          Cada iPhone que passa pela S CELL é avaliado com atenção antes de chegar até você, e cada reparo é feito por quem entende do assunto.
        </p>
        <p style="color:var(--text-dim); font-size:1.05rem; line-height:1.8; margin-top:16px;">
          Trabalhamos com transparência em cada etapa — do preço mostrado no site ao diagnóstico feito na assistência técnica — porque acreditamos que confiança se constrói com clareza, não com promessas vagas.
        </p>
        <div class="value-list">
          <div class="value-item"><h4>Confiança</h4><p style="color:var(--text-dim); font-size:0.88rem; margin-top:8px;">Aparelhos avaliados e informações claras em cada anúncio.</p></div>
          <div class="value-item"><h4>Transparência</h4><p style="color:var(--text-dim); font-size:0.88rem; margin-top:8px;">Preços visíveis, sem letras miúdas.</p></div>
          <div class="value-item"><h4>Tecnologia</h4><p style="color:var(--text-dim); font-size:0.88rem; margin-top:8px;">Atendimento e diagnóstico com foco em qualidade.</p></div>
        </div>
      </div>
    </div>
  </section>
  `;
}

/* ---------------- CONTATO ---------------- */
function renderContato() {
  const cfg = getConfig();
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / Contato</div>
      <h1>Entre em contato</h1>
      <p>Fale com a S CELL pelos canais abaixo ou envie uma mensagem direta pelo WhatsApp.</p>
    </div>
  </section>
  <section class="section" style="padding-top:20px">
    <div class="container contact-grid">
      <div>
        <div class="contact-info-list">
          <div class="contact-info-item"><div class="icon">${iconWhats()}</div><div><h4>WhatsApp</h4><p>${cfg.whatsappNumber.replace(/^55/, "")}</p></div></div>
          <div class="contact-info-item"><div class="icon">${iconInsta()}</div><div><h4>Instagram</h4><p>${cfg.instagram}</p></div></div>
          <div class="contact-info-item"><div class="icon">${iconPin()}</div><div><h4>Endereço</h4><p>${cfg.address}</p></div></div>
          <div class="contact-info-item"><div class="icon">${iconClock()}</div><div><h4>Horário de funcionamento</h4><p>${cfg.hours}</p></div></div>
          <div class="contact-info-item"><div class="icon">${iconMail()}</div><div><h4>E-mail</h4><p>${cfg.email}</p></div></div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <a class="btn btn-whatsapp" target="_blank" href="${waLink(waMsg.contato())}">Falar no WhatsApp</a>
          <a class="btn btn-outline" target="_blank" href="${cfg.instagramUrl}">Instagram</a>
        </div>
      </div>
      <div class="calc-box" style="max-width:none">
        <form id="contatoForm">
          <div class="form-grid">
            <div class="field"><label>Nome</label><input required type="text" name="nome"></div>
            <div class="field"><label>WhatsApp</label><input required type="tel" name="whatsapp"></div>
            <div class="field full"><label>Mensagem</label><textarea required name="mensagem"></textarea></div>
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-lg">Enviar mensagem</button>
        </form>
      </div>
    </div>
  </section>
  `;
  document.getElementById("contatoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    window.open(waLink(`Olá, ${cfg.companyName}! Meu nome é ${d.nome}.\n\n${d.mensagem}`), "_blank");
    toast("Mensagem enviada — abrindo WhatsApp");
    e.target.reset();
  });
}
/* ---------------- POLÍTICA DE PRIVACIDADE ---------------- */
function renderPrivacidade() {
  const cfg = getConfig();
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / Política de Privacidade</div>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: ${new Date().toLocaleDateString("pt-BR", { year: "numeric", month: "long" })}</p>
    </div>
  </section>
  <section class="section" style="padding-top:10px">
    <div class="container" style="max-width:760px">
      <div class="calc-box" style="max-width:none; line-height:1.8; color:var(--text-dim);">
        <p style="color:var(--text); margin-bottom:18px;">Este texto é um modelo padrão e não substitui a orientação de um advogado — recomendamos revisão jurídica antes do uso comercial.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">1. Quais dados coletamos</h3>
        <p>Coletamos apenas os dados que você mesmo nos informa ao entrar em contato: nome, número de WhatsApp e, quando aplicável, informações sobre o aparelho de interesse ou o problema técnico relatado. Não pedimos dados sensíveis nem informações de pagamento diretamente pelo site.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">2. Como usamos esses dados</h3>
        <p>Usamos as informações fornecidas exclusivamente para dar continuidade ao atendimento iniciado por você, seja para tirar dúvidas sobre um iPhone, prosseguir com uma compra ou avaliar uma solicitação de assistência técnica. Todo o contato final acontece pelo WhatsApp.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">3. Cookies e armazenamento local</h3>
        <p>Usamos o armazenamento do seu próprio navegador (localStorage) apenas para lembrar os itens do seu carrinho de compras entre uma visita e outra. Essa informação fica salva só no seu aparelho e não é enviada para nenhum servidor.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">4. Compartilhamento com terceiros</h3>
        <p>Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins de marketing. Os dados informados são usados apenas pela ${cfg.companyName} para o próprio atendimento.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">5. Seus direitos</h3>
        <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você pode solicitar a qualquer momento a confirmação, o acesso, a correção ou a exclusão dos seus dados conosco. Basta entrar em contato pelos canais abaixo.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">6. Contato</h3>
        <p>Dúvidas sobre esta política podem ser enviadas para <strong style="color:var(--text)">${cfg.email}</strong> ou pelo WhatsApp <strong style="color:var(--text)">${cfg.whatsappNumber}</strong>.</p>
      </div>
    </div>
  </section>
  `;
}

/* ---------------- TERMOS DE USO ---------------- */
function renderTermos() {
  const cfg = getConfig();
  app.innerHTML = `
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><a href="#/">Início</a> / Termos de Uso</div>
      <h1>Termos de Uso</h1>
      <p>Última atualização: ${new Date().toLocaleDateString("pt-BR", { year: "numeric", month: "long" })}</p>
    </div>
  </section>
  <section class="section" style="padding-top:10px">
    <div class="container" style="max-width:760px">
      <div class="calc-box" style="max-width:none; line-height:1.8; color:var(--text-dim);">
        <p style="color:var(--text); margin-bottom:18px;">Este texto é um modelo padrão e não substitui a orientação de um advogado — recomendamos revisão jurídica antes do uso comercial.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">1. Sobre este site</h3>
        <p>Este site é um canal de divulgação e contato da ${cfg.companyName}, especializada em venda de iPhones novos e seminovos e em assistência técnica de iPhones. A finalização de compras e o agendamento de serviços acontecem diretamente pelo WhatsApp.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">2. Produtos e preços</h3>
        <p>As fotos dos aparelhos são meramente ilustrativas quando indicado. Preços, condições, estoque e saúde de bateria informados no site podem ser alterados sem aviso prévio até a confirmação final da compra pelo WhatsApp. Todo aparelho seminovo passa por avaliação antes da venda.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">3. Processo de compra</h3>
        <p>Ao clicar em "Comprar" ou "Tenho interesse", você será direcionado ao WhatsApp da ${cfg.companyName} com uma mensagem pré-preenchida. A compra só é considerada confirmada após o combinado diretamente com a equipe de atendimento.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">4. Assistência técnica</h3>
        <p>Os valores exibidos na calculadora de orçamento são estimativas e podem variar após a avaliação técnica presencial do aparelho. Prazos de reparo e garantia sobre o serviço são informados no momento do atendimento.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">5. Garantia dos aparelhos</h3>
        <p>Cada aparelho vendido possui garantia própria, informada individualmente na página do produto. A garantia cobre defeitos de funcionamento identificados dentro do prazo informado, não cobrindo danos por mau uso, queda ou contato com líquidos.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">6. Propriedade do conteúdo</h3>
        <p>Marca, logotipo e identidade visual deste site pertencem à ${cfg.companyName}. A reprodução sem autorização não é permitida.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">7. Alterações nestes termos</h3>
        <p>Estes termos podem ser atualizados a qualquer momento, com a nova versão sempre publicada nesta mesma página.</p>

        <h3 style="color:var(--text); margin:20px 0 8px; font-size:1.05rem;">8. Contato</h3>
        <p>Dúvidas sobre estes termos podem ser enviadas para <strong style="color:var(--text)">${cfg.email}</strong> ou pelo WhatsApp <strong style="color:var(--text)">${cfg.whatsappNumber}</strong>.</p>
      </div>
    </div>
  </section>
  `;
}

function iconWhats(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>`; }
function iconInsta(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>`; }
function iconPin(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`; }
function iconClock(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`; }
function iconMail(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`; }
function iconTrash(){ return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`; }
function iconEdit(){ return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`; }

/* ==========================================================================
   ADMIN — AUTENTICAÇÃO
   Login real, validado pelo Supabase (servidor) — não depende mais do
   navegador nem de senha embutida no código. Para criar ou trocar o
   login do admin, acesse supabase.com → seu projeto → Authentication.
   ========================================================================== */
const Auth = {
  async tryLogin(email, password) {
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
  isAuthenticated() { return _isAdmin; },
  async logout() { await supa.auth.signOut(); },
};
supa.auth.onAuthStateChange((_event, session) => { _isAdmin = !!session; });

function renderAdminGate() {
  if (Auth.isAuthenticated()) return renderAdminDashboard();

  app.innerHTML = `
  <section class="section" style="padding-top: calc(var(--header-h) + 60px); min-height:80vh; display:flex; align-items:center;">
    <div class="container" style="max-width:420px">
      <div class="calc-box" style="max-width:none">
        <h1 style="font-size:1.5rem; margin-bottom:6px;">Painel administrativo</h1>
        <p style="color:var(--text-dim); font-size:0.88rem; margin-bottom:26px;">Acesso restrito à equipe S CELL.</p>
        <form id="adminLoginForm">
          <div class="field" style="margin-bottom:16px;">
            <label>E-mail</label>
            <input required type="email" id="adminEmail" autocomplete="username">
          </div>
          <div class="field" style="margin-bottom:16px;">
            <label>Senha</label>
            <input required type="password" id="adminPassword" autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="adminLoginBtn">Entrar</button>
          <p id="loginError" class="hidden" style="color:var(--danger); font-size:0.82rem; margin-top:12px;">E-mail ou senha incorretos.</p>
        </form>
      </div>
    </div>
  </section>
  `;
  document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value;
    const pass = document.getElementById("adminPassword").value;
    const btn = document.getElementById("adminLoginBtn");
    btn.disabled = true; btn.textContent = "Entrando...";
    const res = await Auth.tryLogin(email, pass);
    if (res.ok) { renderAdminDashboard(); }
    else {
      document.getElementById("loginError").classList.remove("hidden");
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}

/* ==========================================================================
   ADMIN — DASHBOARD / CRUD
   ========================================================================== */
let adminTab = "dashboard";

function renderAdminDashboard() {
  const produtos = getProducts();
  const servicos = getServices();
  const cfg = getConfig();
  const disponiveis = produtos.filter(p => p.status !== "esgotado").length;
  const vendidos = produtos.reduce((s,p) => s + (p.vendidos || 0), 0);

  app.innerHTML = `
  <div class="admin-shell view">
    <aside class="admin-sidebar">
      <div class="brand"><img src="assets/logo.png" style="height:28px"><span>S CELL</span></div>
      <nav class="admin-nav">
        <a data-tab="dashboard" class="${adminTab === "dashboard" ? "active" : ""}">Dashboard</a>
        <a data-tab="produtos" class="${adminTab === "produtos" ? "active" : ""}">Produtos</a>
        <a data-tab="servicos" class="${adminTab === "servicos" ? "active" : ""}">Serviços</a>
        <a data-tab="config" class="${adminTab === "config" ? "active" : ""}">Configurações</a>
        <a href="#/">Voltar ao site</a>
        <a id="adminLogoutBtn" style="color:var(--danger)">Sair</a>
      </nav>
    </aside>
    <main class="admin-main" id="adminMain"></main>
  </div>
  `;
  document.querySelectorAll(".admin-nav a[data-tab]").forEach(a => a.addEventListener("click", () => { adminTab = a.dataset.tab; renderAdminDashboard(); }));
  document.getElementById("adminLogoutBtn").addEventListener("click", async () => { await Auth.logout(); location.hash = "#/admin"; router(); });

  const main = document.getElementById("adminMain");
  if (adminTab === "dashboard") main.innerHTML = adminDashboardHTML(produtos, servicos, disponiveis, vendidos);
  if (adminTab === "produtos") { main.innerHTML = adminProductsHTML(produtos); bindProductsAdmin(); }
  if (adminTab === "servicos") { main.innerHTML = adminServicesHTML(servicos); bindServicesAdmin(); }
  if (adminTab === "config") { main.innerHTML = adminConfigHTML(cfg); bindConfigAdmin(); }
}

function adminDashboardHTML(produtos, servicos, disponiveis, vendidos) {
  return `
    <h1 style="margin-bottom:30px">Dashboard</h1>
    <div class="admin-kpis">
      <div class="kpi-card"><div class="label">Total de iPhones</div><div class="value">${produtos.length}</div></div>
      <div class="kpi-card"><div class="label">iPhones disponíveis</div><div class="value">${disponiveis}</div></div>
      <div class="kpi-card"><div class="label">iPhones vendidos (histórico)</div><div class="value">${vendidos}</div></div>
      <div class="kpi-card"><div class="label">Serviços ativos</div><div class="value">${servicos.filter(s=>s.ativo).length}</div></div>
    </div>
    <div class="admin-note">
      Solicitações de assistência e pedidos chegam diretamente no seu WhatsApp (cada botão do site já gera uma mensagem
      pronta e específica). Este painel controla o que aparece no site: produtos, serviços e dados de contato.
      <br><br>
      Para fazer backup dos seus dados ou mover para outro dispositivo, use "Exportar dados" na aba Configurações.
    </div>
  `;
}

/* -------- Produtos -------- */
function adminProductsHTML(produtos) {
  return `
    <div class="section-head" style="margin-bottom:20px">
      <h1>Produtos</h1>
      <button class="btn btn-primary btn-sm" id="btnAddProduct">+ Adicionar iPhone</button>
    </div>
    <div class="admin-table-scroll">
    <table class="admin-table">
      <thead><tr><th>iPhone</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${produtos.length ? produtos.map(p => `
          <tr>
            <td>${p.nome} ${p.armazenamento} • ${p.cor}</td>
            <td>${money(p.precoPromo || p.preco)}</td>
            <td>${p.estoque}</td>
            <td><span class="status-pill ${p.status === "esgotado" ? "status-finalizado" : "status-disponivel"}">${p.status === "esgotado" ? "Esgotado" : p.status === "ultimas" ? "Últimas unidades" : "Disponível"}</span></td>
            <td style="display:flex; gap:8px;">
              <button class="icon-btn" data-edit="${p.id}" aria-label="Editar">${iconEdit()}</button>
              <button class="icon-btn" data-del="${p.id}" aria-label="Remover">${iconTrash()}</button>
            </td>
          </tr>
        `).join("") : `<tr><td colspan="5" style="color:var(--text-dim)">Nenhum produto cadastrado.</td></tr>`}
      </tbody>
    </table>
  </div>
    <div id="productModalHost"></div>
  `;
}
function bindProductsAdmin() {
  document.getElementById("btnAddProduct").addEventListener("click", () => openProductModal(null));
  document.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openProductModal(b.dataset.edit)));
  document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Remover este iPhone do catálogo?")) return;
    const list = getProducts().filter(p => p.id !== b.dataset.del);
    await Store.saveProducts(list);
    toast("iPhone removido");
    renderAdminDashboard();
  }));
}
function openProductModal(id) {
  const p = id ? byId(id) : null;
  let pmImages = p ? [...p.imagens] : [];
  const host = document.getElementById("productModalHost");
  host.innerHTML = `
    <div class="cart-overlay open" id="pmOverlay"></div>
    <aside class="cart-drawer open" style="width:520px;">
      <div class="cart-header"><h3>${p ? "Editar iPhone" : "Adicionar iPhone"}</h3>
        <button class="icon-btn" id="pmClose">✕</button>
      </div>
      <form id="productForm" style="padding:20px 22px; overflow-y:auto; flex:1;">
        <div class="form-grid">
          <div class="field"><label>Nome (ex: iPhone 15)</label><input required name="nome" value="${p ? p.nome : ""}"></div>
          <div class="field"><label>Modelo (para filtros)</label>
            <select name="modelo" required>
              ${["iPhone 11","iPhone 12","iPhone 13","iPhone 14","iPhone 15","iPhone 16","iPhone 17","Outros"].map(m => `<option ${p && p.modelo === m ? "selected" : ""}>${m}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Armazenamento</label>
            <select name="armazenamento" required>
              ${["64GB","128GB","256GB","512GB","1TB"].map(m => `<option ${p && p.armazenamento === m ? "selected" : ""}>${m}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Cor</label><input required name="cor" value="${p ? p.cor : ""}"></div>
          <div class="field"><label>Condição</label>
            <select name="condicao" required>
              ${["Novo","Seminovo","Usado"].map(m => `<option ${p && p.condicao === m ? "selected" : ""}>${m}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Saúde da bateria (%)</label><input type="number" min="0" max="100" name="bateria" value="${p ? p.bateria || "" : ""}"></div>
          <div class="field"><label>Preço (R$)</label><input required type="number" step="0.01" name="preco" value="${p ? p.preco : ""}"></div>
          <div class="field"><label>Preço promocional (opcional)</label><input type="number" step="0.01" name="precoPromo" value="${p && p.precoPromo ? p.precoPromo : ""}"></div>
          <div class="field"><label>Parcelas (máx.)</label><input type="number" min="1" max="24" name="parcelas" value="${p ? p.parcelas || 12 : 12}"></div>
          <div class="field"><label>Estoque</label><input required type="number" min="0" name="estoque" value="${p ? p.estoque : 1}"></div>
          <div class="field"><label>Garantia</label><input name="garantia" value="${p ? p.garantia : "90 dias S CELL"}"></div>
          <div class="field"><label>Status</label>
            <select name="status">
              <option value="disponivel" ${p && p.status === "disponivel" ? "selected" : ""}>Disponível</option>
              <option value="ultimas" ${p && p.status === "ultimas" ? "selected" : ""}>Últimas unidades</option>
              <option value="esgotado" ${p && p.status === "esgotado" ? "selected" : ""}>Esgotado</option>
            </select>
          </div>
          <div class="field"><label>Destaque na home?</label>
            <select name="destaque">
              <option value="false" ${p && !p.destaque ? "selected" : ""}>Não</option>
              <option value="true" ${p && p.destaque ? "selected" : ""}>Sim</option>
            </select>
          </div>
          <div class="field full">
            <label>Fotos do aparelho</label>
            <div class="photo-grid" id="pmPhotoGrid"></div>
            <label class="btn btn-outline btn-sm" style="cursor:pointer; width:fit-content; margin-top:4px;">
              + Adicionar fotos
              <input type="file" id="pmPhotoInput" accept="image/*" multiple style="display:none;">
            </label>
            <p class="calc-note">Envie direto do computador ou celular (JPG/PNG). As fotos são redimensionadas automaticamente para caber no navegador — evite enviar dezenas de fotos em altíssima resolução no mesmo produto.</p>
          </div>
          <div class="field full"><label>Descrição</label><textarea name="descricao">${p ? p.descricao : ""}</textarea></div>
        </div>
      </form>
      <div class="cart-footer">
        <button class="btn btn-primary btn-block" id="pmSave">Salvar</button>
      </div>
    </aside>
  `;

  function renderPhotoGrid() {
    const grid = document.getElementById("pmPhotoGrid");
    grid.innerHTML = pmImages.length ? pmImages.map((img, i) => `
      <div class="photo-thumb">
        <img src="${img}" alt="Foto ${i + 1}">
        <button type="button" class="photo-remove" data-i="${i}" aria-label="Remover foto">✕</button>
      </div>
    `).join("") : `<p style="color:var(--text-faint); font-size:0.82rem;">Nenhuma foto adicionada ainda.</p>`;
    grid.querySelectorAll(".photo-remove").forEach(btn => btn.addEventListener("click", () => {
      pmImages.splice(Number(btn.dataset.i), 1);
      renderPhotoGrid();
    }));
  }
  renderPhotoGrid();

  document.getElementById("pmPhotoInput").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    toast("Processando fotos...");
    for (const file of files) {
      try { pmImages.push(await compressImage(file)); } catch { toast("Não foi possível ler uma das fotos"); }
    }
    renderPhotoGrid();
    e.target.value = "";
  });

  document.getElementById("pmOverlay").addEventListener("click", () => host.innerHTML = "");
  document.getElementById("pmClose").addEventListener("click", () => host.innerHTML = "");
  document.getElementById("pmSave").addEventListener("click", async (e) => {
    const form = document.getElementById("productForm");
    if (!form.reportValidity()) return;
    if (!pmImages.length) { toast("Adicione ao menos uma foto do aparelho"); return; }
    const d = Object.fromEntries(new FormData(form).entries());
    const list = getProducts();
    const novo = {
      id: p ? p.id : uid(slugify(d.nome + "-" + d.armazenamento)),
      nome: d.nome, modelo: d.modelo, armazenamento: d.armazenamento, cor: d.cor, condicao: d.condicao,
      bateria: d.bateria ? Number(d.bateria) : null,
      preco: Number(d.preco), precoPromo: d.precoPromo ? Number(d.precoPromo) : null,
      parcelas: Number(d.parcelas) || 12, estoque: Number(d.estoque), garantia: d.garantia,
      status: Number(d.estoque) === 0 ? "esgotado" : d.status,
      destaque: d.destaque === "true",
      vendidos: p ? p.vendidos || 0 : 0,
      dataAdicionado: p ? p.dataAdicionado : new Date().toISOString().slice(0,10),
      imagens: pmImages,
      descricao: d.descricao,
    };
    const idx = list.findIndex(x => x.id === novo.id);
    if (idx >= 0) list[idx] = novo; else list.push(novo);
    e.target.disabled = true; e.target.textContent = "Salvando...";
    const ok = await Store.saveProducts(list);
    if (!ok) { toast("Não foi possível salvar — confira sua conexão e tente de novo"); e.target.disabled = false; e.target.textContent = "Salvar"; return; }
    host.innerHTML = "";
    toast(p ? "iPhone atualizado" : "iPhone adicionado");
    renderAdminDashboard();
  });
}

/* -------- Serviços -------- */
function adminServicesHTML(servicos) {
  return `
    <div class="section-head" style="margin-bottom:20px">
      <h1>Serviços</h1>
      <button class="btn btn-primary btn-sm" id="btnAddService">+ Adicionar serviço</button>
    </div>
    <div class="admin-table-scroll">
    <table class="admin-table">
      <thead><tr><th>Serviço</th><th>Preço</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${servicos.length ? servicos.map(s => `
          <tr>
            <td>${s.nome}</td>
            <td>${s.preco ? money(s.preco) : "Sob orçamento"}</td>
            <td><span class="status-pill ${s.ativo ? "status-disponivel" : "status-finalizado"}">${s.ativo ? "Ativo" : "Inativo"}</span></td>
            <td style="display:flex; gap:8px;">
              <button class="icon-btn" data-edit="${s.id}" aria-label="Editar">${iconEdit()}</button>
              <button class="icon-btn" data-del="${s.id}" aria-label="Remover">${iconTrash()}</button>
            </td>
          </tr>
        `).join("") : `<tr><td colspan="4" style="color:var(--text-dim)">Nenhum serviço cadastrado.</td></tr>`}
      </tbody>
    </table>
  </div>
    <div id="serviceModalHost"></div>
  `;
}
function bindServicesAdmin() {
  document.getElementById("btnAddService").addEventListener("click", () => openServiceModal(null));
  document.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openServiceModal(b.dataset.edit)));
  document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Remover este serviço?")) return;
    const list = getServices().filter(s => s.id !== b.dataset.del);
    await Store.saveServices(list);
    toast("Serviço removido");
    renderAdminDashboard();
  }));
}
function openServiceModal(id) {
  const s = id ? svc(id) : null;
  const host = document.getElementById("serviceModalHost");
  host.innerHTML = `
    <div class="cart-overlay open" id="smOverlay"></div>
    <aside class="cart-drawer open" style="width:480px;">
      <div class="cart-header"><h3>${s ? "Editar serviço" : "Adicionar serviço"}</h3>
        <button class="icon-btn" id="smClose">✕</button>
      </div>
      <form id="serviceForm" style="padding:20px 22px; overflow-y:auto; flex:1;">
        <div class="field" style="margin-bottom:16px;"><label>Nome do serviço</label><input required name="nome" value="${s ? s.nome : ""}"></div>
        <div class="field" style="margin-bottom:16px;"><label>Preço (R$) — deixe vazio para "Sob orçamento"</label><input type="number" step="0.01" name="preco" value="${s && s.preco ? s.preco : ""}"></div>
        <div class="field" style="margin-bottom:16px;"><label>Descrição</label><textarea name="descricao">${s ? s.descricao : ""}</textarea></div>
        <div class="field" style="margin-bottom:16px;"><label>Ativo (aparece no site)?</label>
          <select name="ativo"><option value="true" ${!s || s.ativo ? "selected" : ""}>Sim</option><option value="false" ${s && !s.ativo ? "selected" : ""}>Não</option></select>
        </div>
        <div class="field"><label>Mensagem personalizada de WhatsApp (opcional)</label>
          <textarea name="mensagem" placeholder="Deixe em branco para usar a mensagem automática com o nome e o preço deste serviço.">${s ? s.mensagem || "" : ""}</textarea>
        </div>
      </form>
      <div class="cart-footer"><button class="btn btn-primary btn-block" id="smSave">Salvar</button></div>
    </aside>
  `;
  document.getElementById("smOverlay").addEventListener("click", () => host.innerHTML = "");
  document.getElementById("smClose").addEventListener("click", () => host.innerHTML = "");
  document.getElementById("smSave").addEventListener("click", async (e) => {
    const form = document.getElementById("serviceForm");
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form).entries());
    const list = getServices();
    const novo = {
      id: s ? s.id : uid(slugify(d.nome)),
      nome: d.nome, preco: d.preco ? Number(d.preco) : null, descricao: d.descricao,
      ativo: d.ativo === "true", mensagem: d.mensagem || "",
    };
    const idx = list.findIndex(x => x.id === novo.id);
    if (idx >= 0) list[idx] = novo; else list.push(novo);
    e.target.disabled = true; e.target.textContent = "Salvando...";
    const ok = await Store.saveServices(list);
    if (!ok) { toast("Não foi possível salvar — confira sua conexão e tente de novo"); e.target.disabled = false; e.target.textContent = "Salvar"; return; }
    host.innerHTML = "";
    toast(s ? "Serviço atualizado" : "Serviço adicionado");
    renderAdminDashboard();
  });
}

/* -------- Configurações -------- */
function adminConfigHTML(cfg) {
  return `
    <h1 style="margin-bottom:24px">Configurações</h1>
    <form id="configForm" class="calc-box" style="max-width:640px; margin-bottom:30px;">
      <div class="form-grid">
        <div class="field"><label>Nome da empresa</label><input name="companyName" value="${cfg.companyName}"></div>
        <div class="field"><label>Número de WhatsApp (só números, com DDI+DDD)</label><input name="whatsappNumber" value="${cfg.whatsappNumber}"></div>
        <div class="field"><label>Instagram (@usuário)</label><input name="instagram" value="${cfg.instagram}"></div>
        <div class="field"><label>Link do Instagram</label><input name="instagramUrl" value="${cfg.instagramUrl}"></div>
        <div class="field"><label>E-mail</label><input name="email" value="${cfg.email}"></div>
        <div class="field"><label>Horário de funcionamento</label><input name="hours" value="${cfg.hours}"></div>
        <div class="field full"><label>Endereço</label><input name="address" value="${cfg.address}"></div>
      </div>
      <button type="submit" class="btn btn-primary mt-lg" id="configSaveBtn">Salvar configurações</button>
    </form>
    <p class="calc-note" style="max-width:640px; margin: -18px 0 30px;">Qualquer alteração salva aqui (ou nas abas Produtos e Serviços) já aparece na hora para todos os visitantes do site — não precisa reenviar nem publicar nada.</p>

    <h2 style="font-size:1.05rem; margin-bottom:12px;">Backup</h2>
    <div class="calc-box" style="max-width:640px; display:flex; gap:12px; flex-wrap:wrap;">
      <button class="btn btn-outline" id="btnExport">Exportar backup (JSON)</button>
      <label class="btn btn-outline" style="cursor:pointer;">Importar backup
        <input type="file" id="fileImport" accept="application/json" style="display:none;">
      </label>
      <button class="btn btn-outline" id="btnReset" style="color:var(--danger); border-color: var(--danger);">Restaurar padrão de fábrica</button>
    </div>
    <p class="calc-note" style="max-width:640px; margin-top:10px;">Exportar cria um arquivo de segurança com tudo (produtos, serviços, fotos e configurações). "Restaurar padrão de fábrica" apaga tudo que foi personalizado e volta aos dados de exemplo — vale para todos os visitantes.</p>
  `;
}
function bindConfigAdmin() {
  document.getElementById("configForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const btn = document.getElementById("configSaveBtn");
    btn.disabled = true; btn.textContent = "Salvando...";
    const ok = await Store.saveConfig({ ...getConfig(), ...d });
    btn.disabled = false; btn.textContent = "Salvar configurações";
    toast(ok ? "Configurações salvas" : "Não foi possível salvar — confira sua conexão");
  });
  document.getElementById("btnExport").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scell-backup.json";
    a.click();
  });
  document.getElementById("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try { await Store.importJSON(reader.result); toast("Dados importados"); renderAdminDashboard(); }
      catch { toast("Arquivo inválido"); }
    };
    reader.readAsText(file);
  });
  document.getElementById("btnReset").addEventListener("click", async () => {
    if (!confirm("Isso vai apagar todas as alterações feitas no painel e voltar aos dados de exemplo, para todos os visitantes. Continuar?")) return;
    await Store.resetAll();
    toast("Dados restaurados ao padrão");
    renderAdminDashboard();
  });
}

/* ---------------- Inicialização ---------------- */
function applyGlobalLinks() {
  const cfg = getConfig();
  const genericMsg = waLink(waMsg.assistenciaGeral());
  document.getElementById("headerWaBtn").href = genericMsg;
  document.getElementById("mobileWaBtn").href = genericMsg;
  document.getElementById("floatWaBtn").href = genericMsg;
  document.getElementById("footerWaBtn").href = genericMsg;
  document.getElementById("footerWaLink").href = genericMsg;
  document.getElementById("footerInstaLink").href = cfg.instagramUrl;
  document.getElementById("footerYear").textContent = `© ${SCELL_CONFIG.year} ${cfg.companyName}. Todos os direitos reservados.`;
}
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supa.auth.getSession();
  _isAdmin = !!session;
  await loadAllData();
  applyGlobalLinks();
  updateCartUI();
  router();
});
