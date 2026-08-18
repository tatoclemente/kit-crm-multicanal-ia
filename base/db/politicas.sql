-- Políticas de acceso. Pegá esto en el SQL Editor de Supabase después de la migración.
--
-- El CRM entra siempre del lado del servidor con la clave de servicio, que ignora RLS.
-- Lo que esto evita es que la clave ANÓNIMA —que sí viaja al navegador— pueda leer la
-- base si alguien apunta un cliente de Supabase a una tabla.
--
-- Denegación total: RLS habilitado y ninguna política permisiva. Todo lo que no pase
-- por el servidor del CRM, no pasa.

alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table contacts             enable row level security;
alter table contact_identities   enable row level security;
alter table channel_accounts     enable row level security;
alter table agent_configs        enable row level security;
alter table webhook_events       enable row level security;
alter table pipeline_stages      enable row level security;
alter table stage_history        enable row level security;
alter table tasks                enable row level security;
alter table notes                enable row level security;
alter table tags                 enable row level security;
alter table contact_tags         enable row level security;
alter table guardrail_events     enable row level security;
alter table outbound_webhooks    enable row level security;
alter table outbound_deliveries  enable row level security;
alter table api_keys             enable row level security;
alter table integration_calls    enable row level security;
alter table profiles             enable row level security;

-- Única excepción: cada persona puede leer su propio perfil, para que la interfaz
-- sepa quién entró sin pasar por el servidor.
create policy "perfil propio" on profiles
  for select using (auth.uid() = id);

-- Comprobación: esta consulta tiene que devolver todas las tablas con rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
