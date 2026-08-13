import wixData from 'wix-data';
import { createAppointmentCatalogRepository } from 'backend/agendamentosConfiguracaoRepository';
const repository = createAppointmentCatalogRepository({ wixData });
export async function obterCatalogoAgendamentosAdminCore() { return repository.getAdminCatalog(); }
export async function salvarCatalogoAgendamentosAdminCore(payload = {}) { return repository.saveAdminCatalog(payload); }
export async function obterCatalogoAgendamentosPublicoCore() { return repository.getPublicCatalog(); }
