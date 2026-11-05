# Painel administrativo do HomeCash — Spec

Data: 2026-11-05 · Status: **v3.2.1, pronta para a validação do banco** (revisões em §16, auditoria técnica em §17, plano de validação no banco em §18; nada implementado, nenhum SQL executado, nenhuma consulta ao Supabase, nenhuma implementação autorizada).
Base: análise local de `src/`, `supabase/*.sql`, `docs/propostas-supabase.md` e `CONTINUIDADE-HOMECASH.md`.

## 1. Objetivo

Uma área `/admin`, separada do app dos usuários, para o responsável pelo HomeCash:
gerenciar contas, investigar problemas reais em modo de leitura, ver erros técnicos, tratar solicitações dos usuários e consultar o histórico de tudo que o administrador fez.

**Sucesso =**
1. Só administradores autorizados acessam; a checagem é feita no banco, nunca só na tela.
2. Nenhuma chave privilegiada (`service_role`) existe no app ou no navegador.
3. Usuário comum nunca lê dados de outra conta por causa desta área.
4. Toda leitura de dados de usuário e toda escrita do admin deixam registro que o admin não consegue apagar nem alterar pela API.
5. O painel **não altera nenhum dado financeiro nem de perfil**. As únicas escritas do admin são o status de erros e de solicitações.
6. O app atual continua funcionando igual, com ou sem as migrações aplicadas.
7. Tentativas negadas ficam registradas, sem depender de exceção que desfaça o registro.
8. Anexos das solicitações ficam em armazenamento privado, só são aceitos depois de validados no servidor e só são lidos pelo admin com registro prévio.
9. Funções internas não ficam acessíveis pela API sem necessidade.
10. O administrador só acessa o painel com MFA válido (TOTP, nível `aal2`), exigido no banco e não só na tela (§5.8).

## 2. Decisões já tomadas (preservadas)

| Decisão | Escolha |
|---|---|
| Abordagem | **A**: funções `SECURITY DEFINER` no Supabase, sem `service_role` no app. |
| Modo de suporte | Lançamentos completos, **somente leitura**: perfil, grupo, integrantes, entradas, saídas, cartões, faturas, contas fixas, caixinhas e configurações relevantes. |
| Confirmação no suporte | Antes da primeira visualização de cada aba financeira, em cada sessão (§6.1). Exigida também no banco. |
| Campos expostos | Lista explícita por recurso (§6.4). |
| Lançamentos de outros integrantes | Privados ou partilhados ficam **fora** do suporte até a regra ser confirmada (§6.5). |
| Tentativas negadas | Registradas em tabela própria; nenhuma validação desfaz o próprio registro (§5.7). |
| Anexos e e-mail | Imagens em bucket privado, validadas no servidor; envio para `homecashofc@gmail.com` por route handler, com confirmação protegida por segredo de servidor (§10). |
| Política de Privacidade | Tarefa separada, **obrigatória antes do deploy** (§14). |
| MFA do administrador (D1) | **Aprovada em 2026-11-05.** MFA TOTP (`aal2`) obrigatório para todo acesso administrativo, verificado no banco, com ativação, verificação e bloqueio definidos no §5.8. |
| Primeiro admin | Inserido por você no SQL Editor, com autorização, e ativado na ordem do §5.8 (R3). O app não tem tela para criar ou remover admin. |
| Regras do projeto | Sem SQL, commit, push, merge ou deploy sem autorização (CONTINUIDADE, seção 9). |

## 3. Fora de escopo (v1)

- Editar, excluir ou criar qualquer dado de usuário pelo painel (lançamentos, perfil, grupo, repasses, fechamento).
- "Entrar como" o usuário (impersonação) ou gerar tokens dele.
- Tela para gerenciar admins, exportar dados (CSV/PDF), notificações por e-mail ou push.
- Registrar chamadas de `anon` (o Postgres as recusa antes de executar a função; ver §5.7).
- Reenvio do e-mail de uma solicitação pelo admin; anexos que não sejam imagem; antivírus.
- Rotina de limpeza/retenção de erros, auditoria e anexos órfãos.
- Erros de visitantes sem login.
- Corrigir qualquer problema pré-existente encontrado (ex.: §13 item 19).
- Qualquer alteração em tabelas, políticas ou funções existentes.

## 4. Arquitetura

```
Navegador (supabase-js, JWT do usuário)
   └─ /admin/*  (guarda de UI: só experiência)
        └─ supabase.rpc("admin_*")  ──►  Postgres (schema public: só RPCs expostas)
                                          ├─ homecash_interno.checar_admin()  -> não é admin: registra e devolve acesso_negado
                                          ├─ grava admin_auditoria (mesma transação, cadeia de hash)
                                          └─ lê tabelas de domínio (SELECT, linhas elegíveis, campos permitidos)

Navegador ──► POST /api/solicitacoes/[id]/processar (Route Handler, JWT do usuário + segredo de servidor)
                 ├─ valida o conteúdo real das imagens (decodifica e recodifica)
                 ├─ envia o e-mail para homecashofc@gmail.com (chave do provedor só no servidor)
                 └─ confirma cada etapa por funções protegidas pelo segredo de servidor
```

- A sessão do app fica no `localStorage` (`src/lib/supabase.ts` usa `createClient` puro, sem cookies). O servidor Next **não vê** quem está logado, então `proxy.ts` não protege `/admin`. A proteção real é o banco; a guarda de tela só evita mostrar interface vazia.
- Há **um** route handler (§10) e dois segredos novos, **só do servidor**: a chave do provedor de e-mail e o segredo de confirmação (§10.2). Nenhum `service_role`: o handler age com o JWT do próprio usuário. O painel admin continua só com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Cada função admin rejeita quem não é admin **dentro do banco**. Mesmo com o código do app alterado, chamar a função não devolve nada.

## 5. Modelo de segurança

### 5.1 Permissão administrativa
- Tabela `admin_usuarios (user_id uuid pk, ativo boolean, fatores_aprovados uuid[] not null default '{}', email_registrado text, criado_em, criado_por text, observacao)`. Independe de `perfis.cargo` e de grupos.
- RLS ligada, **sem nenhuma política**, e `revoke all` de `public, anon, authenticated`. Nenhuma chamada pela API lê ou escreve nela.
- `sou_admin()`: devolve `true` só se `auth.uid()` está em `admin_usuarios` com `ativo`. Qualquer logado pode chamar (a resposta `false` não revela nada). Devolve `true` também antes do MFA (nível `aal1`): serve só para a interface escolher entre a tela de segurança (§5.8) e "não encontrada", e **não concede acesso a nenhum dado**.
- `homecash_interno.checar_admin(p_funcao text) returns boolean`: chamada no início de toda RPC administrativa. Se o chamador não é admin ativo **ou não tem MFA válido (§5.8)**, **registra a tentativa** (§5.7) e devolve `false`; a RPC responde `{"ok": false, "erro": "<código>"}` (`acesso_negado` ou um dos códigos de MFA do §5.8) **sem levantar exceção**.
- Mudanças em `admin_usuarios` (insert, update, delete) disparam trigger que grava em `admin_auditoria` com `current_user`. Assim o cadastro de um admin também deixa rastro.
- Trigger impede desativar ou remover o **último** admin ativo (evita trancar o painel).
- `admin_usuarios.user_id` **sem chave estrangeira** para `auth.users`. Com `on delete cascade`, a exclusão da conta do admin dispararia o trigger do último admin e faria `excluir_minha_conta` falhar; sem FK a linha fica órfã e inofensiva, porque `checar_admin` só vale com um `auth.uid()` válido.
- **Revogação imediata.** `checar_admin` consulta `admin_usuarios` a cada chamada (inclusive dentro de `admin_suporte_ler`), então `ativo = false` derruba também uma sessão de suporte aberta. O JWT continua válido, mas sem poder administrativo.
- **Risco do token no navegador.** A sessão do Supabase fica em `localStorage`, legível por qualquer script. Um XSS em qualquer tela do app entregaria ao atacante o JWT do admin e, com ele, todas as RPCs `admin_*`. Mitigações obrigatórias no §11 (conteúdo de terceiros só como texto, CSP, nenhum HTML injetado) e o MFA obrigatório abaixo.
- **MFA do admin (D1): aprovada em 2026-11-05.** Os requisitos de ativação, verificação e bloqueio estão no §5.8. O painel ganha telas de cadastro e verificação de MFA, que o app não tem hoje (§11).

### 5.2 Categorias de função e permissão de `EXECUTE`

Funções novas nascem com `EXECUTE` para `PUBLIC` (lição da migração 09). Cada função pertence a **uma** categoria e recebe exatamente o `EXECUTE` dela; todas usam `set search_path = ''` e nomes com schema.

| Cat. | Função | Schema | `EXECUTE` | Regra de corpo |
|---|---|---|---|---|
| A | **RPC administrativa** (`admin_*`) | `public` | `authenticated` | Começa por `checar_admin`; devolve envelope `jsonb`. |
| B | **RPC de usuário logado** (`sou_admin`, `registrar_tentativa_admin`, `registrar_erro`, `criar_solicitacao`, `registrar_anexo`) | `public` | `authenticated` | Exige `auth.uid()`; só mexe nos próprios dados; limites; envelope `jsonb` (exceto `sou_admin`, que devolve `boolean`). |
| C | **RPC de servidor** (`solicitacao_email_reservar`, `solicitacao_email_concluir`, `anexo_validacao_reservar`, `anexo_validacao_concluir`) | `public` | `authenticated` | Exige `auth.uid()` **e** o segredo de servidor (§10.2); envelope `jsonb`. |
| D | **Internas** (`checar_admin`, `registrar_auditoria`, `registrar_negado`, `campos_permitidos`, `hash_texto`, `segredo_valido`, `elegivel_suporte`) | `homecash_interno` | **nenhum** (só o dono; as RPCs `SECURITY DEFINER` as chamam como dono) | Não são chamadas pela API. |
| E | **Auxiliares de política do Storage** (`pode_registrar_anexo`, `pode_gravar_final`, `pode_apagar_bruto`, `pode_apagar_final`, `pode_ler_proprio`, `admin_pode_ler_anexo`) | `homecash_interno` | `authenticated` (obrigatório: o Postgres exige `EXECUTE` do papel que avalia a política) | Recebem só o nome do objeto, usam `auth.uid()` e devolvem `boolean` sobre **o próprio chamador**; não leem nem devolvem dado de terceiros. |
| F | **Funções de trigger** (imutabilidade por linha, imutabilidade de `TRUNCATE`, hash da cadeia, último admin, auditoria de `admin_usuarios`) | `homecash_interno` | **nenhum** | Chamadas só pelo trigger. |

