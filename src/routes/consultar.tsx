import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { Field } from "@/components/Field";
import { emailError } from "@/lib/validators";
import {
  consultarAgendamento,
  cancelarAgendamentoUsuario,
  remarcarAgendamentoUsuario,
  listarDatasDisponiveis,
  listarHorariosDisponiveis,
  listarDisponibilidadeOferta,
  type ConsultaAgendamento,
  type DataDisponivel,
  type HorarioDisponivel,
} from "@/lib/oab-api";

export const Route = createFileRoute("/consultar")({
  component: Page,
});

const MSG_NAO_ENCONTRADO =
  "Não encontramos um agendamento com esse protocolo e e-mail. Confira os dados e tente novamente.";

function Page() {
  const [protocolo, setProtocolo] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ protocolo?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ConsultaAgendamento | null>(null);
  const [credenciais, setCredenciais] = useState<{ protocolo: string; email: string } | null>(null);

  function validar() {
    const next: { protocolo?: string; email?: string } = {};
    if (!protocolo.trim()) next.protocolo = "Informe o protocolo do agendamento.";
    const em = emailError(email);
    if (em) next.email = em;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!validar()) return;
    setLoading(true);
    setErroGeral(null);
    setResultado(null);
    try {
      const r = await consultarAgendamento({
        protocolo,
        emailAdvogado: email,
      });
      if (r.ok) {
        setResultado(r.agendamento);
        setCredenciais({ protocolo: protocolo.trim().toUpperCase(), email: email.trim().toLowerCase() });
      } else {
        // Não revelar diferença entre protocolo inexistente e e-mail errado.
        setErroGeral(MSG_NAO_ENCONTRADO);
      }
    } catch (err) {
      console.error(err);
      setErroGeral(
        "Não foi possível concluir a consulta agora. Tente novamente em instantes.",
      );
    } finally {
      setLoading(false);
    }
  }

  function novaConsulta() {
    setResultado(null);
    setCredenciais(null);
    setErroGeral(null);
    setProtocolo("");
    setEmail("");
    setErrors({});
  }

  return (
    <MobileShell title="Consultar agendamento" contextLabel="Agendamentos" back="/">
      {!resultado ? (
        <>
          <div className="public-task-intro">
            <p>Informe o protocolo recebido por e-mail e o e-mail usado no agendamento.</p>
          </div>

          <form onSubmit={submit} className="public-query-form flex flex-col gap-4" noValidate>
            <Field
              label="Protocolo"
              value={protocolo}
              onChange={(v) => setProtocolo(v.toUpperCase())}
              placeholder="Ex.: AGD-2026-000123"
              required
              error={errors.protocolo}
              autoComplete="off"
            />
            <Field
              label="E-mail do(a) advogado(a)"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="seu@email.com"
              required
              error={errors.email}
            />

            {erroGeral && (
              <div className="alert-danger p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm leading-relaxed text-foreground">{erroGeral}</p>
                </div>
              </div>
            )}

            <div className="public-query-actions">
              <button
                type="submit"
                disabled={loading}
                aria-disabled={loading}
                className={
                  "public-button w-full md:w-auto " +
                  (loading ? "public-button--disabled" : "public-button--primary")
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Consultando…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                    Consultar agendamento
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        <ResultadoCard
          agendamento={resultado}
          credenciais={credenciais}
          onNova={novaConsulta}
          onAtualizar={setResultado}
          onReconsultar={async (novoProtocolo) => {
            const emailUsado = credenciais?.email || email;
            if (!emailUsado) return;
            const r = await consultarAgendamento({
              protocolo: novoProtocolo,
              emailAdvogado: emailUsado,
            });
            if (r.ok) {
              setResultado(r.agendamento);
              setCredenciais({ protocolo: novoProtocolo.trim().toUpperCase(), email: emailUsado });
            }
          }}
        />



      )}
    </MobileShell>
  );
}

function statusClasses(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("cancel")) return "badge-danger";
  if (s.includes("realiz") || s.includes("conclu")) return "badge-info";
  if (s.includes("reagend") || s.includes("remarc")) return "badge-warning";
  if (s.includes("agend")) return "badge-success";
  return "badge-neutral";
}

function isReagendado(status: string) {
  const s = (status || "").toLowerCase();
  return s.includes("reagend") || s.includes("remarc");
}

