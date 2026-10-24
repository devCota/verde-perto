# Requisitos e estado

| ID | Requisito | Implementação |
|---|---|---|
| RF01 | Cadastro, login, logout e recuperação de sessão | API e telas com cookie HttpOnly |
| RF02 | Perfil público e edição do próprio perfil | Nome, avatar por inicial, bio e região |
| RF03 | Publicar, editar e excluir ofertas | Controle de proprietário no backend |
| RF04 | Doação, troca e venda | Campos condicionais; preço obrigatório para venda |
| RF05 | Atualizar disponibilidade e quantidade | Disponível, reservado, indisponível e concluído; zero conclui |
| RF06 | Buscar, filtrar e paginar | Categoria, modalidade, status, nome e proximidade |
| RF07 | Explorar no mapa | Marcadores e links; escolha de região ou geolocalização |
| RF08 | Chat persistente | Apenas participantes, sem conversas duplicadas |
| RF09 | Favoritos persistentes | Adição idempotente e remoção |
| RF10 | Imagens | Upload validado e reencodificado sem EXIF |
| RF11 | Demonstração | Seed explícito e idempotente |
| RF12 | Indicadores | Contagens reais do banco, sem métricas ambientais inventadas |

## Não funcionais

- Interface em português, responsiva, com foco visível, labels e navegação por teclado.
- Senhas Argon2; sessões expiram e são revogadas ao sair ou alterar senha.
- Recursos pessoais exigem sessão; dados públicos usam listas explícitas de campos.
- Apenas coordenadas arredondadas a duas casas decimais são armazenadas; localização exata não é persistida.
- Dados locais de IA, `.env`, banco, uploads e dependências ficam fora do Git.
- Execução sem dependência de ferramentas de IA.

## Fora do MVP

Avaliações, denúncias, cadastro e curadoria de pontos comunitários, notificações, recuperação de senha por e-mail e pagamentos integrados. Existe a entidade e a leitura de pontos comunitários; não há pontos fictícios apresentados como locais reais.