- **Por que um schema `homecash_interno`:** o PostgREST só publica as funções dos schemas "expostos" da API (por padrão, `public`). As categorias D, E e F ficam fora dele, então **não viram `/rest/v1/rpc/...`**. A categoria E precisa de `grant usage on schema homecash_interno to authenticated` e `grant execute` por função, mas continua sem rota na API, desde que o schema não seja exposto (incerteza #15). A criação do schema é `create schema if not exists`; nada existente é alterado.
- Tabelas internas (`servidor_segredos`, `solicitacoes_envios`, `anexos_validacao`, `anexo_leituras`, contadores) ficam no mesmo schema, sem nenhum privilégio para `anon` e `authenticated`.
- **Concessões padrão do Supabase.** Projetos Supabase costumam ter `alter default privileges` que concedem `EXECUTE` a `anon`, `authenticated` e `service_role` em funções novas do schema `public`. `revoke ... from public` **não** remove concessões explícitas a `anon`/`authenticated`. Por isso toda função faz `revoke ... from public, anon, authenticated` antes do `grant` da sua categoria, e a verificação final (§12.1, item 12) confere a ACL (`proacl`). `service_role` pode manter o acesso padrão: o app não o usa e o modelo não depende dele. Não confirmado neste projeto (#26).
- `revoke all on schema homecash_interno from public`; `grant usage` só a `authenticated` (necessário à categoria E). O proprietário das funções `SECURITY DEFINER` e das tabelas é o mesmo papel, de modo que as RPCs leem as tabelas sem política de RLS própria para o chamador; não se usa `force row level security` nas tabelas internas.
- **Envelope** (categorias A, B e C): `{"ok": true, "dados": ...}` ou `{"ok": false, "erro": "<código>"}`. O cliente (`src/lib/admin.ts`) sempre confere `ok`; a resposta HTTP é 200 mesmo quando negada.

### 5.3 Privilégios nas tabelas (incerteza #2)
A migração 08 indica que os privilégios padrão do Supabase podem estar desligados. Não presumir: cada tabela nova faz `revoke all ... from public, anon, authenticated` e depois só os `grant` que a tabela precisa. Nenhum `alter default privileges`.

### 5.4 Auditoria imutável, com cadeia de hash

`admin_auditoria (id bigint identity, ordem bigint not null unique, admin_id uuid, admin_email text, acao text, alvo_user_id uuid, alvo_email text, recurso text, parametros jsonb, linhas int, motivo text, sessao_suporte uuid, criado_em timestamptz, hash_anterior text not null, hash text not null)`.

- Sem chave estrangeira em `auth.users` e com cópia do e-mail: o registro sobrevive à exclusão da conta (`excluir_minha_conta` e o trigger `limpar_dados_ao_excluir_usuario` não conhecem as tabelas novas).
- **Imutabilidade em três camadas** (para `admin_auditoria` e `admin_acessos_negados`; `admin_sessoes_suporte`, `admin_suporte_confirmacoes` e os contadores não levam o bloqueio porque precisam de `update`, mas também não têm acesso pela API):
  1. `revoke all` de `public, anon, authenticated` (inclui `update`, `delete`, `truncate`); só `insert` por dentro das funções `SECURITY DEFINER`.
  2. Trigger **por linha** `before update or delete` que sempre levanta exceção.
  3. Trigger **por instrução**, separado, `before truncate ... for each statement`, que sempre levanta exceção. O Postgres não aceita `TRUNCATE` em trigger por linha.
- **Disponibilidade de SHA-256 (não presumida).** O repositório não registra a versão do PostgreSQL do projeto, e o banco não foi consultado. Fatos conhecidos sem consultar: o `sha256(bytea)` nativo existe a partir do PostgreSQL 11 e a extensão `pgcrypto` oferece `digest(bytea, 'sha256')`. A migração 19 **começa** com um bloco de pré-checagem que, antes de criar qualquer objeto:
  1. procura `pg_catalog.sha256(bytea)` (`to_regprocedure`);
  2. se não houver, procura `digest(bytea, text)` em `extensions` ou `public` e confere que a extensão `pgcrypto` está instalada;
  3. se não houver nenhuma, **aborta com mensagem clara** e não cria nada.
  O resultado é gravado dentro de `homecash_interno.hash_texto(p_texto text) returns text`, criada por `execute format(...)` com a implementação encontrada. O resto do código chama só `hash_texto`. Não se instala extensão nem se altera o projeto para isso.
- **Serialização das inserções.** Trigger `before insert` (categoria F), nesta ordem:
  1. `pg_advisory_xact_lock(<constante int4 do projeto>, <constante da tabela>)` (forma de duas chaves, para não colidir com outros usos). Fica preso até o fim da transação, então um segundo `insert` espera o primeiro **confirmar ou desfazer**.
  2. Lê a última linha **confirmada** (`order by ordem desc limit 1`). O lock garante que ela é a verdadeira anterior, mesmo com transações simultâneas. A leitura exige `READ COMMITTED` (padrão do PostgREST); em outro nível a restrição `unique (ordem)` faz o insert falhar em vez de gravar cadeia errada.
  3. `ordem = coalesce(ultima.ordem, 0) + 1`; `hash_anterior = coalesce(ultima.hash, repeat('0', 64))`.
  4. `hash = hash_texto(jsonb_build_array('v1', ordem, hash_anterior, id, admin_id, admin_email, acao, alvo_user_id, alvo_email, recurso, linhas, motivo, sessao_suporte, to_char(criado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'), parametros)::text)`.
  **`jsonb_build_array` é obrigatório; concatenar com `||` e `|` está proibido.** `admin_id` é nulo quando a mudança vem do SQL Editor (`auth.uid()` nulo), e `texto || NULL` dá `NULL`: o `insert` falharia por causa do `hash not null` e a mudança em `admin_usuarios` seria barrada pelo próprio trigger de auditoria. No array JSON o nulo vira `null`, e um `|` dentro de um texto (termo de busca, motivo) não consegue deslocar a fronteira entre campos.
  A cadeia segue `ordem` (atribuída sob o lock), **não** `id` nem `criado_em`: com identidade e `now()`, duas transações simultâneas podem receber `id` em uma ordem e confirmar em outra. `parametros` é `jsonb`, cuja saída em texto é canônica; a versão `v1` no array permite trocar a regra no futuro.
- **Regra de locks.** Nenhuma função toma o lock de `admin_acessos_negados` e o de `admin_auditoria` na mesma transação (evita deadlock): se precisar gravar as duas coisas, grava a auditoria primeiro e não registra negado depois. `pg_advisory_xact_lock(classe int4, chave int4)` usa **classes distintas** por finalidade (cadeia da auditoria, cadeia dos negados, limites por usuário), para que o `hashtext(...)` de um usuário nunca colida com a chave de uma cadeia.
- **Verificação, paginada.** `admin_verificar_auditoria(p_desde bigint default 1, p_limite int default 5000)` (categoria A) processa **uma página** com **uma única consulta** que usa `lag()` sobre `order by ordem`, o que dá um instantâneo consistente mesmo com inserções em andamento. Lê também a linha imediatamente anterior a `p_desde` para checar o encadeamento da primeira linha da página. Recalcula cada `hash`, compara com o gravado, confere `hash_anterior = hash da linha anterior` e detecta `ordem` repetida ou com salto. Devolve `{"ok": true, "dados": {"verificadas": n, "primeira_quebra": <ordem|null>, "proxima": <ordem|null>, "cabeca": "<hash da última linha da tabela>", "total": n}}`; a tela encadeia as páginas. A paginação existe porque o Supabase aplica `statement_timeout` ao papel `authenticated` (valor não confirmado, #25) e a tabela só cresce.
- **Limites honestos.** (a) O dono do banco pode desligar triggers (`disable trigger`, `session_replication_role = replica`) ou recriar a tabela; o hash só **detecta** adulteração no meio da cadeia. (b) Apagar as **últimas** linhas, ou a tabela inteira, não é detectável só pela cadeia: a tela de Auditoria mostra a `cabeca` e o total, e a recomendação é anotá-la fora do banco de tempos em tempos. (c) Todas as inserções de auditoria passam pelo mesmo lock; com o volume esperado isso é irrelevante.
- Gravada **na mesma transação** da leitura: não existe caminho que leia sem registrar.
- O que registra: acesso ao painel, listagens e buscas (com o termo), abertura de ficha, início e fim de sessão de suporte, confirmação de aba, cada leitura de recurso (qual, mês, quantas linhas, quantas omitidas), abertura de anexo, mudança de status de erro e de solicitação, mudança em `admin_usuarios`.
- Não registra o conteúdo lido (evita copiar dados financeiros para a auditoria).

### 5.5 Sem alteração silenciosa
- RPCs de suporte contêm só `SELECT` em tabelas de domínio e escrevem apenas em `admin_auditoria`, `admin_acessos_negados` (+ contador), `admin_sessoes_suporte` e `admin_suporte_confirmacoes`; `admin_abrir_anexo` grava, além da auditoria, a concessão em `homecash_interno.anexo_leituras`.
- Teste local (§12.2) varre `supabase-20-*.sql` e falha se encontrar `insert|update|delete|truncate` apontando para tabela fora dessa lista.
- Teste de banco (quando autorizado): md5 das tabelas de domínio antes e depois de uma sessão de suporte completa deve ser idêntico.
- Escritas do admin sobre dados que não são do usuário: `admin_atualizar_erro` e `admin_atualizar_solicitacao` (status, nota e resposta), ambas auditadas.

### 5.6 Dados expostos no navegador
Resultados ficam só em memória do componente. Sem `localStorage`, sem log no console, sem botão de exportar. Sessão de suporte expira sozinha.

### 5.7 Tentativas negadas: nenhuma validação desfaz o próprio registro

**Regra geral (vale para as categorias A, B e C):** toda falha de validação **devolve** `{"ok": false, "erro": "<código>"}`; o registro da falha é gravado **antes** do `return`, e nenhuma função levanta exceção depois de gravar. Exceções ficam só para defeitos inesperados (que desfazem tudo e aparecem nos logs do PostgREST). Não se usa bloco `begin ... exception` ao redor de um registro, porque o fim do sub-bloco desfaria o que foi gravado dentro dele.

- **Códigos registráveis** (gravam em `admin_acessos_negados`): `acesso_negado` (`nao_admin`, `admin_inativo`), `mfa_requerida`, `mfa_nao_configurada`, `mfa_expirada`, `fator_nao_aprovado` (§5.8), `sessao_invalida` (inexistente, de outro admin, expirada, encerrada), `aba_nao_confirmada`, `recurso_invalido`, `parametro_invalido` (só nas RPCs A: mês fora de `AAAA-MM`, página/limite fora da faixa), `segredo_invalido` e `servidor_nao_configurado` (RPCs C).
- **Códigos só respondidos, sem registro:** `limite_excedido`, `em_andamento`, `ja_enviado`, `nao_encontrado` e as falhas de validação de usuário comum (RPCs B).
- **Onde fica o registro:** `admin_acessos_negados (id bigint identity, ordem, user_id uuid, email text, funcao text, motivo text, rota text, user_agent text, ip text, criado_em, hash_anterior, hash)` com a mesma imutabilidade e a mesma cadeia do §5.4 (lock próprio). Falhas de `limite_excedido` de usuário comum (B) **não** vão para essa tabela; são só respostas ao app.
- **Agrupamento contra inundação:** uma linha imutável por `(user_id, funcao, motivo, hora)`; as repetições da hora só incrementam o contador em `homecash_interno.acessos_negados_contagem` (`insert ... on conflict do update`, sem valor de auditoria), exibido na tela. Textos com tamanho máximo (`user_agent` 200, `rota` 120).
- **Teto global contra contas em massa:** além do agrupamento por usuário, no máximo **200 linhas novas por hora** em toda a tabela `admin_acessos_negados`; acima disso só o contador sobe e o dashboard mostra o excesso. Evita que milhares de contas descartáveis encham uma tabela imutável.
- **Segredo errado:** após 5 `segredo_invalido` do mesmo `auth.uid()` em 10 min, as RPCs C passam a responder `limite_excedido` sem comparar o segredo (contador em `homecash_interno`).
- **Texto de terceiros:** `rota` e `user_agent` vêm do cliente; são truncados, perdem caracteres de controle ao gravar e só são exibidos como texto (§11).
- **Tela `/admin` para não-admin:** o layout chama `registrar_tentativa_admin('/admin/...')` (categoria B; só grava o próprio `auth.uid()`, com o mesmo limite) e depois mostra "não encontrada".
- **Visibilidade:** aba "Acessos negados" na Auditoria e contador de 24 h no dashboard (`admin_resumo`).
- **Limitações:** (a) chamadas de `anon` são recusadas pelo Postgres por falta de `EXECUTE` **antes** de a função rodar, então não geram registro aqui (ficam nos logs de API do Supabase); (b) `ip` vem de `current_setting('request.headers', true)` (`x-forwarded-for`), **não confirmado**: se faltar, grava `null`; (c) `update`/`delete`/`truncate` bloqueados pela falta de privilégio ou pelos triggers de imutabilidade falham sem registro próprio; ficam nos logs do Supabase; (d) um usuário comum pode gerar registros, por isso o agrupamento por hora.

### 5.8 MFA obrigatório do administrador (D1, aprovada em 2026-11-05)

**Base documental** (documentação do Supabase consultada em 2026-11-05): o JWT traz a claim `aal` (`aal1` ou `aal2`) e as políticas a leem com `auth.jwt()->>'aal'`; `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` devolve `currentLevel` e `nextLevel`; a tabela `auth.mfa_factors` tem `user_id` e `status` (`verified`); quem remove o fator continua com `aal2` no JWT até o token ser renovado ("stale JWT"); a claim `amr` (lista de `{method, timestamp}`) é **opcional**; o limite padrão é 10 fatores por usuário. O primeiro fator de login (Google ou senha) não importa: o TOTP funciona sobre qualquer um. Segundo o código do Supabase Auth: cadastrar um novo fator quando já existe fator verificado **exige sessão `aal2`** (erro `insufficient_aal`); o `verify` devolve um token novo com `aal2` e o método em `amr`, e rotaciona o refresh token; tentativas demais devolvem `mfa_verification_rejected` (padrão de 15 desafios/verificações); fator por telefone e WebAuthn vêm desligados por padrão.

**R1. Escopo.** Todo acesso administrativo exige TOTP verificado: toda RPC categoria A, a política de leitura de anexos do admin (categoria E) e qualquer função admin futura. Não há modo de contingência pelo app, nem sinalizador para desligar. MFA para usuários comuns, SMS e qualquer mudança no login do app ficam **fora de escopo**.

**R2. Fatores.** Somente TOTP (aplicativo autenticador). O banco também impõe isso (R5): só fator com `factor_type = 'totp'` conta como acesso válido, e qualquer outro fator verificado vira `fator_nao_aprovado`. Recomendado cadastrar **dois** fatores (dois aplicativos ou dispositivos) na ativação, ou guardar o segredo mostrado no cadastro em local offline, porque não há recuperação pelo app (R8).

**R3. Ativação, na ordem (cada passo que toca o banco exige sua autorização):**
1. Migração 19 aplicada e código da fase 1 publicado (telas de segurança incluídas).
2. Você insere seu `user_id` em `admin_usuarios` com `ativo = true` e `fatores_aprovados = '{}'`. Agora `sou_admin()` é verdadeiro, mas **toda RPC A responde `mfa_nao_configurada`**.
3. Em `/admin/seguranca` você cadastra o TOTP (QR e segredo) e confirma o primeiro código. A tela mostra o **id** e o horário do fator.
4. Você confere que o id e o horário são os do cadastro que acabou de fazer e, com autorização, aprova o fator: `update admin_usuarios set fatores_aprovados = array['<id>'] where user_id = '<seu id>'`. Sem este passo o acesso fica em `fator_nao_aprovado`.
5. Você sai, entra de novo e faz a verificação do TOTP. O token passa a `aal2` e o painel libera.
6. Recomendado: repetir 3 e 4 para um segundo fator.
Janela de risco: entre os passos 2 e 3, enquanto não existe fator verificado, alguém com um token `aal1` da sua conta poderia cadastrar e verificar um fator antes de você. Depois que o primeiro fator é verificado, o Supabase exige `aal2` para cadastrar outro, e a janela se fecha. Por isso o passo 4 compara id e horário e tudo é feito numa única sessão; se não bater, o fator é removido e o processo recomeça. O segundo fator do passo 6 já é cadastrado em `aal2`.

**R4. Verificação em cada sessão.** `/admin/*` só libera o painel quando `getAuthenticatorAssuranceLevel()` devolve `currentLevel = aal2`. Com `aal1` e `nextLevel = aal2`, a tela pede o código de 6 dígitos (`challenge` + `verify`); o `verify` devolve o token `aal2` e o cliente passa a usá-lo (`refreshSession()` só como reserva, se o token ainda vier `aal1`). Mensagens em português para `mfa_verification_failed`, `mfa_challenge_expired` e `mfa_verification_rejected` (tentativas demais); o código digitado não é exibido nem guardado. O limite de tentativas é o do Supabase Auth (padrão documentado: 15; valor do projeto não confirmado, #33).

**R5. Bloqueio no banco.** `homecash_interno.checar_admin(p_funcao)` aplica, **nesta ordem**, e cada falha devolve um código distinto, é registrada (§5.7) e **não levanta exceção**:
1. sem `auth.uid()`, ou fora de `admin_usuarios`, ou `ativo = false` → `acesso_negado` (sempre o mesmo código para quem não é admin, para a resposta não revelar quem é);
2. `auth.jwt()->>'aal'` **ausente ou diferente** de `aal2` (comparar com `is distinct from`, nunca com `<>`: `NULL <> 'aal2'` não é verdadeiro e deixaria passar um token sem a claim) → `mfa_requerida` se existe ao menos um fator TOTP `verified` **aprovado**; senão `mfa_nao_configurada`;
3. existe fator `verified` do usuário em `auth.mfa_factors`, **de qualquer tipo**, que **não** está em `fatores_aprovados` → `fator_nao_aprovado` (fator cadastrado por terceiro com um token roubado fica sem efeito até você aprovar ou remover; o efeito colateral é bloquear você também, o que falha de forma segura, e a saída é o R8);
4. nenhum fator `verified` **com `factor_type = 'totp'`** entre os aprovados (por exemplo, fator removido enquanto o JWT antigo ainda diz `aal2`) → `mfa_nao_configurada`;
5. se a claim `amr` estiver presente, precisa conter uma entrada de método `totp` com `timestamp` de até **8 horas** atrás; sem `totp`, ou mais antiga → `mfa_expirada` (é preciso verificar de novo). Como `amr` é opcional, esta regra é **validada com um token real** antes de ser mantida (#30); se o token de teste não trouxer `amr`, a regra sai do spec e valem só os passos 2 a 4 e o limite de sessão do projeto;
6. só então devolve `true`.

**R6. Cobertura única.** `checar_admin` é o único ponto de decisão. O teste estático exige que toda RPC A o chame antes de qualquer outra coisa; a função auxiliar `admin_pode_ler_anexo` repete as condições 1 a 5 em modo somente leitura (sem registrar), porque política de Storage não deve gravar.

**R7. Registro.** Os quatro códigos de MFA entram em `admin_acessos_negados` (§5.7). `admin_registrar_acesso` grava na auditoria o `aal` e os métodos de `amr` da sessão. A verificação do código em si fica nos logs do Supabase Auth, não na nossa auditoria.

**R8. Recuperação.** Perdeu o aplicativo: não há reinício pelo app. Você, com acesso ao painel do Supabase e autorização, remove o fator perdido e repete R3. O trigger do último admin não impede isso. Se o papel do SQL Editor não tiver `DELETE` em `auth.mfa_factors` (a etapa E8 verifica), a remoção é feita pelo painel de Auth do Supabase ou pela API administrativa do Auth, rodada na sua máquina, nunca dentro do app.

**R9. Interface** (`/admin/seguranca` e o `layout`): decide pelo par (`currentLevel`, `nextLevel`) da documentação:

| Atual | Próximo | Tela |
|---|---|---|
| `aal1` | `aal1` | Cadastro do TOTP (QR, segredo, confirmação do código; mostra o id e o horário do fator) |
| `aal1` | `aal2` | Verificação do código |
| `aal2` | `aal2` | Painel liberado |
| `aal2` | `aal1` | Bloqueado: fator removido com token antigo; pede nova entrada |

A tela lista os fatores que o Supabase devolver (id, nome, tipo, situação) e, no cadastro, mostra o **id completo** do fator, que é o usado na aprovação. A tela **não** sabe se o fator está aprovado (`admin_usuarios` não é legível pelo cliente) e **não** oferece remover fator: a remoção é feita por você fora do app (R8). A documentação não diz se `listFactors()` inclui fatores ainda não verificados (#31). O QR vem como imagem de dados (a CSP do §11 precisa permitir `img-src data:` só nesta rota); o segredo aparece só durante o cadastro e não é guardado nem registrado em log.

**R10. Testes.** Locais (§12.2): mapa (`currentLevel`, `nextLevel`) → tela. No banco, com autorização e dentro de `begin ... rollback`: claims simuladas por `set_config('request.jwt.claims', ...)` (a técnica é confirmada na etapa E8 do §18) para `aal1`, `aal2`, `amr` ausente, `amr` antigo, fator novo não aprovado e fator removido com JWT antigo.

## 6. Modo de suporte (leitura completa)

### 6.1 Fluxo
1. Admin abre uma conta em **Usuários** → "Abrir suporte".
2. Informa o **motivo** (mínimo 10 letras, igual à regra de reabertura de mês).
3. `admin_suporte_iniciar(p_user, p_motivo)` cria linha em `admin_sessoes_suporte (id, admin_id, alvo_user_id, motivo, iniciado_em, expira_em = +30 min, encerrado_em)` e grava auditoria. Motivo curto devolve `parametro_invalido`. Iniciar uma sessão **encerra** qualquer outra sessão ativa do mesmo admin (no máximo uma por vez, com registro na auditoria).
4. **Confirmação por aba financeira.** Na primeira vez que abre cada aba financeira (Extrato, Cartões, Faturas, Contas fixas, Caixinhas e aportes, Configurações, Fechamento) dentro da sessão, a tela mostra: *"Você vai ver dados financeiros de {nome}. A consulta será registrada. Continuar?"*. Ao confirmar, a tela chama `admin_suporte_confirmar(p_sessao, p_aba)`, que grava em `admin_suporte_confirmacoes (sessao_id, aba, confirmado_em)` (chave `sessao_id + aba`) e na auditoria. **Resumo da conta** (só contagens), **Grupo** e **Integrantes** não pedem confirmação.
5. Cada aba chama `admin_suporte_ler(p_sessao, p_recurso, p_mes, p_pagina, p_limite)`. A função confere: é admin ativo **com MFA válido (§5.8)**, a sessão é dele, não expirou, não foi encerrada, o recurso está na lista e, se é financeiro, **existe confirmação da aba nesta sessão** (senão devolve `aba_nao_confirmada` e registra a tentativa). Depois grava auditoria e devolve os campos permitidos (§6.4) das linhas elegíveis (§6.5).
   Recurso → aba: `extrato`→Extrato; `cartao`→Cartões; `faturas`→Faturas; `contas_fixas`→Contas fixas; `caixinhas` e `aportes`→Caixinhas e aportes; `configuracoes`→Configurações; `fechamento`→Fechamento.
   *Limite honesto:* a confirmação é fricção e prestação de contas, não barreira contra um admin mal-intencionado; a proteção real é o motivo obrigatório, a expiração e a auditoria imutável.
6. `admin_suporte_encerrar(p_sessao)` ou expiração encerra o acesso.
7. A tela mostra uma faixa fixa: **"MODO SUPORTE · somente leitura · {nome/e-mail} · expira em mm:ss"**.

### 6.2 Recursos permitidos (lista fechada, um ramo explícito por recurso, sem SQL dinâmico)
| Recurso | Tabela(s) | Filtro |
|---|---|---|
| `perfil`, `integrantes` | `perfis`, `grupos_familiares` | perfil do alvo; perfis do mesmo `grupo_id` |
| `extrato` | `extrato` | mês (`mes`) + elegibilidade (§6.5) |
| `cartao` | `cartao` | mês + elegibilidade |
| `contas_fixas` | `contas_fixas` | mês + elegibilidade |
| `faturas` | `pagamentos_fatura` + `opcoes_pagamento` (cartões) | mês |
| `caixinhas` | `caixinhas`, `caixinha_movimentos` | todas do alvo, movimentos paginados |
| `aportes` | `aportes_investimento` | do alvo |
| `configuracoes` | `configuracoes`, `opcoes_pagamento`, `opcoes_categoria` | do alvo |
| `fechamento` | `fechamento_controle`, `fechamento_meses`, `fechamento_eventos` | só se `to_regclass` achar as tabelas (migração 18 pode não estar aplicada) |

- **Campos permitidos, não `to_jsonb` livre.** Cada ramo seleciona as linhas elegíveis e passa cada uma por `homecash_interno.campos_permitidos(p_linha jsonb, p_permitidos text[])`, que devolve **só** as chaves da lista do §6.4. A lista é uma constante no corpo da função (versionada no SQL), não uma tabela editável.
- **Por que filtrar chaves:** os nomes reais das colunas não estão versionados (incerteza #3). Referenciar uma coluna inexistente derrubaria a função; filtrar chaves faz a coluna inexistente simplesmente não aparecer. O custo é que um erro de digitação na lista passa sem aviso: o roteiro de testes compara as chaves devolvidas com a lista esperada. **A exceção é a regra de elegibilidade (§6.5), que não pode falhar aberta:** a migração 20 aborta se as colunas dela não existirem.
- `p_limite` máximo 200; resposta traz `total` e `omitidas` para paginar.
- Mês fora de `AAAA-MM` devolve `parametro_invalido`; recurso fora da lista devolve `recurso_invalido`. Ambos registrados (§5.7).

### 6.3 Telas de suporte (somente leitura, componentes próprios)
Abas: Resumo da conta · Grupo e integrantes · Extrato · Cartões · Faturas · Contas fixas · Caixinhas e aportes · Configurações · Fechamento.
Não reutilizar telas do app (`useFinanceStore` está amarrado à sessão do próprio usuário e tem botões de escrita). Reaproveitar só funções puras de `src/lib` (cálculo de saldos, faturas em aberto) quando ajudar a reproduzir o que o usuário vê. O mapeamento linha→tipo hoje vive em `useFinanceStore`; se for necessário, extrair apenas o mapeador, sem mudar comportamento (decidir no plano).
Quando houver linhas omitidas pela §6.5, cada aba mostra: *"N lançamentos de outros integrantes (privados ou partilhados) não são exibidos no suporte."* **Os totais calculados no painel (saldos, faturas em aberto, repasses) usam só as linhas exibidas**, então podem diferir dos valores que o usuário vê quando houver omitidas; a tela avisa e nunca os apresenta como os valores do usuário.

### 6.4 Campos permitidos por recurso

Listas derivadas **do código do app** (`useFinanceStore`, `useCaixinhas`, `useOpcoes`, migração 08), não do banco. São candidatas: devem ser conferidas contra o schema real antes de aplicar a migração 20 (incerteza #3). O que não está na lista não é devolvido.

| Recurso | Campos devolvidos |
|---|---|
| `perfil` | `id, user_id, nome_usuario, cargo, cor, grupo_id, eh_convidado, resumo_visivel, created_at` |
| `integrantes` | `id, user_id, nome_usuario, cargo, cor, eh_convidado, resumo_visivel` |
| grupo | `id, nome, created_at` (de `grupos_familiares`) |
| `extrato` | `id, mes, data, tipo, descricao, categoria, pagamento, valor, owner_id, responsavel_id, grupo_id, repasse_informado, repasse_informado_em, repasse_pago, repasse_pago_em, repasse_conta, repasse_conta_origem, created_at` |
| `cartao` | `id, mes, data, nome, cartao, parcela_atual, parcela_total, categoria, valor, owner_id, responsavel_id, grupo_id, repasse_*` (mesmos de cima), `created_at` |
| `contas_fixas` | `id, mes, nome, valor, pago, forma_pagamento, categoria, owner_id, responsavel_id, grupo_id, repasse_*`, `created_at` |
| `faturas` | `pagamentos_fatura`: `id, cartao, mes, conta, valor, data, created_at`; `opcoes_pagamento` (só cartões): `id, nome, tipo_cartao, limite, dia_vencimento` |
| `caixinhas` | `caixinhas`: `id, nome, eh_reserva, rendimento, meta, saldo, exibir_na_home, banco, tipo_rendimento, ultimo_mes_rendimento, created_at`; `caixinha_movimentos`: `id, caixinha_id, tipo, valor, data, descricao, origem, conta, created_at` |
| `aportes` | `aportes_investimento`: `id, valor, created_at` |
| `configuracoes` | `configuracoes`: `investido, reserva_atual, reserva_meta`; `opcoes_pagamento`: `id, nome, tipo_cartao, eh_cartao, limite, saldo_inicial, dia_vencimento`; `opcoes_categoria`: `id, nome` |
| `fechamento` | `fechamento_controle`: `mes_inicial, criado_em`; `fechamento_meses`: `mes, status, fechado_em, retrato, assinatura`; `fechamento_eventos`: `mes, tipo, em, por, motivo, assinatura` |

**Nunca devolvidos:** `avatar_url`, `usuario_id` (duplicata legada de `owner_id`), `salario` (coluna legada), `privado` e `compartilhado_com` (usados só no filtro), e-mail de integrantes (o e-mail só aparece na ficha do alvo), qualquer coluna fora da lista.
**Valores financeiros continuam completos** (`valor`, saldos, limites) nas linhas elegíveis: é o que você pediu para investigar problemas reais.

### 6.5 Lançamentos privados e partilhados (`privado`)

**O que o código mostra (verificado em `src/`):**
- Na criação, o campo "Quem pode ver" (`NovaTransacao.tsx`, `ExtratoTable.tsx`) grava: *todo o grupo* → `privado = false`, `compartilhado_com = null`; *Só eu* → `privado = true`, `compartilhado_com = null`; *uma pessoa* → `privado = false`, `compartilhado_com = <id>` (só o dono e essa pessoa).
- Na leitura (`lerLancamentos`), o app busca `owner_id`, `responsavel_id` ou `grupo_id` do usuário e só filtra no cliente por `!compartilhado_com || owner_id === uid || compartilhado_com === uid`. **O código não filtra por `privado`** em nenhum ponto.
- Nos arquivos SQL locais, nenhuma política menciona `privado`; só `compartilhado_com` aparece, e somando acesso (migração 10). Se a privacidade "Só eu" for garantida no banco, é por uma política que não está versionada.
- **Conclusão (E5 e E6):** o banco **não** usa `privado`, mas as políticas só mostram a linha ao dono, ao responsável e ao destinatário de `compartilhado_com`. "Só eu" com responsável igual ao dono não vaza. O que sobra (#19) é que uma linha `privado` cujo responsável é outra pessoa continua visível a esse responsável.

**Regra do suporte enquanto não for confirmada (falha fechada):** uma linha de `extrato`, `cartao` ou `contas_fixas` só é devolvida se
`owner_id = alvo`, **ou** (`coalesce(privado,false) = false` **e** `compartilhado_com is null` **e** `responsavel_id` é um perfil do alvo).
Ou seja, **todo lançamento de outro integrante que seja privado ou partilhado é omitido por inteiro**, inclusive os partilhados *com o alvo*. Não basta mascarar a descrição: a linha, o valor, a data, a categoria e os campos de repasse não saem. Só se devolve a contagem `omitidas`. Lançamentos privados do **próprio alvo** aparecem, porque são dados da conta investigada.
- Implementada em `homecash_interno.elegivel_suporte(...)`, usada por todo ramo de lançamento e pelas contagens da ficha. **Como as funções `SECURITY DEFINER` ignoram a RLS, esta regra é o único filtro**: um erro nela vaza dado. Por isso ela tem roteiro de teste próprio com dados de exemplo (linha privada de outro membro, partilhada com o alvo, partilhada com terceiro, `privado` nulo, alvo sem grupo, linha de grupo antigo) e o resultado esperado de cada caso.
- A regra **não depende de grupo**: a visibilidade do alvo é sempre dono, responsável ou destinatário, e `grupo_id` não entra. Alvo sem grupo funciona igual.
- **Dados derivados:** `fechamento_meses.retrato` e `fechamento_eventos.retrato` são resumos gravados pelo app do próprio alvo e saem como estão. Se agregarem lançamentos de terceiros, isso vem do app, não do painel (#19). A contagem global do dashboard (`admin_resumo`) soma linhas sem expor conteúdo e não segue a regra.
- A migração 20 **aborta** se `extrato`, `cartao` ou `contas_fixas` não tiverem `privado`, `compartilhado_com`, `owner_id` e `responsavel_id` (pré-checagem em `information_schema`). Coluna ausente nunca vira "tudo visível".
- **A confirmação no banco veio (E5 e E6).** Se você quiser afrouxar a regra, a opção é mostrar também as linhas em que o alvo é responsável ou destinatário, que são exatamente as que ele lê pela API. A decisão é sua; o spec mantém a regra conservadora (omitir) até lá.

## 7. Dashboard

Funções `admin_resumo()` (migração 19) e `admin_resumo_operacao()` (migração 21).
Indicadores: total de usuários (contas reais, sem convidados), grupos, cadastros hoje/7/30 dias, ativos 7/30 dias (`auth.users.last_sign_in_at`), contagem de linhas por tabela (só contagem), erros novos 24 h, solicitações abertas, acessos negados 24 h.
Gráficos em SVG próprio (como `GraficoEntradasSaidas`): cadastros por dia (30 d), ativos por dia, erros por dia.
Acesso ao painel gera **uma** linha de auditoria por carregamento, limitada a uma a cada 10 min por admin. Sem dados pessoais no dashboard.

## 8. Usuários

`admin_listar_usuarios(p_busca, p_filtro, p_pagina, p_limite)`: e-mail, nome, provedor de login, cadastro, último acesso, e-mail confirmado, grupo, cargo, quantidade de lançamentos (pela mesma regra do §6.5). Busca por e-mail ou nome com `ilike` e caracteres `% _` escapados. Filtros: com/sem grupo, ativos 7/30 dias, nunca acessaram, cadastrados nos últimos 7 dias. Ordenação fixa por parâmetros permitidos.
`admin_usuario_detalhe(p_user)`: ficha com perfil, grupo, integrantes (inclui convidados sem conta), contagens, últimos erros e solicitações.
Ambas gravam auditoria (a busca guarda o termo).

**Atenção (incerteza #1):** `perfis.id` e `perfis.user_id` podem diferir para convidados. A junção usa `perfis.user_id = auth.users.id` primeiro e `perfis.id` como alternativa; convidados (`eh_convidado`) aparecem só como integrantes, nunca como usuário.

## 9. Erros

Tabela `erros_app (id bigint identity, user_id uuid null on delete set null, tela, rota, origem check in ('janela','promessa','react','rpc','manual'), mensagem (≤500), stack (≤4000), user_agent, versao_app, contexto jsonb, impressao text, status check in ('novo','visto','resolvido'), nota_admin, criado_em, resolvido_em)`.
- **Gravação:** `registrar_erro(...)` (categoria B). Trunca tamanhos, calcula `impressao = md5(mensagem + tela)` para agrupar repetidos e limita a 30 erros por usuário a cada 10 min. O limite é checado com `pg_advisory_xact_lock(<classe de limites>, hashtext('erro:' || auth.uid()::text))` antes da contagem, para que requisições simultâneas não passem do teto; o excedente é descartado com `{"ok": true, "descartado": true}`.
- **Sem tabela aberta:** nenhum `insert` direto pela API. Usuário comum não lê erros (nem os próprios).
- **Captura no app:** componente cliente pequeno em `layout.tsx` (listeners `error` e `unhandledrejection`) e fronteira de erro do React. Falhas de `rpc`/consulta importantes chamam `registrarErro` explicitamente. Tela atual vem de `usePathname` e da aba ativa quando existir.
- **Sanitização no cliente (`src/lib/erros.ts`):** remove query string e fragmentos de URL, tokens/JWT e e-mails da mensagem; nunca envia corpo de requisição nem valores financeiros. Falha ao registrar nunca interrompe o app (try/catch silencioso, com trava para não gerar laço).
- **Admin:** `admin_listar_erros(filtros, página)` agrupa por impressão (contagem, último, usuários afetados); `admin_atualizar_erro(id, status, nota)` auditada.

## 10. Solicitações

Tabela `solicitacoes (id uuid, user_id null on delete set null, tipo check in ('bug','problema','sugestao'), titulo ≤120, descricao ≤4000, tela, contexto jsonb, status check in ('nova','em_analise','aguardando_usuario','resolvida','recusada'), resposta_admin, criado_em, atualizado_em, atualizado_por)`. As colunas públicas de e-mail (`email_status check in ('pendente','enviando','enviado','falhou')`, `email_enviado_em`, `email_erro`) entram na migração 22 (`add column if not exists`).
- **Usuário:** cria por `criar_solicitacao(tipo, titulo, descricao, tela)` (categoria B; limite de 5 por hora, checado com `pg_advisory_xact_lock(<classe de limites>, hashtext('sol:' || auth.uid()::text))` antes da contagem; excedente devolve `limite_excedido`); lê as **próprias** (política `select` com `user_id = (select auth.uid())`), vendo status, resposta e `email_status`. **Nenhum `insert`/`update`/`delete` direto**, nem das colunas de e-mail.
- **Admin:** `admin_listar_solicitacoes(filtros, página)`, `admin_atualizar_solicitacao(id, status, resposta)` auditada.
- **No app:** botão "Reportar problema ou sugerir" na `TelaAjuda` (única alteração visível do app) e lista "Minhas solicitações" dentro dela, com status, resposta e selo de e-mail.

### 10.1 Anexos (imagens) e validação no servidor

- **Armazenamento:** bucket privado `solicitacoes-anexos` (`public = false`), 3 MB por arquivo no bucket. Máximo de 4 anexos e 12 MB no total por solicitação.
- **Tabela:** `solicitacoes_anexos (id uuid, solicitacao_id uuid not null references solicitacoes on delete cascade, user_id uuid null on delete set null, estado check in ('registrado','validando','validado','rejeitado','expirado'), caminho_bruto text unique, caminho_final text unique, nome_original text ≤120, mime_declarado text, mime_real text, bytes int, largura int, altura int, sha256_final text, motivo_rejeicao text, criado_em, validado_em)`. O token de reserva da validação fica em `homecash_interno.anexos_validacao` (o usuário lê a própria linha de anexo, então o token não pode morar nela).
- **Caminhos:** bruto `pend/{user_id}/{solicitacao_id}/{anexo_id}`; final `ok/{user_id}/{solicitacao_id}/{anexo_id}.{ext}`. O cliente não escolhe nome.
- **Fluxo:**
  1. `registrar_anexo(solicitacao, nome, mime_declarado, bytes_declarados)` (B): trava a linha da solicitação (`for update`) para contar com segurança, confere dono, estado `nova`, máximo de 4 anexos **vigentes** (`registrado` com menos de 1 h, `validando` e `validado`) e de 8 registros ao todo (rejeitados e expirados não ocupam vaga), soma ≤ 12 MB e mime declarado na lista; cria a linha `registrado` e devolve o `anexo_id`. Falha devolve o código do erro.
  2. O app recodifica a imagem no navegador (canvas, melhor esforço, só para reduzir tamanho; **não conta como validação**) e envia ao caminho bruto. A política de `insert` do Storage só aceita esse caminho se existir linha `registrado` do próprio usuário (`pode_registrar_anexo`).
  3. O app chama `POST /api/solicitacoes/[id]/processar` (§10.2), que valida cada anexo e depois envia o e-mail.
- **Validação real do conteúdo, no servidor** (route handler, Node, biblioteca `sharp`; dependência nova a aprovar no plano, incerteza #16). Para cada anexo `registrado`:
  1. reserva a validação com `anexo_validacao_reservar` (C), uma **reserva com prazo** (lease) descrita no ciclo de vida abaixo; duas chamadas simultâneas não validam o mesmo anexo;
  2. baixa o arquivo bruto com o JWT do usuário e mede os **bytes reais** (≤ 3 MB; o valor declarado é ignorado);
  3. confere os **bytes mágicos** de PNG, JPEG ou WEBP e rejeita qualquer outro formato (SVG, GIF, HEIC, PDF, HTML etc.);
  4. **decodifica a imagem inteira** com `sharp` (`failOn: 'error'`, `limitInputPixels` = 16 000 000, uma única página/quadro); arquivo truncado, corrompido, poliglota ou que não decodifica é rejeitado;
  5. exige largura e altura entre 16 e 4096 px e no máximo 16 megapixels;
  6. exige que o formato **decodificado** seja igual ao `mime_declarado`; diferença rejeita;
  7. aplica a rotação do EXIF, **recodifica** (PNG→PNG, JPEG→JPEG q85, WEBP→WEBP) sem nenhum metadado e confere que o resultado ≤ 3 MB;
  8. calcula o SHA-256 da imagem limpa (módulo `crypto` do Node, independente do Postgres), grava em `ok/...` (política `pode_gravar_final`: só com a linha em `validando` do próprio usuário), baixa de novo e **confere o hash**; se o arquivo foi trocado por fora, rejeita;
  9. registra o resultado com `anexo_validacao_concluir` (C, com o token): `validado` (com `mime_real`, `bytes`, `largura`, `altura`, `sha256_final`) ou `rejeitado` (com `motivo_rejeicao` curto), e apaga o arquivo bruto (política `pode_apagar_bruto`).
  Só anexos `validado` entram no e-mail e só eles podem ser abertos pelo admin. Depois de `validado`, nenhuma política permite `update` ou `delete` do arquivo final pelo usuário.
- **Políticas de `storage.objects`** (nomes `homecash_anexos_*`, todas com `bucket_id = 'solicitacoes-anexos'`, usando as auxiliares da categoria E):
  - usuário: `insert` em `pend/` (`pode_registrar_anexo`) e em `ok/` (`pode_gravar_final`); `select` dos próprios (`pode_ler_proprio`); `delete` em `pend/` (`pode_apagar_bruto`, só depois de o anexo sair de `registrado`) e em `ok/` **apenas enquanto o anexo está `validando`** (`pode_apagar_final`, para a retomada); **nenhum `update`**. Todas as auxiliares comparam o nome do objeto por **igualdade exata** com `caminho_bruto`/`caminho_final` da linha registrada (nunca por prefixo ou `like`), o que também impede `..`, barras extras e pastas de outro usuário;
  - admin: **sem `select` direto**. `admin_abrir_anexo(p_anexo)` (A) só abre anexo `validado`, grava a auditoria e uma concessão de 2 minutos em `homecash_interno.anexo_leituras`, e devolve o caminho final. A política de `select` do admin só vale com concessão ativa **e MFA válido** (`admin_pode_ler_anexo`, que aplica as condições do §5.8 em modo somente leitura). Então o cliente chama `createSignedUrl(caminho, 60)`. Não há leitura de anexo sem registro anterior.
- **Ciclo de vida e recuperação.**
  - **Reserva com prazo.** `homecash_interno.anexos_validacao (anexo_id pk, token uuid, reservado_em timestamptz, tentativas int not null default 0)` é a **fonte de verdade da reserva**; `solicitacoes_anexos.estado` é espelho, atualizado na mesma transação. `anexo_validacao_reservar` faz **um `update` nessa única linha**, com todas as condições no próprio `where`: aceita anexo `registrado` ou `validando` com `reservado_em` mais antigo que **5 min** (reserva vencida) e `tentativas < 3`; incrementa `tentativas`, grava `reservado_em = now()` e novo `token`. O dono é conferido antes, por consulta separada (o dono não muda, então não há corrida). Condições em outra tabela não entram no `where`: em `READ COMMITTED` só a linha travada é reavaliada.
  - **Esgotou as 3 tentativas.** Com a reserva vencida e `tentativas >= 3`, a própria função marca o anexo `rejeitado` (`motivo_rejeicao = 'falha_processamento'`) e responde `anexo_rejeitado`. Nada fica preso para sempre em `validando`.
  - **Queda no meio.** Antes de gravar em `ok/`, o handler apaga qualquer arquivo final remanescente (política `pode_apagar_final`) e refaz o processo a partir do bruto, que só é apagado **depois** de `anexo_validacao_concluir`. Cobertura: queda antes do final → bruto existe, retoma; queda depois de gravar o final → apaga e regrava; queda depois de concluir e antes de apagar o bruto → bruto órfão, apagado na próxima chamada de `processar` (a política aceita `delete` do bruto de anexo `validado` ou `rejeitado`).
  - **Upload ainda não terminou.** Se o bruto não existe, o anexo permanece `registrado` (não é rejeitado). Depois de 1 h sem arquivo vira `expirado`, de forma preguiçosa na próxima chamada de `registrar_anexo` ou `processar`, e libera a vaga.
  - **O que `processar` faz conforme o estado.** Algum anexo `validando` com reserva viva → responde `em_andamento` e **não** envia o e-mail. Anexos `rejeitado` ou `expirado` → o e-mail sai sem eles e o corpo diz quantos não foram aceitos.
  - **Custo.** Máximo de 20 validações por usuário por hora (contador em `homecash_interno`), para o `sharp` não virar vetor de consumo de CPU por contas descartáveis; excedente devolve `limite_excedido`.
  - **Por que o usuário não pula a validação sem o segredo.** Só `anexo_validacao_reservar`, que exige o segredo, leva o anexo a `validando`; e a política de `insert` em `ok/` só aceita o caminho de um anexo `validando`. Sem o segredo não existe arquivo em `ok/` nem anexo `validado`.
- **Risco residual (incerteza #21):** entre a gravação do arquivo final e o `anexo_validacao_concluir`, o usuário (que tem permissão de `insert` em `ok/`) poderia tentar gravar outro arquivo no mesmo caminho. Como o Storage não aceita sobrescrever sem `update`, a segunda gravação falha; o confere-hash do passo 8 detecta qualquer divergência. A janela residual é de milissegundos e só seria explorável com gravação concorrente; aceita na v1.
- **Privacidade da imagem:** capturas de tela podem mostrar dados financeiros; a tela de envio avisa. `reduzirImagem` em `src/lib/imagem.ts` devolve o original quando a recodificação falha; isso só importa para a pré-compressão, já que a validação real é a do servidor.
- **Exclusão de conta:** `user_id` fica nulo, mas os arquivos continuam no bucket. A remoção de anexos de contas excluídas fica para a tarefa de retenção (§13).

### 10.2 Envio para homecashofc@gmail.com e confirmação protegida

- **Destinatário:** `SOLICITACOES_EMAIL_DESTINO=homecashofc@gmail.com`, variável **só do servidor**. Nunca vem do cliente.
- **Problema a evitar:** se o próprio navegador pudesse chamar uma RPC "marcar como enviado", o usuário forjaria o status. **Solução: o status de e-mail só muda por funções da categoria C, que exigem um segredo que só o servidor conhece.**
- **Segredo de servidor.** `SOLICITACOES_SEGREDO_SERVIDOR` (aleatório, ≥ 32 bytes, gerado fora do banco) fica só em variável do servidor na Vercel, sem `NEXT_PUBLIC_`, lida em módulo de servidor (`server-only`).
  - **No banco fica só o hash.** `homecash_interno.servidor_segredos (slot check in ('atual','anterior'), hash text, ativo_ate timestamptz)`, sem nenhum privilégio de API. Você calcula o SHA-256 do segredo **na sua máquina** e insere apenas o hash no SQL Editor, fora de qualquer migração e do Git. Assim o segredo nunca passa pelo Supabase nem pelo histórico do editor, e um vazamento do banco ou de backup não entrega a credencial.
  - **Comparação.** `segredo_valido(p_segredo)` calcula `hash_texto(p_segredo)` e compara com os hashes ativos. Para um segredo aleatório de 256 bits, comparar hashes dispensa comparação em tempo constante: medir o tempo não permite reconstruir o segredo a partir de um prefixo do hash. Sem hash configurado devolve `servidor_nao_configurado`; segredo errado devolve `segredo_invalido`, registra (§5.7) e conta para o bloqueio de 5 falhas em 10 min.
  - **Rotação sem parada.** (1) gerar o novo segredo; (2) inserir o hash dele no slot `atual`, movendo o antigo para `anterior` com `ativo_ate` = agora + 1 h; (3) trocar a variável na Vercel e publicar; (4) depois da janela, apagar o slot `anterior`. Rotacionar também quando o segredo aparecer em log, captura de tela ou histórico.
  - **Higiene de logs.** O segredo viaja só no corpo da chamada RPC (HTTPS), nunca em URL nem cabeçalho. Nenhuma função o usa em mensagem de erro, `raise notice` ou na tabela de negados. O handler nunca registra `process.env`, cabeçalhos nem o corpo das chamadas ao Supabase. O log do Postgres não deve registrar parâmetros de chamadas (`log_statement`, parâmetros de `bind`; configuração não confirmada, #24). Um teste local falha se o nome da variável aparecer em código de cliente (`"use client"`, `src/components`, `src/app/**/page.tsx`).
  - **Alcance e vazamento.** O segredo só autoriza mudar o estado de e-mail e de validação; **não** lê dado de usuário nem é `service_role`. Mesmo assim, **com o segredo vazado e uma conta própria, o atacante consegue marcar como `validado` um anexo seu sem validação real e forjar `enviado`**: a validação é protegida por esse segredo, não por uma barreira separada. Vazamento é incidente: rotacionar e revisar os anexos `validado` do período. Essa dependência é uma limitação do modelo sem `service_role` (#22).
- **Máquina de estados atômica** (a mesma ideia vale para a validação de anexos):
  - Tabela privada `homecash_interno.solicitacoes_envios (solicitacao_id pk, situacao check in ('pendente','enviando','enviado','falhou'), tentativas int not null default 0, reservado_em timestamptz, token uuid)`, criada junto com a solicitação (em `criar_solicitacao`). **Ela é a fonte de verdade da reserva**; `solicitacoes.email_status` é espelho, atualizado na mesma transação.
  - `solicitacao_email_reservar(p_id, p_segredo)`: confere o segredo; confirma o dono com `select 1 from solicitacoes where id = p_id and user_id = auth.uid()` (o dono não muda, então não há corrida); e faz **um único `update` em `solicitacoes_envios`** com todas as condições no `where` dessa mesma linha: `situacao in ('pendente','falhou')`, ou `situacao = 'enviando'` com `reservado_em` mais antigo que 10 min, e `tentativas < 3`. O `update` incrementa `tentativas`, grava `reservado_em = now()`, um novo `token = gen_random_uuid()` e `situacao = 'enviando'`. Em `READ COMMITTED`, uma segunda requisição simultânea espera o lock da linha e reavalia o `where` já com o resultado da primeira (linha `enviando` dentro do prazo), então afeta 0 linhas. **Nenhuma condição do `where` pode estar em outra tabela**: nesse nível de isolamento o Postgres reavalia só a linha travada, não as juntadas. Depois espelha `email_status`. Zero linhas → `em_andamento`, `limite_excedido` ou `ja_enviado`, conforme o estado lido.
  - `solicitacao_email_concluir(p_id, p_token, p_resultado, p_erro, p_segredo)` só age se `situacao = 'enviando'` **e** o token confere (um token antigo, depois de a reserva ter sido retomada por outra chamada, não confere e é recusado); grava `enviado` (com `email_enviado_em`) ou `falhou` (com `email_erro` truncado) nas duas tabelas, na mesma transação.
  - Se o servidor cair no meio, a reserva expira em 10 min e a próxima chamada abre **uma nova tentativa**, contada normalmente (até o máximo de 3). Depois da terceira, a solicitação fica `falhou` de forma definitiva para o usuário e visível ao admin.
- **Route Handler** `POST /api/solicitacoes/[id]/processar`:
  1. valida `Authorization: Bearer <JWT>` com `supabase.auth.getUser(token)` (consulta ao Auth, não só decodifica) e cria um cliente com o JWT do usuário, então a RLS vale;
  2. valida os anexos pendentes (§10.1);
  3. chama `solicitacao_email_reservar`; sem token, encerra;
  4. monta o e-mail com a solicitação e os anexos `validado` (baixados com o JWT do usuário) e envia pelo provedor, com a chave em `EMAIL_API_KEY`;
  5. chama `solicitacao_email_concluir`.
  Idempotente: chamar de novo não reenvia o que já está `enviado`.
- **Sem `service_role`:** o handler nunca age como administrador.
- **Conteúdo seguro:** texto puro; assunto sem quebras de linha e ≤120 caracteres; nomes de arquivo sanitizados; corpo com id, tipo, tela, nome e e-mail de quem enviou, versão do app, descrição e as imagens limpas em anexo. Sem dados financeiros além do que a pessoa escreveu ou anexou.
- **Falha não perde o relato:** a solicitação já existe; `email_status` fica `pendente` ou `falhou`, aparece para o admin e o usuário pode tentar de novo (até 3 tentativas).
- **Limitações:**
  - Provedor ainda não escolhido: Resend (exige domínio verificado) ou SMTP do Gmail com senha de app. Decidir no plano.
  - A cópia que chega ao Gmail está **fora** do bucket privado e da auditoria do painel; a Política de Privacidade precisa dizer isso (§14).
  - O segredo é uma credencial de portador; o que um vazamento permite está no item "Alcance e vazamento" acima. Tratar como segredo de produção.
  - **Entrega "pelo menos uma vez".** Uma queda depois de o provedor aceitar o e-mail e antes de `solicitacao_email_concluir` faz a reserva vencer e o e-mail ser enviado de novo. O id da solicitação vai no assunto para permitir deduplicar; se o provedor oferecer chave de idempotência, usar `solicitacao_id` + número da tentativa.
  - O servidor aprova o e-mail e a imagem; um dono de banco ou da Vercel malicioso estaria fora do modelo.
  - Sem reenvio pelo admin na v1.
  - Limites de execução, memória e tamanho de resposta das funções da Vercel precisam ser conferidos no plano (4 imagens de até 16 MP em sequência).
  - Este Next 16.4.5 usa `cacheComponents: true`: ler `01-getting-started/15-route-handlers.md` antes de escrever o handler.

## 11. Interface

- Rotas: `/admin` (dashboard), `/admin/seguranca` (cadastro e verificação do MFA, §5.8), `/admin/usuarios`, `/admin/usuarios/[id]` (ficha e suporte), `/admin/erros`, `/admin/solicitacoes`, `/admin/auditoria`.
- `src/app/admin/layout.tsx`: guarda cliente → sem sessão vai para `/login`; `sou_admin()` falso chama `registrar_tentativa_admin` e mostra página "não encontrada" (não revela que `/admin` existe). Com `sou_admin()` verdadeiro, o layout consulta `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` e só libera o painel em `aal2`; nos demais casos mostra a tela de segurança (§5.8, R9). Menu lateral próprio no desktop e menu inferior/gaveta no celular, sem reutilizar `Sidebar`.
- Identidade visual: tokens existentes de `globals.css` (`--accent`, `--pos`, `--neg`, `--warn`, `--serie-*`, temas claro/escuro), `ui.tsx` e `lucide-react`. Selo "Admin" discreto para diferenciar do app.
- Tabelas com busca, filtros e paginação **no servidor**; no celular viram cartões empilhados. Sem rolagem horizontal da página, alvos de toque ≥ 44 px.
- Todas as telas tratam: carregando, vazio, erro, "função não instalada" (migração não aplicada) e acesso negado.
- **Conteúdo de terceiros é texto, nunca HTML.** Mensagem e `stack` de erros, título e descrição de solicitações, nomes de arquivo, `rota`, `user_agent`, nomes de usuários e motivos são escritos por usuários e lidos pelo admin, a conta mais poderosa do sistema. Regras: renderizar só como texto (o React escapa); **proibido** `dangerouslySetInnerHTML`, `innerHTML`, `eval` e `href` montado com dado de terceiro em `src/app/admin` e `src/components/admin` (teste estático); links só `https:` ou `mailto:` e com `rel="noreferrer"`; imagens só por URL assinada em `<img>`, nunca `<iframe>` ou `<object>`.
- **CSP e cabeçalhos para `/admin`:** `Content-Security-Policy` restritiva (sem `unsafe-inline` em script, com nonce), `X-Content-Type-Options: nosniff` e `frame-ancestors 'none'`, conforme `02-guides/content-security-policy.md`. Um XSS em qualquer parte do app expõe o JWT do admin no `localStorage` (§5.1); a CSP reduz o risco sem eliminá-lo, e o MFA (D1) é a defesa complementar.
- Antes de escrever código, ler `node_modules/next/dist/docs/` (AGENTS.md): este Next 16.4.5 tem `cacheComponents: true`, `proxy.ts` no lugar de `middleware` e convenções de erro próprias. Itens relevantes: `01-getting-started/10-error-handling.md`, `03-layouts-and-pages.md`, `15-route-handlers.md`, `16-proxy.md`, `02-guides/authentication.md`.

## 12. Arquivos, migrações e testes

### 12.1 Migrações

| Arquivo | Conteúdo |
|---|---|
| `supabase/supabase-19-admin-base.sql` | Pré-checagem (SHA-256, `auth.users`, leitura de `auth.mfa_factors` pelo dono das funções); schema `homecash_interno`; `admin_usuarios` (com `fatores_aprovados`), `admin_auditoria`, `admin_acessos_negados` (+ contador); triggers; `hash_texto`; `sou_admin`; `checar_admin`; `registrar_negado`; `registrar_tentativa_admin`; `admin_registrar_acesso`; `admin_resumo`; `admin_listar_usuarios`; `admin_usuario_detalhe`; `admin_listar_auditoria`; `admin_verificar_auditoria` |
| `supabase/supabase-20-admin-suporte.sql` | Pré-checagem de colunas (§6.5); `admin_sessoes_suporte`, `admin_suporte_confirmacoes`; `campos_permitidos`; `elegivel_suporte`; `admin_suporte_iniciar`, `admin_suporte_confirmar`, `admin_suporte_ler`, `admin_suporte_encerrar` |
| `supabase/supabase-21-erros-solicitacoes.sql` | `erros_app`, `solicitacoes`; `registrar_erro`, `criar_solicitacao`; RPCs `admin_*` de erros e solicitações; `admin_resumo_operacao` |
| `supabase/supabase-22-solicitacoes-anexos-email.sql` | Colunas de e-mail; `solicitacoes_anexos`; tabelas internas (`servidor_segredos`, `solicitacoes_envios`, `anexos_validacao`, `anexo_leituras`); funções C, E e `admin_abrir_anexo`, `registrar_anexo`; bucket e políticas de `storage.objects` |
| `supabase/testes/admin-*.sql` | Roteiros com `begin ... rollback`, só para rodar com autorização |

A 18 (fechamento) continua reservada e **independente**: a 19, a 21 e a 22 não a referenciam; a 20 só a usa via `to_regclass`. A 22 depende da 21 e do Storage do projeto (incerteza #13).

**Padrão de reexecução (cada migração roda em uma transação, com `set local lock_timeout`, e não remove nem altera objeto pré-existente):**

1. **Pré-checagem primeiro, antes de qualquer DDL.** Bloco `do $$` que verifica o que a migração exige (`auth.users`, SHA-256, colunas do §6.5, Storage) e **aborta com mensagem clara** se faltar algo. Só leitura de catálogo.
2. **Marcação de propriedade.** Todo objeto criado leva `comment on ... is 'homecash-admin:v1'`. Antes de substituir uma função, tabela ou política, o bloco confere: se o nome existe **sem** a marcação, a migração **aborta** em vez de sobrescrever. Assim nunca se toca em algo que já existia.
3. **Tabelas:** `create table if not exists`; colunas novas com `add column if not exists`; restrições e índices com `if not exists` ou verificação em `pg_constraint`. Nenhum `drop`, `alter` destrutivo, `truncate` ou `delete` em objeto existente.
4. **Funções:** `create or replace function` **somente** para nomes novos e marcados. Nenhuma função antiga é alterada. Depois de cada `create`, `revoke ... from public, anon, authenticated` e só então o `grant` da categoria (§5.2).
5. **Triggers:** só em tabelas **novas**. `drop trigger if exists <nome> on <tabela nova>` seguido de `create trigger` (não se usa `create or replace trigger`, para não depender da versão do PostgreSQL). Nenhum trigger é criado em `extrato`, `cartao`, `contas_fixas`, `perfis` ou outras tabelas antigas.
6. **Políticas:** RLS ligada nas tabelas novas; `drop policy if exists <nossa> on <tabela nova>` + `create policy`. Em `storage.objects` (tabela que já tem políticas de outros buckets) só se mexe em políticas com prefixo `homecash_anexos_`; `drop policy if exists "homecash_anexos_..."` apenas desses nomes, sempre com `bucket_id = 'solicitacoes-anexos'`. Nunca `alter policy` em política alheia.
7. **Bucket:** `insert into storage.buckets (...) values (...) on conflict (id) do nothing`. Se o bucket já existir, um bloco confere `public = false` e `file_size_limit`; se estiver público ou diferente, a migração **aborta** e não o altera. Plano B se `storage.buckets` ou suas colunas não aceitarem SQL: criar o bucket privado no painel e manter só as políticas na migração (incerteza #13).
8. **Segredo de servidor:** a migração só cria a tabela vazia. O valor é inserido à mão, uma vez, fora do Git.
9. **Desfazer:** cada arquivo termina com um bloco **comentado** que remove somente os objetos que ele criou (padrão das migrações 14 e 18). Nada é executado sozinho.
10. **Teste estático das migrações** (§12.2): proíbe `drop table|drop schema|drop function|truncate|delete from` e `alter table|function|policy` sobre nome fora da lista de objetos novos; exige a pré-checagem como primeiro bloco, a marcação em cada `create` e os blocos dos itens 11 e 12.
11. **Validação da estrutura dos objetos que já existem (nossos).** `create table if not exists` e `add column if not exists` não corrigem uma tabela existente que difira do esperado, e a marcação por `comment` só prova o nome, não a forma. Logo depois de criar, cada migração roda um bloco `do $$` que compara o catálogo com a definição esperada e **aborta listando as divergências**, sem corrigir nada sozinho: colunas (nome, tipo, `not null`, default), `check`s e chaves (`pg_constraint`), índices, triggers esperados e **ausência de triggers inesperados**, `relrowsecurity`, políticas presentes (`pg_policies`), proprietário e privilégios (`has_table_privilege`) e, para funções, `prosecdef`, `proconfig` (`search_path`), tipo de retorno e ACL (`proacl`). Se existir objeto marcado com estrutura diferente (versão anterior ou edição manual), a migração aborta e pede decisão; o conserto é uma migração nova e explícita (por exemplo a 23), nunca um `drop`.
12. **Verificação final de postura (assert).** O último bloco repete no banco as regras do teste estático: nenhuma função A, B ou C executável por `anon`; nenhuma D ou F executável por `anon` ou `authenticated`; E só por `authenticated`; nenhuma tabela nova com privilégio para `anon`/`authenticated` além do previsto; RLS ligada nas tabelas novas. Qualquer falha desfaz a transação inteira.
13. **Schema, bucket e políticas alheias.** `homecash_interno` também leva a marcação: se já existir sem ela, a migração aborta. No Storage, a pré-checagem lista `pg_policies` de `storage.objects` e **aborta** ao achar política permissiva para `anon`, `authenticated` ou `public` cuja condição não esteja limitada a outro `bucket_id` (por exemplo `true`, ou sem `bucket_id`), porque políticas permissivas se somam e anulariam a privacidade do bucket. No bucket já existente, confere também `allowed_mime_types` e `file_size_limit`.
14. **"Idempotente" = estado final idêntico e nenhum dado alterado**, não "nenhum comando executado": `create or replace function` e `comment on` regravam o catálogo a cada execução.

### 12.2 Aplicação e testes

**Aplicação:**
`src/app/admin/{layout,page}.tsx`, `src/app/admin/{usuarios,usuarios/[id],erros,solicitacoes,auditoria,seguranca}/page.tsx`,
`src/lib/adminMfa.ts` (decisão da tela a partir de `currentLevel`/`nextLevel`, chamadas de `mfa.enroll`, `challenge`, `verify`, `listFactors`),
`src/components/admin/*` (menu, tabela paginada, filtros, cartões de indicador, gráficos SVG, faixa de suporte, abas de suporte),
`src/lib/admin.ts` (chamadas `rpc`, envelope `ok/erro`, tipos, paginação), `src/lib/erros.ts` (captura e sanitização),
`src/lib/solicitacoes.ts` (criar, registrar e enviar anexos, pedir processamento),
`src/app/api/solicitacoes/[id]/processar/route.ts` (único código de servidor),
`src/lib/servidor/anexos.ts` (validação de imagem com `sharp`), `src/lib/servidor/email.ts` (montagem e sanitização do e-mail, testável sem rede).
**Variáveis novas (só servidor, nunca `NEXT_PUBLIC_`):** `EMAIL_API_KEY`, `SOLICITACOES_EMAIL_DESTINO`, `SOLICITACOES_SEGREDO_SERVIDOR`, remetente. Entram no `README.md` como nomes, sem valores.
**Dependência nova:** `sharp` (a aprovar no plano, incerteza #16).
**Alterações mínimas em arquivos existentes:** `src/app/layout.tsx` (captador de erros) e `src/components/TelaAjuda.tsx` (botão, lista e envio de anexos). `src/lib/imagem.ts` **não** muda. Nada mais.

**Testes locais (Vitest, sem banco), separados por categoria:**
- `tests/admin-lib.test.ts`: montagem de parâmetros, paginação, leitura do envelope `ok/erro`.
- `tests/admin-mfa.test.ts`: o mapa (`currentLevel`, `nextLevel`) → tela do §5.8 R9, incluindo `aal2`/`aal1` bloqueado; mensagens de erro de MFA em português; o QR e o segredo não são gravados em `localStorage` nem em log.
- `tests/erros-sanitizacao.test.ts`: remoção de token/e-mail/URL, truncamento, limite de disparo no cliente.
- `tests/sql-migracoes.test.ts` (padrão do §12.1): lê `supabase-19/20/21/22` e confere pré-checagem como primeiro bloco, marcação `homecash-admin:v1`, ausência de comandos destrutivos, triggers só em tabelas novas, nenhum `create or replace trigger`, uma política `homecash_anexos_*` por comando e todas com `bucket_id`.
- `tests/sql-funcoes-categorias.test.ts` — **cada categoria é testada pela sua finalidade**, a partir de uma tabela que classifica cada função do §5.2:
  - **A (RPC administrativa):** `security definer`, `set search_path = ''`, começa por `checar_admin`, retorna `jsonb` com envelope, `revoke ... from public, anon` e `grant ... to authenticated`, nenhum `raise exception` depois de um `insert` de registro (§5.7).
  - **B (usuário logado):** exige `auth.uid()`, não chama `checar_admin`, só toca dados do próprio `auth.uid()`; `sou_admin` é a única que retorna `boolean`.
  - **C (servidor):** exige `auth.uid()` e `segredo_valido`; `update` único com todas as condições no `where`; sem `raise` após registro.
  - **D (internas):** no schema `homecash_interno`, **sem** `grant execute` para `anon`/`authenticated`/`public`.
  - **E (políticas do Storage):** no schema `homecash_interno`, `grant execute` **somente** para `authenticated`, recebem só `text`, retornam `boolean`, usam `auth.uid()`.
  - **F (triggers):** retornam `trigger`, sem `grant execute`; os de imutabilidade sempre levantam exceção; existem **dois** triggers distintos para `admin_auditoria` e `admin_acessos_negados` (`before update or delete ... for each row` e `before truncate ... for each statement`).
  - Nenhuma função fora das categorias; nenhuma função nova no schema `public` além das categorias A, B e C.
  - Proíbe `to_jsonb(` devolvido sem passar por `campos_permitidos`; confere que as listas do §6.4 estão presentes e que `privado`/`compartilhado_com` não estão em nenhuma lista devolvida.
- `tests/hash-auditoria.test.ts`: reimplementa em TypeScript a serialização do §5.4 e verifica vetores conhecidos e a detecção de quebra, para a regra ficar especificada e testável sem banco.
- `tests/servidor-anexos.test.ts`: validação de imagem com arquivos de teste: JPEG/PNG/WEBP válidos passam; arquivo truncado, SVG, GIF, HTML renomeado como `.png`, poliglota, imagem acima de 4096 px ou 16 MP, tamanho real acima de 3 MB, formato diferente do declarado são rejeitados; saída sem EXIF.
- `tests/email-solicitacao.test.ts`: assunto sem CR/LF, corte de tamanho, nome de arquivo sanitizado, destinatário só do ambiente.
- `tests/admin-ui-seguranca.test.ts`: varre `src/app/admin`, `src/components/admin` e `src/app/api`; falha com `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function` ou `<iframe`; falha se `SOLICITACOES_SEGREDO_SERVIDOR`, `EMAIL_API_KEY` ou qualquer `SERVICE_ROLE` aparecer em código de cliente ou com prefixo `NEXT_PUBLIC_`; confere que `service_role` não existe no repositório.
- `tests/anexos-ciclo.test.ts` e `tests/email-ciclo.test.ts`: máquinas de estado (reserva, reserva vencida, retomada, limite de 3 tentativas, expiração de `registrado`, token antigo recusado) modeladas em TypeScript, para especificar a regra sem banco.

**Roteiros de banco** (`supabase/testes/admin-*.sql`, só com autorização, `begin ... rollback`, usuários de teste criados dentro da transação): recusa de não-admin e `anon` por categoria; imutabilidade (`update`, `delete`, `truncate`); cadeia de hash com duas sessões inserindo ao mesmo tempo; `admin_verificar_auditoria` após adulteração simulada; segredo errado; reserva de e-mail com duas chamadas simultâneas; reserva vencida de e-mail e de anexo; rotação de segredo com sobreposição; `admin_id` nulo na cadeia; bloqueio por MFA com claims simuladas (`aal1`, `aal2`, `amr` ausente ou antigo, fator novo não aprovado, fator removido com JWT antigo); casos da regra `elegivel_suporte`; confirmação de aba; omissão de lançamentos privados e partilhados; md5 das tabelas de domínio antes e depois; ausência das funções internas em `/rest/v1/rpc`.

## 13. Incertezas e divergências a tratar

| # | Item | Efeito no spec | Como resolver |
|---|---|---|---|
| 1 | `perfis.id` x `user_id` para contas reais e convidados | **Parcial (E5):** `handle_new_user` cria o perfil com `id = user_id = auth.users.id` para contas reais, e `excluir_minha_conta` apaga por `user_id` ou `id`. Junção do §8 confirmada para contas reais | Contagens em Q9.1 (convidados) |
| 2 | Privilégios padrão de tabelas novas (migração 08 sugere desligados) | **Confirmado (§18.5):** tabelas criadas por `postgres` no `public` nascem sem grant de API; `revoke`/`grant` explícitos em tudo (§5.3) | Nada a fazer |
| 3 | Colunas das tabelas base sem DDL versionado | Filtro por chave com lista explícita (§6.4); pré-checagem das colunas críticas na migração 20 | Conferir `extrato/cartao/contas_fixas` e demais listas antes da migração 20 |
| 4 | `meus_membros()`, `meus_grupos()`, `atualizar_repasse` não versionadas | **Resolvido (E5):** definições lidas; `meus_membros()` = perfis do próprio usuário (§6.2, §6.5 corrigidos). Convém versionar essas funções em arquivo, tarefa separada | Nada a fazer no painel |
| 5 | Estado real das migrações 09–14 | **Confirmado (E5):** 09 (ACLs sem `anon`), 10 (políticas com `(select auth.uid())`), 11 (9 índices) e 14 (3 triggers) aplicadas; 13 só pela ACL (definição não conferida); **12 e 18 não aplicadas**. Admin não depende delas | Existe `supabase_migrations.schema_migrations`; listar as versões é uma consulta opcional |
| 6 | **Migração 12 confirmada não aplicada (E5):** não existe o trigger `perfis_protege_colunas` e as políticas de `perfis` não limitam colunas | Sem efeito no admin; permissão nunca fica em `perfis`. É vulnerabilidade pré-existente (§18.5, E5-1) | Aplicar depois do deploy do código atual da branch; tarefa separada |
| 7 | Migração 18: tipo de `caixinha_movimentos.data`, tipo de `mes`, `aportes_investimento` sem trava | Admin só lê; não bloqueia | Itens já listados na 18 e em `propostas-supabase.md` |
| 8 | `CONTINUIDADE-HOMECASH.md` desatualizado (HEAD é `cc34726`; 18 e Resumo já commitados; árvore tem 15 arquivos modificados) | Nenhum | Atualizar o documento em tarefa separada |
| 9 | `anon` e `ip` nos registros de tentativas negadas (§5.7) | `anon` não é registrado; `ip` pode ser `null` | Conferir `request.headers` na primeira consulta autorizada |
| 10 | `auth.users.last_sign_in_at` e schema `auth` | **Confirmado (§18.5):** a coluna existe | Nada a fazer |
| 11 | Política de Privacidade não cobre suporte, erros, anexos nem envio por e-mail | **Portão de deploy** (§14), tarefa separada | Revisar `/privacidade` e `/termos` antes de publicar as fases 3 a 5 |
| 12 | Crescimento de `erros_app`, `admin_auditoria` e anexos órfãos (conta excluída) sem limpeza | Aceito na v1 | Definir retenção depois |
| 13 | Storage via SQL: `storage.buckets` e suas colunas, e políticas já existentes em `storage.objects` (políticas permissivas se **somam**; uma política alheia ampla sobre o mesmo bucket anularia a privacidade) | Migração 22 depende disso; escopo por `bucket_id` | Antes de aplicar a 22, listar as políticas de `storage.objects` e o bucket `avatars`; plano B: criar o bucket no painel |
| 14 | **SHA-256 no PostgreSQL do projeto** | **Resolvido (§18.5):** Postgres 17.11, `sha256(bytea)` nativo e `pgcrypto` em `extensions`. A pré-checagem continua na migração 19 | Nada a fazer |
| 15 | O schema `homecash_interno` não deve estar entre os "Exposed schemas" da API do Supabase | Funções D/E/F sem rota `/rest/v1/rpc` | Conferir a configuração da API no painel; se estiver exposto, não expor |
| 16 | Dependência `sharp` (binário nativo), tempo e memória na Vercel; scripts de instalação do npm 11 já bloqueiam alguns pacotes (CONTINUIDADE §4) | Validação de imagem depende dela | Verificar no plano: instalação sem scripts, limites da função |
| 17 | Provedor de e-mail e remetente indefinidos; cópia no Gmail sai do controle do painel | Escolha no plano | Resend (domínio verificado) ou SMTP do Gmail com senha de app |
| 18 | O dono do banco pode desligar triggers da auditoria; apagar as últimas linhas não quebra a cadeia | Hash só detecta adulteração no meio (§5.4); `cabeca` exibida para registro externo | Aceito na v1 |
| 19 | **Rebaixada pela E5 e E6 (§18.5):** o banco não usa `privado`, mas só mostra a linha ao dono, ao responsável e ao destinatário de `compartilhado_com` (`meus_membros()` devolve só os perfis do próprio usuário). "Só eu" com responsável igual ao dono não vaza; vaza só para quem foi marcado responsável ou destinatário | Suporte falha fechado (§6.5). **Fora do escopo deste spec** | Opcional: decidir a semântica de "Só eu" com outro responsável; não bloqueia o painel |
| 20 | Nível de isolamento das chamadas RPC (a cadeia assume `READ COMMITTED`) | Em outro nível, `unique (ordem)` faz o insert falhar em vez de gravar cadeia errada | Conferir no roteiro de banco |
| 21 | Janela mínima de gravação concorrente em `ok/` antes do `anexo_validacao_concluir` (§10.1) | Aceita na v1; confere-hash a detecta | Revisar se o Storage recusa sobrescrita sem `update` |
| 22 | Segredo de servidor: só o hash fica no banco (§10.2), mas a validação de anexos e o status de e-mail dependem dele; vazado, permite forjar `validado` e `enviado` de anexos e solicitações **próprios** | Limitação do modelo sem `service_role`; rotação com sobreposição e revisão dos anexos do período | Aceito na v1; tratar vazamento como incidente |
| 23 | Sessão do admin em `localStorage`: um XSS expõe o JWT do admin | **D1 aprovada:** MFA obrigatório no banco (§5.8) mais §11 (texto escapado, CSP). O MFA não impede um XSS que roube um token já `aal2` durante a sessão; escape e CSP continuam necessários | Validar o fluxo com conta de teste (§18, E8 e E10) |
| 24 | Configuração de log do Postgres e do Supabase (`log_statement`, parâmetros de `bind`, retenção dos logs de API) | O segredo viaja só no corpo; higiene do §10.2 | Conferir a configuração de logs do projeto |
| 25 | `statement_timeout` do papel `authenticated` | **Resolvido (§18.5):** 8 s. Verificação da auditoria paginada (§5.4); `p_limite` máximo 200 no suporte | Nada a fazer |
| 26 | Concessões padrão de `EXECUTE` do Supabase em funções novas (`pg_default_acl`) | **Confirmado (§18.5):** funções novas no `public` abrem para `anon` e `authenticated`; `revoke` explícito e verificação final de ACL (§5.2, §12.1 itens 11 e 12) | Nada a fazer |
| 27 | Entrega do e-mail "pelo menos uma vez": queda entre o envio e a confirmação gera e-mail duplicado | Aceito; id no assunto para deduplicar (§10.2) | Chave de idempotência do provedor, se houver |
| 28 | Totais calculados no suporte divergem do app quando há linhas omitidas (§6.3) | Aviso na tela | Aceito |
| 29 | A auditoria guarda o e-mail do alvo depois da exclusão da conta | Necessário para a rastreabilidade; entra no portão da Política de Privacidade (§14) | Definir base legal e prazo de retenção na tarefa de privacidade |
| 30 | A claim `amr` é **opcional** na documentação do Supabase; a janela de 8 h do MFA (§5.8 R5.5) depende de uma entrada `totp` com `timestamp` | Se um token `aal2` real não trouxer `amr`, a regra de frescor sai do spec e valem só `aal2`, fator aprovado e limite de sessão do projeto | Inspecionar um token `aal2` de conta de teste (§18, E10) |
| 31 | Cadastrar outro fator com fator já verificado exige `aal2` (código do Supabase Auth, `insufficient_aal`). Não confirmado: se `unenroll` exige `aal2` e se `listFactors()` inclui fatores não verificados | A aprovação de fator (§5.8 R5.3) continua necessária para a janela anterior à primeira verificação | Testar com conta de teste (§18, E10) |
| 32 | O dono das funções precisa ler `auth.mfa_factors` (colunas `id`, `user_id`, `status`, `factor_type`); a recuperação (R8) pode precisar de `DELETE` | **Resolvido (§18.5):** `postgres` lê e apaga; a coluna `secret` existe e nunca é lida; `status` e `factor_type` são enums. A pré-checagem da migração 19 continua | Nada a fazer |
| 33 | TOTP precisa estar habilitado (cadastro e verificação) nas configurações de Auth do projeto; limite de tentativas errôneas e `max_enrolled_factors` (padrão 10 na documentação) | Pré-requisito da ativação (§5.8 R3 e R4) | Conferir no painel (§18, E10) |
| 34 | JWT antigo continua `aal2` depois de remover o fator (documentação: "stale JWT") | `checar_admin` exige fator verificado e aprovado (§5.8 R5.4) | Roteiro de banco (§5.8 R10) |

## 14. Fases e portões

Cada fase termina testada localmente (`vitest`, `tsc`, `build`) e **espera autorização** antes de qualquer SQL no banco.

1. **Base:** migração 19 (admin, auditoria, hash, negados, `sou_admin`, `checar_admin` com MFA), layout `/admin`, **telas de segurança e MFA (§5.8)**, guarda, menu, dashboard parcial, auditoria. Nenhuma RPC administrativa funciona sem MFA desde o primeiro dia.
2. **Usuários:** listagem, busca, filtros, ficha.
3. **Suporte:** migração 20, faixa de suporte, abas somente leitura, regra do §6.5.
4. **Erros e solicitações:** migração 21, captador no app, botão na `TelaAjuda`, telas admin.
5. **Anexos e e-mail:** migração 22, upload privado, validação no servidor, `route.ts`, variáveis e segredo de servidor, abertura de anexo pelo admin com concessão e auditoria.

**Portão da Política de Privacidade (tarefa separada):** a revisão do texto de `/privacidade` e `/termos` é feita **antes do deploy** das fases 3, 4 e 5. Deve cobrir: acesso de suporte com motivo e auditoria; omissão de lançamentos privados de outros integrantes; coleta de erros técnicos; anexos de imagem, sua validação e retenção; envio das solicitações por e-mail a um provedor externo e à caixa `homecashofc@gmail.com`; direito de exclusão e a retenção do e-mail do alvo na auditoria depois da exclusão (#29). Não faz parte da implementação deste spec e não altera esses arquivos agora.

**Ordem de publicação segura:** o código do app tolera migração ausente (rotas admin mostram "não instalado"; captador de erros e botão de solicitação falham em silêncio). Então o deploy do código pode vir antes ou depois do SQL.

**Aplicação de SQL (futura, com autorização por migração):** rodar a migração (a pré-checagem aborta sozinha se algo não bater); rodar o roteiro de testes em `begin/rollback`; conferir que as funções D, E e F não aparecem na API e que as A recusam não-admin e `anon`; só então fazer a ativação do primeiro admin na ordem do §5.8 (R3) e, na fase 5, o segredo de servidor.

## 15. Critérios de aceite

- Conta comum chamando qualquer RPC categoria A recebe `{"ok": false, "erro": "acesso_negado"}` e deixa **uma** linha em `admin_acessos_negados` por hora; repetir só aumenta o contador. `anon` não consegue executar nenhuma.
- Toda falha de validação das categorias A, B e C devolve envelope e **não** levanta exceção. Para cada código **registrável** do §5.7 (`acesso_negado`, `sessao_invalida`, `aba_nao_confirmada`, `recurso_invalido`, `parametro_invalido` nas RPCs A, `segredo_invalido`, `servidor_nao_configurado`), um teste força o erro e confere que a linha de `admin_acessos_negados` (ou o contador, dentro do teto da hora) permaneceu. Os códigos **não registráveis** (`limite_excedido`, `em_andamento`, `ja_enviado`, `nao_encontrado` e as falhas das RPCs B) são conferidos só como resposta.
- Funções D, E e F não respondem em `/rest/v1/rpc/...` para `anon` nem `authenticated`; as E funcionam dentro das políticas do Storage; as A, B e C só `authenticated`.
- **MFA (§5.8):** admin ativo em `aal1` recebe `mfa_requerida` (há fator aprovado) ou `mfa_nao_configurada` em **toda** RPC A e não recebe dado algum; em `aal2` com fator aprovado, funciona. Fator verificado não aprovado → `fator_nao_aprovado`. JWT `aal2` antigo depois de remover o fator → `mfa_nao_configurada`. Com a regra de frescor mantida (#30), `amr` `totp` com mais de 8 h → `mfa_expirada`. Cada um desses códigos deixa registro (§5.7).
- Sem MFA válido, a política de leitura de anexos do admin **não** libera o arquivo, mesmo com concessão ativa. `sou_admin()` verdadeiro em `aal1` só mostra a tela de segurança.
- A interface segue a tabela de estados do §5.8 R9 (inclui `aal2`/`aal1` bloqueado) e não oferece remover fator; a ativação segue a ordem do R3.
- `admin_auditoria` e `admin_acessos_negados` rejeitam `update`, `delete` e `truncate` (três comandos testados separadamente; o trigger por instrução cobre o `truncate`).
- Com duas sessões inserindo auditoria ao mesmo tempo, a cadeia fica sem `ordem` repetida nem salto, e `admin_verificar_auditoria` devolve `primeira_quebra = null`; após adulteração simulada em transação com rollback, devolve a `ordem` correta. A verificação funciona em páginas e uma linha com `admin_id` nulo (mudança feita no SQL Editor) é gravada sem erro e entra na cadeia.
- A migração 19 aborta, sem criar nada, quando não há `sha256(bytea)` nem `digest`.
- Aba financeira sem confirmação na sessão devolve `aba_nao_confirmada`, registra a tentativa e não devolve linhas.
- Nenhuma resposta de `admin_suporte_ler` contém chave fora do §6.4; `avatar_url`, `usuario_id`, `salario`, `privado` e `compartilhado_com` nunca aparecem.
- **Lançamentos `privado = true` ou com `compartilhado_com` preenchido de outro integrante não aparecem em nenhuma resposta do suporte nem nas contagens da ficha**, só o número `omitidas`; os do próprio alvo aparecem. A migração 20 aborta se as colunas necessárias não existirem.
- Anexo: arquivo que não é imagem válida (truncado, SVG, GIF, HTML renomeado, poliglota, acima de 4096 px, 16 MP ou 3 MB reais, formato diferente do declarado) termina `rejeitado` e nunca é anexado ao e-mail nem aberto pelo admin; imagem válida é recodificada sem metadados e só então fica `validado`.
- Usuário só registra anexo em solicitação própria, `nova`, dentro de 4 anexos e 12 MB, mesmo com requisições simultâneas; só lê os próprios; o admin só obtém URL assinada após `admin_abrir_anexo`, dentro de 2 minutos e apenas para anexo `validado`.
- Um usuário chamando diretamente `solicitacao_email_reservar` ou `solicitacao_email_concluir` sem o segredo recebe `segredo_invalido` (registrado) e não muda nada; com o segredo errado idem; após 5 falhas em 10 min as RPCs C respondem `limite_excedido` sem comparar.
- No banco só existe o **hash** do segredo; durante a rotação os dois segredos valem na janela e depois só o novo; nenhum log do handler nem mensagem de função contém o segredo.
- Anexo preso em `validando` volta a ser processado depois de 5 min e vira `rejeitado` (`falha_processamento`) após 3 tentativas; `registrado` sem arquivo vira `expirado` em 1 h e libera a vaga; uma queda entre a gravação em `ok/` e a conclusão não deixa arquivo final sem registro nem bruto apagado antes da hora; `processar` com anexo `validando` de reserva viva responde `em_andamento` e não envia o e-mail.
- Um `token` de reserva antigo (de e-mail ou de anexo) é recusado depois que a reserva foi retomada por outra chamada.
- Conteúdo de terceiros (erros, solicitações, nomes de arquivo, `rota`, `user_agent`) aparece como texto; o teste estático de `src/app/admin` e `src/components/admin` não encontra HTML injetado.
- Duas chamadas simultâneas a `POST /api/solicitacoes/[id]/processar` resultam em **um** envio e no máximo 3 tentativas no total; a segunda recebe `em_andamento`. (A garantia é "pelo menos uma vez": uma queda depois do envio e antes da confirmação pode gerar um e-mail duplicado quando a reserva vencer, #27.) Falha do provedor deixa `email_status = 'falhou'` sem perder o relato. O destinatário nunca vem do cliente.
- Sessão de suporte expirada, encerrada ou de outro admin não lê nada.
- Após uma sessão de suporte completa, o md5 das tabelas de domínio é idêntico.
- Reexecutar cada migração deixa o catálogo e os dados no mesmo estado final e sem erro (os comandos `create or replace` e `comment on` são reexecutados, o que é esperado). Objeto preexistente sem a marcação `homecash-admin:v1`, ou com a marcação mas estrutura divergente (coluna, `check`, trigger, RLS, ACL, `search_path`), faz a migração abortar listando as divergências e sem modificar o objeto. A verificação final de postura (§12.1, item 12) passa.
- Excluir uma conta de teste mantém a auditoria e zera `user_id` em erros, solicitações e anexos, e não falha nem para a conta de um admin (`admin_usuarios` sem chave estrangeira).
- Usuário só lê as próprias solicitações e nunca lê `erros_app`.
- App atual (rotas `/`, `/login`, `/perfil`) se comporta como antes; `vitest`, `tsc` e `build` passam.
- Layout sem rolagem lateral em 390 px e 1280 px, nos temas claro e escuro.

## 16. Revisões

**v2 (2026-11-05):**
1. Confirmação por aba financeira, exigida no banco.
2. Lista explícita de campos no suporte.
3. Registro de tentativas negadas.
4. Imutabilidade da auditoria com trigger por linha e trigger por instrução (`TRUNCATE`).
5. Anexos de imagem em bucket privado.
6. Envio ao e-mail da equipe por route handler, sem `service_role`.
7. Política de Privacidade como tarefa separada e portão de deploy.

**v3 (2026-11-05), a pedido do responsável:**
1. **E-mail:** o usuário não consegue mais marcar "enviado". O status só muda por funções que exigem um segredo de servidor; a reserva é um `update` atômico com limite de 3 tentativas e validade de 10 min (§10.2). `solicitacao_email_resultado` foi removida.
2. **Privados:** verificado no código (§6.5). A regra do `privado` não está confirmada, então o suporte omite **a linha inteira** de lançamentos privados ou partilhados de outros integrantes, em vez de mascarar a descrição.
3. **Anexos:** validação real no servidor com decodificação e recodificação, além de MIME, tamanho, quantidade e dimensões (§10.1).
4. **Auditoria:** SHA-256 não é presumido; pré-checagem com `sha256(bytea)` ou `digest` e aborto se nenhum existir. Definidos serialização com lock consultivo, ordem da cadeia própria (`ordem`), fórmula do hash e verificação por `lag()` (§5.4).
5. **Testes:** funções classificadas em seis categorias, cada uma testada pela sua finalidade (§5.2, §12.2).
6. **Migrações:** padrão reexecutável com pré-checagem, marcação de propriedade, aborto sobre nome preexistente e nenhum comando destrutivo (§12.1).
7. **Permissões:** funções internas em schema não exposto; `EXECUTE` por categoria; auxiliares de política do Storage com `EXECUTE` só para `authenticated` (§5.2).
8. **Negados:** regra única para todas as validações: devolver, registrar e nunca levantar exceção depois do registro (§5.7).

**v3.1 (2026-11-05), auditoria técnica a pedido do responsável:** 20 achados documentados no §17, todos corrigidos no texto quando eram documentais. Principais mudanças: reserva de e-mail e de anexo reescritas sobre uma única linha (§10.1, §10.2); recuperação de anexos presos; hash da cadeia por `jsonb_build_array` (§5.4); verificação paginada; segredo só como hash, com rotação e bloqueio (§10.2); regras contra XSS e CSP e decisão D1 de MFA (§5.1, §11); validação de estrutura das migrações (§12.1); ACL padrão do Supabase (§5.2); critérios de aceite coerentes com o comportamento (§15).

**v3.2 (2026-11-05):** decisão **D1 aprovada**: MFA TOTP (`aal2`) obrigatório para administradores. Requisitos de ativação, verificação e bloqueio no §5.8; códigos de MFA no §5.7; telas de segurança no §11; `fatores_aprovados` em `admin_usuarios`; critérios no §15; incertezas #30 a #34. Acrescentado o **plano de validação no banco** (§18): consultas somente leitura preparadas, nenhuma executada. **v3.2.1:** revisão pontual do §5.8 (comparação de `aal` segura contra nulo, só fator TOTP, janela de cadastro reduzida, compatibilidade de `verify` e `listFactors`, recuperação); a especificação está pronta para a validação do banco.

**Ainda depende de confirmação no banco (nada foi consultado):** versão do PostgreSQL e SHA-256 (#14); colunas reais e privacidade de `privado` (#3, #19); `meus_membros()` (#4); políticas existentes de `storage.objects` e bucket (#13); schemas expostos da API (#15); `perfis.id` x `user_id` (#1); `last_sign_in_at` e cabeçalhos (#9, #10); `pg_default_acl` (#26); `statement_timeout` (#25); configuração de logs (#24); MFA e claim `aal` (#23, #30 a #34).

## 17. Auditoria técnica do SPEC v3

Auditoria feita sobre o texto do v3, sem consultar o Supabase e sem alterar código. "Tipo" separa **vulnerabilidade** (permite abuso), **falha de implementação** (a regra, como escrita, não funcionaria) e **limitação** (aceita ou fora do controle). "Banco" indica se a confirmação exige consulta ao banco (nenhuma foi feita).

| # | Gravidade | Tipo | Cenário concreto | Correção aplicada (mínima) | Banco? |
|---|---|---|---|---|---|
| A1 | **Alta** | Falha de implementação | A reserva de e-mail era "um único `update`" que filtrava `user_id` e `email_status` em `solicitacoes` e `tentativas`/`reservado_em` em `solicitacoes_envios`. Um `update` não cobre duas tabelas, e em `READ COMMITTED` o Postgres reavalia só a linha travada, não as juntadas. Duas requisições simultâneas poderiam passar das 3 tentativas ou enviar duas vezes | A reserva vive numa única linha (`solicitacoes_envios`), com todas as condições no `where` dela; o dono é conferido antes por consulta separada; `email_status` vira espelho (§10.2). Mesma regra para a reserva de anexos (§10.1) | Não; o roteiro de banco prova a concorrência depois |
| A2 | **Alta** | Falha de implementação | Anexo que cai em `validando` (timeout da função, queda) nunca era reprocessado, porque a reserva só aceitava `registrado`; o final já gravado em `ok/` impedia regravar (o Storage não sobrescreve); `registrado` sem arquivo ocupava vaga para sempre. A solicitação ficava sem anexos e o e-mail nunca fechava | Ciclo de vida com reserva de prazo (5 min), 3 tentativas, `rejeitado` por `falha_processamento`, `expirado` em 1 h, apagar o final remanescente na retomada, bruto apagado só depois de concluir, `em_andamento` bloqueia o e-mail (§10.1) | Não |
| A3 | **Alta** | Falha de implementação | O hash concatenava com `\|\|`. `admin_id` é nulo quando a mudança vem do SQL Editor (`auth.uid()` nulo); `texto \|\| NULL` dá `NULL`, o `insert` falha por `hash not null` e a própria inclusão do primeiro admin ficaria barrada pelo trigger de auditoria. O `\|` dentro de um termo de busca também deslocava a fronteira dos campos | Hash sobre `jsonb_build_array(...)::text`, que preserva nulos e fronteiras (§5.4) | Não |
| A4 | **Alta** | Vulnerabilidade (condicional) | O admin lê texto escrito por usuários (erros, solicitações, nomes de arquivo, `user_agent`). Um HTML/JS injetado e renderizado sem escape roubaria o JWT do admin do `localStorage` e permitiria chamar todas as RPCs `admin_*`; o app não tem MFA | Texto sempre escapado, `dangerouslySetInnerHTML` proibido (teste estático), CSP restritiva em `/admin` (§11); MFA `aal2` obrigatório, **D1 aprovada** (§5.8) | Claim `aal` confirmada na documentação do Supabase; falta validar com token real (§18) |
| A5 | **Média** | Falha de implementação | O segredo de servidor ficaria em texto no banco, e inserido pelo SQL Editor ficaria no histórico do editor; sem rotação sem parada; sem bloqueio de tentativas; sem regra de log | Só o hash no banco (calculado fora do Supabase), dois slots para rotação, bloqueio de 5 falhas em 10 min e higiene de logs (§10.2) | Só a configuração de logs (#24) |
| A6 | **Média** | Limitação | Com o segredo vazado e uma conta própria, o atacante marca como `validado` um anexo seu sem validação real (grava o arquivo em `ok/` durante `validando`) e forja `enviado`; o admin abriria depois esse arquivo | Documentado como incidente (rotacionar e revisar anexos `validado`); sem `service_role` não há como separar essa barreira do segredo (§10.2, #22) | Não |
| A7 | **Média** | Falha de implementação | `admin_verificar_auditoria` lia a tabela inteira numa consulta; o `statement_timeout` do papel `authenticated` interromperia a verificação assim que a cadeia crescesse | Verificação paginada com `p_limite` e `proxima` (§5.4) | Conferir o timeout (#25) |
| A8 | **Média** | Vulnerabilidade (negação de serviço) | Milhares de contas descartáveis chamando `registrar_tentativa_admin` enchem uma tabela imutável; o mesmo vale para `processar` consumindo CPU do `sharp` | Teto global de 200 linhas novas por hora em `admin_acessos_negados`; 20 validações por usuário por hora (§5.7, §10.1) | Não |
| A9 | **Média** | Falha de implementação | `create table if not exists` e `add column if not exists` não corrigem tabela existente com outra forma; a marcação por `comment` prova só o nome. Função `create or replace` não repõe ACL; `homecash_interno` ou o bucket poderiam já existir | Validação de estrutura, assert final de postura, marcação do schema e checagem do bucket (§12.1 itens 11 a 14) | A pré-checagem lê o catálogo no momento da aplicação, com autorização |
| A10 | **Média** | Falha de implementação | `revoke ... from public` não remove concessões padrão do Supabase para `anon`/`authenticated`; faltava `registrar_auditoria` na categoria D e `pode_apagar_final` na E; o schema interno não revogava `public` | `revoke` explícito de `public, anon, authenticated`, ACL verificada, funções incluídas, `revoke all on schema ... from public` (§5.2) | Confirmar `pg_default_acl` (#26) |
| A11 | **Média** | Vulnerabilidade (condicional) | Políticas permissivas se somam. Uma política antiga de `storage.objects` sem `bucket_id` (por exemplo criada pelo painel) liberaria os anexos privados a qualquer logado; comparar caminho por prefixo permitiria `..` ou pasta alheia | Pré-checagem que aborta ao achar política permissiva alheia; comparação de caminho por igualdade exata (§12.1 item 13, §10.1) | Sim: listar `pg_policies` de `storage.objects` |
| A12 | **Média** | Falha de implementação | A regra de elegibilidade é o único filtro (as funções ignoram a RLS). Casos de borda sem definição: alvo sem grupo, `privado` nulo, linha de grupo antigo | Alvo sem grupo definido; `coalesce` fail-closed; roteiro de teste com os casos (§6.5) | Sim, para a regra real de privacidade (#19) |
| A13 | Baixa | Falha de implementação | `admin_usuarios` com chave estrangeira em cascata para `auth.users`: o trigger do último admin barraria a exclusão da conta do admin e `excluir_minha_conta` falharia | Sem chave estrangeira (§5.1) | Não |
| A14 | Baixa | Inconsistência | O critério exigia registro para toda falha, mas `limite_excedido` das RPCs B não registra; `em_andamento` e `ja_enviado` não estavam na lista de códigos; o texto dizia "reaproveita a tentativa" enquanto a reserva incrementa; "não altera nada" era falso para `create or replace`; "um envio" ignorava a entrega repetida | Códigos separados em registráveis e só respondidos; critérios reescritos (§5.7, §10.2, §15) | Não |
| A15 | Baixa | Falha de implementação | `hashtext('erro:' \|\| auth.uid())` não compila (uuid sem cast) e `hashtext` pode colidir com a chave da cadeia; risco de deadlock entre as duas cadeias | Cast para `text`, classes de lock distintas e regra de ordem dos locks (§5.4, §9, §10) | Não |
| A16 | Baixa | Limitação | Queda depois de o provedor aceitar o e-mail e antes de confirmar gera e-mail duplicado quando a reserva vence | Garantia "pelo menos uma vez" documentada; id no assunto; idempotência do provedor se houver (§10.2, #27) | Não |
| A17 | Baixa | Limitação | Várias sessões de suporte abertas ao mesmo tempo por um admin ampliam a janela de leitura | Uma sessão ativa por admin; iniciar encerra as anteriores (§6.1) | Não |
| A18 | Baixa | Limitação | Totais calculados no painel divergem do app quando há linhas omitidas; `retrato` do fechamento pode agregar linhas de terceiros | Aviso na tela; `retrato` tratado como registro do alvo (§6.3, §6.5, #28) | Não |
| A19 | Baixa | Limitação | A auditoria guarda o e-mail do alvo depois que a conta é excluída | Entra no portão da Política de Privacidade (§14, #29) | Não |
| A20 | Baixa | Limitação | O dono do banco desliga triggers; apagar a cauda da cadeia não é detectável | Já documentado (§5.4); `cabeca` exibida para registro externo | Não |

**Itens verificados sem problema:** o `unique (ordem)` mais o lock protegem a cadeia contra `id`/`now()` fora de ordem; o `truncate` tem trigger por instrução próprio; as funções de categoria D e F não aparecem na API enquanto o schema não for exposto (#15); a revogação de admin vale na hora (§5.1); a etapa `confirmar` é idempotente por chave composta; `route handler` com `Bearer` não sofre CSRF por cookie.

**O que ainda precisa de autorização ou validação real (nada foi feito):**
1. Aprovar o SPEC v3.2. A decisão **D1** (MFA `aal2`) já está **aprovada**.
2. Consultas somente leitura ao banco, uma a uma: versão do PostgreSQL e SHA-256 (#14); `pg_default_acl` (#26); `statement_timeout` (#25); políticas de `storage.objects` e bucket (#13, A11); schemas expostos da API (#15); `meus_membros()` e políticas reais de `extrato`, `cartao`, `contas_fixas` (#4, #19); colunas reais das listas do §6.4 (#3); `perfis.id` x `user_id` (#1); `last_sign_in_at` (#10).
3. Configuração fora do banco: logs do Postgres e do Supabase (#24); MFA do projeto (#23).
4. Aprovar a dependência `sharp` e escolher o provedor de e-mail (#16, #17).
5. Tarefa separada da Política de Privacidade, antes do deploy das fases 3 a 5.
6. Autorização para escrever o plano de implementação (skill writing-plans) e, depois, **por migração**, para aplicar qualquer SQL.

## 18. Plano de validação no banco (consultas somente leitura, preparadas e NÃO executadas)

**Status: nenhuma consulta foi executada.** O `CONTINUIDADE-HOMECASH.md` proíbe até consultas ao Supabase; este plano só as prepara. Cada etapa precisa da **sua autorização expressa antes de rodar**.

### 18.1 Regras de execução
1. **Uma etapa por vez.** Eu aviso qual etapa vou rodar, você autoriza, eu rodo, mostro o resultado e paro. Nada é encadeado sem nova autorização.
2. **Somente leitura, garantida pelo banco.** Cada consulta roda isolada dentro de `begin transaction read only; <consulta>; rollback;`. Qualquer escrita falharia. Nenhuma consulta usa `insert`, `update`, `delete`, `create`, `alter`, `drop`, `grant`, `set` persistente, `pg_read_file` ou funções de escrita.
3. **Só catálogo e metadados**, exceto as consultas marcadas **[DADOS]** (E9), que leem tabelas de usuários mas devolvem **apenas contagens agregadas**; essas pedem autorização separada.
4. **Nada sensível no resultado.** Nenhuma consulta devolve e-mail, nome, valor financeiro ou token. Se alguma saída trouxer dado pessoal inesperado, eu paro e não a repito.
5. **Falhou ou veio diferente do esperado?** Eu paro a etapa, informo e não improviso consultas novas.
6. **Registro.** Depois de cada etapa, com sua autorização, eu atualizo as incertezas do §13 com o resultado e o que muda no spec.
7. **Executor.** Console SQL do Supabase (você roda e me mostra o resultado) ou a ferramenta MCP de SQL do Supabase (eu rodo). A escolha é sua; as regras acima valem para os dois.

### 18.2 Etapas

**E1. Ambiente e SHA-256** (decide #14, #20, #24; define como a migração 19 cria `hash_texto`)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q1.1 | Versão do Postgres, papel de execução, modo somente leitura e isolamento | `versao_num` ≥ 150000; `somente_leitura = on`; `isolamento = read committed` |
| Q1.2 | `sha256(bytea)` nativo e `digest` do `pgcrypto` existem? | `sha256_nativo` preenchido; os outros podem ser nulos |
| Q1.3 | Vetor de teste do SHA-256 (cálculo puro, sem dados) | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |
| Q1.4 | Extensões instaladas | Lista com `plpgsql`; `pgcrypto`, `pg_stat_statements` e outras são informativas |
| Q1.5 | Configurações por papel (`statement_timeout`, `pgrst.*`) | `authenticated` com `statement_timeout`; `authenticator` com configurações `pgrst.*` |
| Q1.6 | Configuração de log do Postgres | `log_statement` sem `all`; `log_parameter_max_length*` pequeno ou 0 |

```sql
-- Q1.1
select version() as versao, current_setting('server_version_num')::int as versao_num,
       current_user as papel, current_setting('transaction_read_only') as somente_leitura,
       current_setting('default_transaction_isolation') as isolamento;
-- Q1.2
select to_regprocedure('pg_catalog.sha256(bytea)') as sha256_nativo,
       to_regprocedure('extensions.digest(bytea,text)') as digest_extensions,
       to_regprocedure('public.digest(bytea,text)') as digest_public;
-- Q1.3 (só se Q1.2 trouxe sha256_nativo)
select encode(sha256('abc'::bytea), 'hex') as sha256_abc;
-- Q1.4
select e.extname, e.extversion, n.nspname as schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1;
-- Q1.5
select rolname, rolconfig::text as configuracao from pg_roles
 where rolname in ('anon','authenticated','authenticator','service_role','postgres','supabase_storage_admin') order by 1;
-- Q1.6
select name, setting from pg_settings
 where name in ('log_statement','log_min_duration_statement','log_min_error_statement',
                'log_parameter_max_length','log_parameter_max_length_on_error') order by 1;
```
*Se mudar o spec:* sem `sha256` nativo nem `digest`, a migração 19 não pode ser aplicada como está (§5.4); `statement_timeout` define o tamanho de página da verificação da auditoria (§5.4); `log_statement = all` obriga a revisar a higiene do segredo (§10.2).

**E2. Exposição da API e privilégios padrão** (decide #2, #15, #26)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q2.1 | Schemas existentes, dono e ACL | `public`, `auth`, `storage`, `extensions` etc.; **sem** `homecash_interno` |
| Q2.2 | Schemas expostos pela API (`pgrst.db_schemas`) | `public, graphql_public` (ou parecido); `homecash_interno` nunca aparece |
| Q2.3 | Privilégios padrão para objetos novos (`pg_default_acl`) | Entradas do `postgres` no `public` com `anon`, `authenticated`, `service_role` para tabelas e funções |
| Q2.4 | Quem tem privilégio hoje nas tabelas do `public` | `authenticated` com privilégios nas tabelas do app; `anon` sem ou com pouco |

```sql
-- Q2.1
select n.nspname as schema, pg_get_userbyid(n.nspowner) as dono, n.nspacl::text as acl
  from pg_namespace n where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' order by 1;
-- Q2.2
select unnest(rolconfig) as configuracao from pg_roles where rolname = 'authenticator' and rolconfig is not null;
-- Q2.3
select pg_get_userbyid(d.defaclrole) as papel, d.defaclnamespace::regnamespace::text as schema,
       d.defaclobjtype as tipo, d.defaclacl::text as acl from pg_default_acl d order by 1,2,3;
-- Q2.4
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2;
```
*Se mudar o spec:* se `homecash_interno` aparecer exposto, a categoria E deixa de ser aceitável (§5.2); se `pg_default_acl` não conceder a `anon`/`authenticated`, o `revoke` explícito continua e só a justificativa muda; Q2.4 confirma ou derruba a hipótese da migração 08 (#2).

**E3. Colisão de nomes** (confirma que o §12.1 não vai bater em objeto existente)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q3.1 | Algum schema, tabela, função, bucket ou política com os nomes planejados já existe? | **Zero linhas.** Qualquer linha bloqueia a migração correspondente até decidirmos o nome |

```sql
-- Q3.1
select 'schema' as tipo, nspname::text as nome from pg_namespace where nspname = 'homecash_interno'
union all
select 'relacao', c.relname::text from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('admin_usuarios','admin_auditoria','admin_acessos_negados','admin_sessoes_suporte',
                     'admin_suporte_confirmacoes','erros_app','solicitacoes','solicitacoes_anexos')
union all
select 'funcao', p.proname::text from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and (p.proname like 'admin\_%' or p.proname in ('sou_admin','registrar_erro','criar_solicitacao','registrar_anexo',
        'registrar_tentativa_admin','solicitacao_email_reservar','solicitacao_email_concluir',
        'anexo_validacao_reservar','anexo_validacao_concluir'))
union all
select 'bucket', id::text from storage.buckets where id = 'solicitacoes-anexos'
union all
select 'politica', policyname::text from pg_policies where policyname like 'homecash\_%';
```

**E4. Colunas e restrições das tabelas de domínio** (decide #1, #3, #7, #18; valida as listas do §6.4)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q4.1 | Colunas de `perfis`, `grupos_familiares`, `convites_grupo_familiar` | `perfis` com `id`, `user_id`, `nome_usuario`, `cargo`, `cor`, `grupo_id`, `eh_convidado`, `resumo_visivel`; mostra se existe `created_at` |
| Q4.2 | Colunas de `extrato`, `cartao`, `contas_fixas` | `mes` (texto), `data`, `owner_id`, `responsavel_id`, `grupo_id`, `compartilhado_com`, `privado`, `repasse_*`, `pago` (só contas fixas) |
| Q4.3 | Colunas das demais (`pagamentos_fatura`, `caixinhas`, `caixinha_movimentos`, `aportes_investimento`, `configuracoes`, `opcoes_pagamento`, `opcoes_categoria`) | Tipos de `caixinha_movimentos.data` e dos campos do §6.4 |
| Q4.4 | Chaves primárias, únicas, estrangeiras e `check` dessas tabelas | Estrangeiras para `auth.users` e a ação ao excluir (`cascade`, `set null`) |
| Q4.5 | Todas as chaves estrangeiras que apontam para `auth.users` | Mostra quem é afetado pela exclusão de conta (#12) |

```sql
-- Q4.1 (troque a lista em Q4.2 e Q4.3 pelas tabelas de cada grupo)
select table_name, ordinal_position as pos, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name in ('perfis','grupos_familiares','convites_grupo_familiar')
 order by table_name, ordinal_position;
-- Q4.2: mesma consulta com ('extrato','cartao','contas_fixas')
-- Q4.3: mesma consulta com ('pagamentos_fatura','caixinhas','caixinha_movimentos','aportes_investimento',
--                          'configuracoes','opcoes_pagamento','opcoes_categoria')
-- Q4.4
select t.relname as tabela, c.conname, c.contype, pg_get_constraintdef(c.oid) as definicao
  from pg_constraint c join pg_class t on t.oid = c.conrelid
 where c.connamespace = 'public'::regnamespace and c.contype in ('p','u','f','c')
   and t.relname in ('perfis','grupos_familiares','extrato','cartao','contas_fixas','pagamentos_fatura','caixinhas',
                     'caixinha_movimentos','aportes_investimento','configuracoes','opcoes_pagamento','opcoes_categoria')
 order by 1,2;
-- Q4.5
select c.conrelid::regclass::text as tabela, c.conname, pg_get_constraintdef(c.oid) as definicao
  from pg_constraint c where c.contype = 'f' and c.confrelid = 'auth.users'::regclass order by 1,2;
```
*Se mudar o spec:* coluna faltando sai da lista do §6.4; ausência de `privado` ou `compartilhado_com` impede a migração 20 (§6.5); `caixinha_movimentos.data` fecha a dúvida da migração 18 (#7).

**E5. Funções, triggers e estado das migrações antigas** (decide #4, #5, #6, #7, #8)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q5.1 | Funções do `public` com `SECURITY DEFINER`, `search_path` e ACL | `adicionar_convidado*` sem `EXECUTE` para `anon` (migrações 09 e 13); lista completa das RPCs do app |
| Q5.2 | Definição das funções **não versionadas** (`meus_membros`, `meus_grupos`, `membro_pertence`, `atualizar_repasse`, `handle_new_user`, `excluir_minha_conta`, `limpar_dados_ao_excluir_usuario`) | Corpo de cada uma; resolve o que `meus_membros()` devolve e como a conta é excluída |
| Q5.3 | Triggers em tabelas do `public` e em `auth.users` | `lancamento_trava_repasse_confirmado` nas 3 tabelas (migração 14); **sem** `perfis_protege_colunas` (12) e **sem** `lancamento_trava_mes_fechado` (18); triggers de criação e exclusão de usuário em `auth.users` |
| Q5.4 | Índices da migração 11 | 9 índices presentes |
| Q5.5 | Existe tabela de histórico de migrações? | Provavelmente nula (scripts rodados à mão) |

```sql
-- Q5.1
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos, p.prosecdef as definer,
       p.proconfig::text as config, p.proacl::text as acl
  from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1,2;
-- Q5.2
select p.proname, pg_get_functiondef(p.oid) as definicao from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('meus_membros','meus_grupos','membro_pertence','atualizar_repasse','handle_new_user',
                     'excluir_minha_conta','limpar_dados_ao_excluir_usuario') order by 1;
-- Q5.3
select t.tgrelid::regclass::text as tabela, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definicao
  from pg_trigger t
 where not t.tgisinternal
   and (t.tgrelid = 'auth.users'::regclass
        or t.tgrelid in (select c.oid from pg_class c where c.relnamespace = 'public'::regnamespace))
 order by 1,2;
-- Q5.4
select indexname from pg_indexes where schemaname = 'public'
   and indexname in ('perfis_user_id_idx','perfis_grupo_id_idx','extrato_grupo_id_idx','extrato_usuario_id_idx',
                     'cartao_grupo_id_idx','cartao_usuario_id_idx','contas_fixas_grupo_id_idx',
                     'opcoes_pagamento_grupo_id_idx','opcoes_categoria_grupo_id_idx') order by 1;
-- Q5.5
select to_regclass('supabase_migrations.schema_migrations') as tabela_historico;
```
*Se mudar o spec:* o corpo de `meus_membros()` substitui a regra reescrita do §6.2/§6.5; se a 12 ou a 18 já estiverem aplicadas, o `CONTINUIDADE-HOMECASH.md` está errado e o §13 #5 e #8 mudam; se `excluir_minha_conta` não limpar as tabelas novas, o §15 sobre exclusão precisa de ajuste.

**E6. RLS e privacidade dos lançamentos** (decide #19; define se o suporte pode afrouxar o §6.5)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q6.1 | RLS ligada e dono das tabelas do `public` | `relrowsecurity = true` nas tabelas de domínio; dono `postgres` |
| Q6.2 | Todas as políticas do `public` | Igual à migração 10 (nomes e condições) |
| Q6.3 | Alguma política menciona `privado`? | **Zero linhas** confirma que "Só eu" não é garantido pelo banco (#19). Linhas indicam a regra real |
| Q6.4 | Existe política `RESTRICTIVE`? | Zero linhas |

```sql
-- Q6.1
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forcada, pg_get_userbyid(c.relowner) as dono
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1;
-- Q6.2
select tablename, policyname, permissive, roles::text as papeis, cmd, qual, with_check
  from pg_policies where schemaname = 'public' order by tablename, policyname;
-- Q6.3
select tablename, policyname, permissive, cmd from pg_policies
 where schemaname = 'public' and (coalesce(qual,'') ilike '%privado%' or coalesce(with_check,'') ilike '%privado%');
-- Q6.4
select tablename, policyname, cmd from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE';
```
*Se mudar o spec:* resultado de Q6.3 vazio mantém o §6.5 como está e **abre a tarefa separada** da possível lacuna #19 (não corrigida aqui); com política real, o §6.5 pode ser revisto por decisão sua.

**E7. Storage** (decide #13)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q7.1 | Colunas de `storage.buckets` e `storage.objects` | Inclui `file_size_limit` e `allowed_mime_types` em `buckets`; senão a migração 22 usa o plano B |
| Q7.2 | Buckets existentes | `avatars` (provavelmente público); **sem** `solicitacoes-anexos` |
| Q7.3 | Políticas de `storage.objects` | Cada política limitada a um `bucket_id`; **alerta** para qualquer uma permissiva sem `bucket_id` |
| Q7.4 | Dono de `storage.objects`, RLS ligada e se o papel atual pode criar políticas | RLS ligada; dono `supabase_storage_admin`; `sou_membro_do_dono` verdadeiro |
| Q7.5 | Funções auxiliares do Storage | `foldername` presente |

```sql
-- Q7.1
select table_name, column_name, data_type from information_schema.columns
 where table_schema = 'storage' and table_name in ('buckets','objects') order by table_name, ordinal_position;
-- Q7.2
select * from storage.buckets order by id;
-- Q7.3
select policyname, permissive, roles::text as papeis, cmd, qual, with_check
  from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
-- Q7.4
select c.relname, pg_get_userbyid(c.relowner) as dono, c.relrowsecurity as rls,
       pg_has_role(current_user, c.relowner, 'member') as sou_membro_do_dono
  from pg_class c where c.oid = 'storage.objects'::regclass;
-- Q7.5
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos from pg_proc p
 where p.pronamespace = 'storage'::regnamespace and p.proname in ('foldername','filename','extension') order by 1;
```
*Se mudar o spec:* política permissiva alheia **bloqueia** a migração 22 (§12.1 item 13); `sou_membro_do_dono = false` ou colunas ausentes ativam o plano B (bucket e políticas pelo painel).

**E8. Auth e MFA** (decide #10, #23, #32; valida a técnica de teste do §5.8 R10)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q8.1 | `auth.users` tem `last_sign_in_at`, `created_at`, `email_confirmed_at`, `raw_app_meta_data`? | Todas presentes |
| Q8.2 | Estrutura de `auth.mfa_factors`, `auth.mfa_challenges`, `auth.mfa_amr_claims` | Tabelas existem; `mfa_factors` com `id`, `user_id`, `factor_type`, `status`, `created_at` |
| Q8.3 | Definição de `auth.jwt()` e `auth.uid()` | Leem `request.jwt.claims` (confirma o uso de `set_config` nos testes) |
| Q8.4 | Quais papéis leem, e podem apagar (recuperação do §5.8 R8), em `auth.mfa_factors`? | `postgres` pode ler; `anon` não; `pode_apagar` indica o caminho de recuperação |

```sql
-- Q8.1
select column_name, data_type from information_schema.columns
 where table_schema = 'auth' and table_name = 'users'
   and column_name in ('id','email','created_at','last_sign_in_at','email_confirmed_at','raw_app_meta_data') order by 1;
-- Q8.2
select table_name, column_name, data_type from information_schema.columns
 where table_schema = 'auth' and table_name in ('mfa_factors','mfa_challenges','mfa_amr_claims')
 order by table_name, ordinal_position;
-- Q8.3
select p.proname, pg_get_functiondef(p.oid) as definicao from pg_proc p
 where p.pronamespace = 'auth'::regnamespace and p.proname in ('jwt','uid') order by 1;
-- Q8.4
select r.rolname, has_table_privilege(r.oid, 'auth.mfa_factors', 'SELECT') as pode_ler,
       has_table_privilege(r.oid, 'auth.mfa_factors', 'DELETE') as pode_apagar
  from pg_roles r where r.rolname in ('postgres','authenticated','anon','service_role','supabase_auth_admin') order by 1;
```
*Se mudar o spec:* `postgres` sem leitura de `auth.mfa_factors` quebra os passos 3 e 4 do §5.8 R5 e exige outro desenho; `last_sign_in_at` ausente derruba o indicador de ativos (§7); nome diferente de coluna em `mfa_factors` ajusta `checar_admin`.

**E9. Contagens agregadas [DADOS] — autorização separada** (decide #1, #19, #10; só números, nenhuma linha identificável)

| ID | Objetivo | Resultado esperado |
|---|---|---|
| Q9.1 | `perfis`: quantos têm `id = user_id`, sem `user_id`, convidados, sem grupo | Convidados com `user_id` nulo; contas reais com `id = user_id` |
| Q9.2 | Quantos lançamentos privados e partilhados existem em cada tabela | Números por tabela; mostra o alcance real da lacuna #19 |
| Q9.3 | Há fatores MFA cadastrados no projeto? | Nenhum (MFA ainda não usado) |
| Q9.4 | Quantas contas têm `last_sign_in_at` preenchido | Quase todas |

```sql
-- Q9.1
select count(*) as total, count(*) filter (where id = user_id) as id_igual_user_id,
       count(*) filter (where user_id is null) as sem_user_id, count(*) filter (where id <> user_id) as id_diferente,
       count(*) filter (where eh_convidado) as convidados, count(*) filter (where grupo_id is null) as sem_grupo
  from public.perfis;
-- Q9.2
select 'extrato' as tabela, count(*) as total, count(*) filter (where privado) as privados,
       count(*) filter (where compartilhado_com is not null) as partilhados from public.extrato
union all select 'cartao', count(*), count(*) filter (where privado), count(*) filter (where compartilhado_com is not null) from public.cartao
union all select 'contas_fixas', count(*), count(*) filter (where privado), count(*) filter (where compartilhado_com is not null) from public.contas_fixas;
-- Q9.3
select factor_type::text as tipo, status::text as situacao, count(*) as quantidade from auth.mfa_factors group by 1,2;
-- Q9.4
select count(*) as total, count(last_sign_in_at) as com_ultimo_acesso from auth.users;
```

**E10. Fora do banco (conferências e testes manuais)** (decide #9, #16, #23, #24, #30 a #33)

| ID | Onde | O que conferir |
|---|---|---|
| V10.1 | Painel do Supabase, Authentication, MFA | TOTP habilitado para cadastro e verificação; limite de fatores; limite de tentativas |
| V10.2 | Painel do Supabase, Authentication, Sessions e Providers | Validade do JWT, limite de duração e de inatividade da sessão (se houver no plano); provedores ativos; proteção contra senhas vazadas (D3 do `propostas-supabase.md`) |
| V10.3 | Painel do Supabase, API Settings | Lista de "Exposed schemas" (confirma Q2.2); linhas máximas por resposta |
| V10.4 | Painel do Supabase, Logs | Retenção e conteúdo dos logs de API e de banco (decide #24) |
| V10.5 | Vercel | Plano e limites das funções (tempo, memória, tamanho de resposta) para a validação de imagens; se as variáveis do §12.2 poderão ser criadas só no servidor |
| V10.6 | Documentação do PostgREST | Se `request.headers` e `x-forwarded-for` estão disponíveis dentro de funções (#9); consulta à documentação, sem tocar no banco |
| V10.7 | **Depois da implementação**, com conta de teste criada por você | Decodificar um token `aal2` e ver `aal` e `amr` (#30); tentar cadastrar segundo fator em `aal1` com fator verificado e tentar `unenroll` (#31); `aal` se mantém após a renovação do token; fluxo completo do §5.8 R3 |

### 18.3 Ordem sugerida e critérios de parada
1. **E1, E2, E3** primeiro: decidem se a migração 19 é possível e se há conflito de nome. Se E1 não achar SHA-256 nem `digest`, ou E3 devolver linhas, **paro e volto ao spec**.
2. **E8** em seguida: define se o desenho de MFA do §5.8 R5 é viável (leitura de `auth.mfa_factors`).
3. **E4, E5, E6**: validam a migração 20 e a regra de privacidade.
4. **E7**: só antes da fase 5 (migração 22); pode ser adiada.
5. **E9**: só com autorização separada; **E10** em paralelo, sem tocar no banco.

Cada etapa devolve um resumo curto (esperado contra obtido, divergências, o que muda no spec). Sem sua autorização expressa, **nada deste plano é executado**.

### 18.4 Pacote preparado: E1, E2, E3 e E8 (15 consultas, aguardando autorização)
- **Independência.** Cada consulta é um `select` completo, sem variável, tabela temporária ou resultado de outra. Rodam em qualquer ordem e cada uma em chamada separada. Uma que falhe não impede as outras: um erro como `function sha256 does not exist` na Q1.3 é um **resultado válido** (diz que a função não existe).
- **Lista e ordem sugerida:** Q1.1, Q1.2, Q1.3, Q1.4, Q1.5, Q1.6 (E1); Q2.1, Q2.2, Q2.3, Q2.4 (E2); Q3.1 (E3); Q8.1, Q8.2, Q8.3, Q8.4 (E8).
- **Somente leitura.** Cada chamada leva o envoltório `begin transaction read only; <consulta>; rollback;`. Se o executor recusar o `begin` por já rodar dentro da própria transação, a consulta segue válida: é um único `select` de catálogo e não grava nada.
- **Alvo.** Projeto `iitgqormevgznxikwyvu` (do `CONTINUIDADE-HOMECASH.md`); confirmo o projeto com você antes da primeira chamada.
- **Saída.** Nenhuma delas devolve dado de usuário. Q8.3 devolve o código-fonte de `auth.jwt()` e `auth.uid()`; Q1.5 e Q2.3 devolvem configurações e ACLs, sem segredos.
- **Depois da execução.** Eu resumo "esperado contra obtido" por consulta e, com sua autorização, atualizo o §13.

### 18.5 Resultados da execução de E1, E2, E3 e E8 (2026-11-05)

Executadas as 15 consultas, uma por vez, pelo MCP do Supabase, no projeto `iitgqormevgznxikwyvu` (confirmado antes: sa-east-1, status saudável, Postgres 17). Todas eram `select` de catálogo e nenhuma devolveu dado de usuário. **Desvio do §18.1:** o executor não aceita o envoltório `begin read only` (devolve só o resultado do último comando) e a sessão veio com `transaction_read_only = off`; por isso cada consulta foi enviada **sozinha, como um único `select`**, sem nenhum comando de escrita. Nenhuma condição de parada foi acionada.

| Consulta | Resultado obtido | Veredito |
|---|---|---|
| Q1.1 | PostgreSQL 17.11 (`170011`); papel `postgres`; isolamento `read committed` | Aprovado |
| Q1.2 | `sha256(bytea)` nativo presente; `extensions.digest(bytea,text)` presente; `public.digest` ausente | Aprovado |
| Q1.3 | `ba7816bf…0015ad`, igual ao vetor conhecido | Aprovado |
| Q1.4 | `pg_stat_statements`, `pgcrypto` (schema `extensions`), `plpgsql`, `supabase_vault`, `uuid-ossp` | Aprovado |
| Q1.5 | `authenticated` `statement_timeout=8s`; `anon` 3s; `authenticator` 8s e `lock_timeout=8s` (carrega `supautils` e `safeupdate`); sem `pgrst.*` no papel | Aprovado, com item manual (Q2.2) |
| Q1.6 | `log_statement=ddl`; `log_min_error_statement=error`; `log_parameter_max_length=-1`; `log_parameter_max_length_on_error=0` | Aprovado, com regra de cuidado (abaixo) |
| Q2.1 | Schemas: `auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `public`, `realtime`, `storage`, `supabase_migrations`, `vault`; **sem** `homecash_interno`; `postgres` tem só `USAGE` em `auth` | Aprovado |
| Q2.2 | `authenticator` **não** tem `pgrst.db_schemas`; o banco não informa quais schemas a API expõe | **Depende de conferência manual** (V10.3) |
| Q2.3 | Objetos criados por `postgres` no `public`: **funções** ganham `EXECUTE` para `anon`, `authenticated`, `service_role`; **tabelas** só para `postgres` (sem grant de API); sequências só `postgres`. Não há regra padrão para um schema novo | Aprovado (confirma #2 e #26) |
| Q2.4 | `anon` sem privilégio em nenhuma tabela do `public`; `authenticated` com CRUD nas tabelas do app **e também** em tabelas legadas e de backup (ver alerta) | Aprovado, com **alerta** |
| Q3.1 | Zero linhas: nenhuma colisão de schema, tabela, função, bucket ou política | Aprovado |
| Q8.1 | `auth.users` tem `id`, `email`, `created_at`, `last_sign_in_at`, `email_confirmed_at`, `raw_app_meta_data` | Aprovado (fecha #10) |
| Q8.2 | As 3 tabelas de MFA existem. `mfa_factors`: `id`, `user_id`, `friendly_name`, `factor_type` (enum), `status` (enum), `created_at`, `updated_at`, **`secret`**, `phone`, `last_challenged_at`, `web_authn_*` | Aprovado, com ajuste |
| Q8.3 | `auth.jwt()` lê `request.jwt.claim` ou `request.jwt.claims`; `auth.uid()` lê `request.jwt.claim.sub` e, se vazio, `request.jwt.claims->>'sub'` | Aprovado (técnica de teste confirmada) |
| Q8.4 | `postgres` e `supabase_auth_admin` leem **e apagam** `auth.mfa_factors`; `anon`, `authenticated` e `service_role` não | Aprovado (fecha #32) |

**Impacto no spec (já refletido nos itens abaixo ou a aplicar no plano):**
1. **SHA-256 (§5.4):** `hash_texto` usa o `sha256(bytea)` nativo (Postgres 17); `extensions.digest` fica só como alternativa da pré-checagem. #14 resolvido.
2. **Timeout (§5.4):** `statement_timeout` de 8 s para `authenticated` confirma a verificação paginada. #25 resolvido.
3. **Privilégios (§5.2, §5.3):** funções novas no `public` nascem abertas para `anon` e `authenticated` (revoke explícito obrigatório); tabelas novas criadas por `postgres` nascem **sem** grant de API (só os grants do §5.3 abrem acesso); num schema novo (`homecash_interno`) valem os padrões do Postgres, então o `revoke ... from public` também é obrigatório.
4. **MFA (§5.8):** `checar_admin` lê só `id`, `user_id`, `status` e `factor_type` de `auth.mfa_factors` e **nunca `secret`**; `status` e `factor_type` são enums, então a comparação usa literal ou `::text`. O dono das funções (`postgres`) consegue ler, e a recuperação do R8 por SQL é possível.
5. **Logs (§10.2, #24):** `log_statement = ddl` registra o texto de todo comando DDL e `log_min_error_statement = error` registra o texto de comandos que falham, mas **sem parâmetros** (`..._on_error = 0`). Regra nova: o segredo e o seu hash **nunca** aparecem em literal dentro de DDL nem de comando que possa falhar; o hash entra por `insert` bem-sucedido, e o segredo só viaja como parâmetro de RPC.
6. **Testes de banco (§5.8 R10):** `set_config('request.jwt.claims', '{"sub":"<uuid>","aal":"aal2"}', true)` funciona, com `request.jwt.claim.sub` vazio.

**Alerta fora do escopo do admin (precisa de verificação, não corrigido):** Q2.4 mostra `authenticated` com `SELECT/INSERT/UPDATE/DELETE` em tabelas de backup e legadas (`contas_fixas_backup_duplicatas_20261016`, `..._02`, `contas_fixas_backup_recorrencia_20261016`, `caixinhas_migracao_legado`, `opcoes_padrao_aplicadas`, entre outras). A migração 10 não cita essas tabelas. **Se elas não tiverem RLS ligada, qualquer usuário logado leria e alteraria cópias de dados financeiros pela API.** Isso não foi consultado (RLS é a Q6.1, fora deste pacote). Prioridade alta para a etapa E6. **Resolvido pela E6 (abaixo): essas tabelas têm RLS ligada e nenhuma política, o que nega todo acesso.**

#### E6. RLS e privacidade dos lançamentos (executada em 2026-11-05)

Quatro consultas, uma por vez, só `select`, mesmo projeto e mesmo critério de execução do pacote anterior. Nenhuma devolveu dado de usuário.

| Consulta | Resultado obtido | Veredito |
|---|---|---|
| Q6.1 | As **24** tabelas do `public` têm RLS ligada; nenhuma com RLS forçada; todas com dono `postgres` | Aprovado |
| Q6.2 | 17 tabelas têm política; **7 não têm nenhuma**. Todas as políticas são `PERMISSIVE`, para `authenticated`, e usam `(select auth.uid())` | Aprovado, com achados abaixo |
| Q6.3 | **Nenhuma** política menciona `privado` | Confirma #19 no nível das políticas |
| Q6.4 | **Nenhuma** política `RESTRICTIVE` | Aprovado |

**1. Tabelas seguras**
- **RLS ligada e sem política (acesso negado a `authenticated`)**, apesar dos grants de CRUD vistos na Q2.4: `contas_fixas_backup_duplicatas_20261016`, `contas_fixas_backup_duplicatas_20261016_02`, `contas_fixas_backup_recorrencia_20261016`, `caixinhas_migracao_legado`, `opcoes_padrao_aplicadas`, `opcoes_padrao_criadas`, `convites_grupo_familiar`. **O alerta da Q2.4 não se confirmou:** os backups não estão expostos pela API.
- **Política restrita ao dono (`user_id` ou `owner_id` = `auth.uid()`):** `aportes_investimento`, `caixinhas`, `caixinha_movimentos` (com checagem da caixinha), `caixinhas_investimento`, `configuracoes`, `opcoes_categoria`, `opcoes_pagamento`, `pagamentos_fatura`, `preferencias_dashboard`; `movimentacoes_caixinha` só leitura do dono.
- **Grupo, sem escrita pela API:** `grupos_familiares` (só `select` via `meus_grupos()`).

**2. Tabelas potencialmente expostas**
- **`extrato`, `cartao`, `contas_fixas`:** `select` permitido ao dono **ou** a quem for membro do grupo do `responsavel_id` (`responsavel_id IN (select meus_membros())`), mais a política `partilha seletiva segura` (acesso extra a `compartilhado_com`). Nada no banco restringe linhas `privado = true` nem esconde as partilhadas com uma pessoa: **a privacidade "Só eu" e "só eu e essa pessoa" não é imposta pelo banco**, e o código do app só filtra `compartilhado_com` no cliente, não `privado` (§6.5). A exposição real foi resolvida na E5: `meus_membros()` devolve só os perfis do próprio usuário, então **não** há leitura de grupo inteiro (ver E5 abaixo).
- **`perfis`:** `perfis_proprio_update` e `perfis_proprio_insert` não limitam colunas, então o próprio usuário pode gravar `grupo_id` e `cargo` na sua linha (a migração 12 existe e não foi aplicada, segundo o `CONTINUIDADE`; a existência do trigger não foi consultada, Q5.3).
- **Legado (`grupos`, `membros`):** `grupos` e `membros` com políticas por `sou_dono`; `membros_update_proprio` deixa o usuário alterar a própria linha inteira. Tabelas descritas como vazias.

**3. Gravidade** (nenhuma é correção deste spec; nada foi alterado)

| # | Problema | Gravidade | Natureza | Confirmado? |
|---|---|---|---|---|
| E6-1 | `privado` não é usado pelo banco. **Rebaixado pela E5:** a leitura é só de dono, responsável e destinatário de `compartilhado_com`; "Só eu" com responsável igual ao dono **não vaza**; a linha continua visível a quem foi marcado como responsável ou destinatário | **Baixa a Média** (semântica) | Limitação de projeto | Confirmado pelas políticas e por `meus_membros()` (E5) |
| E6-2 | `perfis` permite gravar o próprio `grupo_id` e `cargo` (entrar em grupo alheio conhecendo o id; virar gestor) | **Alta**, mas **já conhecida** e com correção pronta (migração 12) | Vulnerabilidade pendente | Políticas confirmadas; trigger não consultado |
| E6-3 | `authenticated` tem CRUD concedido em tabelas legadas e de backup (inofensivo hoje, pela RLS sem política) | Baixa (defesa em profundidade) | Limitação | Confirmado |
| E6-4 | `membros_update_proprio` (legado) | Baixa | Limitação | Confirmado; tabela legada |

**4. Correções necessárias** (todas dependem de autorização específica; **nada foi aplicado**)
- **E6-1 (rebaixado, opcional):** definir o que "Só eu" deve significar quando há outro responsável; se quiser impor no banco (por exemplo, política `RESTRICTIVE` em `select` de `extrato`, `cartao` e `contas_fixas` excluindo `privado` e `compartilhado_com` de terceiros) e corrigir o filtro do cliente. É migração nova, com teste de duas contas e cuidado com repasses e fechamento. **Tarefa separada, fora do painel admin.**
- **E6-2:** aplicar a migração 12 **depois** do deploy do código atual (ordem já documentada).
- **E6-3 e E6-4:** revogar os grants de `authenticated` sobre as tabelas de backup/legadas, ou remover as tabelas, o que cai na decisão sobre P1 a P4 (`propostas-supabase.md`), hoje não autorizadas.
- **Backups:** nenhuma correção necessária.

**5. Efeito no spec do painel:** a regra do §6.5 (omitir linhas privadas ou partilhadas de terceiros) continua **obrigatória**. A E5, logo abaixo, **corrigiu** a avaliação do E6-1 e a definição de "visão do usuário".

#### E5. Funções, triggers e estado das migrações (executada em 2026-11-05)

Cinco consultas, uma por vez, só `select`, mesmo projeto. Nenhuma devolveu dado de usuário (Q5.2 devolve código-fonte de funções).

| Consulta | Resultado obtido | Veredito |
|---|---|---|
| Q5.1 | 27 funções no `public`. **Nenhuma** com `EXECUTE` para `anon`. `authenticated` executa as RPCs do app **e** as legadas `aceitar_convites`, `convidar_membro`, `criar_grupo`, `criar_formas_pagamento_padrao`, `registrar_movimentacao_caixinha`. Funções de trigger e órfãs (`cria_perfil_automatico`, `entrar_grupo_familiar`, `handle_new_user`, `limpar_dados_ao_excluir_usuario`, `lancamento_trava_repasse_confirmado`, `opcoes_pagamento_normaliza`, `caixinha_aplicar_movimento`) só para `postgres`/`service_role`. 14 funções `SECURITY DEFINER` usam `search_path = public` em vez de vazio | Aprovado, com achados |
| Q5.2 | Definições lidas (abaixo) | Aprovado, **muda o spec** |
| Q5.3 | Triggers: `on_auth_user_created` e `trg_limpar_dados_ao_excluir_usuario` em `auth.users`; `caixinha_movimentos_saldo`; `lancamento_trava_repasse_confirmado` em `extrato`, `cartao`, `contas_fixas` (migração 14); `trg_opcoes_pagamento_normaliza`. **Não existem** `perfis_protege_colunas` (migração 12) nem os triggers de mês fechado (migração 18) | Confirma 14 aplicada; **12 e 18 não aplicadas** |
| Q5.4 | Os 9 índices da migração 11 existem | Aprovado |
| Q5.5 | Existe `supabase_migrations.schema_migrations` (esperado: nula) | Inesperado; as versões não foram listadas (não estava no pacote) |

**Definições que importam:**
- `meus_membros()` = `select id from perfis where user_id = auth.uid()`: devolve **só o(s) perfil(is) do próprio usuário**, não os do grupo. `meus_grupos()` = `select grupo_id from perfis where user_id = auth.uid()`. `membro_pertence(m, g)` = existe perfil com `id = m` e `grupo_id = g`.
- Portanto `extrato_select` (`owner_id = uid` **ou** `responsavel_id IN meus_membros()`) mostra ao usuário **apenas** o que ele lançou, o que está no nome dele como responsável e o que foi partilhado com ele. **Não existe leitura de grupo inteiro.** O E6-1 foi rebaixado por isso.
- `handle_new_user` cria o perfil com `id = user_id = auth.users.id` (e ignora qualquer erro com `exception when others then null`).
- `excluir_minha_conta` apaga os dados do usuário nas tabelas listadas, solta as referências de terceiros, apaga o perfil e depois `auth.users`; roda com `search_path = public, auth`.
- `atualizar_repasse` valida a tabela por lista fixa e usa `format('%I')`; `informar`/`desinformar` só pelo responsável, `concluir` só pelo dono, `reabrir` pelo dono; não consulta fechamento de mês (migração 18 pendente).

**Achados** (nada foi alterado)

| # | Problema | Gravidade | Natureza | Confirmado? |
|---|---|---|---|---|
| E5-1 | **Migração 12 não aplicada:** `perfis_proprio_update` e `perfis_proprio_insert` deixam o usuário gravar o próprio `grupo_id`, `cargo`, `eh_convidado` e `user_id`. Quem souber o id de um grupo pode entrar nele (`meus_grupos()` passa a incluí-lo), ler os perfis do grupo, lançar despesas com qualquer membro como responsável (`membro_pertence`), e assumir `cargo = 'gestor'` para as funções de gestão (remover membros, excluir o grupo) | **Alta** (exige conhecer o id do grupo, que não é público mas aparece para os membros e ex-membros) | Vulnerabilidade, **já conhecida**, correção pronta | Sim: políticas e ausência do trigger |
| E5-2 | `privado` não é usado pelo banco; "Só eu" com outro responsável continua visível a ele (E6-1) | Baixa a Média | Limitação de projeto | Sim |
| E5-3 | Funções legadas ainda executáveis por `authenticated` (P1 a P3 não autorizadas); as definições **não foram inspecionadas** | Baixa (não avaliada) | Superfície desnecessária | Sim, ACL; risco não avaliado |
| E5-4 | 14 funções `SECURITY DEFINER` com `search_path = public` | Baixa (informativa): `authenticated` e `anon` não têm `CREATE` no `public` (Q2.1), então não há como plantar objeto | Hardening | Sim |
| E5-5 | `excluir_minha_conta` e o trigger de exclusão não citam `pagamentos_fatura`, `preferencias_dashboard`, `convites_grupo_familiar` nem `grupos_familiares.criado_por`; dependem de chaves estrangeiras com `cascade` (não conferidas, Q4.4 e Q4.5) | Baixa | Dependência não verificada | Não |
| E5-6 | `atualizar_repasse` ignora o fechamento de mês (migração 18 pendente) | Informativa | Pendência conhecida | Sim |

**Efeito no spec do painel** (já aplicado no texto):
1. §6.5: a "visão do usuário" passa a ser dono, responsável (perfil do alvo) ou destinatário, **sem grupo**; a regra de omissão de privados e partilhados de terceiros continua, e há uma opção de afrouxar (decisão sua).
2. #4 resolvido; #5 e #6 confirmados; #1 parcial; #19 rebaixado.
3. O painel não depende da migração 12, mas E5-1 é a pendência de segurança mais séria do projeto e merece prioridade própria.

**Sequência mínima para corrigir e concluir** (cada passo que toca o banco exige autorização específica):
1. **Concluir a validação restante:** E4 (colunas e chaves estrangeiras, que também resolve E5-5), E7 (Storage, só antes da fase 5), E9 (contagens, autorização separada), e a conferência manual de V10.1 (TOTP habilitado) e V10.3 (schemas expostos). Opcional: listar as versões de `supabase_migrations.schema_migrations`.
2. **Escrever o plano de implementação** (skill writing-plans) a partir do SPEC v3.2.1.
3. **Implementar a fase 1** (migração 19, telas de segurança e MFA) e ativar o primeiro admin na ordem do §5.8.
4. **Fases 2 a 5** (usuários, suporte, erros e solicitações, anexos e e-mail), uma migração por vez, cada uma com roteiro de banco e autorização.
5. **Política de Privacidade** revisada antes do deploy das fases 3 a 5.
6. **Em paralelo e fora do painel:** corrigir E5-1 (merge e deploy do código atual da branch, depois migração 12) e, se quiser, E5-2, E5-3 e as limpezas P1 a P4.
