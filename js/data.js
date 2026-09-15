/* ==========================================================================
   S CELL — CONFIGURAÇÃO CENTRAL
   Edite este arquivo para atualizar dados da loja sem mexer no resto do código.
   ========================================================================== */

const SCELL_CONFIG = {
  companyName: "S CELL",
  tagline: "Tecnologia, confiança e qualidade.",
  whatsappNumber: "5527999999999", // TROCAR: número real da S CELL (formato: 55 + DDD + número)
  instagram: "@scell.iphones", // TROCAR: usuário real do Instagram
  instagramUrl: "https://instagram.com/scell.iphones", // TROCAR
  email: "contato@scell.com.br", // TROCAR
  address: "Endereço a definir", // TROCAR
  hours: "Segunda a sábado, 9h às 18h", // TROCAR
  year: new Date().getFullYear(),
};

/* ---------------- ACESSO AO PAINEL ADMINISTRATIVO ----------------
   Senha padrão: scell@admin2026  →  TROQUE IMEDIATAMENTE.
   Para gerar o hash de uma nova senha, abra o Console do navegador (F12) em
   qualquer página do site e rode:
     crypto.subtle.digest("SHA-256", new TextEncoder().encode("SUA_NOVA_SENHA"))
       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")))
   Copie o texto gerado e substitua o valor de passwordHash abaixo.
   IMPORTANTE: este é um painel client-side (sem servidor/banco de dados).
   Isso dá uma proteção razoável contra acesso casual, mas não é equivalente
   a um login de servidor real — veja a explicação completa no chat.
-------------------------------------------------------------------- */
const ADMIN_AUTH = {
  passwordHash: "dac94beed5bee760c782ee39e71da149873054ad9f4ac8fe61aa37ebb3e04661", // scell@admin2026
  sessionMinutes: 30,
  maxAttempts: 5,
  lockMinutes: 10,
};

