# Casos de uso

| Ator | Caso | Resultado |
|---|---|---|
| Visitante | Explorar ofertas e filtros | Lista paginada de produtos disponíveis |
| Visitante | Selecionar região no mapa | Descobrir oferta por área aproximada |
| Visitante | Criar conta | Perfil e sessão autenticada |
| Participante | Publicar oferta | Anúncio persistido com modalidade e região |
| Participante | Salvar favorito | Oferta acessível na coleção pessoal |
| Interessado | Iniciar conversa | Conversa única associada à oferta |
| Anunciante/interessado | Trocar mensagens | Histórico restrito aos dois participantes |
| Anunciante | Atualizar quantidade e status | Comunidade vê disponibilidade atualizada |
| Anunciante | Excluir oferta | Oferta removida da descoberta, conversa preservada |
| Participante | Editar perfil/senha | Apenas os próprios dados são alterados |

## Exceções principais

Uma pessoa não pode conversar consigo mesma, editar anúncio alheio ou ler conversa de terceiros. Oferta encerrada não aceita nova conversa. Falha de rede apresenta mensagem e permite tentar novamente. Geolocalização negada mantém a seleção manual disponível. Dados inválidos retornam erro de validação; a API não depende do bloqueio do botão.
