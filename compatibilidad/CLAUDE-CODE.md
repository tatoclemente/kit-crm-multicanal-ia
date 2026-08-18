# Claude Code

Abrí la raíz del kit. Claude Code lee `CLAUDE.md`, que remite a `AGENTS.md` y a la skill
canónica.

Comandos disponibles: `/setup`, `/construi`, `/conecta`, `/integra`, `/deploy`, `/revisa`.
Todos delegan en `.agents/skills/crm-multicanal/SKILL.md`; ninguno tiene una segunda
implementación. Siempre hay una frase natural equivalente.

El kit **no** trae `.claude/settings.json` con permisos preaprobados, a propósito. Varias
acciones tienen efectos sobre datos y personas reales: registrar el webhook, importar
historial, prender un canal. Esas confirmaciones son parte del diseño.

Cuando el CRM esté construido, podés conectar su servidor MCP para operar la bandeja
desde el chat:

```json
{ "mcpServers": { "crm": { "command": "npm", "args": ["run", "mcp"], "cwd": "workspace/<cliente>/base" } } }
```

La herramienta `responder` de ese servidor **envía de verdad**. Confirmá siempre antes.
