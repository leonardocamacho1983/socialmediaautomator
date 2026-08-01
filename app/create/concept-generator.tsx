"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  type CreativeProject,
} from "../../lib/creative/concepts";
import {
  compactBrandProfileForGeneration,
  compactBriefingForGeneration,
} from "../../lib/creative/context";
import {
  createTypographicPiece,
  type TypographicCopy,
  type TypographicVariantId,
} from "../../lib/creative/typographic-piece";

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
    updatedAt: new Date().toISOString(),
  };
}

export function ConceptGenerator() {
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [briefing, setBriefing] = useState(emptyCreativeBriefing);
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("Carregando perfil de marca.");
  const [error, setError] = useState("");

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

  function persistProject(nextProject: CreativeProject) {
    window.localStorage.setItem(
      CREATIVE_PROJECT_STORAGE_KEY,
      JSON.stringify(nextProject),
    );
    setProject(nextProject);
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
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus(`Conceito escolhido: ${concept.title}`);
  }

  function produceTypographicPiece() {
    if (!project || !selectedConcept) {
      return;
    }

    const nextProject: CreativeProject = {
      ...project,
      typographicPiece: createTypographicPiece(
        project,
        selectedConcept,
        activeBrandProfile,
      ),
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
      updatedAt: new Date().toISOString(),
    };
    persistProject(nextProject);
    setStatus("Copy visual atualizada.");
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
                  {activeTypographicPiece
                    ? "Marco 3 em revisao"
                    : "Pronto para Marco 3"}
                </h3>
                <p>
                  {activeTypographicPiece
                    ? "A peca tipografica ja esta pronta para comparar variacoes e baixar o PNG."
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
                    <dd>Preview + PNG final</dd>
                  </div>
                </dl>
                <button
                  className="primary-button next-step-button"
                  type="button"
                  onClick={produceTypographicPiece}
                >
                  {activeTypographicPiece
                    ? "Regenerar peca tipografica"
                    : "Produzir peca tipografica"}
                </button>
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
          selectedConcept={selectedConcept}
          onProduce={produceTypographicPiece}
          onUpdateCopy={updateTypographicCopy}
          onSelectVariant={selectTypographicVariant}
        />
      ) : null}
    </main>
  );
}
