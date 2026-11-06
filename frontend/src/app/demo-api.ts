import { HttpErrorResponse } from "@angular/common/http";
import { categories, Listing, User } from "./data";
import {
  createDemoState, DemoAccount, DemoConversation, DemoListing, DemoState, passwordHash,
} from "./demo-seed";

// Isola este projeto de outros sites publicados na mesma origem github.io.
const storageKey = "verdeperto.demo.v1:" + new URL(document.baseURI).pathname;
const sessionKey = storageKey + ":session";
let queue: Promise<unknown> = Promise.resolve();
type Params = Record<string, string | number>;
type Body = Record<string, unknown>;
const now = () => new Date().toISOString();
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1;
function fail(status: number, detail: string): never {
  throw new HttpErrorResponse({ status, error: { detail } });
}
function text(body: Body, key: string, min = 0, max = 3000) {
  const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
  if (value.length < min || value.length > max)
    fail(422, "Confira o campo “" + key + "” e tente novamente.");
  return value;
}
function number(body: Body, key: string, min: number, max: number) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    fail(422, "Informe um valor válido para “" + key + "”.");
  return value;
}
function choice(body: Body, key: string, values: string[]) {
  const value = text(body, key);
  if (!values.includes(value)) fail(422, "Escolha uma opção válida para “" + key + "”.");
  return value;
}
function publicUser(user: DemoAccount, privateProfile = false): User {
  const { id, name, bio, city, neighborhood, created_at, avatar_url } = user;
  return { id, name, bio, city, neighborhood, created_at, avatar_url,
    ...(privateProfile ? { email: user.email } : {}) };
}
function save(state: DemoState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    fail(507, "Não foi possível salvar no navegador. Libere espaço ou use uma foto menor. Seus dados anteriores foram preservados.");
  }
}
async function load(): Promise<DemoState> {
  let raw: string | null;
  try { raw = localStorage.getItem(storageKey); }
  catch { fail(507, "Permita o armazenamento deste site no navegador para usar a demonstração."); }
  if (!raw) {
    const state = await createDemoState();
    save(state);
    return state;
  }
  try {
    const state: DemoState = JSON.parse(raw);
    if (state.version !== 1 || !Array.isArray(state.users) || !Array.isArray(state.listings)
      || !Array.isArray(state.messages) || !Array.isArray(state.conversations) || !Array.isArray(state.favorites)) throw Error();
    return state;
  } catch {
    fail(500, "Os dados desta demonstração não puderam ser lidos. Use “Recomeçar demonstração” para restaurar os exemplos.");
  }
}

