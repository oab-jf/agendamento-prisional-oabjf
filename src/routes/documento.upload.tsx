import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { usePrototype } from "@/lib/prototype-store";
import {
  DOCUMENTO_EXTENSOES_ACEITAS,
  DOCUMENTO_TAMANHO_MAX_BYTES,
  TIPOS_DOCUMENTO,
  uploadDocumentoArquivo,
  validarArquivoDocumento,
} from "@/lib/oab-api";

export const Route = createFileRoute("/documento/upload")({
  component: Page,
});

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Page() {
  const { doc, setDoc } = usePrototype();
  const nav = useNavigate();

  const [tipoDocumento, setTipoDocumento] = useState(doc.tipoDocumento ?? "");
  const [observacoes, setObservacoes] = useState(doc.observacoesAdvogado ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const arquivoJaEnviado = !!doc.arquivoPrincipalUrl && !file;
  const nomeAtual = file?.name ?? doc.arquivoPrincipalNome;
  const tamanhoAtual = file?.size ?? doc.arquivoTamanhoBytes;

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validarArquivoDocumento(f);
    if (err) {
      setFile(null);
      setFileError(err);
      toast.error("Arquivo inválido", { description: err });
      return;
    }
    setFile(f);
    setFileError(null);
  }

  function limparArquivo() {
    setFile(null);
    setFileError(null);
    // Também remove metadados anteriores, forçando novo upload.
    setDoc({
      arquivoPrincipalUrl: undefined,
      arquivoPrincipalNome: undefined,
      arquivoMimeType: undefined,
      arquivoTamanhoBytes: undefined,
    });
  }

  async function continuar() {
    setAttempted(true);
    if (!tipoDocumento) {
      toast.error("Selecione o tipo de documento");
      return;
    }
    if (!file && !arquivoJaEnviado) {
      toast.error("Anexe o arquivo do documento");
      return;
    }
    const tipoLabel = TIPOS_DOCUMENTO.find((t) => t.value === tipoDocumento)?.label ?? tipoDocumento;

    // Se já há arquivo enviado e usuário não trocou, apenas grava tipo/observações e avança.
    if (!file && arquivoJaEnviado) {
      setDoc({
        tipoDocumento,
        tipoDocumentoLabel: tipoLabel,
        observacoesAdvogado: observacoes.trim() || undefined,
      });
      nav({ to: "/documento/revisao" });
      return;
    }

    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadDocumentoArquivo(file, setUploadProgress);
      if (!res.ok) {
        const msg = res.message || res.error || "Não foi possível enviar o arquivo.";
        toast.error("Erro no envio", { description: msg });
        setFileError(msg);
        return;
      }
      setDoc({
        tipoDocumento,
        tipoDocumentoLabel: tipoLabel,
        observacoesAdvogado: observacoes.trim() || undefined,
        arquivoPrincipalUrl: res.arquivoPrincipalUrl,
        arquivoPrincipalNome: res.arquivoPrincipalNome,
        arquivoMimeType: res.arquivo?.mimeType,
        arquivoTamanhoBytes: res.arquivo?.tamanhoBytes,
      });
      nav({ to: "/documento/revisao" });
    } catch (e) {
      console.error(e);
      toast.error("Erro no envio", { description: "Verifique sua conexão e tente novamente." });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const acceptAttr = DOCUMENTO_EXTENSOES_ACEITAS.join(",") + ",application/pdf,image/jpeg,image/png";
  const tipoInvalido = attempted && !tipoDocumento;
  const arquivoInvalido = attempted && !file && !arquivoJaEnviado;

  return (
    <MobileShell title="Enviar documento" step={{ current: 4, total: 6 }} back="/documento/ipl">
      <PageTitle
        title="Documento a enviar"
        subtitle="Selecione o tipo, anexe o arquivo e, se quiser, deixe observações para a unidade."
      />

      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Tipo de documento<span className="ml-1 text-destructive">*</span>
          </label>
          <select
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            className={
              "h-12 w-full rounded-xl border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary " +
              (tipoInvalido ? "border-destructive" : "border-input")
            }
          >
            <option value="">Selecione…</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {tipoInvalido && <p className="mt-1 text-xs text-destructive">Selecione o tipo de documento.</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Arquivo<span className="ml-1 text-destructive">*</span>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            onChange={onSelectFile}
            className="hidden"
          />
          {nomeAtual ? (
            <div
              className={
                "flex items-start gap-3 rounded-xl border bg-card p-4 " +
                (arquivoInvalido ? "border-destructive" : "border-input")
              }
            >
              <div className="document-upload-file-card__icon shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{nomeAtual}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatBytes(tamanhoAtual)}
                  {arquivoJaEnviado && " · já enviado"}
                </div>
              </div>
              <button
                type="button"
                onClick={limparArquivo}
                aria-label="Remover arquivo"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card p-6 text-center transition-colors hover:bg-muted/40 " +
                (arquivoInvalido ? "border-destructive" : "border-input")
              }
            >
              <UploadCloud className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Selecionar arquivo</span>
              <span className="text-xs text-muted-foreground">PDF, JPG ou PNG · até 8 MB</span>
            </button>
          )}
          {nomeAtual && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Trocar arquivo
            </button>
          )}
          {fileError && <p className="mt-1 text-xs text-destructive">{fileError}</p>}
          {arquivoInvalido && !fileError && (
            <p className="mt-1 text-xs text-destructive">Anexe o arquivo do documento.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Formatos aceitos: PDF, JPG, PNG. Tamanho máximo: {formatBytes(DOCUMENTO_TAMANHO_MAX_BYTES)}.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Ex.: solicitar assinatura e devolução por e-mail."
            className="w-full rounded-xl border border-input bg-background p-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">{observacoes.length}/500</p>
        </div>

        {uploading && (
          <div className="document-upload-progress" role="status" aria-live="polite">
            <div className="document-upload-progress__meta">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Enviando arquivo diretamente ao armazenamento
              </span>
              <strong>{uploadProgress > 0 ? `${uploadProgress}%` : "Preparando…"}</strong>
            </div>
            <div className="document-upload-progress__track" aria-hidden>
              <span style={{ width: `${Math.max(4, uploadProgress)}%` }} />
            </div>
          </div>
        )}
      </div>

      <StepActions
        back="/documento/ipl"
        onNext={continuar}
        nextDisabled={uploading}
        nextLabel={uploading ? "Enviando…" : "Continuar"}
      />
    </MobileShell>
  );
}

