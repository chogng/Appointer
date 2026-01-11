import React from "react";

const ButtonFxDemo = () => {
  return (
    <div className="w-full min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          Button FX Demo
        </h1>
        <p className="text-text-secondary">
          用于单独验证 `click_btn--fx` 的 hover 效果：当前已替换为 Claude-like
          的 `box-shadow` spread 外扩（不再使用 `::before` 的 `transform:
          scale(...)`）。
        </p>
      </div>

      <section className="bg-bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="click_btn click_btn--md click_btn--fx click_btn--primary"
          >
            <span className="click_btn_content">Primary + FX</span>
          </button>

          <button
            type="button"
            className="click_btn click_btn--md click_btn--fx click_btn--ghost"
          >
            <span className="click_btn_content">Ghost + FX（透明底）</span>
          </button>

          <button
            type="button"
            className="click_btn click_btn--md click_btn--ghost"
          >
            <span className="click_btn_content">Ghost（无 FX，对照）</span>
          </button>

          <button
            type="button"
            className="click_btn click_btn--md click_btn--fx click_btn--ghost"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              borderColor: "#d1d1d1",
              "--click-fx-bg": "rgb(250, 249, 245)",
              "--click-fx-border": "#d1d1d1",
              "--click-fx-border-hover": "#d1d1d1",
            }}
          >
            <span className="click_btn_content">
              Ghost + FX（浅底示例 / 可能双圈）
            </span>
          </button>

          <button
            type="button"
            className="click_btn click_btn--md click_btn--fx click_btn--ghost demo_no-border"
            style={{
              backgroundColor: "rgb(250, 249, 245)",
              color: "rgb(20, 20, 19)",
              borderColor: "#d1d1d1",
              "--click-fx-bg": "rgb(250, 249, 245)",
              "--click-fx-border": "#d1d1d1",
              "--click-fx-border-hover": "#d1d1d1",
            }}
          >
            <span className="click_btn_content">
              Ghost + FX（浅底 / 强制无 border）
            </span>
          </button>

          <button type="button" className="click_btn click_btn--claude-shadow">
            Claude-shadow（固定深色）
          </button>

          <button
            type="button"
            disabled
            className="click_btn click_btn--md click_btn--fx click_btn--disabled"
          >
            <span className="click_btn_content">Disabled</span>
          </button>
        </div>

        <div className="mt-4 text-sm text-text-tertiary">
          说明：当前 `click_btn--fx` 的“变大感”来自 `box-shadow` 的 spread
          外扩； 按钮本体 computed `transform` 通常仍是 none。
        </div>
      </section>
    </div>
  );
};

export default ButtonFxDemo;
