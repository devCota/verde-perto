# Modelo de dados

```mermaid
erDiagram
  User ||--o{ Listing : publica
  User ||--o{ Session : autentica
  User ||--o{ Favorite : salva
  Listing ||--o{ Favorite : recebe
  Listing ||--o{ Conversation : contextualiza
  User ||--o{ Conversation : participa
  Conversation ||--o{ Message : contem
  User ||--o{ Message : envia
  User { int id PK string name string email UK string password_hash string city string neighborhood }
  Session { int id PK int user_id FK string token_hash UK datetime expires_at }
  Listing { int id PK int owner_id FK string title string category float quantity string offer_type float price float public_latitude float public_longitude string status datetime deleted_at }
  Favorite { int id PK int user_id FK int listing_id FK }
  Conversation { int id PK int listing_id FK int owner_id FK int interested_id FK }
  Message { int id PK int conversation_id FK int sender_id FK string content datetime created_at }
  CommunityPoint { int id PK string name UK string category float public_latitude float public_longitude }
```

Favoritos são únicos por usuário e anúncio. Conversas são únicas por anúncio e interessado; o anunciante é determinado pelo anúncio. Quantidade e preço não podem ser negativos. E-mail e hash do token são únicos. Há índices nos filtros e relacionamentos mais usados.

Anúncios são excluídos logicamente: deixam as listagens e os favoritos, mas as conversas conservam seu contexto. As coordenadas públicas são as únicas coordenadas do anúncio; não existe coluna com endereço ou coordenada residencial precisa.

SQLite: `backend/verdeperto.db`. PostgreSQL: configurar `DATABASE_URL`. O seed não é uma migração e não deve ser usado para atualizar esquemas.
