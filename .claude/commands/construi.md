---
description: Construye el CRM por fases, sin saltear ninguna
---

Leé `AGENTS.md` y `.agents/skills/crm-multicanal/SKILL.md`.
Retomá desde la primera fase incompleta de `workspace/_ESTADO.md`.
Una fase por vez: al terminar cada una, `npm run typecheck` y `npm run build` limpios y
la verificación que esa fase pide, con la salida real pegada. No avances si la anterior
no compila. Usá $ARGUMENTS para indicar en qué fase arrancar, si viene.
