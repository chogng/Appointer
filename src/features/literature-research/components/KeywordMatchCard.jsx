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
        dta={{ page: "lr", slot: "keyword-panel", comp: "card" }}
        aria-label={t("literature_keyword_matching")}
      >
        <div className="toolbar_group">
          <Tabs
            dta={{ page: "lr", slot: "keyword", comp: "tabs" }}
            options={[
              { value: "any", label: t("literature_match_any") },
              { value: "all", label: t("literature_match_all") },
            ]}
            value={keywordMode}
            onChange={onKeywordModeChange}
            groupLabel="Match view"
          />
        </div>

        <div className="mt-3" data-ui="literature-keywords-warp">
          <Textarea
            dataUi="literature-keywords"
            value={keywordInput}
            onChange={onKeywordInputChange}
            placeholder={t("literature_keywords_placeholder")}
            rows={2}
            hint={`${t("literature_keywords_count")}：${keywordsCount}`}
          />
        </div>
      </Card>
    </section>
  );
};

export default KeywordMatchCard;
