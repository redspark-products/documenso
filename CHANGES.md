# Modificações deste fork

Este repositório é uma versão modificada do [Documenso](https://github.com/documenso/documenso), distribuída sob a
[GNU AGPL-3.0](./LICENSE). Este arquivo lista as mudanças feitas sobre o projeto original, conforme a seção 5(a) da
licença. O histórico completo de cada mudança está no git.

- **Código-fonte desta versão:** https://github.com/redspark-products/documenso
- **Base do upstream:** `documenso/documenso@125ff950` (v2.22.0)
- **Pasta `packages/ee`:** não modificada (licença comercial separada).

## 2026-11-20 — Selfie do signatário

Captura opcional de uma selfie de cada signatário antes de concluir a assinatura, como evidência de identidade.
Desligada por padrão; pode ser ativada por organização, por equipe ou por documento.

**Comportamento**

- Signatários (papel `SIGNER`) de documentos que exigem selfie passam por uma etapa extra no diálogo de conclusão:
  consentimento explícito com checkbox obrigatório e foto pela câmera frontal (`getUserMedia`), sem envio de arquivo,
  com prévia e opção de refazer.
- A conclusão é recusada no servidor (`RECIPIENT_SELFIE_REQUIRED`) enquanto o signatário não tiver selfie, inclusive
  em envelopes TSP/CSC.
- A imagem é normalizada (EXIF/GPS removidos), tem o SHA-256 calculado no servidor e é cifrada
  (XChaCha20-Poly1305, chave `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY`) antes de ir para o storage.
- Cada captura gera o evento de auditoria `DOCUMENT_RECIPIENT_SELFIE_CAPTURED` (hash e versão do consentimento, sem a
  imagem).
- O certificado de assinatura mostra a selfie, o hash e o horário de captura de cada signatário. Documentos que
  exigem selfie sempre recebem o certificado.
- Membros da equipe com acesso ao documento podem ver a selfie numa rota restrita, sem URL pública ou reutilizável.
- Links diretos de template e assinatura embutida (embed) não suportam a selfie nesta versão.

**Arquivos novos**

- `packages/prisma/migrations/20261120000000_add_recipient_selfie/`
- `packages/lib/constants/recipient-selfie.ts`
- `packages/lib/server-only/recipient-selfie/*`
- `packages/trpc/server/recipient-router/upload-recipient-selfie{,.types}.ts`
- `apps/remix/server/api/files/routes/get-recipient-selfie.ts`
- `apps/remix/app/components/general/document-signing/signer-selfie-{provider,step}.tsx`
- `apps/remix/app/components/general/document/recipient-selfie-view-dialog.tsx`
- `packages/app-tests/e2e/recipient/signer-selfie.spec.ts`

**Arquivos do upstream alterados**

- Schema e configurações: `packages/prisma/schema.prisma`, `packages/lib/utils/{organisations,teams,document}.ts`,
  `packages/lib/types/{document-meta,envelope,envelope-editor}.ts`,
  `packages/lib/server-only/template/create-document-from{,-direct}-template.ts`,
  `packages/trpc/server/{organisation,team}-router/update-*-settings{,.types}.ts`
- Assinatura: `packages/lib/server-only/document/complete-document-with-token.ts`,
  `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts`,
  `packages/trpc/server/recipient-router/router.ts`, `packages/lib/errors/app-error.ts`,
  `packages/lib/server-only/rate-limit/rate-limits.ts`
- Auditoria e certificado: `packages/lib/types/document-audit-logs.ts`, `packages/lib/utils/document-audit-logs.ts`,
  `packages/lib/server-only/pdf/{generate-certificate-pdf,render-certificate}.ts`,
  `packages/lib/jobs/definitions/internal/seal-document.handler.ts`
- Interface: `apps/remix/app/components/forms/document-preferences-form.tsx`,
  `apps/remix/app/components/general/envelope-editor/envelope-editor-settings-dialog.tsx`,
  `apps/remix/app/components/general/document-signing/document-signing-complete-dialog.tsx`,
  `apps/remix/app/components/general/document/document-page-view-recipients.tsx`,
  `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx`,
  `apps/remix/app/routes/_authenticated+/{o.$orgUrl.settings.document,t.$teamUrl+/settings.document}.tsx`,
  `apps/remix/app/utils/toast-error-messages.ts`, `apps/remix/server/api/files/files.ts`
- Traduções: `packages/lib/translations/*/web.po`

## 2026-11-20 — Link para o código-fonte

Para atender à seção 13 da AGPL-3.0, as páginas públicas, a tela de assinatura e a área autenticada passam a exibir
um link "Código-fonte", configurável por `NEXT_PUBLIC_SOURCE_CODE_URL` (padrão: o repositório deste fork).

**Arquivos do upstream alterados:** `apps/remix/app/components/general/public-legal-links.tsx`,
`apps/remix/app/routes/_authenticated+/_layout.tsx`, `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx`,
`packages/lib/constants/app.ts`, `packages/tsconfig/process-env.d.ts`, `.env.example`
