# Verificação da entrega

Verificação local em 24/10/2026, Linux, Node.js 26.10 e Python 3.14.

| Verificação | Resultado |
|---|---|
| pytest da API | 13 testes aprovados |
| Playwright | 3 testes aprovados, incluindo jornadas entre duas contas |
| Build Angular de produção | Aprovado; carregamento das telas por rota |
| npm audit após ajuste do Vite | 0 vulnerabilidades conhecidas |
| Seed executado duas vezes | Sem duplicação: 3 usuários, 9 ofertas, 1 conversa, 2 mensagens e 1 favorito |
| `bash scripts/dev.sh --seed` | Preparou ambiente e dados |
| `bash scripts/dev.sh` | Iniciou API e Angular; Ctrl+C encerrou os serviços |
| Modelo PostgreSQL | DDL de tabelas e índices compilado pelo SQLAlchemy |
| Revisão visual | Desktop 1440 px e celular 390 px, com correções de contraste e tipografia conferidas |
| Git | Configurações pessoais, arquivos de IA, banco, uploads, segredos e builds ignorados |

Os testes da API usam um banco temporário separado. Os testes de navegador usam a instância local, criam dados fictícios e excluem as ofertas ao terminar. Os registros gerados durante esta verificação foram removidos; o seed original foi preservado.

As capturas em `docs/screenshots/` vêm da aplicação executada, com dados fictícios identificados. Os tiles reais do OpenStreetMap foram carregados antes da captura do mapa.

## Limites

- Não houve deploy público nem criação de contas externas.
- PostgreSQL remoto e Supabase Storage com credenciais reais não foram exercitados. Compilar DDL não equivale a testar conexão ou persistência remota.
- O script PowerShell não foi executado, pois este ambiente não dispõe de PowerShell.
- O build informa que Leaflet usa CommonJS; a compilação é concluída. Há um aviso de descontinuação de uma dependência do cliente de testes Python, sem falha nos testes.
- Avaliações, denúncias e curadoria de pontos comunitários permanecem fora do MVP.
