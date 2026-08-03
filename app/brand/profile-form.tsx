"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  buildVisualProfile,
  buildWritingProfile,
  emptyBrandProfile,
  isBrandProfile,
  listToText,
  normalizeList,
  type BrandProfile,
} from "../../lib/brand/profile";

type BrandProfileFormState = Omit<
  BrandProfile,
  "preferredWords" | "forbiddenWords" | "visualReferences"
> & {
  preferredWords: string;
  forbiddenWords: string;
  visualReferences: string;
};

const textFields = [
  {
    id: "brandName",
    label: "Nome da marca",
    placeholder: "Ex: Falay",
  },
  {
    id: "productOrService",
    label: "Produto ou servico",
    placeholder: "Ex: atendimento e vendas por WhatsApp",
  },
  {
    id: "valueProposition",
    label: "Proposta de valor",
    placeholder: "O que a marca promete mudar para o cliente",
  },
  {
    id: "audience",
    label: "Publico",
    placeholder: "Quem precisa sentir que isso foi feito para ele",
  },
  {
    id: "toneOfVoice",
    label: "Tom de voz",
    placeholder: "Ex: direto, humano, premium, sem hype",
  },
] as const;

function toFormState(profile: BrandProfile): BrandProfileFormState {
  return {
    ...profile,
    preferredWords: listToText(profile.preferredWords),
    forbiddenWords: listToText(profile.forbiddenWords),
    visualReferences: listToText(profile.visualReferences),
  };
}

function toProfile(state: BrandProfileFormState): BrandProfile {
  return {
    ...state,
    preferredWords: normalizeList(state.preferredWords),
    forbiddenWords: normalizeList(state.forbiddenWords),
    visualReferences: normalizeList(state.visualReferences),
    updatedAt: new Date().toISOString(),
  };
}

