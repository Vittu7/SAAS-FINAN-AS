-- Storage: remove políticas duplicadas, fecha a listagem pública e põe limites nos buckets.
--
-- Situação encontrada em 2026-11-05:
--   * avatars tinha 8 políticas: 2 de leitura pública idênticas + 3 pares duplicados (envia/altera/apaga).
--   * As 2 políticas de leitura pública (SELECT para PUBLIC) deixavam qualquer pessoa LISTAR todos os arquivos
--     do bucket (nomes = ids de usuário). Bucket público já serve a URL do arquivo sem política de SELECT,
--     então as fotos continuam aparecendo.
--   * O app (PerfilConta/perfil.ts) lista, envia (upsert) e remove só a pasta do próprio usuário: precisa de
--     SELECT apenas na própria pasta.
--   * Nenhum bucket tinha limite de tamanho nem tipo de arquivo.
--
-- Não apaga arquivos. Pode ser rodado mais de uma vez.
-- Para desfazer a leitura: create policy "avatars_leitura_publica" on storage.objects for select using (bucket_id = 'avatars');

begin;

-- 1) Duplicadas (ficam as 3 com nome *_proprio, que fazem exatamente o mesmo)
drop policy if exists "avatars dono envia"  on storage.objects;
drop policy if exists "avatars dono altera" on storage.objects;
drop policy if exists "avatars dono apaga"  on storage.objects;

-- 2) Sem listagem pública
drop policy if exists "avatars leitura publica" on storage.objects;
drop policy if exists "avatars_leitura_publica" on storage.objects;

-- 3) Cada usuário enxerga (listar/upsert/remover) só a própria pasta
drop policy if exists "avatars_leitura_propria" on storage.objects;
create policy "avatars_leitura_propria" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4) Limites
update storage.buckets
   set file_size_limit = 5242880,  -- 5 MB (o app reduz a foto para ~50 KB antes de enviar)
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
 where id = 'avatars';

update storage.buckets
   set file_size_limit = 1048576,  -- 1 MB
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml']
 where id = 'logo';

commit;

-- Verificação (deve listar 3 políticas de avatars + 1 leitura própria, e os limites):
-- select polname, polcmd from pg_policy where polrelid = 'storage.objects'::regclass order by 1;
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets;