function waLink(message) {
  // Usa o número salvo pelo admin (Store) quando existir; senão, o valor de fábrica.
  const number = (typeof Store !== "undefined" ? Store.config().whatsappNumber : SCELL_CONFIG.whatsappNumber);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/* ---------------- PRODUTOS (iPhones) ----------------
   status: "disponivel" | "ultimas" | "esgotado"
   condicao: "Novo" | "Seminovo" | "Usado"
------------------------------------------------------- */
const IPHONES = [
  {
    id: "iph-13-128-meianoite",
    nome: "iPhone 13",
    modelo: "iPhone 13",
    armazenamento: "128GB",
    cor: "Meia-noite",
    condicao: "Seminovo",
    bateria: 92,
    preco: 2699,
    precoPromo: null,
    parcelas: 10,
    estoque: 3,
    garantia: "90 dias S CELL",
    status: "disponivel",
    destaque: false,
    vendidos: 18,
    dataAdicionado: "2026-06-01",
    imagens: ["https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800&q=80"],
    descricao: "iPhone 13 128GB em ótimo estado de conservação, testado e aprovado pela equipe técnica da S CELL. Ideal para quem busca performance com o melhor custo-benefício.",
  },
  {
    id: "iph-14-128-estelar",
    nome: "iPhone 14",
    modelo: "iPhone 14",
    armazenamento: "128GB",
    cor: "Estelar",
    condicao: "Seminovo",
    bateria: 94,
    preco: 3199,
    precoPromo: null,
    parcelas: 10,
    estoque: 5,
    garantia: "90 dias S CELL",
    status: "disponivel",
    destaque: false,
    vendidos: 24,
    dataAdicionado: "2026-06-10",
    imagens: ["https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=800&q=80"],
    descricao: "iPhone 14 128GB seminovo, com excelente saúde de bateria e visual impecável. Acompanha avaliação técnica completa de 40 pontos feita pela S CELL.",
  },
  {
    id: "iph-15-128-preto",
    nome: "iPhone 15",
    modelo: "iPhone 15",
    armazenamento: "128GB",
    cor: "Preto",
    condicao: "Seminovo",
    bateria: 95,
    preco: 3699,
    precoPromo: 3399,
    parcelas: 12,
    estoque: 2,
    garantia: "90 dias S CELL",
    status: "ultimas",
    destaque: true,
    vendidos: 31,
    dataAdicionado: "2026-07-02",
    imagens: ["https://images.unsplash.com/photo-1695048065332-38d64d7d1e0b?w=800&q=80"],
    descricao: "iPhone 15 128GB, um dos modelos mais procurados da loja. Bateria com saúde de 95%, sem marcas de uso visíveis, acompanha carregador USB-C.",
  },
  {
    id: "iph-15pro-256-titanio",
    nome: "iPhone 15 Pro",
    modelo: "iPhone 15 Pro",
    armazenamento: "256GB",
    cor: "Titânio Natural",
    condicao: "Seminovo",
    bateria: 93,
    preco: 5299,
    precoPromo: null,
    parcelas: 12,
    estoque: 1,
    garantia: "90 dias S CELL",
    status: "ultimas",
    destaque: false,
    vendidos: 9,
    dataAdicionado: "2026-05-20",
    imagens: ["https://images.unsplash.com/photo-1696446702813-6019437cd1a5?w=800&q=80"],
    descricao: "iPhone 15 Pro 256GB em titânio natural, câmera profissional e chip A17 Pro. Estado de conservação excelente, ideal para quem exige o máximo de performance.",
  },
  {
    id: "iph-16-128-branco",
    nome: "iPhone 16",
    modelo: "iPhone 16",
    armazenamento: "128GB",
    cor: "Branco",
    condicao: "Novo",
    bateria: 100,
    preco: 4199,
    precoPromo: null,
    parcelas: 12,
    estoque: 6,
    garantia: "1 ano Apple + garantia S CELL",
    status: "disponivel",
    destaque: true,
    vendidos: 12,
    dataAdicionado: "2026-08-05",
    imagens: ["https://images.unsplash.com/photo-1662947995764-06e04125f0c1?w=800&q=80"],
    descricao: "iPhone 16 128GB lacrado, com nota fiscal e garantia de fábrica. O mais novo lançamento disponível na S CELL.",
  },
  {
    id: "iph-12-64-azul",
    nome: "iPhone 12",
    modelo: "iPhone 12",
    armazenamento: "64GB",
    cor: "Azul",
    condicao: "Usado",
    bateria: 87,
    preco: 1899,
    precoPromo: 1699,
    parcelas: 8,
    estoque: 0,
    garantia: "60 dias S CELL",
    status: "esgotado",
    destaque: false,
    vendidos: 27,
    dataAdicionado: "2026-04-11",
    imagens: ["https://images.unsplash.com/photo-1603921326210-6edd2d60ca68?w=800&q=80"],
    descricao: "iPhone 12 64GB, ótima opção de entrada. Funcionamento 100% testado pela equipe técnica.",
  },
];

/* ---------------- SERVIÇOS DE ASSISTÊNCIA TÉCNICA ----------------
   preco: número (R$) ou null quando for "Sob orçamento"
--------------------------------------------------------------------- */
const SERVICOS = [
  { id: "tela", nome: "Troca de tela", preco: 350, ativo: true, descricao: "Substituição da tela por peça de qualidade, com teste completo de toque e cores.", mensagem: "" },
  { id: "bateria", nome: "Troca de bateria", preco: 220, ativo: true, descricao: "Troca da bateria original por uma nova, recuperando a autonomia do aparelho.", mensagem: "" },
  { id: "conector", nome: "Conector de carga", preco: 180, ativo: true, descricao: "Reparo ou troca do conector de carga para o aparelho voltar a carregar normalmente.", mensagem: "" },
  { id: "software", nome: "Problemas de software", preco: 120, ativo: true, descricao: "Diagnóstico e correção de travamentos, lentidão, erros de sistema e atualizações.", mensagem: "" },
  { id: "camera", nome: "Câmera", preco: 280, ativo: true, descricao: "Reparo ou substituição de câmera traseira ou frontal com defeito.", mensagem: "" },
  { id: "alto-falante", nome: "Alto-falante", preco: 150, ativo: true, descricao: "Troca do alto-falante para restaurar a qualidade do som do aparelho.", mensagem: "" },
  { id: "microfone", nome: "Microfone", preco: 150, ativo: true, descricao: "Reparo do microfone para chamadas e gravações com áudio nítido novamente.", mensagem: "" },
  { id: "face-id", nome: "Face ID", preco: null, ativo: true, descricao: "Diagnóstico e reparo do sistema de reconhecimento facial. Valor sob orçamento.", mensagem: "" },
  { id: "diagnostico", nome: "Diagnóstico técnico", preco: 40, ativo: true, descricao: "Avaliação completa do aparelho para identificar a causa do problema.", mensagem: "" },
];

/* Estimativas usadas na calculadora de orçamento (modelo -> serviço -> valor) */
const ESTIMATIVAS = {
  "iPhone 11": { tela: 280, bateria: 180, conector: 150, software: 100, camera: 220, "alto-falante": 120, microfone: 120, "face-id": null, diagnostico: 40 },
  "iPhone 12": { tela: 300, bateria: 190, conector: 160, software: 110, camera: 240, "alto-falante": 130, microfone: 130, "face-id": null, diagnostico: 40 },
  "iPhone 13": { tela: 330, bateria: 210, conector: 170, software: 120, camera: 260, "alto-falante": 140, microfone: 140, "face-id": null, diagnostico: 40 },
  "iPhone 14": { tela: 360, bateria: 220, conector: 180, software: 120, camera: 280, "alto-falante": 150, microfone: 150, "face-id": null, diagnostico: 40 },
  "iPhone 15": { tela: 420, bateria: 240, conector: 190, software: 130, camera: 320, "alto-falante": 160, microfone: 160, "face-id": null, diagnostico: 40 },
  "iPhone 16": { tela: 490, bateria: 260, conector: 200, software: 140, camera: 360, "alto-falante": 170, microfone: 170, "face-id": null, diagnostico: 40 },
};

/* ---------------- ETAPAS DE ACOMPANHAMENTO (mock) ---------------- */
const ETAPAS_ASSISTENCIA = [
  "Solicitação recebida",
  "Em análise",
  "Em manutenção",
  "Aguardando peça",
  "Pronto para retirada",
  "Finalizado",
];