export function BrandProfileForm() {
  const [form, setForm] = useState<BrandProfileFormState>(() =>
    toFormState(emptyBrandProfile),
  );
  const [savedProfile, setSavedProfile] = useState<BrandProfile | null>(null);
  const [status, setStatus] = useState("Nenhum perfil salvo nesta sessao.");

  useEffect(() => {
    const storedValue = window.localStorage.getItem(BRAND_PROFILE_STORAGE_KEY);
    if (!storedValue) {
      return;
    }

    try {
      const parsedValue: unknown = JSON.parse(storedValue);
      if (isBrandProfile(parsedValue)) {
        const loadedProfile = {
          ...emptyBrandProfile,
          ...parsedValue,
        };
        // The form hydrates from browser-only storage after the client mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSavedProfile(loadedProfile);
        setForm(toFormState(loadedProfile));
        setStatus("Perfil carregado do navegador.");
      }
    } catch {
      setStatus("Nao foi possivel carregar o perfil salvo.");
    }
  }, []);

  const draftProfile = useMemo(() => toProfile(form), [form]);
  const writingProfile = useMemo(
    () => buildWritingProfile(draftProfile),
    [draftProfile],
  );
  const visualProfile = useMemo(
    () => buildVisualProfile(draftProfile),
    [draftProfile],
  );
  const structuredProfile = useMemo(
    () => ({
      brandProfile: draftProfile,
      writingProfile,
      visualProfile,
    }),
    [draftProfile, visualProfile, writingProfile],
  );

  function updateField<K extends keyof BrandProfileFormState>(
    key: K,
    value: BrandProfileFormState[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = toProfile(form);
    window.localStorage.setItem(
      BRAND_PROFILE_STORAGE_KEY,
      JSON.stringify(nextProfile),
    );
    setSavedProfile(nextProfile);
    setForm(toFormState(nextProfile));
    setStatus("Perfil salvo.");
  }

  function handleClear() {
    window.localStorage.removeItem(BRAND_PROFILE_STORAGE_KEY);
    setForm(toFormState(emptyBrandProfile));
    setSavedProfile(null);
    setStatus("Perfil removido.");
  }

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("logoDataUrl", String(reader.result || ""));
      updateField("logoFileName", file.name);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="brand-shell">
      <header className="brand-header">
        <div className="nav-row">
          <Link className="text-link" href="/">
            Inicio
          </Link>
          <Link className="text-link" href="/create">
            Criar post
          </Link>
          <Link className="text-link" href="/projects">
            Projetos
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 1</p>
          <h1>Brand Foundation</h1>
          <p className="lead">
            Um unico perfil de marca, salvo localmente, para orientar os
            proximos motores criativos.
          </p>
        </div>
      </header>

      <form className="brand-grid" onSubmit={handleSubmit}>
        <section className="brand-section" aria-labelledby="brand-core-title">
          <div className="section-heading">
            <p className="section-kicker">Base</p>
            <h2 id="brand-core-title">Negocio e voz</h2>
          </div>

          <label className="field field-wide">
            <span>Descricao do negocio</span>
            <textarea
              value={form.businessDescription}
              onChange={(event) =>
                updateField("businessDescription", event.target.value)
              }
              placeholder="O que a empresa faz, para quem e por que existe"
              rows={4}
            />
          </label>

          {textFields.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              <input
                value={form[field.id]}
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          ))}

          <label className="field">
            <span>Palavras preferidas</span>
            <textarea
              value={form.preferredWords}
              onChange={(event) =>
                updateField("preferredWords", event.target.value)
              }
              placeholder="Uma por linha"
              rows={5}
            />
          </label>

          <label className="field">
            <span>Palavras proibidas</span>
            <textarea
              value={form.forbiddenWords}
              onChange={(event) =>
                updateField("forbiddenWords", event.target.value)
              }
              placeholder="Uma por linha"
              rows={5}
            />
          </label>
        </section>

        <section className="brand-section" aria-labelledby="brand-visual-title">
          <div className="section-heading">
            <p className="section-kicker">Visual</p>
            <h2 id="brand-visual-title">Identidade minima</h2>
          </div>

          <div className="color-row">
            <label className="field color-field">
              <span>Cor principal</span>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(event) =>
                  updateField("primaryColor", event.target.value)
                }
              />
            </label>
            <label className="field color-field">
              <span>Cor secundaria</span>
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(event) =>
                  updateField("secondaryColor", event.target.value)
                }
              />
            </label>
            <label className="field color-field">
              <span>Fundo</span>
              <input
                type="color"
                value={form.backgroundColor}
                onChange={(event) =>
                  updateField("backgroundColor", event.target.value)
                }
              />
            </label>
          </div>

          <label className="field">
            <span>Fonte de titulo</span>
            <input
              value={form.headingFont}
              onChange={(event) => updateField("headingFont", event.target.value)}
              placeholder="Ex: Inter"
            />
          </label>

          <label className="field">
            <span>Fonte de texto</span>
            <input
              value={form.bodyFont}
              onChange={(event) => updateField("bodyFont", event.target.value)}
              placeholder="Ex: Inter"
            />
          </label>

          <label className="field file-field">
            <span>Logo</span>
            <input accept="image/*,.svg" type="file" onChange={handleLogoUpload} />
          </label>

          {form.logoDataUrl ? (
            <div className="logo-preview" aria-label="Logo selecionado">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logoDataUrl} alt="" />
              <span>{form.logoFileName}</span>
            </div>
          ) : null}

          <label className="field field-wide">
            <span>Referencias visuais</span>
            <textarea
              value={form.visualReferences}
              onChange={(event) =>
                updateField("visualReferences", event.target.value)
              }
              placeholder="Links ou descricoes, uma por linha"
              rows={5}
            />
          </label>

          <label className="field field-wide">
            <span>Exemplos bons</span>
            <textarea
              value={form.goodExamples}
              onChange={(event) => updateField("goodExamples", event.target.value)}
              placeholder="Posts, frases ou referencias que devem guiar a marca"
              rows={5}
            />
          </label>

          <label className="field field-wide">
            <span>Exemplos ruins</span>
            <textarea
              value={form.badExamples}
              onChange={(event) => updateField("badExamples", event.target.value)}
              placeholder="O que a marca deve evitar"
              rows={5}
            />
          </label>
        </section>

        <aside className="brand-aside" aria-label="Contrato estruturado">
          <div className="summary-block">
            <p className="section-kicker">Status</p>
            <strong>{status}</strong>
            <span>
              Ultima versao:{" "}
              {savedProfile?.updatedAt
                ? new Date(savedProfile.updatedAt).toLocaleString("pt-BR")
                : "nao salva"}
            </span>
          </div>

          <div
            className="brand-swatch"
            style={{
              background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
            }}
            aria-hidden="true"
          />

          <pre className="profile-preview">
            {JSON.stringify(structuredProfile, null, 2)}
          </pre>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Salvar perfil
            </button>
            <button className="secondary-button" type="button" onClick={handleClear}>
              Limpar
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
