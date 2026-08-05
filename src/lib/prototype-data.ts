/**
 * Dados mockados do protótipo.
 *
 * Todo o conteúdo aqui é fictício e existe apenas para popular telas durante
 * a demonstração. Quando o backend real for plugado, este arquivo será
 * substituído por chamadas a server functions / Lovable Cloud.
 *
 * Convenções:
 * - `UNIDADES`, `HORARIOS`: catálogos estáticos exibidos nos selects.
 * - `gerarDatasDisponiveis`: datas fixas — uma delas marcada como `encerrado`
 *   para demonstrar a UI de prazo encerrado.
 * - `getIndisponiveis`: deriva horários ocupados de forma determinística
 *   (mesma unidade+data -> mesmos horários), para o protótipo parecer estável.
 * - `gerarProtocolo*`: gera identificadores aleatórios para a tela de sucesso.
 * - `MOCK_*`: listas usadas nas telas administrativas (`/admin`, `/gestao`).
 */
export const UNIDADES = [
  {
    id: "pjec",
    nome: "Penitenciária José Edson Cavalieri",
    endereco: "Juiz de Fora — MG",
  },
  {
    id: "afeb",
    nome: "Anexo Feminino Eliane Betti",
    endereco: "Juiz de Fora — MG",
  },
] as const;

export type UnidadeId = (typeof UNIDADES)[number]["id"];

export const HORARIOS = [
  "09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
];

const diasSemana = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

export type DataDisponivel = {
  id: string;
  label: string;
  diaSemana: string;
  diaMes: string;
  encerrado?: boolean;
};

export function gerarDatasDisponiveis(): DataDisponivel[] {
  // Datas mockadas fixas para protótipo
  return [
    { id: "2026-06-17", label: "Quarta, 17/06", diaSemana: "Quarta", diaMes: "17/06" },
    { id: "2026-06-18", label: "Quinta, 18/06", diaSemana: "Quinta", diaMes: "18/06" },
    { id: "2026-06-19", label: "Sexta, 19/06", diaSemana: "Sexta", diaMes: "19/06" },
    { id: "2026-06-22", label: "Segunda, 22/06", diaSemana: "Segunda", diaMes: "22/06" },
    { id: "2026-06-23", label: "Terça, 23/06", diaSemana: "Terça", diaMes: "23/06", encerrado: true },
  ];
}

// Horários indisponíveis simulados por data/unidade
export function getIndisponiveis(unidade: string, data: string): string[] {
  const seed = (unidade + data).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const pool = ["09:30","10:00","11:30","13:00","14:30","15:30"];
  return pool.filter((_, i) => (seed + i) % 3 === 0);
}

export function gerarProtocoloAgendamento() {
  const n = 123 + Math.floor(Math.random() * 800);
  return `AG-2026-${String(n).padStart(6, "0")}`;
}

export function gerarProtocoloDocumento() {
  const n = 87 + Math.floor(Math.random() * 800);
  return `DOC-2026-${String(n).padStart(6, "0")}`;
}

export const MOCK_AGENDAMENTOS = [
  { protocolo: "AG-2026-000118", unidade: "Penitenciária José Edson Cavalieri", advogado: "Maria A. Oliveira", oab: "MG-123.456", ipl: "IPL 0451/2025", data: "17/06/2026", horario: "09:30", status: "Agendado" },
  { protocolo: "AG-2026-000119", unidade: "Anexo Feminino Eliane Betti", advogado: "João P. Souza", oab: "MG-98.765", ipl: "IPL 0512/2025", data: "17/06/2026", horario: "10:00", status: "Agendado" },
  { protocolo: "AG-2026-000120", unidade: "Penitenciária José Edson Cavalieri", advogado: "Carla M. Lima", oab: "MG-44.221", ipl: "IPL 0233/2025", data: "18/06/2026", horario: "14:00", status: "Realizado" },
  { protocolo: "AG-2026-000121", unidade: "Penitenciária José Edson Cavalieri", advogado: "Pedro H. Andrade", oab: "MG-72.110", ipl: "IPL 0398/2025", data: "18/06/2026", horario: "15:30", status: "Cancelado" },
  { protocolo: "AG-2026-000122", unidade: "Anexo Feminino Eliane Betti", advogado: "Luísa F. Castro", oab: "MG-55.987", ipl: "IPL 0611/2025", data: "19/06/2026", horario: "11:00", status: "Agendado" },
];

export const MOCK_DOCUMENTOS = [
  { protocolo: "DOC-2026-000081", unidade: "Penitenciária José Edson Cavalieri", advogado: "Maria A. Oliveira", oab: "MG-123.456", ipl: "IPL 0451/2025", status: "Recebido", data: "16/06/2026" },
  { protocolo: "DOC-2026-000082", unidade: "Anexo Feminino Eliane Betti", advogado: "João P. Souza", oab: "MG-98.765", ipl: "IPL 0512/2025", status: "Concluído", data: "16/06/2026" },
  { protocolo: "DOC-2026-000083", unidade: "Penitenciária José Edson Cavalieri", advogado: "Carla M. Lima", oab: "MG-44.221", ipl: "IPL 0233/2025", status: "Com erro", data: "15/06/2026", motivoErro: "Procuração ilegível" },
  { protocolo: "DOC-2026-000084", unidade: "Penitenciária José Edson Cavalieri", advogado: "Pedro H. Andrade", oab: "MG-72.110", ipl: "IPL 0398/2025", status: "Recebido", data: "15/06/2026" },
];

export const MOCK_BLOQUEIOS = [
  { id: 1, unidade: "Todas as unidades", tipo: "Dia inteiro", data: "20/06/2026", horario: "—", motivo: "Feriado municipal" },
  { id: 2, unidade: "Penitenciária José Edson Cavalieri", tipo: "Horário específico", data: "18/06/2026", horario: "13:00 – 14:00", motivo: "Manutenção da sala virtual" },
];

export const MOCK_ENVIOS = [
  { id: 1, unidade: "Penitenciária José Edson Cavalieri", dataAtendimentos: "17/06/2026", total: 8, email: "agenda.pjec@oab-jf.org.br", status: "Enviado", hora: "17:00" },
  { id: 2, unidade: "Anexo Feminino Eliane Betti", dataAtendimentos: "17/06/2026", total: 4, email: "agenda.afeb@oab-jf.org.br", status: "Enviado", hora: "17:00" },
  { id: 3, unidade: "Penitenciária José Edson Cavalieri", dataAtendimentos: "16/06/2026", total: 9, email: "agenda.pjec@oab-jf.org.br", status: "Erro", hora: "17:01", erro: "Falha de SMTP — reenviado manualmente" },
  { id: 4, unidade: "Anexo Feminino Eliane Betti", dataAtendimentos: "16/06/2026", total: 3, email: "agenda.afeb@oab-jf.org.br", status: "Enviado", hora: "17:00" },
];