function ResultadoCard({
  agendamento,
  credenciais,
  onNova,
  onAtualizar,
  onReconsultar,
}: {
  agendamento: ConsultaAgendamento;
  credenciais: { protocolo: string; email: string } | null;
  onNova: () => void;
  onAtualizar: (a: ConsultaAgendamento) => void;
  onReconsultar: (protocolo: string) => Promise<void>;
}) {
  const {
    protocolo,
    statusLabel,
    status,
    schemaVersion,
    servicoNome,
    ofertaId,
    ofertaNome,
    localNome,
    localEndereco,
    recursoNome,
    unidadeNome,
    unidadeSlug,
    dataLabel,
    horarioLabel,
    horarioInicio,
    horarioFim,
    nomeIpl,
    infopen,
    nomeAdvogado,
    numeroOab,
    novoProtocolo,
    protocoloOrigem,
    podeCancelar,
    cancelamentoPermitido,
    cancelamentoMensagem,
    podeRemarcar,
    remarcacaoPermitida,
    remarcacaoMensagem,
  } = agendamento;

  const horario =
    horarioLabel ||
    (horarioInicio && horarioFim
      ? `${horarioInicio} — ${horarioFim}`
      : horarioInicio || undefined);

  const statusLower = (status || "").toLowerCase();
  const ehAtivo = statusLower.includes("agend") && !statusLower.includes("reagend") && !statusLower.includes("cancel") && !statusLower.includes("realiz") && !statusLower.includes("conclu");
  const permitido = podeCancelar === true || cancelamentoPermitido === true;
  const podeRemarcarUi = podeRemarcar === true || remarcacaoPermitida === true;
  const isGeneric = Number(schemaVersion || 0) >= 2 && Boolean(ofertaId);

  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erroCancel, setErroCancel] = useState<string | null>(null);
  const [sucessoCancel, setSucessoCancel] = useState<string | null>(null);

  const [remarcarAberto, setRemarcarAberto] = useState(false);
  const [remarcarEtapa, setRemarcarEtapa] = useState<"escolher" | "confirmar">("escolher");
  const [datas, setDatas] = useState<DataDisponivel[]>([]);
  const DATAS_PAGE = 5;
  const [datasVisiveis, setDatasVisiveis] = useState(DATAS_PAGE);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [carregandoDatas, setCarregandoDatas] = useState(false);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [dataSel, setDataSel] = useState<DataDisponivel | null>(null);
  const [horarioSel, setHorarioSel] = useState<HorarioDisponivel | null>(null);
  const [remarcando, setRemarcando] = useState(false);
  const [erroRemarcar, setErroRemarcar] = useState<string | null>(null);
  const [sucessoRemarcar, setSucessoRemarcar] = useState<string | null>(null);
  const [visualizando, setVisualizando] = useState(false);

  useEffect(() => {
    if (!remarcarAberto || (!unidadeSlug && !isGeneric)) return;
    let cancelado = false;
    setCarregandoDatas(true);
    setDatasVisiveis(DATAS_PAGE);

    const loader = isGeneric && ofertaId
      ? listarDisponibilidadeOferta(ofertaId).then((result) =>
          (result.dates || []).map((item) => ({
            id: item.id,
            dataIso: item.dataIso,
            label: item.labelCompleta || item.label,
            diaSemana: item.diaSemana,
            diaMes: item.label,
            disponivel: item.disponivel,
            encerrado: false,
          })),
        )
      : listarDatasDisponiveis(unidadeSlug || "");

    loader
      .then((d) => {
        if (!cancelado) setDatas(d);
      })
      .catch(() => {
        if (!cancelado) setErroRemarcar("Não foi possível carregar as datas disponíveis.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoDatas(false);
      });
    return () => {
      cancelado = true;
    };
  }, [remarcarAberto, unidadeSlug, isGeneric, ofertaId]);

  useEffect(() => {
    if (!remarcarAberto || !dataSel || (!unidadeSlug && !isGeneric)) return;
    let cancelado = false;
    setCarregandoHorarios(true);
    setHorarios([]);
    setHorarioSel(null);

    const loader = isGeneric && ofertaId
      ? listarDisponibilidadeOferta(ofertaId, dataSel.dataIso).then((result) =>
          (result.slots || []).map((item) => ({
            id: item.id,
            value: item.value,
            label: item.label,
            horarioInicio: item.horarioInicio,
            horarioFim: item.horarioFim,
            disponivel: item.disponivel,
          })),
        )
      : listarHorariosDisponiveis(unidadeSlug || "", dataSel.dataIso);

    loader
      .then((h) => {
        if (!cancelado) setHorarios(h);
      })
      .catch(() => {
        if (!cancelado) setErroRemarcar("Não foi possível carregar os horários disponíveis.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoHorarios(false);
      });
    return () => {
      cancelado = true;
    };
  }, [remarcarAberto, unidadeSlug, dataSel, isGeneric, ofertaId]);

  function abrirRemarcar() {
    setDataSel(null);
    setHorarioSel(null);
    setHorarios([]);
    setErroRemarcar(null);
    setRemarcarEtapa("escolher");
    setRemarcarAberto(true);
  }

  function fecharRemarcar() {
    if (remarcando) return;
    setRemarcarAberto(false);
  }

  async function confirmarRemarcacao() {
    if (!credenciais || !dataSel || !horarioSel || remarcando) return;
    setRemarcando(true);
    setErroRemarcar(null);
    try {
      const r = await remarcarAgendamentoUsuario({
        protocolo: credenciais.protocolo,
        emailAdvogado: credenciais.email,
        dataIso: dataSel.dataIso,
        horarioInicio: horarioSel.horarioInicio,
        horarioFim: horarioSel.horarioFim,
      });
      if (r.ok) {
        onAtualizar(r.agendamento);
        setSucessoRemarcar(
          "Agendamento remarcado com sucesso. Guarde o novo protocolo para futuras consultas.",
        );
        setRemarcarAberto(false);
      } else {
        setErroRemarcar(r.message || r.error || "Não foi possível remarcar o agendamento.");
      }
    } catch (e) {
      console.error(e);
      setErroRemarcar("Não foi possível remarcar o agendamento. Tente novamente em instantes.");
    } finally {
      setRemarcando(false);
    }
  }

  async function confirmarCancelamento() {
    if (!credenciais || cancelando) return;
    setCancelando(true);
    setErroCancel(null);
    try {
      const r = await cancelarAgendamentoUsuario({
        protocolo: credenciais.protocolo,
        emailAdvogado: credenciais.email,
      });
      if (r.ok) {
        onAtualizar(r.agendamento);
        setSucessoCancel("Agendamento cancelado com sucesso.");
        setConfirmando(false);
      } else {
        setErroCancel(r.message || r.error || "Não foi possível cancelar o agendamento.");
      }
    } catch (e) {
      console.error(e);
      setErroCancel("Não foi possível cancelar o agendamento. Tente novamente em instantes.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <>
      <PageTitle
        title={
          sucessoRemarcar
            ? "Agendamento remarcado com sucesso"
            : sucessoCancel
              ? "Agendamento cancelado"
              : "Agendamento encontrado"
        }
      />

      <div className="overflow-hidden rounded-2xl border border-clay/20 bg-card">
        <div className="flex flex-col gap-3 border-b border-clay/15 bg-sand/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-clay">
              Protocolo
            </div>
            <div className="mt-1 font-mono text-xl tracking-tight text-ink break-all sm:text-2xl md:text-3xl">
              {protocolo}
            </div>
          </div>
          <span
            className={
              "inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium " +
              statusClasses(status)
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            {statusLabel || status}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          {isGeneric ? (
            <>
              <Info2 label="Serviço" value={servicoNome || ofertaNome} />
              <Info2 label="Atendimento" value={recursoNome || ofertaNome} />
              <Info2 label="Local" value={localNome} />
              {localEndereco && <Info2 label="Endereço" value={localEndereco} />}
            </>
          ) : (
            <>
              <Info2 label="Unidade prisional" value={unidadeNome} />
              <Info2 label="Nome da IPL" value={nomeIpl} />
              {infopen && <Info2 label="INFOPEN" value={infopen} />}
            </>
          )}
          <Info2 label="Data" value={dataLabel} />
          <Info2 label="Horário" value={horario} />
          <Info2 label="Advogado(a)" value={nomeAdvogado} />
          <Info2 label="OAB" value={numeroOab} />
        </dl>

        {protocoloOrigem && (
          <div className="border-t border-clay/15 bg-sand/40 px-5 py-4">
            <div className="flex items-start gap-2 text-sm text-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" strokeWidth={1.5} />
              <span>
                Este agendamento foi gerado a partir do protocolo{" "}
                <strong className="font-medium">{protocoloOrigem}</strong>.
              </span>
            </div>
          </div>
        )}
      </div>

      {isReagendado(status) && (
        <div className="mt-4 alert-warning px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2.5 text-sm leading-relaxed">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning-text)]" strokeWidth={1.5} />
            <span className="break-words">
              {novoProtocolo ? (
                <>
                  Este agendamento foi reagendado para o protocolo{" "}
                  <strong className="font-mono font-medium">{novoProtocolo}</strong>. Consulte o
                  novo protocolo para acompanhar os dados atualizados.
                </>
              ) : (
                <>
                  Este agendamento foi reagendado. Consulte o novo protocolo informado no e-mail
                  de confirmação.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {sucessoCancel && (
        <div className="mt-4 alert-success px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2.5 text-sm leading-relaxed">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success-text)]" strokeWidth={1.5} />
            <span>{sucessoCancel}</span>
          </div>
        </div>
      )}

      {sucessoRemarcar && (
        <div className="mt-4 alert-success px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2.5 text-sm leading-relaxed">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success-text)]" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p>{sucessoRemarcar}</p>
              <button
                type="button"
                disabled={visualizando}
                onClick={async () => {
                  setVisualizando(true);
                  try {
                    await onReconsultar(protocolo);
                    setSucessoRemarcar(null);
                  } finally {
                    setVisualizando(false);
                  }
                }}
                className="public-button public-button--secondary mt-3 min-h-9 px-3 py-2 text-xs"
              >
                {visualizando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                    Carregando…
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Visualizar agendamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {ehAtivo &&
        !sucessoCancel &&
        !sucessoRemarcar &&
        (podeRemarcarUi && (unidadeSlug || isGeneric) ? true : permitido) && (
          <div className="mt-6 rounded-2xl border border-clay/20 bg-sand/30 px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="text-base font-semibold text-ink sm:text-lg">Ações do agendamento</h3>
            <p className="mt-1 text-sm leading-relaxed text-clay">
              {podeRemarcarUi && (unidadeSlug || isGeneric) && permitido
                ? "Você pode remarcar ou cancelar este agendamento dentro do prazo permitido."
                : podeRemarcarUi && (unidadeSlug || isGeneric)
                  ? "Você pode remarcar este agendamento dentro do prazo permitido."
                  : "Você pode cancelar este agendamento dentro do prazo permitido."}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              {podeRemarcarUi && (unidadeSlug || isGeneric) && (
                <button
                  type="button"
                  onClick={abrirRemarcar}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-clay/40 bg-paper px-4 text-sm font-medium text-ink transition-colors hover:bg-sand/60 sm:w-auto"
                >
                  <CalendarClock className="h-4 w-4" strokeWidth={1.5} />
                  Remarcar agendamento
                </button>
              )}
              {permitido && (
                <button
                  type="button"
                  onClick={() => {
                    setErroCancel(null);
                    setConfirmando(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-destructive/40 bg-transparent px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 sm:w-auto"
                >
                  <XCircle className="h-4 w-4" strokeWidth={1.5} />
                  Cancelar agendamento
                </button>
              )}
            </div>
          </div>
        )}

      {ehAtivo && !permitido && !podeRemarcarUi && (cancelamentoMensagem || remarcacaoMensagem) && (
        <div className="mt-4 rounded-2xl border border-clay/20 bg-sand/30 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2.5 text-sm leading-relaxed text-clay">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-clay" strokeWidth={1.5} />
            <span>{remarcacaoMensagem || cancelamentoMensagem}</span>
          </div>
        </div>
      )}





      <div className="mt-8 flex flex-col gap-3 border-t border-clay/15 pt-6 md:flex-row-reverse md:items-center md:justify-start md:gap-4">
        <button
          type="button"
          onClick={onNova}
          className="public-button public-button--primary w-full md:w-auto"
        >
          Fazer nova consulta
        </button>
      </div>

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !cancelando && setConfirmando(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-clay/20 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" strokeWidth={1.5} />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-ink">Cancelar agendamento?</h3>
                <p className="mt-2 text-sm leading-relaxed text-clay">
                  Essa ação cancelará o atendimento e liberará o horário para outros agendamentos.
                  Ela não poderá ser desfeita.
                </p>
              </div>
            </div>

            {erroCancel && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm leading-relaxed text-foreground">{erroCancel}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={cancelando}
                className="inline-flex h-11 items-center justify-center rounded-md border border-clay/30 bg-transparent px-4 text-sm font-medium text-ink transition-colors hover:bg-sand/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarCancelamento}
                disabled={cancelando}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-paper transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {cancelando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Cancelando…
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" strokeWidth={1.5} />
                    Confirmar cancelamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {remarcarAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={fecharRemarcar}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-clay/20 bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-clay/15 px-6 py-4">
              <h3 className="text-lg font-semibold text-ink">
                {remarcarEtapa === "escolher" ? "Remarcar agendamento" : "Confirmar remarcação?"}
              </h3>
              <p className="mt-1 text-xs text-clay">
                {isGeneric ? "Atendimento" : "Unidade"}: {" "}
                <span className="font-medium text-ink">
                  {isGeneric ? recursoNome || ofertaNome : unidadeNome}
                </span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {remarcarEtapa === "escolher" ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-clay">
                      Nova data
                    </div>
                    {carregandoDatas ? (
                      <div className="flex items-center gap-2 text-sm text-clay">
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                        Carregando datas…
                      </div>
                    ) : datas.length === 0 ? (
                      <p className="text-sm text-clay">Nenhuma data disponível no momento.</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {datas.slice(0, datasVisiveis).map((d) => {
                            const ativo = dataSel?.dataIso === d.dataIso;
                            const desabilitado = d.disponivel === false || d.encerrado === true;
                            return (
                              <button
                                key={d.id || d.dataIso}
                                type="button"
                                disabled={desabilitado}
                                onClick={() => setDataSel(d)}
                                className={
                                  "rounded-md border px-3 py-2 text-sm transition-colors " +
                                  (desabilitado
                                    ? "cursor-not-allowed border-clay/20 bg-sand/30 text-clay/50"
                                    : ativo
                                      ? "border-ink bg-ink text-paper"
                                      : "border-clay/30 bg-transparent text-ink hover:bg-sand/60")
                                }
                              >
                                {d.label || `${d.diaSemana} ${d.diaMes}`}
                              </button>
                            );
                          })}
                        </div>
                        {datasVisiveis < datas.length ? (
                          <div className="mt-3 flex flex-col items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setDatasVisiveis((v) => Math.min(v + DATAS_PAGE, datas.length))
                              }
                              className="rounded-md border border-clay/30 bg-transparent px-3 py-1.5 text-xs text-ink transition-colors hover:bg-sand/60"
                            >
                              Ver próximas datas
                            </button>
                            <p className="text-[11px] text-clay">
                              Mostrando {Math.min(datasVisiveis, datas.length)} de {datas.length} datas disponíveis.
                            </p>
                          </div>
                        ) : datas.length > DATAS_PAGE ? (
                          <p className="mt-3 text-[11px] text-clay">
                            Todas as datas disponíveis no período foram exibidas.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {dataSel && (
                    <div>
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-clay">
                        Novo horário
                      </div>
                      {carregandoHorarios ? (
                        <div className="flex items-center gap-2 text-sm text-clay">
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                          Carregando horários…
                        </div>
                      ) : horarios.length === 0 ? (
                        <p className="text-sm text-clay">Nenhum horário disponível nesta data.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {horarios.map((h) => {
                            const ativo = horarioSel?.value === h.value;
                            return (
                              <button
                                key={h.id || h.value}
                                type="button"
                                onClick={() => setHorarioSel(h)}
                                className={
                                  "rounded-md border px-3 py-2 text-sm transition-colors " +
                                  (ativo
                                    ? "border-ink bg-ink text-paper"
                                    : "border-clay/30 bg-transparent text-ink hover:bg-sand/60")
                                }
                              >
                                {h.label || `${h.horarioInicio} — ${h.horarioFim}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {erroRemarcar && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                      <p className="text-sm leading-relaxed text-foreground">{erroRemarcar}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" strokeWidth={1.5} />
                    <p className="text-sm leading-relaxed text-clay">
                      Essa ação criará um novo protocolo e o agendamento atual será marcado como
                      reagendado.
                    </p>
                  </div>
                  <div className="rounded-md border border-clay/20 bg-sand/40 px-4 py-3 text-sm text-ink">
                    <div>
                      <span className="text-clay">Nova data: </span>
                      <strong className="font-medium">{dataSel?.label}</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-clay">Novo horário: </span>
                      <strong className="font-medium">
                        {horarioSel?.label ||
                          `${horarioSel?.horarioInicio} — ${horarioSel?.horarioFim}`}
                      </strong>
                    </div>
                  </div>
                  {erroRemarcar && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                      <p className="text-sm leading-relaxed text-foreground">{erroRemarcar}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-clay/15 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (remarcando) return;
                  if (remarcarEtapa === "confirmar") setRemarcarEtapa("escolher");
                  else fecharRemarcar();
                }}
                disabled={remarcando}
                className="inline-flex h-11 items-center justify-center rounded-md border border-clay/30 bg-transparent px-4 text-sm font-medium text-ink transition-colors hover:bg-sand/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Voltar
              </button>
              {remarcarEtapa === "escolher" ? (
                <button
                  type="button"
                  disabled={!dataSel || !horarioSel}
                  onClick={() => {
                    setErroRemarcar(null);
                    setRemarcarEtapa("confirmar");
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmarRemarcacao}
                  disabled={remarcando}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {remarcando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      Remarcando…
                    </>
                  ) : (
                    <>
                      <CalendarClock className="h-4 w-4" strokeWidth={1.5} />
                      Confirmar remarcação
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Info2({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-clay">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

