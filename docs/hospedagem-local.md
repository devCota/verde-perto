# VerdePerto no próprio computador

Este modo serve o frontend compilado e a API pelo computador Linux do responsável. Não transfere o banco para uma hospedagem externa: SQLite e uploads permanecem em `backend/`. Para acesso pela internet, o tráfego HTTPS passa por um **Cloudflare Quick Tunnel**, sem conta ou domínio próprio. Qualquer pessoa com o link pode abrir páginas, ofertas e fotos públicas e se cadastrar; autenticação continua obrigatória para áreas privadas.

O gerenciador está preparado no repositório. A configuração só fica ativa quando o responsável executa a instalação abaixo. Não há ativação automática ao clonar o código, rodar testes ou iniciar o desenvolvimento.

## Apresentação temporária, sem serviços permanentes

Na raiz do projeto Linux:

```bash
python3 scripts/hosting.py present
```

O comando baixa o conector oficial verificado, compila a interface e inicia o site junto de um túnel público. Não executa seed nem substitui o banco. Use o link HTTPS mostrado na saída para acessar pela internet, inclusive na faculdade. Deixe o processo ativo; `Ctrl+C` encerra tudo. O link atual também fica em `.local-hosting/presentation-url.txt`.

Para impedir suspensão automática enquanto a apresentação roda, sem mudar as configurações globais de energia:

```bash
systemd-inhibit --what=sleep --mode=block --who=VerdePerto --why="Apresentação do VerdePerto" python3 scripts/hosting.py present
```

Se precisar deixar a execução independente do terminal/chat, use um serviço **temporário**, removido quando encerrado:

```bash
systemd-run --user --unit=verdeperto-apresentacao --collect --working-directory="$PWD" /usr/bin/systemd-inhibit --what=sleep --mode=block --who=VerdePerto --why="Apresentação do VerdePerto" /usr/bin/python3 "$PWD/scripts/hosting.py" present
cat .local-hosting/presentation-url.txt
```

Nesse caso, pare com `systemctl --user stop verdeperto-apresentacao`. A execução não é habilitada para iniciar após reboot. O desktop deve continuar ligado, com internet e com sua sessão Linux ativa (pode bloquear a tela). O bloqueio de suspensão vale somente enquanto o processo roda.

## Instalar e ativar no Linux

Requisitos: Python/Node/npm do README, systemd de usuário e acesso à internet para baixar o conector oficial. Encerre `dev.sh` antes, pois a porta 8000 será usada pela hospedagem.

Na raiz do projeto:

```bash
python3 scripts/hosting.py install
```

Esse comando:

1. Baixa `cloudflared` do repositório oficial `cloudflare/cloudflared`, verificando o SHA-256 da release. O executável fica em `.local-hosting/bin/`, ignorado pelo Git.
2. Compila o Angular. Não executa seed, nem redefine usuários, banco ou fotos.
3. Instala `verdeperto.service` e `verdeperto-tunnel.service` em `~/.config/systemd/user/`.
4. Inicia a API e os arquivos compilados em `127.0.0.1:8000`, acessíveis externamente pelo túnel HTTPS. A porta não é aberta no roteador.
5. Mostra uma URL real `https://….trycloudflare.com`. O site completo usa esse mesmo domínio, inclusive API, cookies e imagens.

O modo `local-hosting` usa cookies HttpOnly/Secure/SameSite e mantém a validação de origem nas escritas. A API aceita cabeçalhos de proxy somente do endereço de loopback. Documentação interativa da API não é publicada nesse modo; apenas o build do Angular é servido, sem `.env`, código do backend ou diretório Git.

## Ver o link, iniciar e parar

```bash
python3 scripts/hosting.py status
python3 scripts/hosting.py start
python3 scripts/hosting.py stop
```

O status procura a URL somente na execução atual do túnel; não usa um endereço antigo salvo no Git. Os serviços rodam em segundo plano e não dependem do terminal aberto. Ficam habilitados para iniciar ao entrar na conta Linux. Sem configuração adicional de linger do sistema, não há promessa de funcionamento antes do login ou depois de encerrar todas as sessões.

O computador precisa permanecer ligado, conectado e **sem suspender**. Este gerenciador não altera as configurações globais de energia ou de login do computador. Bloquear a tela é diferente de suspender.

O endereço Quick Tunnel muda quando o processo do túnel é reiniciado, inclusive após reiniciar o computador. Uma queda temporária da conexão pode ser recuperada pelo próprio conector; consulte `status` quando voltar. Para URL fixa e disponibilidade contínua, será necessário configurar um túnel nomeado com domínio/conta, ou escolher hospedagem externa.

## Atualizar código

Depois de revisar/obter as alterações no repositório:

```bash
python3 scripts/hosting.py update
```

O frontend é recompilado e a API reiniciada. Confira o endereço pelo status. Antes de alterações no esquema do banco, faça backup de `backend/verdeperto.db` e `backend/uploads/`; a rotina não migra tabelas existentes.

## Diagnóstico

```bash
journalctl --user -u verdeperto.service -n 50 --no-pager
journalctl --user -u verdeperto-tunnel.service -n 50 --no-pager
```

O endpoint `/api/health` deve responder com `service: VerdePerto`. Os logs do túnel contêm o endereço público, mas não são incluídos no Git. Se o serviço estiver parado, `status` não apresenta URL como ativa.

Para conferir o site, abra a URL no celular usando dados móveis, faça login, abra uma oferta e o mapa, e teste uma conversa entre contas autorizadas. Cada navegador guarda seu cookie de sessão; o banco das ofertas e conversas é compartilhado no computador servidor.

## Remover os serviços

```bash
python3 scripts/hosting.py uninstall
```

Isso para e desabilita os serviços e remove suas unidades systemd. Código, banco e imagens são preservados. O binário baixado em `.local-hosting/bin/` pode ser removido depois se não for mais necessário.

## Condições do túnel

Quick Tunnels são destinados a testes/apresentações, sem garantia de disponibilidade. O link deixa de funcionar quando o túnel para; o hostname muda em uma nova execução. Há limite de 200 requisições simultâneas e não há suporte a SSE. O chat do VerdePerto usa polling, portanto não depende de SSE. Condições verificadas em 27/10/2026 na [documentação oficial do Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
