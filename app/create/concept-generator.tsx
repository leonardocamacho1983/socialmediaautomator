"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CaptionWorkshop } from "./caption-workshop";
import { FinalPostPackageWorkshop } from "./final-post-package";
import { TypographicPieceWorkshop } from "./typographic-piece-workshop";
import {
  BRAND_PROFILE_STORAGE_KEY,
  emptyBrandProfile,
  isBrandProfile,
  stripEmbeddedBrandAssets,
  type BrandProfile,
} from "../../lib/brand/profile";
import {
  CREATIVE_PROJECT_STORAGE_KEY,
  emptyCreativeBriefing,
  isCreativeProject,
  objectiveLabels,
  type CreativeBriefing,
  type CreativeConcept,
  type CreativeConceptBatch,
  type FinalPostChecklistItem,
  type CreativeProject,
} from "../../lib/creative/concepts";
import {
  APPROVED_POSTS_STORAGE_KEY,
  createApprovedPostFromProject,
  parseApprovedPosts,
  upsertApprovedPost,
  type ApprovedPost,
} from "../../lib/creative/approved-posts";
import {
  reviewCaptionForInstagram,
  type CaptionPackage,
  type CaptionVariantId,
} from "../../lib/creative/captions";
import {
  compactBrandProfileForGeneration,
  compactBriefingForGeneration,
} from "../../lib/creative/context";
import {
  createTypographicPiece,
  type TypographicCopy,
  type TypographicVariantId,
} from "../../lib/creative/typographic-piece";
import {
  buildStudioProjectRecordFromApprovedPost,
  buildStudioProjectRecordFromProject,
  syncStudioProjectRecord,
} from "../../lib/persistence/studio-projects";

const objectiveOptions = Object.entries(objectiveLabels) as Array<
  [CreativeBriefing["objective"], string]
>;

function createProject(
  brandSnapshot: BrandProfile,
  briefing: CreativeBriefing,
  batch: CreativeConceptBatch,
): CreativeProject {
  return {
    id: `project-${Date.now()}`,
    brandSnapshot,
    briefing,
    batch,
    selectedConceptId: null,
    finalPostPackage: null,
    updatedAt: new Date().toISOString(),
  };
}

