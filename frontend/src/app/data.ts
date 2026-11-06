export interface User {
  id: number;
  name: string;
  email?: string;
  bio: string;
  city: string;
  neighborhood: string;
  avatar_url?: string;
  created_at: string;
}
export interface Listing {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  offer_type: string;
  price: number | null;
  exchange_for: string;
  image_url: string | null;
  city: string;
  neighborhood: string;
  public_latitude: number;
  public_longitude: number;
  status: string;
  created_at: string;
  owner: User;
  distance_km: number | null;
}
export interface Page {
  items: Listing[];
  total: number;
  page: number;
  page_size: number;
}
export interface Conversation {
  id: number;
  listing_id: number;
  listing_title: string;
  listing_image: string;
  listing_deleted: boolean;
  participant: User;
  last_message: string;
  updated_at: string;
}
export interface Message {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
  simulated?: boolean;
}
export const categories = [
  { id: "fruits", name: "Frutas", icon: "apple" },
  { id: "vegetables", name: "Verduras e legumes", icon: "carrot" },
  { id: "greens", name: "Hortaliças", icon: "salad" },
  { id: "herbs", name: "Ervas e temperos", icon: "sprout" },
  { id: "plants", name: "Mudas e plantas", icon: "flower-2" },
  { id: "seeds", name: "Sementes", icon: "bean" },
  { id: "other", name: "Outros cultivos", icon: "leaf" },
];
export const offerNames: Record<string, string> = {
  donation: "Doação",
  exchange: "Troca",
  sale: "Venda",
};
export const statusNames: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  unavailable: "Indisponível",
  completed: "Concluído",
};
export const regions = [
  {
    name: "Eldorado · Contagem",
    city: "Contagem",
    neighborhood: "Eldorado",
    lat: -19.94,
    lng: -44.04,
  },
  {
    name: "Centro · Contagem",
    city: "Contagem",
    neighborhood: "Centro",
    lat: -19.93,
    lng: -44.08,
  },
  {
    name: "Riacho · Contagem",
    city: "Contagem",
    neighborhood: "Riacho das Pedras",
    lat: -19.96,
    lng: -44.05,
  },
  {
    name: "Industrial · Contagem",
    city: "Contagem",
    neighborhood: "Industrial",
    lat: -19.96,
    lng: -44.03,
  },
  {
    name: "Belo Horizonte · Centro",
    city: "Belo Horizonte",
    neighborhood: "Centro",
    lat: -19.92,
    lng: -43.94,
  },
];
