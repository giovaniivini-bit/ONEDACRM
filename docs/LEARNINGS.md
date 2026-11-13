## 2026-11-13 — Arquivos novos e allowlist pública

Sintoma: nova tela funcionava no smoke com interceptação local, mas arquivosJS/CSS
retornaram404 em produção. Causa: PUBLIC_FILES em server.js não incluía os assets.
Correção: liberar somente follow-product.js/css e repetir smoke público completo.
Regra: novas telas precisam validar assets reais viaHTTP além do browser com mocks.

# Aprendizados
