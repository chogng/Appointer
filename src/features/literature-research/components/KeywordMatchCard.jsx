import React from "react";
import { useLanguage } from "../../../hooks/useLanguage";
import Tabs from "../../../components/ui/Tabs";
import Textarea from "../../../components/ui/Textarea";
import Card from "../../../components/ui/Card";

const KeywordMatchCard = ({
  keywordMode,
  onKeywordModeChange,
  keywordInput,
  onKeywordInputChange,
  keywordsCount,
}) => {
  const { t } = useLanguage();

  return (
    <section aria-label={t("literature_keyword_matching")}>
      <h2 className="section_title">{t("literature_keyword_matching")}</h2>
      <Card
        as="section"
        id="literature-keyword-panel"
        cta="Literature research"
        ctaPosition="keyword-panel"
        ctaCopy="card"
        aria-label={t("literature_keyword_matching")}
      >
        <div className="toolbar_group">
          <Tabs
            options={[
              {
                value: "any",
                label: t("literature_match_any"),
                cta: "Literature research",
                ctaPosition: "keyword",
                ctaCopy: "any",
              },
              {
                value: "all",
                label: t("literature_match_all"),
                cta: "Literature research",
                ctaPosition: "keyword",
                ctaCopy: "all",
              },
            ]}
            value={keywordMode}
            onChange={onKeywordModeChange}
            groupLabel="Match view"
          />
        </div>

        <div className="mt-3">
          <Textarea
            id="literature-keywords"
            aria-label="keywords"
            value={keywordInput}
            onChange={onKeywordInputChange}
            placeholder={t("literature_keywords_placeholder")}
            rows={2}
            fieldClassName="rounded-lg"
            hint={`${t("literature_keywords_count")}：${keywordsCount}`}
          />
        </div>
      </Card>
    </section>
  );
};

export default KeywordMatchCard;