export function ConceptGenerator() {
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [briefing, setBriefing] = useState(emptyCreativeBriefing);
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [status, setStatus] = useState("Carregando perfil de marca.");
  const [persistenceStatus, setPersistenceStatus] = useState(
    "Persistencia aguardando projeto.",
  );
  const [error, setError] = useState("");
  const [captionError, setCaptionError] = useState("");
  const [
    typographicRegenerationInstruction,
    setTypographicRegenerationInstruction,
  ] = useState("");
  const [captionRegenerationInstruction, setCaptionRegenerationInstruction] =
    useState("");

  useEffect(() => {
    const storedBrand = window.localStorage.getItem(BRAND_PROFILE_STORAGE_KEY);
    if (storedBrand) {
      try {
        const parsedBrand: unknown = JSON.parse(storedBrand);
        if (isBrandProfile(parsedBrand)) {
          // The page hydrates from browser-only storage after the client mounts.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBrandProfile({
            ...emptyBrandProfile,
            ...parsedBrand,
          });
          setStatus("Perfil de marca carregado.");
        }
      } catch {
        setStatus("Nao foi possivel carregar o perfil de marca.");
      }
    } else {
      setStatus("Nenhum perfil de marca encontrado neste navegador.");
    }

    const storedProject = window.localStorage.getItem(
      CREATIVE_PROJECT_STORAGE_KEY,
    );
    if (storedProject) {
      try {
        const parsedProject: unknown = JSON.parse(storedProject);
        if (isCreativeProject(parsedProject)) {
          setProject(parsedProject);
          setBriefing(parsedProject.briefing);
        }
      } catch {
        setStatus("Perfil carregado, mas projeto anterior invalido.");
      }
    }
  }, []);

  const selectedConcept = useMemo(() => {
    if (!project?.selectedConceptId) {
      return null;
    }

    return (
      project.batch.concepts.find(
        (concept) => concept.id === project.selectedConceptId,
      ) || null
    );
  }, [project]);

  const activeBrandProfile = useMemo(
    () => brandProfile || project?.brandSnapshot || emptyBrandProfile,
    [brandProfile, project?.brandSnapshot],
  );

  const activeTypographicPiece =
    project?.typographicPiece?.conceptId === selectedConcept?.id
      ? project?.typographicPiece
      : null;
  const activeCaptionPackage: CaptionPackage | null =
    project?.captionPackage &&
    project.captionPackage.conceptId === selectedConcept?.id &&
    project.captionPackage.typographicPieceId === activeTypographicPiece?.id
      ? project.captionPackage
      : null;
  const activeFinalPostPackage =
    project?.finalPostPackage &&
    selectedConcept &&
    activeTypographicPiece &&
    activeCaptionPackage &&
    project.finalPostPackage.conceptId === selectedConcept.id &&
    project.finalPostPackage.typographicPieceId === activeTypographicPiece.id &&
    project.finalPostPackage.typographicVariantId ===
      activeTypographicPiece.selectedVariantId &&
    project.finalPostPackage.captionPackageId === activeCaptionPackage.id &&
    project.finalPostPackage.captionVariantId ===
      activeCaptionPackage.selectedVariantId
      ? project.finalPostPackage
      : null;

  function persistProject(nextProject: CreativeProject) {
    window.localStorage.setItem(
      CREATIVE_PROJECT_STORAGE_KEY,
      JSON.stringify(nextProject),
    );
    setProject(nextProject);
    syncProjectInBackground(nextProject);
  }

  function persistApprovedPost(
    nextProject: CreativeProject,
    concept: CreativeConcept,
  ) {
    const approvedPost = createApprovedPostFromProject(nextProject, concept);

    if (!approvedPost) {
      return;
    }

    let currentPosts: ApprovedPost[] = [];

    try {
      const storedPosts = window.localStorage.getItem(
        APPROVED_POSTS_STORAGE_KEY,
      );
      currentPosts = parseApprovedPosts(
        storedPosts ? JSON.parse(storedPosts) : [],
      );
    } catch {
      currentPosts = [];
    }

    window.localStorage.setItem(
      APPROVED_POSTS_STORAGE_KEY,
      JSON.stringify(upsertApprovedPost(currentPosts, approvedPost)),
    );
    syncApprovedPostInBackground(approvedPost);
  }

  function syncProjectInBackground(nextProject: CreativeProject) {
    setPersistenceStatus("Salvando projeto no banco...");
    void syncStudioProjectRecord(
      buildStudioProjectRecordFromProject(nextProject),
    )
      .then(() => {
        setPersistenceStatus("Projeto sincronizado no banco.");
      })
      .catch(() => {
        setPersistenceStatus(
          "Projeto salvo no navegador. Banco indisponivel ou nao configurado.",
        );
      });
  }

  function syncApprovedPostInBackground(approvedPost: ApprovedPost) {
    setPersistenceStatus("Salvando aprovado no banco...");
    void syncStudioProjectRecord(
      buildStudioProjectRecordFromApprovedPost(approvedPost),
    )
      .then(() => {
        setPersistenceStatus("Post aprovado sincronizado no banco.");
      })
      .catch(() => {
        setPersistenceStatus(
          "Post aprovado salvo no navegador. Banco indisponivel ou nao configurado.",
        );
      });
  }

  function startNewPost() {
    window.localStorage.removeItem(CREATIVE_PROJECT_STORAGE_KEY);
    setProject(null);
    setBriefing(emptyCreativeBriefing);
    setError("");
    setCaptionError("");
    setTypographicRegenerationInstruction("");
    setCaptionRegenerationInstruction("");
    setStatus("Novo post iniciado. Preencha o briefing.");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function updateBriefing<K extends keyof CreativeBriefing>(
    key: K,
    value: CreativeBriefing[K],
  ) {
    setBriefing((currentBriefing) => ({
      ...currentBriefing,
      [key]: value,
    }));
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!brandProfile?.brandName) {
      setError("Salve um perfil de marca antes de gerar conceitos.");
      return;
    }

    setIsGenerating(true);
    setStatus("Gerando tres conceitos criativos distintos.");

    try {
      const generationBrandProfile = compactBrandProfileForGeneration(
        stripEmbeddedBrandAssets(brandProfile),
      );
      const generationBriefing = compactBriefingForGeneration(briefing);
      const response = await fetch("/api/concepts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandProfile: generationBrandProfile,
          briefing: generationBriefing,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Nao foi possivel gerar conceitos.";
        const errorCode =
          payload && typeof payload === "object" && "code" in payload
            ? String(payload.code)
            : "";
        throw new Error(
          errorCode ? `${errorMessage} (${errorCode})` : errorMessage,
        );
      }

      const nextProject = createProject(
        generationBrandProfile,
        generationBriefing,
        payload as CreativeConceptBatch,
      );
      persistProject(nextProject);
      setStatus("Conceitos gerados e salvos neste navegador.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel gerar conceitos.",
      );
      setStatus("Geracao interrompida.");
    } finally {
      setIsGenerating(false);
    }
  }

  function selectConcept(concept: CreativeConcept) {
    if (!project) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      selectedConceptId: concept.id,
      typographicPiece:
        project.typographicPiece?.conceptId === concept.id
          ? project.typographicPiece
          : null,
      captionPackage:
        project.captionPackage?.conceptId === concept.id &&
        project.captionPackage.typographicPieceId === project.typographicPiece?.id
          ? project.captionPackage
          : null,
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus(`Conceito escolhido: ${concept.title}`);
  }

  function produceTypographicPiece() {
    if (!project || !selectedConcept) {
      return;
    }

    const typographicPiece = createTypographicPiece(
      project,
      selectedConcept,
      activeBrandProfile,
      {
        regenerationInstruction: typographicRegenerationInstruction,
      },
    );
    const nextProject: CreativeProject = {
      ...project,
      typographicPiece,
      captionPackage: null,
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Peca tipografica gerada para revisao.");
    window.requestAnimationFrame(() => {
      document
        .getElementById("typographic-piece")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectTypographicVariant(variantId: TypographicVariantId) {
    if (!project?.typographicPiece) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      typographicPiece: {
        ...project.typographicPiece,
        selectedVariantId: variantId,
      },
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Variacao tipografica escolhida.");
  }

  function updateTypographicCopy(field: keyof TypographicCopy, value: string) {
    if (!project?.typographicPiece) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      typographicPiece: {
        ...project.typographicPiece,
        copy: {
          ...project.typographicPiece.copy,
          [field]: value,
        },
      },
      captionPackage: null,
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Copy visual atualizada. Gere legenda novamente.");
  }

  async function generateCaptionPackage() {
    setCaptionError("");

    if (!project || !selectedConcept || !activeTypographicPiece) {
      setCaptionError("Produza a peca tipografica antes de gerar legenda.");
      return;
    }

    setIsGeneratingCaption(true);
    setStatus("Gerando tres opcoes de legenda para o post.");

    try {
      const generationBrandProfile = compactBrandProfileForGeneration(
        stripEmbeddedBrandAssets(activeBrandProfile),
      );
      const generationBriefing = compactBriefingForGeneration(project.briefing);
      const response = await fetch("/api/captions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandProfile: generationBrandProfile,
          briefing: generationBriefing,
          selectedConcept,
          typographicPiece: activeTypographicPiece,
          regenerationInstruction: captionRegenerationInstruction,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Nao foi possivel gerar legenda.";
        const errorCode =
          payload && typeof payload === "object" && "code" in payload
            ? String(payload.code)
            : "";
        throw new Error(
          errorCode ? `${errorMessage} (${errorCode})` : errorMessage,
        );
      }

      const nextProject: CreativeProject = {
        ...project,
        captionPackage: payload as CaptionPackage,
        finalPostPackage: null,
        updatedAt: new Date().toISOString(),
      };
      persistProject(nextProject);
      setStatus("Legendas geradas para revisao.");
      window.requestAnimationFrame(() => {
        document
          .getElementById("caption-workshop")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (caughtError) {
      setCaptionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel gerar legenda.",
      );
      setStatus("Geracao de legenda interrompida.");
    } finally {
      setIsGeneratingCaption(false);
    }
  }

  function selectCaptionVariant(variantId: CaptionVariantId) {
    if (!project?.captionPackage) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      captionPackage: {
        ...project.captionPackage,
        selectedVariantId: variantId,
      },
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Variacao de legenda escolhida.");
  }

  function updateCaptionVariant(
    field: "caption" | "firstComment",
    value: string,
  ) {
    if (!project?.captionPackage) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      captionPackage: updateSelectedCaptionVariant(project.captionPackage, {
        [field]: value,
      }),
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Legenda atualizada.");
  }

  function updateCaptionHashtags(value: string) {
    if (!project?.captionPackage) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      captionPackage: updateSelectedCaptionVariant(project.captionPackage, {
        hashtags: parseHashtags(value),
      }),
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Hashtags atualizadas.");
  }

  function reviewSelectedCaption() {
    if (!project?.captionPackage || !activeTypographicPiece) {
      return;
    }

    const selectedVariant =
      project.captionPackage.variants.find(
        (variant) => variant.id === project.captionPackage?.selectedVariantId,
      ) || project.captionPackage.variants[0];

    if (!selectedVariant) {
      return;
    }

    const review = reviewCaptionForInstagram(
      selectedVariant.caption,
      activeTypographicPiece.copy,
      activeBrandProfile,
    );
    const nextProject: CreativeProject = {
      ...project,
      captionPackage: updateSelectedCaptionVariant(project.captionPackage, {
        review,
      }),
      finalPostPackage: null,
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Legenda revisada contra criterios de Instagram.");
  }

  function approveFinalPostPackage(checklist: FinalPostChecklistItem[]) {
    if (
      !project ||
      !selectedConcept ||
      !activeTypographicPiece ||
      !activeCaptionPackage
    ) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      finalPostPackage: {
        id: `final-post-${project.id}-${selectedConcept.id}`,
        conceptId: selectedConcept.id,
        typographicPieceId: activeTypographicPiece.id,
        typographicVariantId: activeTypographicPiece.selectedVariantId,
        captionPackageId: activeCaptionPackage.id,
        captionVariantId: activeCaptionPackage.selectedVariantId,
        approvedAt: new Date().toISOString(),
        checklist,
      },
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    persistApprovedPost(nextProject, selectedConcept);
    setStatus("Pacote final aprovado e salvo na biblioteca.");
  }

  return (
    <main className="brand-shell">
      <header className="brand-header">
        <div className="nav-row">
          <Link className="text-link" href="/">
            Inicio
          </Link>
          <Link className="text-link" href="/brand">
            Brand Foundation
          </Link>
          <Link className="text-link" href="/approved">
            Posts aprovados
          </Link>
          <Link className="text-link" href="/projects">
            Projetos
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 2</p>
          <h1>Creative Concepts</h1>
          <p className="lead">
            Gere tres caminhos criativos diferentes antes de escrever legenda ou
            criar qualquer asset visual.
          </p>
        </div>
      </header>

      <section className="workflow-grid">
        <form className="brand-section concept-form" onSubmit={handleGenerate}>
          <div className="section-heading">
            <p className="section-kicker">Briefing</p>
            <h2>Pedido do post</h2>
          </div>

          <div className="status-strip">
            <strong>{brandProfile?.brandName || "Marca nao carregada"}</strong>
            <span>{status}</span>
            <span>{persistenceStatus}</span>
          </div>

          <label className="field">
            <span>Assunto</span>
            <input
              required
              value={briefing.topic}
              onChange={(event) => updateBriefing("topic", event.target.value)}
              placeholder="Ex: clientes que param de responder"
            />
          </label>

          <label className="field">
            <span>Objetivo</span>
            <select
              value={briefing.objective}
              onChange={(event) =>
                updateBriefing(
                  "objective",
                  event.target.value as CreativeBriefing["objective"],
                )
              }
            >
              {objectiveOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-wide">
            <span>Mensagem principal</span>
            <textarea
              required
              value={briefing.mainMessage}
              onChange={(event) =>
                updateBriefing("mainMessage", event.target.value)
              }
              placeholder="O que a pessoa precisa entender depois de ver o post"
              rows={4}
            />
          </label>

          <label className="field field-wide">
            <span>Contexto</span>
            <textarea
              value={briefing.context}
              onChange={(event) => updateBriefing("context", event.target.value)}
              placeholder="Situacao, publico, oferta, momento da marca ou nuance importante"
              rows={4}
            />
          </label>

          <label className="field field-wide">
            <span>Referencia opcional</span>
            <textarea
              value={briefing.reference}
              onChange={(event) =>
                updateBriefing("reference", event.target.value)
              }
              placeholder="Link, frase, post, insight ou direcao que inspirou este pedido"
              rows={3}
            />
          </label>

          <label className="field">
            <span>Link ou material relacionado</span>
            <input
              value={briefing.relatedLink}
              onChange={(event) =>
                updateBriefing("relatedLink", event.target.value)
              }
              placeholder="Opcional"
            />
          </label>

          <label className="field">
            <span>Restricoes</span>
            <input
              value={briefing.constraints}
              onChange={(event) =>
                updateBriefing("constraints", event.target.value)
              }
              placeholder="Ex: sem humor, sem prometer resultado"
            />
          </label>

          {error ? <p className="error-message">{error}</p> : null}

          <button
            className="primary-button"
            type="submit"
            disabled={isGenerating}
          >
            {isGenerating ? "Gerando..." : "Gerar conceitos"}
          </button>
        </form>

        <aside className="brand-aside concept-aside">
          <div className="summary-block">
            <p className="section-kicker">Projeto atual</p>
            <strong>{selectedConcept?.title || "Nenhum conceito escolhido"}</strong>
            <span>
              {project?.batch.generatedAt
                ? `Gerado em ${new Date(project.batch.generatedAt).toLocaleString(
                    "pt-BR",
                  )}`
                : "Aguardando geracao"}
            </span>
            {project?.batch.model ? <span>Modelo: {project.batch.model}</span> : null}
          </div>

          <div
            className={
              selectedConcept
                ? "next-step-panel"
                : "next-step-panel next-step-panel-muted"
            }
          >
            <p className="section-kicker">Proximo passo</p>
            {selectedConcept ? (
              <>
                <h3>
                  {activeFinalPostPackage
                    ? "Post final aprovado"
                    : activeCaptionPackage
                      ? "Pronto para pacote final"
                    : activeTypographicPiece
                      ? "Pronto para legenda"
                      : "Pronto para Marco 3"}
                </h3>
                <p>
                  {activeFinalPostPackage
                    ? "O pacote final foi aprovado e salvo na biblioteca de posts aprovados."
                    : activeCaptionPackage
                      ? "Revise o pacote final do post antes de considerar esta peca pronta para uso."
                    : activeTypographicPiece
                      ? "A peca tipografica esta pronta. Gere a legenda sabendo o que o visual ja diz."
                      : "Produzir a primeira peca tipografica a partir deste conceito: copy visual, layout 1080x1350 e tres variacoes."}
                </p>
                <dl className="next-step-list">
                  <div>
                    <dt>Formato</dt>
                    <dd>{selectedConcept.recommendedFormat}</dd>
                  </div>
                  <div>
                    <dt>Direcao</dt>
                    <dd>{selectedConcept.visualDirection.visualFamily}</dd>
                  </div>
                  <div>
                    <dt>Saida</dt>
                    <dd>
                      {activeFinalPostPackage
                        ? "Biblioteca local de posts aprovados"
                        : activeCaptionPackage
                        ? "Pacote final do post"
                        : activeTypographicPiece
                          ? "3 opcoes de legenda"
                          : "Preview + PNG final"}
                    </dd>
                  </div>
                </dl>
                {activeFinalPostPackage ? (
                  <Link
                    className="primary-button next-step-button"
                    href="/approved"
                  >
                    Ver posts aprovados
                  </Link>
                ) : activeCaptionPackage ? (
                  <a
                    className="primary-button next-step-button"
                    href="#final-post-package"
                  >
                    Ver pacote final
                  </a>
                ) : (
                  <button
                    className="primary-button next-step-button"
                    type="button"
                    disabled={Boolean(activeTypographicPiece && isGeneratingCaption)}
                    onClick={
                      activeTypographicPiece
                        ? generateCaptionPackage
                        : produceTypographicPiece
                    }
                  >
                    {activeTypographicPiece
                      ? isGeneratingCaption
                        ? "Gerando..."
                        : "Gerar legenda"
                      : "Produzir peca tipografica"}
                  </button>
                )}
                {activeTypographicPiece ? (
                  <a className="secondary-button next-step-button" href="#typographic-piece">
                    Ver peca tipografica
                  </a>
                ) : null}
              </>
            ) : (
              <p>
                Escolha uma alternativa para travar o conceito e preparar a
                producao visual.
              </p>
            )}
          </div>

          <pre className="profile-preview">
            {JSON.stringify(
              project
                ? {
                    selectedConceptId: project.selectedConceptId,
                    typographicPiece: project.typographicPiece
                      ? {
                          id: project.typographicPiece.id,
                          selectedVariantId:
                            project.typographicPiece.selectedVariantId,
                        }
                      : null,
                    captionPackage: activeCaptionPackage
                      ? {
                          id: activeCaptionPackage.id,
                          selectedVariantId:
                            activeCaptionPackage.selectedVariantId,
                        }
                      : null,
                    finalPostPackage: activeFinalPostPackage
                      ? {
                          id: activeFinalPostPackage.id,
                          approvedAt: activeFinalPostPackage.approvedAt,
                        }
                      : null,
                    decisionTrace: project.batch.decisionTrace,
                  }
                : {
                    expected: "briefing + brandProfile => 3 creative concepts",
                  },
              null,
              2,
            )}
          </pre>
        </aside>
      </section>

      {project ? (
        <section className="concept-results" aria-labelledby="concepts-title">
          <div className="section-heading">
            <p className="section-kicker">Alternativas</p>
            <h2 id="concepts-title">Conceitos gerados</h2>
          </div>

          <div className="concept-card-grid">
            {project.batch.concepts.map((concept) => {
              const isSelected = concept.id === project.selectedConceptId;

              return (
                <article
                  className={
                    isSelected
                      ? "concept-card concept-card-selected"
                      : "concept-card"
                  }
                  key={concept.id}
                >
                  <div>
                    <p className="section-kicker">
                      {concept.recommendedFormat}
                    </p>
                    <h3>{concept.title}</h3>
                    <p className="concept-hook">{concept.hook}</p>
                  </div>

                  <dl className="concept-details">
                    <div>
                      <dt>Ideia central</dt>
                      <dd>{concept.centralIdea}</dd>
                    </div>
                    <div>
                      <dt>Direcao visual</dt>
                      <dd>{concept.visualDirection.visualFamily}</dd>
                    </div>
                    <div>
                      <dt>Copy</dt>
                      <dd>{concept.copyDirection.style}</dd>
                    </div>
                  </dl>

                  <div>
                    <h4>Estrutura narrativa</h4>
                    <ol>
                      {concept.narrativeStructure.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="concept-note">
                    <strong>Por que serve</strong>
                    <span>{concept.whyItFitsBrand}</span>
                  </div>

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => selectConcept(concept)}
                  >
                    {isSelected ? "Conceito escolhido" : "Escolher conceito"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {project && selectedConcept ? (
        <TypographicPieceWorkshop
          brandProfile={activeBrandProfile}
          project={project}
          regenerationInstruction={typographicRegenerationInstruction}
          selectedConcept={selectedConcept}
          onProduce={produceTypographicPiece}
          onUpdateCopy={updateTypographicCopy}
          onUpdateRegenerationInstruction={setTypographicRegenerationInstruction}
          onSelectVariant={selectTypographicVariant}
        />
      ) : null}

      {project && selectedConcept && activeTypographicPiece ? (
        <CaptionWorkshop
          brandProfile={activeBrandProfile}
          captionError={captionError}
          captionPackage={activeCaptionPackage}
          isGeneratingCaption={isGeneratingCaption}
          project={project}
          regenerationInstruction={captionRegenerationInstruction}
          selectedConcept={selectedConcept}
          onGenerateCaption={generateCaptionPackage}
          onReviewCaption={reviewSelectedCaption}
          onSelectCaptionVariant={selectCaptionVariant}
          onUpdateCaptionHashtags={updateCaptionHashtags}
          onUpdateCaptionVariant={updateCaptionVariant}
          onUpdateRegenerationInstruction={setCaptionRegenerationInstruction}
        />
      ) : null}

      {project && selectedConcept && activeTypographicPiece && activeCaptionPackage ? (
        <FinalPostPackageWorkshop
          brandProfile={activeBrandProfile}
          captionPackage={activeCaptionPackage}
          finalPostPackage={activeFinalPostPackage}
          selectedConcept={selectedConcept}
          typographicPiece={activeTypographicPiece}
          onApprove={approveFinalPostPackage}
          onCreateNewPost={startNewPost}
        />
      ) : null}
    </main>
  );
}

function updateSelectedCaptionVariant(
  captionPackage: CaptionPackage,
  patch: Partial<CaptionPackage["variants"][number]>,
): CaptionPackage {
  return {
    ...captionPackage,
    variants: captionPackage.variants.map((variant) =>
      variant.id === captionPackage.selectedVariantId
        ? {
            ...variant,
            ...patch,
          }
        : variant,
    ),
  };
}

function parseHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) =>
      item
        .trim()
        .replace(/^#+/, "")
        .replace(/[^\p{L}\p{N}_]/gu, ""),
    )
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => `#${item}`);
}
