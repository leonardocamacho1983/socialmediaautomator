"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  type BrandProfile,
} from "../../lib/brand/profile";
import {
  APPROVED_POSTS_STORAGE_KEY,
  parseApprovedPosts,
  upsertApprovedPost,
} from "../../lib/creative/approved-posts";
import {
  CREATIVE_PROJECT_STORAGE_KEY,
  isCreativeProject,
  type CreativeProject,
} from "../../lib/creative/concepts";
import {
  buildStudioProjectRecordFromApprovedPost,
  buildStudioProjectRecordFromProject,
  deleteStudioProjectRecord,
  fetchStudioProjectRecords,
  syncStudioProjectRecord,
  type StudioProjectRecord,
  type StudioProjectStatus,
} from "../../lib/persistence/studio-projects";

const statusLabels: Record<StudioProjectStatus, string> = {
  draft: "Rascunho",
  concept_selected: "Conceito escolhido",
  typographic_ready: "Peça pronta",
  caption_ready: "Legenda pronta",
  approved: "Aprovado",
  package_ready: "Pacote pronto",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

export function ProjectLibrary() {
  const router = useRouter();
  const [projects, setProjects] = useState<StudioProjectRecord[]>([]);
  const [status, setStatus] = useState("Carregando biblioteca persistida.");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localRecords, setLocalRecords] = useState<StudioProjectRecord[]>([]);

  useEffect(() => {
    // The local project cache is browser-only and becomes available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalRecords(readLocalStudioRecords());
    void loadProjects();
  }, []);

  const normalizedSearchTerm = normalizeText(searchTerm);
  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return normalizeText(
          [
            project.title,
            project.brandName,
            project.status,
            project.summary.briefingTopic,
            project.summary.selectedConceptTitle,
            project.summary.captionPreview,
          ].join(" "),
        ).includes(normalizedSearchTerm);
      }),
    [normalizedSearchTerm, projects],
  );
  const approvedCount = useMemo(
    () => projects.filter((project) => project.source === "approved_post").length,
    [projects],
  );
  const draftCount = projects.length - approvedCount;

  async function loadProjects() {
    setIsLoading(true);
    setStatus("Carregando projetos do banco.");

    try {
      const nextProjects = await fetchStudioProjectRecords();
      setProjects(nextProjects);
      setStatus("Biblioteca carregada do banco.");
    } catch {
      setProjects([]);
      setStatus(
        "Banco indisponivel ou nao configurado. Use sincronizar depois que a persistencia estiver ativa.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function syncLocalRecords() {
    const records = readLocalStudioRecords();
    setLocalRecords(records);

    if (!records.length) {
      setStatus("Nao ha projetos locais para sincronizar.");
      return;
    }

    setIsSyncing(true);
    setStatus("Sincronizando projetos deste navegador.");

    try {
      const savedRecords = await Promise.all(records.map(syncStudioProjectRecord));
      setProjects(mergeStudioProjectRecords(savedRecords, projects));
      setStatus(`${savedRecords.length} projeto(s) sincronizado(s) no banco.`);
    } catch {
      setStatus(
        "Nao foi possivel sincronizar. Confira se o banco esta configurado.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function openProject(project: StudioProjectRecord) {
    saveProjectSnapshot(project.projectData.brandSnapshot, project.projectData);

    if (project.approvedPostData) {
      const currentPosts = readLocalApprovedPosts();
      const nextPosts = upsertApprovedPost(currentPosts, project.approvedPostData);

      window.localStorage.setItem(
        APPROVED_POSTS_STORAGE_KEY,
        JSON.stringify(nextPosts),
      );
      router.push(`/approved/${encodeURIComponent(project.approvedPostData.id)}`);
      return;
    }

    router.push("/create");
  }

  async function deleteProject(projectId: string) {
    setStatus("Removendo projeto do banco.");

    try {
      await deleteStudioProjectRecord(projectId);
      setProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== projectId),
      );
      setStatus("Projeto removido da biblioteca persistida.");
    } catch {
      setStatus("Nao foi possivel remover o projeto persistido.");
    }
  }

  return (
    <main className="brand-shell projects-shell">
      <header className="brand-header">
        <div className="nav-row">
          <Link className="text-link" href="/">
            Inicio
          </Link>
          <Link className="text-link" href="/brand">
            Brand Foundation
          </Link>
          <Link className="text-link" href="/create">
            Criar post
          </Link>
          <Link className="text-link" href="/approved">
            Posts aprovados
          </Link>
          <Link className="text-link" href="/outputs">
            Entregas
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 7</p>
          <h1>Projetos</h1>
          <p className="lead">
            Biblioteca persistida para recuperar projetos, pacotes aprovados e
            variações sem depender apenas do cache deste navegador.
          </p>
        </div>
      </header>

      <section className="projects-toolbar" aria-label="Acoes de projetos">
        <div>
          <strong>{projects.length}</strong>
          <span>{projects.length === 1 ? "projeto salvo" : "projetos salvos"}</span>
        </div>
        <div>
          <strong>{approvedCount}</strong>
          <span>{approvedCount === 1 ? "aprovado" : "aprovados"}</span>
        </div>
        <div>
          <strong>{draftCount}</strong>
          <span>{draftCount === 1 ? "em criacao" : "em criacao"}</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={syncLocalRecords}
          disabled={isSyncing}
        >
          {isSyncing ? "Sincronizando..." : "Sincronizar navegador"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={loadProjects}
          disabled={isLoading}
        >
          Atualizar
        </button>
        <span className="next-step-status" role="status">
          {status}
        </span>
      </section>

      <section className="approved-filter-panel" aria-label="Busca de projetos">
        <label className="field approved-search-field">
          <span>Busca</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por titulo, marca, status, briefing ou legenda"
          />
        </label>
        <div className="approved-filter-summary">
          <strong>
            {visibleProjects.length} de {projects.length}
          </strong>
          <span>
            {visibleProjects.length === 1
              ? "projeto visivel"
              : "projetos visiveis"}
          </span>
        </div>
        {searchTerm.trim() ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSearchTerm("")}
          >
            Limpar busca
          </button>
        ) : null}
      </section>

      {localRecords.length ? (
        <section className="projects-local-note">
          <strong>{localRecords.length} item(ns) neste navegador.</strong>
          <p>
            Clique em sincronizar para enviar o projeto atual e os aprovados
            locais para a biblioteca persistida.
          </p>
        </section>
      ) : null}

      {visibleProjects.length ? (
        <section className="projects-grid" aria-label="Projetos persistidos">
          {visibleProjects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-heading">
                <span className="project-source">
                  {project.source === "approved_post" ? "Aprovado" : "Projeto"}
                </span>
                <span className={`project-status project-status-${project.status}`}>
                  {statusLabels[project.status]}
                </span>
                <h2>{project.title}</h2>
                <p>{project.brandName}</p>
              </div>

              <dl className="project-card-meta">
                <div>
                  <dt>Briefing</dt>
                  <dd>{project.summary.briefingTopic || "Sem briefing"}</dd>
                </div>
                <div>
                  <dt>Conceito</dt>
                  <dd>
                    {project.summary.selectedConceptTitle || "Nao escolhido"}
                  </dd>
                </div>
                <div>
                  <dt>Atualizado</dt>
                  <dd>{new Date(project.updatedAt).toLocaleString("pt-BR")}</dd>
                </div>
              </dl>

              {project.summary.captionPreview ? (
                <p className="project-card-copy">
                  {project.summary.captionPreview}
                </p>
              ) : null}

              <div className="project-card-flags">
                {project.summary.hasTypographicPiece ? <span>Visual</span> : null}
                {project.summary.hasCaptionPackage ? <span>Legenda</span> : null}
                {project.summary.hasFinalPackage ? <span>Pacote</span> : null}
                {project.summary.hasVisualAsset ? <span>Asset</span> : null}
                {project.summary.hasApprovedCarousel ? (
                  <span>Carrossel</span>
                ) : null}
                {project.summary.hasDurableOutputs ? <span>Storage</span> : null}
              </div>

              <div className="approved-post-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openProject(project)}
                >
                  Abrir
                </button>
                <button
                  className="secondary-button secondary-danger"
                  type="button"
                  onClick={() => deleteProject(project.id)}
                >
                  Remover do banco
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="approved-empty">
          <strong>Nenhum projeto persistido encontrado.</strong>
          <p>
            Se voce ja criou posts neste navegador, use sincronizar navegador
            para migrar esses itens para o banco.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={syncLocalRecords}
            disabled={isSyncing}
          >
            Sincronizar navegador
          </button>
        </section>
      )}
    </main>
  );
}

function readLocalStudioRecords() {
  const records = new Map<string, StudioProjectRecord>();
  const currentProject = readCurrentLocalProject();

  if (currentProject) {
    const record = buildStudioProjectRecordFromProject(currentProject);
    records.set(record.id, record);
  }

  for (const post of readLocalApprovedPosts()) {
    const record = buildStudioProjectRecordFromApprovedPost(post);
    records.set(record.id, record);
  }

  return [...records.values()];
}

function readCurrentLocalProject() {
  try {
    const storedProject = window.localStorage.getItem(
      CREATIVE_PROJECT_STORAGE_KEY,
    );
    const parsedProject: unknown = storedProject
      ? JSON.parse(storedProject)
      : null;

    return isCreativeProject(parsedProject) ? parsedProject : null;
  } catch {
    return null;
  }
}

function readLocalApprovedPosts() {
  try {
    const storedPosts = window.localStorage.getItem(APPROVED_POSTS_STORAGE_KEY);

    return parseApprovedPosts(storedPosts ? JSON.parse(storedPosts) : []);
  } catch {
    return [];
  }
}

function saveProjectSnapshot(
  brandProfile: BrandProfile,
  projectSnapshot: CreativeProject,
) {
  window.localStorage.setItem(
    BRAND_PROFILE_STORAGE_KEY,
    JSON.stringify(brandProfile),
  );
  window.localStorage.setItem(
    CREATIVE_PROJECT_STORAGE_KEY,
    JSON.stringify(projectSnapshot),
  );
}

function mergeStudioProjectRecords(
  nextRecords: StudioProjectRecord[],
  currentRecords: StudioProjectRecord[],
) {
  const recordsById = new Map<string, StudioProjectRecord>();

  for (const record of [...currentRecords, ...nextRecords]) {
    const current = recordsById.get(record.id);

    if (!current || getProjectTime(record) >= getProjectTime(current)) {
      recordsById.set(record.id, record);
    }
  }

  return [...recordsById.values()].sort(
    (a, b) => getProjectTime(b) - getProjectTime(a),
  );
}

function getProjectTime(project: StudioProjectRecord) {
  return new Date(project.updatedAt).getTime();
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
