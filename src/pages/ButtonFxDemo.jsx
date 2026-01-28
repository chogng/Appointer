import React from "react";
import { useLanguage } from "../hooks/useLanguage";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const ButtonFxDemo = () => {
  const { t } = useLanguage();

  const typographyRows = [
    { label: "Display", className: "text-3xl font-serif font-medium", meta: "text-3xl · 30/36" },
    { label: "H2", className: "text-2xl font-serif font-medium", meta: "text-2xl · 24/32" },
    { label: "H3", className: "text-xl font-serif font-medium", meta: "text-xl · 20/28" },
    { label: "H4", className: "text-lg font-serif font-medium", meta: "text-lg · 18/28" },
    { label: "Body", className: "text-base font-sans", meta: "text-base · 16/24" },
    { label: "Body-sm", className: "text-sm font-sans", meta: "text-sm · 14/20" },
    { label: "Caption", className: "text-xs font-sans", meta: "text-xs · 12/16" },
    { label: "Mono", className: "text-sm font-mono", meta: "font-mono · 14/20" },
  ];

  return (
    <div className="w-full min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("button_fx_demo_title")}
        </h1>
        <p className="text-text-secondary">{t("button_fx_demo_desc")}</p>
      </div>

      <Card
        as="section"
        id="demo-button-fx"
        cta="demo"
        ctaPosition="button-fx"
        ctaCopy="container"
        aria-label={t("button_fx_demo_title")}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" id="demo-btn-primary-fx">
            {t("button_fx_demo_primary_fx")}
          </Button>

          <Button variant="ghost" id="demo-btn-ghost-fx">
            {t("button_fx_demo_ghost_fx")}
          </Button>


          <Button
            variant="ghost"
            id="demo-btn-ghost-fx-light"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              "--btn-ring-inner": "rgb(250, 249, 245)",
              "--btn-ring-outer": "#d1d1d1",
              "--btn-ring-outer-hover": "#d1d1d1",
            }}
          >
            {t("button_fx_demo_ghost_fx_light")}
          </Button>

          <Button
            variant="ghost"
            id="demo-btn-ghost-fx-light-forced-border"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              borderWidth: 1,
              borderColor: "#d1d1d1",
              "--btn-ring-inner": "rgb(250, 249, 245)",
              "--btn-ring-outer": "#d1d1d1",
              "--btn-ring-outer-hover": "#d1d1d1",
            }}
          >
            {t("button_fx_demo_ghost_fx_forced_border")}
          </Button>

          <Button disabled id="demo-btn-disabled">
            {t("button_fx_demo_disabled")}
          </Button>
        </div>

        <div className="mt-4 text-sm text-text-tertiary">
          {t("button_fx_demo_note")}
        </div>
      </Card>

      <section className="mt-10" aria-label={t("card_demo_title")}>
        <div className="mb-4">
          <h2 className="section_title">{t("card_demo_title")}</h2>
          <p className="text-sm text-text-secondary">{t("card_demo_desc")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            as="section"
            id="button-fx-demo-card-demo-default"
            cta="button-fx-demo"
            ctaPosition="card-demo"
            ctaCopy="default"
            aria-label={t("card_demo_default_aria")}
          >
            <div className="text-sm font-medium">
              {t("card_demo_default")}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              <span id="button-fx-demo-card-demo-default-marker">
                {t("card_demo_marker")}
              </span>
            </div>
          </Card>

          <Card
            as="section"
            id="button-fx-demo-card-demo-panel"
            variant="panel"
            cta="button-fx-demo"
            ctaPosition="card-demo"
            ctaCopy="panel"
            aria-label={t("card_demo_panel_aria")}
          >
            <div className="text-sm font-medium">{t("card_demo_panel")}</div>
            <div className="mt-1 text-xs text-text-secondary">
              <span id="button-fx-demo-card-demo-panel-marker">
                {t("card_demo_marker")}
              </span>
            </div>
          </Card>

          <Card
            as="section"
            id="button-fx-demo-card-demo-flat"
            variant="flat"
            cta="button-fx-demo"
            ctaPosition="card-demo"
            ctaCopy="flat"
            aria-label={t("card_demo_flat_aria")}
          >
            <div className="text-sm font-medium">{t("card_demo_flat")}</div>
            <div className="mt-1 text-xs text-text-secondary">
              <span id="button-fx-demo-card-demo-flat-marker">
                {t("card_demo_marker")}
              </span>
            </div>
          </Card>

          <Card
            as="section"
            id="button-fx-demo-card-demo-glass"
            variant="glass"
            cta="button-fx-demo"
            ctaPosition="card-demo"
            ctaCopy="glass"
            aria-label={t("card_demo_glass_aria")}
          >
            <div className="text-sm font-medium">{t("card_demo_glass")}</div>
            <div className="mt-1 text-xs text-text-secondary">
              <span id="button-fx-demo-card-demo-glass-marker">
                {t("card_demo_marker")}
              </span>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-10" aria-label={t("typography_demo_title")}>
        <div className="mb-4">
          <h2 className="section_title">{t("typography_demo_title")}</h2>
          <p className="text-sm text-text-secondary">{t("typography_demo_desc")}</p>
        </div>

        <Card
          as="section"
          id="button-fx-demo-typography"
          cta="button-fx-demo"
          ctaPosition="typography-demo"
          ctaCopy="container"
          aria-label={t("typography_demo_title")}
        >
          <div className="divide-y divide-border-subtle">
            {typographyRows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-6 py-4"
              >
                <div className="min-w-[110px] text-sm font-medium text-text-tertiary">
                  {row.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={row.className}>
                    The quick brown fox jumps over the lazy dog
                  </div>
                  <div className="mt-1 text-xs font-mono text-text-tertiary">
                    {row.meta} · <span className="opacity-70">{row.className}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
};

export default ButtonFxDemo;
