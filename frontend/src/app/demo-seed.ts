import { Listing, Message, User } from "./data";

export interface DemoAccount extends User {
  email: string;
  password_salt: string;
  password_hash: string;
}
export type DemoListing = Omit<Listing, "owner" | "distance_km"> & {
  deleted?: boolean;
};
export interface DemoConversation {
  id: number;
  listing_id: number;
  owner_id: number;
  interested_id: number;
  created_at: string;
}
export interface DemoState {
  version: 1;
  users: DemoAccount[];
  listings: DemoListing[];
  favorites: { user_id: number; listing_id: number }[];
  conversations: DemoConversation[];
  messages: (Message & { conversation_id: number })[];
}

// Autenticação apenas demonstrativa; os dados continuam acessíveis no navegador.
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key, 256,
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createDemoState(): Promise<DemoState> {
  const created_at = "2026-10-01T12:00:00.000Z";
  const people = [
    ["Ana Oliveira", "ana@verdeperto.example", "Eldorado"],
    ["João Santos", "joao@verdeperto.example", "Riacho das Pedras"],
    ["Maria Costa", "maria@verdeperto.example", "Centro"],
  ];
  const salt = crypto.randomUUID();
  const hash = await passwordHash("DemoVerde123!", salt);
  const users: DemoAccount[] = people.map(([name, email, neighborhood], i) => ({
    id: i + 1, name, email, neighborhood, city: "Contagem", created_at,
    bio: "Perfil fictício de demonstração. Cultivar e compartilhar faz parte do meu dia.",
    password_salt: salt, password_hash: hash,
  }));
  const examples = [
    { title: "Limões fresquinhos do quintal", category: "fruits", quantity: 20, unit: "unidades", offer_type: "donation", image: "lemons.jpg", neighborhood: "Eldorado", lat: -19.94, lng: -44.04 },
    { title: "Mudas de manjericão", category: "plants", quantity: 6, unit: "mudas", offer_type: "exchange", image: "herbs.jpg", neighborhood: "Riacho das Pedras", lat: -19.96, lng: -44.05, exchange_for: "Sementes ou outras ervas para minha horta" },
    { title: "Tomates colhidos hoje", category: "vegetables", quantity: 3, unit: "kg", offer_type: "sale", price: 8.5, image: "tomatoes.jpg", neighborhood: "Centro", lat: -19.93, lng: -44.08 },
    { title: "Uma cesta de folhas verdes", category: "greens", quantity: 4, unit: "maços", offer_type: "donation", image: "greens.jpg", neighborhood: "Industrial", lat: -19.96, lng: -44.03 },
    { title: "Alecrim para sua horta", category: "herbs", quantity: 8, unit: "mudas", offer_type: "exchange", image: "herbs.jpg", neighborhood: "Eldorado", lat: -19.94, lng: -44.04, exchange_for: "Mudas de hortelã ou cebolinha" },
    { title: "Laranjas do nosso pomar", category: "fruits", quantity: 5, unit: "kg", offer_type: "donation", image: "oranges.jpg", neighborhood: "Centro", lat: -19.93, lng: -44.08 },
    { title: "Sementes de girassol", category: "seeds", quantity: 3, unit: "pacotes", offer_type: "exchange", image: "garden.jpg", neighborhood: "Eldorado", lat: -19.94, lng: -44.04, status: "reserved", exchange_for: "Sementes de flores" },
    { title: "Hortaliças compartilhadas", category: "greens", quantity: 0, unit: "maços", offer_type: "donation", image: "greens.jpg", neighborhood: "Riacho das Pedras", lat: -19.96, lng: -44.05, status: "completed" },
    { title: "Muda de limoeiro", category: "plants", quantity: 1, unit: "mudas", offer_type: "sale", price: 25, image: "garden.jpg", neighborhood: "Centro", lat: -19.93, lng: -44.08, status: "unavailable" },
  ];
  return {
    version: 1, users,
    listings: examples.map((e, i) => ({
      id: i + 1, owner_id: (i % 3) + 1, title: e.title, category: e.category,
      quantity: e.quantity, unit: e.unit, offer_type: e.offer_type,
      price: e.price ?? null, exchange_for: e.exchange_for ?? "",
      image_url: "assets/" + e.image, city: "Contagem", neighborhood: e.neighborhood,
      public_latitude: e.lat, public_longitude: e.lng, status: e.status ?? "available",
      created_at: new Date(Date.parse(created_at) + i * 60000).toISOString(),
      description: "Oferta fictícia para demonstração acadêmica do VerdePerto. Produto de cultivo local; combine os detalhes e a retirada pelo chat. A localização representa apenas a região aproximada.",
    })),
    favorites: [{ user_id: 2, listing_id: 2 }],
    conversations: [{ id: 1, listing_id: 1, owner_id: 1, interested_id: 2, created_at }],
    messages: [
      { id: 1, conversation_id: 1, sender_id: 2, content: "Olá, Ana! Ainda tem limões disponíveis? Gostaria de buscar alguns.", created_at },
      { id: 2, conversation_id: 1, sender_id: 1, content: "Olá! Tem sim. Podemos combinar a retirada em um ponto público do bairro.", created_at },
    ],
  };
}
