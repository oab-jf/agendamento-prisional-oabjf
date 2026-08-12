# Backend Wix/Velo — fonte versionada

Este diretório passa a ser a fonte versionada do backend da Central de
Agendamentos.

## Estrutura

- `source/`: cópia exata do estado vigente capturado no Wix/Velo em 12/08/2026;
- `domain/`: módulos puros e testáveis do novo domínio multimodal;
- `tests/`: testes de contrato e compatibilidade.

## Regra de publicação

Nunca sobrescrever um arquivo mutável do Wix usando snapshot histórico.

Toda publicação deve partir do arquivo vigente, produzir diff mínimo, validar
funções preservadas, manter rollback e publicar arquivos coordenados em uma
única rodada.

## Estado desta versão

A fundação v0.1 não altera endpoints, coleções ou comportamento em produção.
As modalidades futuras permanecem desativadas. O Atendimento Prisional segue
como única modalidade habilitada.
