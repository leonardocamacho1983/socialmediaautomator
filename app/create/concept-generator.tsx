"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  emptyBrandProfile,
  isBrandProfile,
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
      const response = await fetch("/api/concepts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandProfile,
          briefing,
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Nao foi possivel gerar conceitos.";
        throw new Error(message);
      }

      const nextProject = createProject(
        brandProfile,
        briefing,
        payload as CreativeConceptBatch,
      );
      window.localStorage.setItem(
        CREATIVE_PROJECT_STORAGE_KEY,
        JSON.stringify(nextProject),
      );
      setProject(nextProject);
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
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      CREATIVE_PROJECT_STORAGE_KEY,
      JSON.stringify(nextProject),
    );
    setProject(nextProject);
    setStatus(`Conceito escolhido: ${concept.title}`);
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

          <pre className="profile-preview">
            {JSON.stringify(
              project
                ? {
                    selectedConceptId: project.selectedConceptId,
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
            {project.batch.concepts.map((concept) => (
              <article
                className={
                  concept.id === project.selectedConceptId
                    ? "concept-card concept-card-selected"
                    : "concept-card"
                }
                key={concept.id}
              >
                <div>
                  <p className="section-kicker">{concept.recommendedFormat}</p>
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
                  onClick={() => selectConcept(concept)}
                >
                  Escolher conceito
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
