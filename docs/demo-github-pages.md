# Demonstração do VerdePerto no GitHub Pages

Este modo é uma demonstração interativa para avaliação acadêmica. Todo o fluxo
roda no navegador: cadastro, login de teste, perfil, ofertas de doação/troca/venda,
fotos, edição, exclusão, disponibilidade, busca, filtros, mapa, favoritos e chat
simulado. Não precisa de Python, banco hospedado ou computador ligado depois da
publicação. A versão completa com FastAPI continua disponível separadamente.

## Experimentar no computador

Com Node e npm instalados, a partir da raiz do repositório:

```bash
cd frontend
npm ci
npm run start:demo
```

Abra **http://localhost:4300**. O comando inicia somente a interface, sem a API.
Use **Usar conta de teste** no aviso superior e escolha Ana, João ou Maria. Para
criar uma conta nova, clique em **Cadastre-se** e use informações fictícias.

As três contas iniciais também aceitam login pelo formulário:

| Conta | E-mail | Senha de teste |
|---|---|---|
| Ana Oliveira | `ana@verdeperto.example` | `DemoVerde123!` |
| João Santos | `joao@verdeperto.example` | `DemoVerde123!` |
| Maria Costa | `maria@verdeperto.example` | `DemoVerde123!` |

Se alterar a senha de uma dessas contas, o botão rápido dela deixará de entrar
até restaurar os exemplos; a nova senha funciona pelo formulário normal.

## Publicar uma vez no GitHub

1. No repositório, abra **Settings → Pages**. Em **Build and deployment → Source**,
   selecione **GitHub Actions**. No GitHub Free, o repositório precisa ser público.
2. Envie as alterações, incluindo `.github/workflows/demo-pages.yml`, para a
   branch `main` no GitHub. O workflow já está na pasta correta; não é necessário
   copiar modelos nem escolher Jekyll ou Static HTML.
3. A publicação começa automaticamente ao enviar alterações da interface ou do
   workflow para `main`. Acompanhe em **Actions → Publicar demonstração do VerdePerto**.
   Também é possível iniciar por **Run workflow**, escolhendo `main`. O GitHub
   instala as dependências, compila, testa e publica apenas `frontend/dist/demo/browser`.
4. Aguarde a execução terminar com sucesso e copie o endereço mostrado no job
   `deploy` ou em **Settings → Pages → Visit site**.

Com o repositório `devCota/verde-perto`, o endereço esperado após publicar é
`https://devcota.github.io/verde-perto/`. A preparação local não confirma uma
publicação: confira o link gerado pelo GitHub antes de enviá-lo ao professor.

O endereço permanece disponível sem o seu computador ligado. Para atualizar,
envie as alterações da interface para `main`: o workflow publica a nova versão
automaticamente. Alterações somente em documentação não disparam a publicação.

Referências: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
e [publicação com workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## O que é simulado

- **Dados locais:** `localStorage` guarda os exemplos e as alterações neste
  navegador e neste endereço do site. Cada visitante começa com os mesmos
  exemplos, mas não recebe os anúncios ou alterações de outra pessoa. A publicação
  contém somente dados fictícios definidos no código; banco, `.env`, fotos locais
  do backend e cadastros reais não são copiados para o build.
- **Sessão de teste:** `sessionStorage` mantém a conta ativa por aba, inclusive ao
  recarregar. Não é autenticação de produção nem controle de acesso seguro; todos
  os dados da demonstração pertencem ao navegador. Use somente e-mails, nomes e
  senhas fictícios. As senhas de teste são derivadas com PBKDF2 e salt, sem armazenar
  a senha em texto puro, mas isso não transforma um site estático em servidor seguro.
- **Chat:** a mensagem fica salva localmente e recebe uma resposta automática
  identificada como **Resposta simulada**. Nenhuma mensagem chega a pessoas reais.
  **Trocar conta** permite ver a mesma conversa como outro participante na mesma
  instalação da demonstração.
- **Fotos:** escolha JPG, PNG ou WebP de até 5 MB. A imagem é reduzida, reencodificada
  em JPEG sem os metadados originais e salva com o anúncio no navegador. Existe
  limite de espaço do navegador; uma falha de gravação informa o problema e preserva
  os dados anteriores. Não há upload a um servidor.
- **Mapa:** os marcadores vêm dos dados de demonstração. O fundo do mapa usa
  OpenStreetMap e precisa de internet. A localização é opcional e aproximada; a
  escolha manual de região continua disponível.
- **Recomeçar:** o botão **Recomeçar demonstração** pede confirmação, remove apenas
  os dados deste projeto, encerra a sessão da aba e restaura os exemplos. Limpar
  os dados do site no navegador também remove suas alterações. Outros sites na
  mesma origem do GitHub Pages não são apagados.

Navegação por hash (`#/explorar`, `#/ofertas/1`) permite abrir e recarregar qualquer
tela no GitHub Pages sem um servidor de rotas.

## Build e verificação

Na pasta `frontend`:

```bash
npm run build:demo
npx playwright install chromium
npm run test:demo
```

Os testes usam o build final em um servidor estritamente estático sob
`/verde-perto/`, sem FastAPI, sem fallback de rotas e com as chamadas `/api/`
bloqueadas. Exercitam as jornadas e a persistência com armazenamento isolado dos
dados pessoais do navegador. O fundo externo do mapa é bloqueado nos testes;
marcadores e navegação são verificados sem depender de um serviço externo.

`npm run build` e `npm start` continuam destinados ao sistema completo com API.
O modo de demonstração usa a configuração Angular `demo` e é gerado em outra
pasta (`dist/demo/browser`), sem substituir `dist/verdeperto/browser`.
