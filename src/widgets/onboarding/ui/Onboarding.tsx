import React, { useState } from "react";
import {
  FolderIcon,
  getAmbientArtworkForDay,
  LANGUAGES,
  NovusLogo,
  NvButton,
  NvSheet,
  useI18n,
  usePreference,
  type PosturePreference,
} from "@/shared";
import { FolderPicker } from "@/features";
import { PosturePreview } from "./PosturePreview";
import "./onboarding.css";

const STEPS = 3;

/**
 * First run after install: language → viewing mode → photo folder. Choices
 * are stored as they are made. The onboarding keeps one fixed scale; the
 * viewing-mode step explains each mode with an animated preview instead.
 */
export const Onboarding: React.FC = () => {
  const { t, language } = useI18n();
  const [, setLanguage] = usePreference("language");
  const [posture, setPosture] = usePreference("posture");
  const [folder, setFolder] = usePreference("ambientFolder");
  const [, setDone] = usePreference("onboardingDone");
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const artwork = getAmbientArtworkForDay();

  const postures: { value: PosturePreference; title: string; hint: string }[] = [
    {
      value: "tablet",
      title: t("settings.posture.tablet"),
      hint: t("settings.posture.tabletHint"),
    },
    { value: "tv", title: t("settings.posture.tv"), hint: t("settings.posture.tvHint") },
  ];

  const next = () => {
    // Store the detected language too, so later OS changes don't switch it silently.
    if (step === 0) setLanguage(language);
    if (step < STEPS - 1) setStep(step + 1);
    else setDone(true);
  };

  return (
    <div className="nvo nv-on-media">
      {artwork && <img className="nvo__photo" src={artwork.url} alt="" draggable={false} />}
      <div className="nvo__scrim" aria-hidden="true" />

      <header className="nvo__bar">
        <NovusLogo height={30} />
        <span className="nvo__step nv-numeral">
          {t("onboarding.step", { current: step + 1, total: STEPS })}
        </span>
      </header>

      <main className="nvo__panel" key={step}>
        {step === 0 && (
          <>
            <h1 className="nvo__title">{t("onboarding.welcome")}</h1>
            <p className="nvo__body">{t("onboarding.languageTitle")}</p>
            <div className="nvo__choices" role="radiogroup" aria-label={t("settings.language")}>
              {LANGUAGES.map((option, index) => (
                <NvButton
                  key={option.code}
                  size="large"
                  onMedia
                  variant={option.code === language ? "primary" : "secondary"}
                  role="radio"
                  aria-checked={option.code === language}
                  lang={option.code}
                  data-nav-default={index === 0 ? true : undefined}
                  onClick={() => setLanguage(option.code)}
                >
                  {option.nativeName}
                </NvButton>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="nvo__title">{t("onboarding.postureTitle")}</h1>
            <p className="nvo__body">{t("onboarding.postureBody")}</p>
            <div className="nvo__postures" role="radiogroup" aria-label={t("settings.posture")}>
              {postures.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={posture === option.value}
                  className={`nvo__posture${posture === option.value ? " is-checked" : ""}`}
                  onClick={() => setPosture(option.value)}
                >
                  <span className={`nvo__glyph nvo__glyph--${option.value}`} aria-hidden="true" />
                  <strong>{option.title}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="nvo__title">{t("onboarding.photoTitle")}</h1>
            <p className="nvo__body">{t("onboarding.photoBody")}</p>
            <div className="nvo__folder">
              <FolderIcon size={22} />
              <span>{folder ?? t("settings.ambientFolderDefault")}</span>
              <NvButton onMedia onClick={() => setPickerOpen(true)}>
                {t("common.change")}
              </NvButton>
            </div>
          </>
        )}

        <div className="nvo__actions">
          {step > 0 && (
            <NvButton size="large" onMedia variant="quiet" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </NvButton>
          )}
          <NvButton size="large" onMedia variant="primary" onClick={next}>
            {step === STEPS - 1 ? t("onboarding.start") : t("common.next")}
          </NvButton>
        </div>
      </main>

      {step === 1 && (
        <div className="nvo__preview">
          <PosturePreview mode={posture} />
        </div>
      )}

      <NvSheet
        open={pickerOpen}
        title={t("folder.title")}
        onClose={() => setPickerOpen(false)}
        closeLabel={t("common.close")}
      >
        <FolderPicker
          initialPath={folder}
          onPick={(path) => {
            setFolder(path);
            setPickerOpen(false);
          }}
        />
      </NvSheet>
    </div>
  );
};
