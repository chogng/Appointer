import React from "react";
import { useLanguage } from "../hooks/useLanguage";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const ButtonFxDemo = () => {
  const { t } = useLanguage();

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
            id="demo-btn-ghost-no-fx"
            className="demo_no-fx"
          >
            {t("button_fx_demo_ghost_no_fx")}
          </Button>

          <Button
            fx
            variant="ghost"
            id="demo-btn-ghost-fx-light"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              "--click-fx-bg": "rgb(250, 249, 245)",
              "--click-fx-border": "#d1d1d1",
              "--click-fx-border-hover": "#d1d1d1",
            }}
          >
            {t("button_fx_demo_ghost_fx_light")}
          </Button>

          <Button
            fx
            variant="ghost"
            id="demo-btn-ghost-fx-light-forced-border"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              borderWidth: 1,
              borderColor: "#d1d1d1",
              "--click-fx-bg": "rgb(250, 249, 245)",
              "--click-fx-border": "#d1d1d1",
              "--click-fx-border-hover": "#d1d1d1",
            }}
          >
            {t("button_fx_demo_ghost_fx_forced_border")}
          </Button>

          <Button
            fx
            variant="ghost"
            id="demo-btn-ghost-fx-light-no-border"
            className="demo_no-border"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              "--click-fx-bg": "rgb(250, 249, 245)",
              "--click-fx-border": "#d1d1d1",
              "--click-fx-border-hover": "#d1d1d1",
            }}
          >
            {t("button_fx_demo_ghost_fx_light_no_border")}
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
            <div className="text-sm font-semibold">
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
            <div className="text-sm font-semibold">{t("card_demo_panel")}</div>
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
            <div className="text-sm font-semibold">{t("card_demo_flat")}</div>
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
            <div className="text-sm font-semibold">{t("card_demo_glass")}</div>
            <div className="mt-1 text-xs text-text-secondary">
              <span id="button-fx-demo-card-demo-glass-marker">
                {t("card_demo_marker")}
              </span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default ButtonFxDemo;