class DemoRequest {
  changed = false;
  session: number | null | undefined;
  constructor(private state: DemoState) {}
  private user() {
    let id: number;
    try { id = Number(sessionStorage.getItem(sessionKey)); }
    catch { fail(507, "Permita o armazenamento deste site para entrar na demonstração."); }
    const user = this.state.users.find((u) => u.id === id);
    if (!user) fail(401, "Entre na sua conta para continuar.");
    return user;
  }
  private listing(id: number, owner = false) {
    const listing = this.state.listings.find((l) => l.id === id && !l.deleted);
    if (!listing) fail(404, "Oferta não encontrada.");
    if (owner && listing.owner_id !== this.user().id)
      fail(403, "Você só pode alterar suas próprias ofertas.");
    return listing;
  }
  private listingData(listing: DemoListing, params: Params = {}): Listing {
    const { deleted, ...fields } = listing;
    let distance_km: number | null = null;
    if (params["lat"] !== undefined && params["lng"] !== undefined) {
      const radians = Math.PI / 180, lat = Number(params["lat"]), lng = Number(params["lng"]);
      const a = Math.sin((listing.public_latitude - lat) * radians / 2) ** 2
        + Math.cos(lat * radians) * Math.cos(listing.public_latitude * radians)
        * Math.sin((listing.public_longitude - lng) * radians / 2) ** 2;
      distance_km = Math.round(6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 10) / 10;
    }
    return { ...fields, owner: publicUser(this.state.users.find((u) => u.id === listing.owner_id)!), distance_km };
  }
  private search(params: Params) {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const query = normalize(String(params["q"] ?? ""));
    const rows = this.state.listings.filter((l) => !l.deleted
      && (!query || normalize(l.title).includes(query))
      && (!params["category"] || l.category === params["category"])
      && (!params["offer_type"] || l.offer_type === params["offer_type"])
      && (!params["city"] || l.city === params["city"])
      && (!params["owner_id"] || l.owner_id === Number(params["owner_id"]))
      && (!(params["status"] ?? "available") || l.status === (params["status"] ?? "available")))
      .map((l) => this.listingData(l, params));
    rows.sort((a, b) => params["sort"] === "nearest" && a.distance_km !== null && b.distance_km !== null
      ? a.distance_km - b.distance_km || b.id - a.id
      : b.created_at.localeCompare(a.created_at) || b.id - a.id);
    const page = Math.max(1, Number(params["page"]) || 1);
    const page_size = Math.min(100, Math.max(1, Number(params["page_size"]) || 12));
    return { items: rows.slice((page - 1) * page_size, page * page_size), total: rows.length, page, page_size };
  }
  private listingInput(body: Body) {
    const quantity = number(body, "quantity", 0, 1000000);
    const offer_type = choice(body, "offer_type", ["donation", "exchange", "sale"]);
    const price = offer_type === "sale" ? number(body, "price", 0.01, 1000000) : null;
    const image_url = body["image_url"] ? text(body, "image_url", 1, 1000000) : null;
    if (image_url && !/^assets\/[a-z0-9-]+\.(jpg|svg)$/.test(image_url)
      && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image_url))
      fail(422, "Escolha uma foto pelo formulário.");
    return {
      title: text(body, "title", 3, 100), description: text(body, "description", 10, 3000),
      category: choice(body, "category", categories.map((c) => c.id)), quantity,
      unit: choice(body, "unit", ["unidades", "kg", "g", "maços", "mudas", "pacotes", "litros"]),
      offer_type, price, exchange_for: text(body, "exchange_for", 0, 200), image_url,
      city: text(body, "city", 2, 80), neighborhood: text(body, "neighborhood", 2, 80),
      public_latitude: Math.round(number(body, "public_latitude", -90, 90) * 100) / 100,
      public_longitude: Math.round(number(body, "public_longitude", -180, 180) * 100) / 100,
      status: quantity === 0 ? "completed" : choice(body, "status", ["available", "reserved", "unavailable", "completed"]),
    };
  }
  private conversation(id: number) {
    const user = this.user();
    const conversation = this.state.conversations.find((c) => c.id === id && [c.owner_id, c.interested_id].includes(user.id));
    if (!conversation) fail(404, "Conversa não encontrada.");
    return conversation;
  }
  private conversationData(conversation: DemoConversation) {
    const user = this.user();
    const listing = this.state.listings.find((l) => l.id === conversation.listing_id)!;
    const last = this.state.messages.filter((m) => m.conversation_id === conversation.id).at(-1);
    return {
      id: conversation.id, listing_id: listing.id, listing_title: listing.title,
      listing_image: listing.image_url, listing_deleted: !!listing.deleted,
      participant: publicUser(this.state.users.find((u) => u.id === (user.id === conversation.owner_id ? conversation.interested_id : conversation.owner_id))!),
      last_message: last?.content ?? "Comece a conversa e combine a retirada.",
      updated_at: last?.created_at ?? conversation.created_at,
    };
  }
  async run(method: string, path: string, body: Body, params: Params): Promise<unknown> {
    if (method === "GET") {
      if (path === "/auth/me" || path === "/users/me") return publicUser(this.user(), true);
      if (path === "/listings") return this.search(params);
      if (path === "/map/listings") return this.search({ ...params, status: "available", sort: "nearest", page_size: 100 });
      if (path === "/users/me/listings") return this.state.listings.filter((l) => !l.deleted && l.owner_id === this.user().id).reverse().map((l) => this.listingData(l));
      if (path === "/favorites") {
        const user = this.user();
        return this.state.favorites.filter((f) => f.user_id === user.id)
          .map((f) => this.state.listings.find((l) => l.id === f.listing_id && !l.deleted))
          .filter((l): l is DemoListing => !!l).map((l) => this.listingData(l));
      }
      if (path === "/conversations") {
        const user = this.user();
        return this.state.conversations.filter((c) => [c.owner_id, c.interested_id].includes(user.id))
          .map((c) => this.conversationData(c)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      }
      const messages = path.match(/^\/conversations\/(\d+)\/messages$/);
      if (messages) {
        const conversation = this.conversation(Number(messages[1]));
        return { conversation: this.conversationData(conversation), items: this.state.messages
          .filter((m) => m.conversation_id === conversation.id && m.id > Number(params["after"] ?? 0)) };
      }
      const detail = path.match(/^\/listings\/(\d+)$/);
      if (detail) return this.listingData(this.listing(Number(detail[1])));
      const profile = path.match(/^\/users\/(\d+)$/);
      if (profile) {
        const user = this.state.users.find((u) => u.id === Number(profile[1]));
        if (!user) fail(404, "Perfil não encontrado.");
        return publicUser(user);
      }
      if (path === "/stats") {
        const listings = this.state.listings.filter((l) => !l.deleted);
        return { members: this.state.users.length, available: listings.filter((l) => l.status === "available").length,
          completed: listings.filter((l) => l.status === "completed").length,
          donations: listings.filter((l) => l.offer_type === "donation").length, demo: true };
      }
      if (path === "/community-points") return [];
    }
    if (method === "POST" && path === "/auth/register") {
      const email = text(body, "email", 3, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, "Informe um e-mail válido.");
      if (this.state.users.some((u) => u.email === email)) fail(409, "Este e-mail já tem uma conta nesta demonstração.");
      const password = text(body, "password", 8, 128), salt = crypto.randomUUID();
      const user: DemoAccount = {
        id: nextId(this.state.users), email, name: text(body, "name", 2, 80), bio: "",
        city: text(body, "city", 2, 80), neighborhood: text(body, "neighborhood", 2, 80), created_at: now(),
        password_salt: salt, password_hash: await passwordHash(password, salt),
      };
      this.state.users.push(user); this.changed = true; this.session = user.id;
      return publicUser(user, true);
    }
    if (method === "POST" && path === "/auth/login") {
      const email = text(body, "email", 3, 254).toLowerCase();
      const user = this.state.users.find((u) => u.email === email);
      if (!user || await passwordHash(text(body, "password", 1, 128), user.password_salt) !== user.password_hash)
        fail(401, "E-mail ou senha incorretos.");
      this.session = user.id;
      return publicUser(user, true);
    }
    if (method === "POST" && path === "/auth/logout") { this.session = null; return null; }
    if (method === "PATCH" && path === "/users/me") {
      const user = this.user();
      Object.assign(user, { name: text(body, "name", 2, 80), bio: text(body, "bio", 0, 500),
        city: text(body, "city", 2, 80), neighborhood: text(body, "neighborhood", 2, 80) });
      this.changed = true;
      return publicUser(user, true);
    }
    if (method === "POST" && path === "/users/me/password") {
      const user = this.user();
      if (await passwordHash(text(body, "current_password", 1, 128), user.password_salt) !== user.password_hash)
        fail(400, "A senha atual está incorreta.");
      const salt = crypto.randomUUID();
      user.password_hash = await passwordHash(text(body, "new_password", 8, 128), salt);
      user.password_salt = salt; this.changed = true;
      return null;
    }
    if (method === "POST" && path === "/listings") {
      const user = this.user();
      const listing = { ...this.listingInput(body), id: nextId(this.state.listings), owner_id: user.id, created_at: now() };
      this.state.listings.push(listing); this.changed = true;
      return this.listingData(listing);
    }
    const availability = path.match(/^\/listings\/(\d+)\/availability$/);
    if (method === "PATCH" && availability) {
      const listing = this.listing(Number(availability[1]), true);
      const quantity = number(body, "quantity", 0, 1000000);
      listing.quantity = quantity;
      listing.status = quantity === 0 ? "completed" : choice(body, "status", ["available", "reserved", "unavailable", "completed"]);
      this.changed = true;
      return this.listingData(listing);
    }
    const detail = path.match(/^\/listings\/(\d+)$/);
    if (detail && ["PATCH", "DELETE"].includes(method)) {
      const listing = this.listing(Number(detail[1]), true);
      if (method === "PATCH") Object.assign(listing, this.listingInput(body));
      else listing.deleted = true;
      this.changed = true;
      return method === "PATCH" ? this.listingData(listing) : null;
    }
    const favorite = path.match(/^\/favorites\/(\d+)$/);
    if (favorite && ["POST", "DELETE"].includes(method)) {
      const user = this.user(), id = Number(favorite[1]);
      this.listing(id);
      this.state.favorites = this.state.favorites.filter((f) => !(f.user_id === user.id && f.listing_id === id));
      if (method === "POST") this.state.favorites.push({ user_id: user.id, listing_id: id });
      this.changed = true;
      return null;
    }
    if (method === "POST" && path === "/conversations") {
      const user = this.user(), listing = this.listing(number(body, "listing_id", 1, Number.MAX_SAFE_INTEGER));
      if (listing.owner_id === user.id) fail(400, "Você não pode iniciar uma conversa no seu próprio anúncio.");
      let conversation = this.state.conversations.find((c) => c.listing_id === listing.id && c.interested_id === user.id);
      if (!conversation) {
        if (!["available", "reserved"].includes(listing.status)) fail(409, "Esta oferta já foi encerrada.");
        conversation = { id: nextId(this.state.conversations), listing_id: listing.id, owner_id: listing.owner_id,
          interested_id: user.id, created_at: now() };
        this.state.conversations.push(conversation); this.changed = true;
      }
      return this.conversationData(conversation);
    }
    const messages = path.match(/^\/conversations\/(\d+)\/messages$/);
    if (method === "POST" && messages) {
      const conversation = this.conversation(Number(messages[1])), user = this.user();
      const message = { id: nextId(this.state.messages), conversation_id: conversation.id,
        sender_id: user.id, content: text(body, "content", 1, 2000), created_at: now() };
      this.state.messages.push(message);
      this.state.messages.push({ id: message.id + 1, conversation_id: conversation.id,
        sender_id: user.id === conversation.owner_id ? conversation.interested_id : conversation.owner_id,
        content: "Combinado! Podemos acertar a quantidade e a retirada em um ponto público do bairro por aqui.",
        simulated: true, created_at: now() });
      this.changed = true;
      return message;
    }
    fail(404, "Este recurso não está disponível na demonstração.");
  }
  async upload(body: unknown) {
    this.user();
    const file = body instanceof FormData ? body.get("file") : null;
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      fail(422, "Escolha uma imagem JPG, PNG ou WebP.");
    if (file.size > 5 * 1024 * 1024) fail(413, "A imagem deve ter até 5 MB.");
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { fail(422, "Não foi possível abrir essa imagem. Escolha outra foto."); }
    try {
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d")!;
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.75);
      if (url.length > 700000) fail(413, "Escolha uma foto menor para caber no armazenamento da demonstração.");
      return { url };
    } finally { bitmap.close(); }
  }
}

export function demoRequest<T>(method: string, path: string, body: unknown = {}, params: Params = {}): Promise<T> {
  const result = queue.then(async () => {
    const state = await load(), request = new DemoRequest(state);
    const response = method === "POST" && path === "/uploads"
      ? await request.upload(body) : await request.run(method, path, body as Body, params);
    if (request.changed) save(state);
    if (request.session !== undefined) {
      try {
        if (request.session === null) sessionStorage.removeItem(sessionKey);
        else sessionStorage.setItem(sessionKey, String(request.session));
      } catch { fail(507, "Permita o armazenamento deste site para entrar na demonstração."); }
    }
    return structuredClone(response) as T;
  });
  queue = result.catch(() => {});
  return result;
}

export async function resetDemo() {
  await queue;
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(sessionKey);
}
