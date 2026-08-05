# 07 — Design system e UX

## Identidade visual

A Central usa visual institucional/editorial:

- fundo claro sépia (`paper`/`sand`);
- texto escuro (`ink`);
- acento vermelho OAB (`brand-red`);
- acento azul OAB (`brand-blue`);
- títulos com `Instrument Serif`;
- corpo com `Instrument Sans`.

Tokens ficam em:

```text
src/styles.css
```

## Status e tags

Regra: status são sempre retangulares com leve arredondamento.

Usar:

```text
badge-base
badge-success
badge-danger
badge-warning
badge-info
badge-neutral
```

Não usar:

```text
rounded-full
emerald-50
red-50
amber-50
sky-50
```

## Toasts

Toasts usam `src/components/ui/sonner.tsx` e CSS institucional em `src/styles.css`.

Não reativar `richColors` do Sonner.

O toast deve parecer parte da Central, não componente genérico de navegador/template.

## Mobile

Padrões atuais:

- navegação do painel vira seletor “Área do painel: ...”;
- filtros colapsam por padrão em Unidades e Bloqueios;
- cards mobile iniciam colapsados;
- Agendamentos e Documentos usam cards compactos;
- listas longas de datas mostram inicialmente 5 opções e botão “Ver próximas datas”.

## Componentes base

- Header: `src/components/AppHeader.tsx`
- Footer: `src/components/AppFooter.tsx`
- Shell: `src/components/AppShell.tsx`
- Shell compatível com fluxos antigos: `src/components/MobileShell.tsx`
- Campos/máscaras: `src/components/Field.tsx`, `src/components/OabField.tsx`, `src/lib/masks.ts`
- Validações: `src/lib/validators.ts`

## Regras de manutenção visual

- Não criar botões soltos com cara de HTML básico.
- Não usar cores Tailwind genéricas para estados críticos.
- Não misturar raios de borda muito diferentes.
- Não esconder ações importantes como texto sem borda.
- Manter microcopy clara e humana.
