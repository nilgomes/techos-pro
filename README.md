# TechOS Pro

Sistema web para gestão de assistência técnica.

## Stack

- React + Vite
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Vercel

## 1. Instalação

```bash
npm install
```

## 2. Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute `supabase/schema.sql`.
4. Em Project Settings / Connect copie a Project URL e a Publishable Key.

## 3. Ambiente

Copie `.env.example` para `.env.local`:

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave
```

Não publique `.env.local`.

## 4. Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:5173`.

## 5. Criar conta

Na tela inicial do TechOS Pro, clique em "Ainda não tenho conta".

O trigger do banco cria automaticamente:
- empresa
- perfil de administrador
- vínculo do usuário com a empresa

## 6. Deploy Vercel

Envie o projeto para GitHub e importe o repositório na Vercel.

Configure as mesmas variáveis de ambiente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Build:

```bash
npm run build
```

Output:

```text
dist
```

## Segurança

A aplicação usa Row Level Security no Supabase e cada registro recebe o `company_id` da empresa do usuário autenticado.

Nunca coloque a service_role key no frontend.
