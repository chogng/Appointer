import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";
import { apiService } from "../services/apiService";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Toast from "../components/ui/Toast";
import {
  User,
  Moon,
  Sun,
  Monitor,
  Lock,
  Camera,
  Check,
  ArrowUp,
  Database,
  Trash2,
  Key,
  Loader2,
} from "lucide-react";
function Section({ title, icon, children }) {
  const Icon = icon;
  return (
    <Card className="mb-6 bg-white">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-subtle">
        <Icon size={20} className="text-accent" />
        <h2 className="text-lg font-medium text-text-primary">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

const Settings = () => {
  const containerRef = useRef(null);
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [name, setName] = useState(user?.name || "");
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") =>
    setToast({ isVisible: true, message, type });
  const closeToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const formatProviderLabel = (provider) => {
    const normalized = String(provider || "").trim().toLowerCase();
    if (normalized === "bigmodel") return "BigModel";
    if (normalized === "openai") return "OpenAI";
    if (normalized === "openai_compatible") return "OpenAI-compatible";
    return provider || "-";
  };
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retention, setRetention] = useState(null);
  const [retentionForm, setRetentionForm] = useState({
    logsDays: "",
    requestsDays: "",
  });

  const [hasDefaultTranslationApiKey, setHasDefaultTranslationApiKey] = useState(false);
  const [translationApiKeyMasked, setTranslationApiKeyMasked] = useState(null);
  const [translationApiKeyInput, setTranslationApiKeyInput] = useState("");
  const [translationApiKeySync, setTranslationApiKeySync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [defaultTranslationApiKeyMasked, setDefaultTranslationApiKeyMasked] = useState(null);
  const [defaultTranslationApiKeyInput, setDefaultTranslationApiKeyInput] = useState("");
  const [defaultTranslationApiKeySync, setDefaultTranslationApiKeySync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [translationProvider, setTranslationProvider] = useState("bigmodel");
  const [translationProviderInput, setTranslationProviderInput] = useState("bigmodel");
  const [supportedTranslationProviders, setSupportedTranslationProviders] = useState(["bigmodel"]);
  const [translationProviderSync, setTranslationProviderSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [userTranslationProvider, setUserTranslationProvider] = useState(null);
  const [userTranslationProviderInput, setUserTranslationProviderInput] = useState("");
  const [userTranslationProviderSync, setUserTranslationProviderSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [translationModel, setTranslationModel] = useState(null);
  const [translationModelInput, setTranslationModelInput] = useState("");
  const [translationModelSync, setTranslationModelSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [hasDefaultTranslationModel, setHasDefaultTranslationModel] = useState(false);
  const [defaultTranslationModel, setDefaultTranslationModel] = useState(null);
  const [builtinDefaultTranslationModel, setBuiltinDefaultTranslationModel] = useState("glm-4.5-flash");
  const [defaultTranslationModelInput, setDefaultTranslationModelInput] = useState("");
  const [defaultTranslationModelSync, setDefaultTranslationModelSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [hasDefaultTranslationBaseUrl, setHasDefaultTranslationBaseUrl] = useState(false);
  const [defaultTranslationBaseUrl, setDefaultTranslationBaseUrl] = useState(null);
  const [defaultTranslationBaseUrlInput, setDefaultTranslationBaseUrlInput] = useState("");
  const [defaultTranslationBaseUrlSync, setDefaultTranslationBaseUrlSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [translationBaseUrl, setTranslationBaseUrl] = useState(null);
  const [translationBaseUrlInput, setTranslationBaseUrlInput] = useState("");
  const [translationBaseUrlSync, setTranslationBaseUrlSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });
  const [translateTestInput, setTranslateTestInput] = useState(
    "We propose a simple experiment to validate the method and report key performance metrics.",
  );
  const [translateTestBypassCache, setTranslateTestBypassCache] = useState(true);
  const [translateTestForceDefaultKey, setTranslateTestForceDefaultKey] = useState(false);
  const [translateTest, setTranslateTest] = useState({
    state: "idle", // idle | loading | done | error
    apiKeySource: null, // user | default | null
    translatedText: "",
    error: "",
    cached: false,
    model: "",
    modelSource: null,
    translationProvider: null,
    translationProviderSource: null,
    translationBaseUrlSource: null,
    translationBaseUrlHost: null,
  });

  const normalizedDefaultTranslationProvider = String(translationProvider || "").trim().toLowerCase();
  const normalizedUserTranslationProvider = String(userTranslationProvider || "").trim().toLowerCase();
  const effectiveTranslationProviderForUser =
    normalizedUserTranslationProvider || normalizedDefaultTranslationProvider;
  const isDefaultOpenAICompatibleProvider = Boolean(
    normalizedDefaultTranslationProvider &&
    normalizedDefaultTranslationProvider !== "bigmodel" &&
    normalizedDefaultTranslationProvider !== "openai",
  );
  const isEffectiveOpenAICompatibleProviderForUser = Boolean(
    effectiveTranslationProviderForUser &&
    effectiveTranslationProviderForUser !== "bigmodel" &&
    effectiveTranslationProviderForUser !== "openai",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getLiteratureSettings();
        if (cancelled) return;
        setHasDefaultTranslationApiKey(Boolean(data?.hasDefaultTranslationApiKey));
        setTranslationApiKeyMasked(
          typeof data?.translationApiKeyMasked === "string" && data.translationApiKeyMasked
            ? data.translationApiKeyMasked
            : null,
        );
        setTranslationModel(
          typeof data?.translationModel === "string" && data.translationModel ? data.translationModel : null,
        );
        setTranslationBaseUrl(
          typeof data?.translationBaseUrl === "string" && data.translationBaseUrl
            ? data.translationBaseUrl
            : null,
        );
        setHasDefaultTranslationBaseUrl(Boolean(data?.hasDefaultTranslationBaseUrl));
        setUserTranslationProvider(
          typeof data?.translationProvider === "string" && data.translationProvider
            ? data.translationProvider
            : null,
        );
        setTranslationProvider(
          typeof data?.defaultTranslationProvider === "string" && data.defaultTranslationProvider
            ? data.defaultTranslationProvider
            : "bigmodel",
        );
        setTranslationProviderInput(
          typeof data?.defaultTranslationProvider === "string" && data.defaultTranslationProvider
            ? data.defaultTranslationProvider
            : "bigmodel",
        );
        setSupportedTranslationProviders(
          Array.isArray(data?.supportedTranslationProviders) && data.supportedTranslationProviders.length
            ? data.supportedTranslationProviders
            : ["bigmodel"],
        );
      } catch {
        // quiet error
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveTranslationApiKey = async () => {
    const key = String(translationApiKeyInput || "").trim();
    if (!key) {
      showToast(t("personal_api_key_required"), "error");
      return;
    }

    setTranslationApiKeySync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationApiKey: key });
      setTranslationApiKeyMasked(
        typeof data?.translationApiKeyMasked === "string" && data.translationApiKeyMasked
          ? data.translationApiKeyMasked
          : null,
      );
      setTranslationApiKeyInput("");
      setTranslationApiKeySync({ state: "saved", message: "" });
      showToast(t("personal_api_key_saved"), "success");
    } catch (error) {
      setTranslationApiKeySync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_api_key_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error"
      );
    }
  };

  const handleClearTranslationApiKey = async () => {
    setTranslationApiKeySync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationApiKey: "" });
      setTranslationApiKeyMasked(
        typeof data?.translationApiKeyMasked === "string" && data.translationApiKeyMasked
          ? data.translationApiKeyMasked
          : null,
      );
      setTranslationApiKeyInput("");
      setTranslationApiKeySync({ state: "saved", message: "" });
      showToast(t("personal_api_key_cleared"), "success");
    } catch (error) {
      setTranslationApiKeySync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_api_key_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error"
      );
    }
  };

  const handleSaveUserTranslationProvider = async () => {
    const provider = String(userTranslationProviderInput || "").trim();
    if (!provider) {
      showToast(t("translation_provider_required"), "error");
      return;
    }

    setUserTranslationProviderSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationProvider: provider });
      setUserTranslationProvider(
        typeof data?.translationProvider === "string" && data.translationProvider
          ? data.translationProvider
          : provider.trim().toLowerCase(),
      );
      setUserTranslationProviderInput("");
      setUserTranslationProviderSync({ state: "saved", message: "" });
      showToast(t("translation_provider_saved"), "success");
    } catch (error) {
      setUserTranslationProviderSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("translation_provider_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleClearUserTranslationProvider = async () => {
    setUserTranslationProviderSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationProvider: "" });
      setUserTranslationProvider(
        typeof data?.translationProvider === "string" && data.translationProvider
          ? data.translationProvider
          : null,
      );
      setUserTranslationProviderInput("");
      setUserTranslationProviderSync({ state: "saved", message: "" });
      showToast(t("translation_provider_cleared"), "success");
    } catch (error) {
      setUserTranslationProviderSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("translation_provider_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleSaveTranslationModel = async () => {
    const model = String(translationModelInput || "").trim();
    if (!model) {
      showToast(t("personal_model_required"), "error");
      return;
    }

    setTranslationModelSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationModel: model });
      setTranslationModel(
        typeof data?.translationModel === "string" && data.translationModel ? data.translationModel : model,
      );
      setTranslationModelInput("");
      setTranslationModelSync({ state: "saved", message: "" });
      showToast(t("personal_model_saved"), "success");
    } catch (error) {
      setTranslationModelSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_model_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error"
      );
    }
  };

  const handleClearTranslationModel = async () => {
    setTranslationModelSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationModel: "" });
      setTranslationModel(
        typeof data?.translationModel === "string" && data.translationModel ? data.translationModel : null,
      );
      setTranslationModelInput("");
      setTranslationModelSync({ state: "saved", message: "" });
      showToast(t("personal_model_cleared"), "success");
    } catch (error) {
      setTranslationModelSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_model_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error"
      );
    }
  };

  const handleSaveTranslationBaseUrl = async () => {
    const baseUrl = String(translationBaseUrlInput || "").trim();
    if (!baseUrl) {
      showToast(t("personal_base_url_required"), "error");
      return;
    }

    setTranslationBaseUrlSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationBaseUrl: baseUrl });
      setTranslationBaseUrl(
        typeof data?.translationBaseUrl === "string" && data.translationBaseUrl
          ? data.translationBaseUrl
          : baseUrl,
      );
      setTranslationBaseUrlInput("");
      setTranslationBaseUrlSync({ state: "saved", message: "" });
      showToast(t("personal_base_url_saved"), "success");
    } catch (error) {
      setTranslationBaseUrlSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_base_url_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleClearTranslationBaseUrl = async () => {
    setTranslationBaseUrlSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureSettings({ translationBaseUrl: "" });
      setTranslationBaseUrl(
        typeof data?.translationBaseUrl === "string" && data.translationBaseUrl ? data.translationBaseUrl : null,
      );
      setTranslationBaseUrlInput("");
      setTranslationBaseUrlSync({ state: "saved", message: "" });
      showToast(t("personal_base_url_cleared"), "success");
    } catch (error) {
      setTranslationBaseUrlSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("personal_base_url_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;

    (async () => {
      try {
        const [keyData, modelData, baseUrlData] = await Promise.all([
          apiService.getLiteratureAdminTranslationKey(),
          apiService.getLiteratureAdminTranslationModel(),
          apiService.getLiteratureAdminTranslationBaseUrl(),
        ]);
        if (cancelled) return;
        setDefaultTranslationApiKeyMasked(
          typeof keyData?.defaultTranslationApiKeyMasked === "string" &&
            keyData.defaultTranslationApiKeyMasked
            ? keyData.defaultTranslationApiKeyMasked
            : null,
        );
        setHasDefaultTranslationApiKey(Boolean(keyData?.hasDefaultTranslationApiKey));

        setHasDefaultTranslationModel(Boolean(modelData?.hasDefaultTranslationModel));
        setDefaultTranslationModel(
          typeof modelData?.defaultTranslationModel === "string" && modelData.defaultTranslationModel
            ? modelData.defaultTranslationModel
            : null,
        );
        setBuiltinDefaultTranslationModel(
          typeof modelData?.builtinDefaultTranslationModel === "string" && modelData.builtinDefaultTranslationModel
            ? modelData.builtinDefaultTranslationModel
            : "glm-4.5-flash",
        );

        setHasDefaultTranslationBaseUrl(Boolean(baseUrlData?.hasDefaultTranslationBaseUrl));
        setDefaultTranslationBaseUrl(
          typeof baseUrlData?.defaultTranslationBaseUrl === "string" && baseUrlData.defaultTranslationBaseUrl
            ? baseUrlData.defaultTranslationBaseUrl
            : null,
        );
      } catch {
        // quiet error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const handleSaveDefaultTranslationApiKey = async () => {
    const key = String(defaultTranslationApiKeyInput || "").trim();
    if (!key) {
      showToast(
        t("default_api_key_required"),
        "error",
      );
      return;
    }

    setDefaultTranslationApiKeySync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationKey({
        defaultTranslationApiKey: key,
      });
      setDefaultTranslationApiKeyMasked(
        typeof data?.defaultTranslationApiKeyMasked === "string" &&
          data.defaultTranslationApiKeyMasked
          ? data.defaultTranslationApiKeyMasked
          : null,
      );
      setHasDefaultTranslationApiKey(Boolean(data?.hasDefaultTranslationApiKey));
      setDefaultTranslationApiKeyInput("");
      setDefaultTranslationApiKeySync({ state: "saved", message: "" });
      showToast(
        t("default_api_key_saved"),
        "success",
      );
    } catch (error) {
      setDefaultTranslationApiKeySync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_api_key_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleClearDefaultTranslationApiKey = async () => {
    setDefaultTranslationApiKeySync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationKey({
        defaultTranslationApiKey: "",
      });
      setDefaultTranslationApiKeyMasked(null);
      setHasDefaultTranslationApiKey(Boolean(data?.hasDefaultTranslationApiKey));
      setDefaultTranslationApiKeyInput("");
      setDefaultTranslationApiKeySync({ state: "saved", message: "" });
      showToast(
        t("default_api_key_cleared"),
        "success",
      );
    } catch (error) {
      setDefaultTranslationApiKeySync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_api_key_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleSaveDefaultTranslationModel = async () => {
    const model = String(defaultTranslationModelInput || "").trim();
    if (!model) {
      showToast(
        t("default_model_required"),
        "error",
      );
      return;
    }

    setDefaultTranslationModelSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationModel({
        defaultTranslationModel: model,
      });
      setHasDefaultTranslationModel(Boolean(data?.hasDefaultTranslationModel));
      setDefaultTranslationModel(
        typeof data?.defaultTranslationModel === "string" && data.defaultTranslationModel
          ? data.defaultTranslationModel
          : model,
      );
      setBuiltinDefaultTranslationModel(
        typeof data?.builtinDefaultTranslationModel === "string" && data.builtinDefaultTranslationModel
          ? data.builtinDefaultTranslationModel
          : builtinDefaultTranslationModel,
      );
      setDefaultTranslationModelInput("");
      setDefaultTranslationModelSync({ state: "saved", message: "" });
      showToast(
        t("default_model_saved"),
        "success",
      );
    } catch (error) {
      setDefaultTranslationModelSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_model_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleClearDefaultTranslationModel = async () => {
    setDefaultTranslationModelSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationModel({
        defaultTranslationModel: "",
      });
      setHasDefaultTranslationModel(Boolean(data?.hasDefaultTranslationModel));
      setDefaultTranslationModel(
        typeof data?.defaultTranslationModel === "string" && data.defaultTranslationModel
          ? data.defaultTranslationModel
          : null,
      );
      setBuiltinDefaultTranslationModel(
        typeof data?.builtinDefaultTranslationModel === "string" && data.builtinDefaultTranslationModel
          ? data.builtinDefaultTranslationModel
          : builtinDefaultTranslationModel,
      );
      setDefaultTranslationModelInput("");
      setDefaultTranslationModelSync({ state: "saved", message: "" });
      showToast(
        t("default_model_cleared"),
        "success",
      );
    } catch (error) {
      setDefaultTranslationModelSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_model_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleSaveDefaultTranslationBaseUrl = async () => {
    const baseUrl = String(defaultTranslationBaseUrlInput || "").trim();
    if (!baseUrl) {
      showToast(
        t("default_base_url_required"),
        "error",
      );
      return;
    }

    setDefaultTranslationBaseUrlSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationBaseUrl({
        defaultTranslationBaseUrl: baseUrl,
      });
      setHasDefaultTranslationBaseUrl(Boolean(data?.hasDefaultTranslationBaseUrl));
      setDefaultTranslationBaseUrl(
        typeof data?.defaultTranslationBaseUrl === "string" && data.defaultTranslationBaseUrl
          ? data.defaultTranslationBaseUrl
          : baseUrl,
      );
      setDefaultTranslationBaseUrlInput("");
      setDefaultTranslationBaseUrlSync({ state: "saved", message: "" });
      showToast(t("default_base_url_saved"), "success");
    } catch (error) {
      setDefaultTranslationBaseUrlSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_base_url_save_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleClearDefaultTranslationBaseUrl = async () => {
    setDefaultTranslationBaseUrlSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationBaseUrl({
        defaultTranslationBaseUrl: "",
      });
      setHasDefaultTranslationBaseUrl(Boolean(data?.hasDefaultTranslationBaseUrl));
      setDefaultTranslationBaseUrl(
        typeof data?.defaultTranslationBaseUrl === "string" && data.defaultTranslationBaseUrl
          ? data.defaultTranslationBaseUrl
          : null,
      );
      setDefaultTranslationBaseUrlInput("");
      setDefaultTranslationBaseUrlSync({ state: "saved", message: "" });
      showToast(t("default_base_url_cleared"), "success");
    } catch (error) {
      setDefaultTranslationBaseUrlSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("default_base_url_clear_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleUpdateTranslationProvider = async (nextProvider) => {
    const provider = String(nextProvider || "").trim().toLowerCase();
    if (!provider || provider === translationProvider) return;
    if (!isSuperAdmin) return;
    if (translationProviderSync.state === "saving") return;

    const confirmed = window.confirm(
      t("translation_provider_switch_confirm"),
    );
    if (!confirmed) return;

    setTranslationProviderSync({ state: "saving", message: "" });
    try {
      const data = await apiService.updateLiteratureAdminTranslationProvider({
        translationProvider: provider,
      });

      const updatedProvider =
        typeof data?.translationProvider === "string" && data.translationProvider
          ? data.translationProvider
          : provider;
      setTranslationProvider(updatedProvider);
      setTranslationProviderInput(updatedProvider);
      setSupportedTranslationProviders(
        Array.isArray(data?.supportedProviders) && data.supportedProviders.length
          ? data.supportedProviders
          : supportedTranslationProviders,
      );

      if (data?.clearedDefaults) {
        setHasDefaultTranslationApiKey(false);
        setDefaultTranslationApiKeyMasked(null);
        setDefaultTranslationApiKeyInput("");
        setHasDefaultTranslationModel(false);
        setDefaultTranslationModel(null);
        setDefaultTranslationModelInput("");
        setHasDefaultTranslationBaseUrl(false);
        setDefaultTranslationBaseUrl(null);
        setDefaultTranslationBaseUrlInput("");
      }

      setTranslationProviderSync({ state: "saved", message: "" });
      showToast(
        t("translation_provider_updated"),
        "success",
      );
    } catch (error) {
      setTranslationProviderSync({
        state: "error",
        message: error?.message || String(error),
      });
      showToast(
        (t("translation_provider_update_failed")) +
        (error?.message ? ` (${error.message})` : ""),
        "error",
      );
    }
  };

  const handleTestTranslate = async () => {
    if (translateTest.state === "loading") return;
    const text = String(translateTestInput || "").trim();
    if (!text) {
      showToast(t("literature_translate_test_required"), "error");
      return;
    }

	    setTranslateTest({
	      state: "loading",
	      apiKeySource: null,
	      translatedText: "",
	      error: "",
	      cached: false,
	      model: "",
	      modelSource: null,
	      translationProvider: null,
	      translationProviderSource: null,
	      translationBaseUrlSource: null,
	      translationBaseUrlHost: null,
	    });

    try {
      const data = await apiService.translateLiteratureAbstract({
        id: `settings_test_${Date.now()}`,
        text,
        targetLang: "zh",
        bypassCache: translateTestBypassCache,
        ...(isSuperAdmin && translateTestForceDefaultKey ? { forceKeySource: "default" } : {}),
      });
      const translatedText =
        typeof data?.translatedText === "string" ? data.translatedText.trim() : "";
      if (!translatedText) throw new Error("Translation returned empty text");

	      setTranslateTest({
	        state: "done",
	        apiKeySource:
	          typeof data?.apiKeySource === "string" && data.apiKeySource ? data.apiKeySource : null,
	        translatedText,
	        error: "",
	        cached: Boolean(data?.cached),
	        model: typeof data?.model === "string" ? data.model : "",
	        modelSource:
	          typeof data?.modelSource === "string" && data.modelSource ? data.modelSource : null,
	        translationProvider:
	          typeof data?.translationProvider === "string" && data.translationProvider
	            ? data.translationProvider
	            : null,
	        translationProviderSource:
	          typeof data?.translationProviderSource === "string" && data.translationProviderSource
	            ? data.translationProviderSource
	            : null,
	        translationBaseUrlSource:
	          typeof data?.translationBaseUrlSource === "string" && data.translationBaseUrlSource
	            ? data.translationBaseUrlSource
	            : null,
	        translationBaseUrlHost:
	          typeof data?.translationBaseUrlHost === "string" && data.translationBaseUrlHost
	            ? data.translationBaseUrlHost
	            : null,
	      });
	    } catch (error) {
	      const apiKeySourceFromError =
	        typeof error?.apiKeySource === "string" && error.apiKeySource ? error.apiKeySource : null;
	      const modelFromError = typeof error?.model === "string" && error.model ? error.model : "";
	      const modelSourceFromError =
	        typeof error?.modelSource === "string" && error.modelSource ? error.modelSource : null;
	      const providerFromError =
	        typeof error?.translationProvider === "string" && error.translationProvider
	          ? error.translationProvider
	          : null;
	      const providerSourceFromError =
	        typeof error?.translationProviderSource === "string" && error.translationProviderSource
	          ? error.translationProviderSource
	          : null;
	      const baseUrlSourceFromError =
	        typeof error?.translationBaseUrlSource === "string" && error.translationBaseUrlSource
	          ? error.translationBaseUrlSource
	          : null;
	      const baseUrlHostFromError =
	        typeof error?.translationBaseUrlHost === "string" && error.translationBaseUrlHost
	          ? error.translationBaseUrlHost
	          : null;
	      setTranslateTest({
	        state: "error",
	        apiKeySource: apiKeySourceFromError,
	        translatedText: "",
	        error: error?.message || String(error),
	        cached: false,
	        model: modelFromError,
	        modelSource: modelSourceFromError,
	        translationProvider: providerFromError,
	        translationProviderSource: providerSourceFromError,
	        translationBaseUrlSource: baseUrlSourceFromError,
	        translationBaseUrlHost: baseUrlHostFromError,
	      });
	    }
	  };

  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    const load = async () => {
      try {
        setRetentionLoading(true);
        const data = await apiService.getRetentionSettings();
        if (cancelled) return;
        setRetention(data);
        setRetentionForm({
          logsDays: String(data.logsDays),
          requestsDays: String(data.requestsDays),
        });
      } catch {
        if (!cancelled) showToast(t("retentionLoadFailed"), "error");
      } finally {
        if (!cancelled) setRetentionLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, t]);

  const handleNameSave = async () => {
    if (!name.trim()) return;
    const result = await updateUser({ name: name.trim() });
    if (result.success) {
      showToast(t("updateSuccess"), "success");
    } else {
      showToast(t("updateFailed"), "error");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = await updateUser({ avatar: reader.result });
      if (result.success) {
        showToast(t("updateSuccess"), "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      showToast(t("passwordMismatch"), "error");
      return;
    }
    setPasswordData({ current: "", new: "", confirm: "" });
    showToast(t("updateSuccess"), "success");
  };

  const handleRetentionSave = async () => {
    try {
      setRetentionSaving(true);
      const updated = await apiService.updateRetentionSettings({
        logsDays: Number(retentionForm.logsDays),
        requestsDays: Number(retentionForm.requestsDays),
      });
      setRetention(updated);
      setRetentionForm({
        logsDays: String(updated.logsDays),
        requestsDays: String(updated.requestsDays),
      });
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      showToast(error.message || t("updateFailed"), "error");
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleRetentionRunNow = async () => {
    try {
      setRetentionRunning(true);
      const result = await apiService.runRetentionCleanup();
      setRetention(result);
      setRetentionForm({
        logsDays: String(result.logsDays),
        requestsDays: String(result.requestsDays),
      });
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      showToast(error.message || t("retentionCleanupFailed"), "error");
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative min-h-screen">
      <h1 className="text-3xl font-serif font-medium text-text-primary mb-8">
        {t("settings")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title={t("profile")} icon={User}>
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      fill="none"
                      height="32"
                      viewBox="0 0 24 24"
                      width="32"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-white opacity-50"
                    >
                      <circle
                        cx="12"
                        cy="7"
                        r="4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></circle>
                      <path
                        d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 11V17"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 17L10 15"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 17L14 15"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  <Camera size={20} className="text-white" />
                  <input
                    id="settings-avatar"
                    name="avatar"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {t("displayName")}
                </label>
                <div className="flex items-center p-1 bg-bg-page border border-border-subtle rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-black transition-all">
                  <input
                    id="settings-display-name"
                    name="displayName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 min-w-0 pl-2 pr-4 py-1 bg-transparent border-none text-text-primary text-sm focus:outline-none focus:ring-0 placeholder:text-text-secondary"
                    placeholder={t("displayName")}
                    autoComplete="name"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    onClick={handleNameSave}
                    variant="primary"
                    size="md"
                    fx
                  >
                    {t("saveChanges")}
                    <ArrowUp size={16} />
                  </Button>
                </div>
              </div>
            </div>
            <div className="w-20 flex justify-center mt-3">
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider whitespace-nowrap">
                {t(user?.role)}
              </p>
            </div>
          </div>
        </Section>

        <Section title={t("appearance")} icon={Monitor}>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: "light", icon: Sun, label: t("light") },
              { id: "dark", icon: Moon, label: t("dark") },
              { id: "system", icon: Monitor, label: t("system") },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`
                                    flex flex-col items-center justify-center p-4 rounded-xl border transition-all
                                    ${theme === item.id
                    ? "bg-accent/5 border-accent text-accent"
                    : "border-border-subtle text-text-secondary hover:bg-bg-subtle"
                  }
                                `}
              >
                <item.icon size={24} className="mb-2" />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("language")} icon={Monitor}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: "en", label: t("english") },
              { id: "zh", label: t("chinese") },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id)}
                className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all text-left
                                    ${language === item.id
                    ? "bg-accent/5 border-accent text-accent"
                    : "border-border-subtle text-text-secondary hover:bg-bg-subtle"
                  }
                                `}
              >
                <span className="text-xs font-serif font-medium">
                  {item.label}
                </span>
                {language === item.id && <Check size={16} />}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("translation_service")} icon={Key}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t("default_provider")}
                </label>
                <span className="text-xs text-text-tertiary">
                  {t("default_provider_hint")}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isSuperAdmin ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      id="settings-translation-provider-default"
                      name="defaultTranslationProvider"
                      type="text"
                      value={translationProviderInput}
                      onChange={(e) => setTranslationProviderInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleUpdateTranslationProvider(translationProviderInput);
                        }
                      }}
                      list="translationProviderSuggestions"
                      placeholder="bigmodel / openai / openai_compatible"
                      disabled={translationProviderSync.state === "saving"}
                      className="min-w-[240px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateTranslationProvider(translationProviderInput)}
                      disabled={
                        translationProviderSync.state === "saving" ||
                        !String(translationProviderInput || "").trim() ||
                        String(translationProviderInput || "").trim().toLowerCase() ===
                          String(translationProvider || "").trim().toLowerCase()
                      }
                      className={`action-btn action-btn--lg ${translationProviderSync.state === "saving" ||
                        !String(translationProviderInput || "").trim() ||
                        String(translationProviderInput || "").trim().toLowerCase() ===
                          String(translationProvider || "").trim().toLowerCase()
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--primary"
                        }`}
                    >
                      <span className="action-btn__content">
                        {translationProviderSync.state === "saving" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          t("literature_save")
                        )}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-text-primary">
                    {formatProviderLabel(translationProvider)}
                  </div>
                )}
              </div>

              {translationProviderSync.state === "error" && translationProviderSync.message && (
                <div className="text-xs text-red-500">
                  {translationProviderSync.message}
                </div>
              )}
            </div>

            <datalist id="translationProviderSuggestions">
              {supportedTranslationProviders.map((provider) => (
                <option key={provider} value={provider} />
              ))}
            </datalist>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t("personal_provider")}
                </label>
                <span className="text-xs text-text-tertiary">
                  {t("personal_provider_hint")}
                </span>
              </div>

              <div className="text-xs text-text-tertiary -mt-1 mb-1">
                {userTranslationProvider
                  ? (t("provider_current")) +
                  `: ${formatProviderLabel(userTranslationProvider)}`
                  : (t("personal_provider_using_default")) +
                  `: ${formatProviderLabel(translationProvider)}`}
              </div>

              {hasDefaultTranslationApiKey && !translationApiKeyMasked && (
                <div className="text-xs text-amber-600 -mt-1 mb-1">
                  {t("personal_provider_requires_personal_key")}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="settings-translation-provider-user"
                  name="userTranslationProvider"
                  type="text"
                  value={userTranslationProviderInput}
                  onChange={(e) => setUserTranslationProviderInput(e.target.value)}
                  placeholder="siliconflow / openai_compatible / openai / bigmodel"
                  list="translationProviderSuggestions"
                  disabled={userTranslationProviderSync.state === "saving"}
                  className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
                  autoComplete="off"
                  spellCheck={false}
                />

                <button
                  type="button"
                  onClick={handleSaveUserTranslationProvider}
                  disabled={
                    userTranslationProviderSync.state === "saving" ||
                    !String(userTranslationProviderInput || "").trim()
                  }
                  className={`action-btn action-btn--lg ${userTranslationProviderSync.state === "saving" ||
                    !String(userTranslationProviderInput || "").trim()
                    ? "action-btn--disabled"
                    : "action-btn--fx action-btn--primary"
                    }`}
                >
                  <span className="action-btn__content">
                    {userTranslationProviderSync.state === "saving" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      t("literature_save")
                    )}
                  </span>
                </button>

                {Boolean(userTranslationProvider) && (
                  <button
                    type="button"
                    onClick={handleClearUserTranslationProvider}
                    disabled={userTranslationProviderSync.state === "saving"}
                    className={`action-btn action-btn--lg ${userTranslationProviderSync.state === "saving"
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--ghost action-btn--danger"
                      }`}
                  >
                    <span className="action-btn__content">{t("literature_clear")}</span>
                  </button>
                )}
              </div>

              {userTranslationProviderSync.state === "error" &&
                userTranslationProviderSync.message && (
                <div className="text-xs text-red-500">
                  {userTranslationProviderSync.message}
                </div>
              )}
            </div>

            {isSuperAdmin && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <label className="text-sm font-medium text-text-secondary">
                    {t("default_api_key")}
                  </label>
                  <span className="text-xs text-text-tertiary">
                    {t("default_api_key_hint")}
                  </span>
                </div>

                {defaultTranslationApiKeyMasked && (
                  <div className="text-xs text-text-tertiary -mt-1 mb-1">
                    {(t("api_key_saved")) + `: ${defaultTranslationApiKeyMasked}`}
                  </div>
                )}

                <form
                  className="flex items-center gap-2 flex-wrap"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveDefaultTranslationApiKey();
                  }}
                >
                  <input
                    id="settings-default-api-key"
                    name="defaultTranslationApiKey"
                    type="password"
                    value={defaultTranslationApiKeyInput}
                    onChange={(e) => setDefaultTranslationApiKeyInput(e.target.value)}
                    placeholder={t("default_api_key_placeholder")}
                    className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    autoComplete="new-password"
                    spellCheck={false}
                  />

                  <button
                    type="submit"
                    disabled={
                      defaultTranslationApiKeySync.state === "saving" ||
                      !defaultTranslationApiKeyInput.trim()
                    }
                    className={`action-btn action-btn--lg ${defaultTranslationApiKeySync.state === "saving" ||
                      !defaultTranslationApiKeyInput.trim()
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--primary"
                      }`}
                  >
                    <span className="action-btn__content">
                      {defaultTranslationApiKeySync.state === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        t("literature_save")
                      )}
                    </span>
                  </button>

                  {hasDefaultTranslationApiKey && (
                    <button
                      type="button"
                      onClick={handleClearDefaultTranslationApiKey}
                      disabled={defaultTranslationApiKeySync.state === "saving"}
                      className={`action-btn action-btn--lg ${defaultTranslationApiKeySync.state === "saving"
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--ghost action-btn--danger"
                        }`}
                    >
                      <span className="action-btn__content">{t("literature_clear")}</span>
                    </button>
                  )}
                </form>
              </div>
            )}

            {isSuperAdmin && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <label className="text-sm font-medium text-text-secondary">
                    {t("default_model")}
                  </label>
                  <span className="text-xs text-text-tertiary">
                    {t("default_model_hint")}
                  </span>
                </div>

                <div className="text-xs text-text-tertiary -mt-1 mb-1">
                  {(t("model_current")) +
                    `: ${hasDefaultTranslationModel ? defaultTranslationModel : "-"}`}
                  {!hasDefaultTranslationModel &&
                    translationProvider === "bigmodel" &&
                    builtinDefaultTranslationModel
                    ? ` | ${t("model_builtin")}: ${builtinDefaultTranslationModel}`
                    : ""}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    id="settings-default-model"
                    name="defaultTranslationModel"
                    type="text"
                    value={defaultTranslationModelInput}
                    onChange={(e) => setDefaultTranslationModelInput(e.target.value)}
                    placeholder={t("default_model_placeholder")}
                    className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    onClick={handleSaveDefaultTranslationModel}
                    disabled={
                      defaultTranslationModelSync.state === "saving" ||
                      !defaultTranslationModelInput.trim()
                    }
                    className={`action-btn action-btn--lg ${defaultTranslationModelSync.state === "saving" ||
                      !defaultTranslationModelInput.trim()
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--primary"
                      }`}
                  >
                    <span className="action-btn__content">
                      {defaultTranslationModelSync.state === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        t("literature_save")
                      )}
                    </span>
                  </button>

                  {hasDefaultTranslationModel && (
                    <button
                      type="button"
                      onClick={handleClearDefaultTranslationModel}
                      disabled={defaultTranslationModelSync.state === "saving"}
                      className={`group relative inline-flex items-center px-4 h-[42px] rounded-lg text-sm font-medium transition-colors before:content-[''] before:absolute before:inset-0 before:rounded-lg before:pointer-events-none before:transition-transform before:transition-colors ${defaultTranslationModelSync.state === "saving"
                        ? "text-text-secondary cursor-not-allowed before:bg-bg-subtle before:border before:border-border-subtle"
                        : "bg-bg-page border border-border-subtle text-text-tertiary hover:text-red-500 hover:border-red-500/50"
                        }`}
                    >
                      <span className="relative z-10">
                        {t("literature_clear")}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {isSuperAdmin && isDefaultOpenAICompatibleProvider && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <label className="text-sm font-medium text-text-secondary">
                    {t("default_base_url")}
                  </label>
                  <span className="text-xs text-text-tertiary">
                    {t("default_base_url_hint")}
                  </span>
                </div>

                <div className="text-xs text-text-tertiary -mt-1 mb-1">
                  {`Current: ${hasDefaultTranslationBaseUrl ? defaultTranslationBaseUrl : "-"}`}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    id="settings-default-base-url"
                    name="defaultTranslationBaseUrl"
                    type="text"
                    value={defaultTranslationBaseUrlInput}
                    onChange={(e) => setDefaultTranslationBaseUrlInput(e.target.value)}
                    placeholder={t("default_base_url_placeholder")}
                    className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    onClick={handleSaveDefaultTranslationBaseUrl}
                    disabled={
                      defaultTranslationBaseUrlSync.state === "saving" ||
                      !defaultTranslationBaseUrlInput.trim()
                    }
                    className={`action-btn action-btn--lg ${defaultTranslationBaseUrlSync.state === "saving" ||
                      !defaultTranslationBaseUrlInput.trim()
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--primary"
                      }`}
                  >
                    <span className="action-btn__content">
                      {defaultTranslationBaseUrlSync.state === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        t("literature_save")
                      )}
                    </span>
                  </button>

                  {hasDefaultTranslationBaseUrl && (
                    <button
                      type="button"
                      onClick={handleClearDefaultTranslationBaseUrl}
                      disabled={defaultTranslationBaseUrlSync.state === "saving"}
                      className={`action-btn action-btn--lg ${defaultTranslationBaseUrlSync.state === "saving"
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--ghost action-btn--danger"
                        }`}
                    >
                      <span className="action-btn__content">{t("literature_clear")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t("personal_api_key")}
                </label>
                <span className="text-xs text-text-tertiary">
                  {t("personal_api_key_hint")}
                </span>
              </div>

              {hasDefaultTranslationApiKey && !translationApiKeyMasked && (
                <div className="text-xs text-text-tertiary -mt-1 mb-1">
                  {t("personal_api_key_using_default")}
                </div>
              )}

              {translationApiKeyMasked && (
                <div className="text-xs text-text-tertiary -mt-1 mb-1">
                  {(t("api_key_saved")) + `: ${translationApiKeyMasked}`}
                </div>
              )}

              <form
                className="flex items-center gap-2 flex-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTranslationApiKey();
                }}
              >
                <input
                  id="settings-personal-api-key"
                  name="translationApiKey"
                  type="password"
                  value={translationApiKeyInput}
                  onChange={(e) => setTranslationApiKeyInput(e.target.value)}
                  placeholder={t("personal_api_key_placeholder")}
                  className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  autoComplete="new-password"
                  spellCheck={false}
                />

                <button
                  type="submit"
                  disabled={translationApiKeySync.state === "saving" || !translationApiKeyInput.trim()}
                  className={`action-btn action-btn--lg ${translationApiKeySync.state === "saving" ||
                    !translationApiKeyInput.trim()
                    ? "action-btn--disabled"
                    : "action-btn--fx action-btn--primary"
                    }`}
                >
                  <span className="action-btn__content">
                    {translationApiKeySync.state === "saving" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      t("literature_save")
                    )}
                  </span>
                </button>

                {Boolean(translationApiKeyMasked) && (
                  <button
                    type="button"
                    onClick={handleClearTranslationApiKey}
                    disabled={translationApiKeySync.state === "saving"}
                    className={`action-btn action-btn--lg ${translationApiKeySync.state === "saving"
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--ghost action-btn--danger"
                      }`}
                  >
                    <span className="action-btn__content">{t("literature_clear")}</span>
                  </button>
                )}
              </form>
            </div>

            {isEffectiveOpenAICompatibleProviderForUser && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <label className="text-sm font-medium text-text-secondary">
                    {t("personal_base_url")}
                  </label>
                  <span className="text-xs text-text-tertiary">
                    {t("personal_base_url_hint")}
                  </span>
                </div>

                {hasDefaultTranslationBaseUrl && !translationBaseUrl && (
                  <div className="text-xs text-text-tertiary -mt-1 mb-1">
                    {t("personal_base_url_using_default")}
                  </div>
                )}

                {hasDefaultTranslationApiKey && !translationApiKeyMasked && (
                  <div className="text-xs text-amber-600 -mt-1 mb-1">
                    {t("personal_base_url_requires_personal_key")}
                  </div>
                )}

                <div className="text-xs text-text-tertiary -mt-1 mb-1">
                  {`Current: ${translationBaseUrl || "-"}`}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    id="settings-personal-base-url"
                    name="translationBaseUrl"
                    type="text"
                    value={translationBaseUrlInput}
                    onChange={(e) => setTranslationBaseUrlInput(e.target.value)}
                    placeholder={t("personal_base_url_placeholder")}
                    className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    onClick={handleSaveTranslationBaseUrl}
                    disabled={
                      translationBaseUrlSync.state === "saving" || !translationBaseUrlInput.trim()
                    }
                    className={`action-btn action-btn--lg ${translationBaseUrlSync.state === "saving" ||
                      !translationBaseUrlInput.trim()
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--primary"
                      }`}
                  >
                    <span className="action-btn__content">
                      {translationBaseUrlSync.state === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        t("literature_save")
                      )}
                    </span>
                  </button>

                  {Boolean(translationBaseUrl) && (
                    <button
                      type="button"
                      onClick={handleClearTranslationBaseUrl}
                      disabled={translationBaseUrlSync.state === "saving"}
                      className={`action-btn action-btn--lg ${translationBaseUrlSync.state === "saving"
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--ghost action-btn--danger"
                        }`}
                    >
                      <span className="action-btn__content">{t("literature_clear")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t("personal_model")}
                </label>
                <span className="text-xs text-text-tertiary">
                  {t("personal_model_hint")}
                </span>
              </div>

              <div className="text-xs text-text-tertiary -mt-1 mb-1">
                {translationModel
                  ? (t("model_current")) +
                  `: ${translationModel}`
                  : t("personal_model_using_default")}
              </div>

              {hasDefaultTranslationApiKey && !translationApiKeyMasked && (
                <div className="text-xs text-amber-600 -mt-1 mb-1">
                  {t("personal_model_requires_personal_key")}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="settings-personal-model"
                  name="translationModel"
                  type="text"
                  value={translationModelInput}
                  onChange={(e) => setTranslationModelInput(e.target.value)}
                  placeholder={t("personal_model_placeholder")}
                  className="flex-1 min-w-[280px] px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  autoComplete="off"
                  spellCheck={false}
                />

                <button
                  type="button"
                  onClick={handleSaveTranslationModel}
                  disabled={translationModelSync.state === "saving" || !translationModelInput.trim()}
                  className={`action-btn action-btn--lg ${translationModelSync.state === "saving" ||
                    !translationModelInput.trim()
                    ? "action-btn--disabled"
                    : "action-btn--fx action-btn--primary"
                    }`}
                >
                  <span className="action-btn__content">
                    {translationModelSync.state === "saving" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      t("literature_save")
                    )}
                  </span>
                </button>

                {Boolean(translationModel) && (
                  <button
                    type="button"
                    onClick={handleClearTranslationModel}
                    disabled={translationModelSync.state === "saving"}
                    className={`action-btn action-btn--lg ${translationModelSync.state === "saving"
                      ? "action-btn--disabled"
                      : "action-btn--fx action-btn--ghost action-btn--danger"
                      }`}
                  >
                    <span className="action-btn__content">{t("literature_clear")}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 p-4 rounded-xl border border-border-subtle bg-bg-page/30">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {t("literature_translate_test_title")}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {t("literature_translate_test_hint")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestTranslate}
                  disabled={translateTest.state === "loading"}
                  className={`action-btn action-btn--md ${translateTest.state === "loading"
                    ? "action-btn--disabled"
                    : "action-btn--fx action-btn--primary"
                    }`}
                >
                  <span className="action-btn__content">
                    {translateTest.state === "loading" && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    <span>
                      {translateTest.state === "loading"
                        ? t("literature_translate_test_running")
                        : t("literature_translate_test_run")}
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                <div className="flex items-center gap-4 flex-wrap text-text-secondary">
                  {isSuperAdmin && (
                    <label className="inline-flex items-center gap-2 select-none">
                      <input
                        id="settings-translate-test-force-default"
                        name="translateTestForceDefaultKey"
                        type="checkbox"
                        checked={translateTestForceDefaultKey}
                        onChange={(e) => setTranslateTestForceDefaultKey(e.target.checked)}
                      />
                      {t("literature_translate_test_force_default")}
                    </label>
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-text-secondary select-none">
                  <input
                    id="settings-translate-test-bypass-cache"
                    name="translateTestBypassCache"
                    type="checkbox"
                    checked={translateTestBypassCache}
                    onChange={(e) => setTranslateTestBypassCache(e.target.checked)}
                  />
                  {t("literature_translate_test_bypass_cache")}
                </label>
              </div>

              <textarea
                id="settings-translate-test-input"
                name="translateTestInput"
                value={translateTestInput}
                onChange={(e) => setTranslateTestInput(e.target.value)}
                rows={3}
                placeholder={
                  t("literature_translate_test_placeholder")
                }
                autoComplete="off"
                spellCheck={false}
                className="mt-3 w-full px-3 py-2.5 rounded-lg bg-bg-page border border-border-subtle focus:outline-none focus:ring-1 focus:ring-accent text-sm text-text-primary placeholder:text-text-tertiary resize-y"
              />

              {translateTest.state === "done" && (
                <div className="mt-3 text-sm text-text-secondary space-y-2">
                  <div className="text-xs text-text-tertiary">
                    {(t("literature_translate_test_used_key")) +
                      `: ${translateTest.apiKeySource === "user"
                        ? t("literature_translate_test_key_user")
                        : translateTest.apiKeySource === "default"
                          ? t("literature_translate_test_key_default")
                          : t("literature_translate_test_key_none")
	                      }`}
	                    {translateTest.model
	                      ? ` | ${(t("translation_model_short"))}: ${translateTest.model}${translateTest.modelSource
	                        ? ` (${translateTest.modelSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.modelSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : translateTest.modelSource
	                        })`
	                        : ""}`
	                      : ""}
	                    {translateTest.translationProvider
	                      ? ` | ${(t("translation_provider_short"))}: ${translateTest.translationProvider}${translateTest.translationProviderSource
	                        ? ` (${translateTest.translationProviderSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.translationProviderSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : translateTest.translationProviderSource
	                        })`
	                        : ""}`
	                      : ""}
	                    {translateTest.translationBaseUrlHost
	                      ? ` | ${(t("translation_base_url_short"))}: ${translateTest.translationBaseUrlHost}${translateTest.translationBaseUrlSource
	                        ? ` (${translateTest.translationBaseUrlSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.translationBaseUrlSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : t("literature_translate_test_key_none")
	                        })`
	                        : ""}`
	                      : ""}
	                    {translateTest.cached
	                      ? ` | ${t("literature_translate_test_cached")}`
	                      : ""}
	                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {translateTest.translatedText}
                  </div>
                </div>
              )}

              {translateTest.state === "error" && (
                <div className="mt-3 text-sm text-red-500">
                  <div>
                    {(t("literature_translate_test_failed")) +
                      (translateTest.error ? `: ${translateTest.error}` : "")}
                  </div>
                  <div className="mt-1 text-xs text-red-500/90">
                    {(t("literature_translate_test_used_key")) +
                      `: ${translateTest.apiKeySource === "user"
                        ? t("literature_translate_test_key_user")
                        : translateTest.apiKeySource === "default"
                          ? t("literature_translate_test_key_default")
                          : t("literature_translate_test_key_none")
	                      }`}
	                    {translateTest.model
	                      ? ` | ${(t("translation_model_short"))}: ${translateTest.model}${translateTest.modelSource
	                        ? ` (${translateTest.modelSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.modelSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : translateTest.modelSource
	                        })`
	                        : ""}`
	                      : ""}
	                    {translateTest.translationProvider
	                      ? ` | ${(t("translation_provider_short"))}: ${translateTest.translationProvider}${translateTest.translationProviderSource
	                        ? ` (${translateTest.translationProviderSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.translationProviderSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : translateTest.translationProviderSource
	                        })`
	                        : ""}`
	                      : ""}
	                    {translateTest.translationBaseUrlHost
	                      ? ` | ${(t("translation_base_url_short"))}: ${translateTest.translationBaseUrlHost}${translateTest.translationBaseUrlSource
	                        ? ` (${translateTest.translationBaseUrlSource === "user"
	                          ? t("literature_translate_test_key_user")
	                          : translateTest.translationBaseUrlSource === "default"
	                            ? t("literature_translate_test_key_default")
	                            : t("literature_translate_test_key_none")
	                        })`
	                        : ""}`
	                      : ""}
	                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title={t("security")} icon={Lock}>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("currentPassword")}
              </label>
              <input
                id="settings-current-password"
                name="currentPassword"
                type="password"
                value={passwordData.current}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, current: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("newPassword")}
              </label>
              <input
                id="settings-new-password"
                name="newPassword"
                type="password"
                value={passwordData.new}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, new: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("confirmPassword")}
              </label>
              <input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                value={passwordData.confirm}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirm: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="action-btn action-btn--md action-btn--fx action-btn--primary w-full"
            >
              <span className="action-btn__content">{t("saveChanges")}</span>
            </button>
          </form>
        </Section>

        {isSuperAdmin && (
          <div className="md:col-span-2">
            <Section title={t("dataRetention")} icon={Database}>
              {retentionLoading ? (
                <div className="text-sm text-text-secondary">Loading...</div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    {t("retentionHint")}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        {t("logsRetentionDays")}
                      </label>
                      <input
                        id="settings-retention-logs-days"
                        name="logsRetentionDays"
                        type="number"
                        min="1"
                        max="3650"
                        value={retentionForm.logsDays}
                        onChange={(e) =>
                          setRetentionForm((prev) => ({
                            ...prev,
                            logsDays: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        disabled={
                          retentionLoading ||
                          retentionSaving ||
                          retentionRunning
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        {t("requestsRetentionDays")}
                      </label>
                      <input
                        id="settings-retention-requests-days"
                        name="requestsRetentionDays"
                        type="number"
                        min="1"
                        max="3650"
                        value={retentionForm.requestsDays}
                        onChange={(e) =>
                          setRetentionForm((prev) => ({
                            ...prev,
                            requestsDays: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        disabled={
                          retentionLoading ||
                          retentionSaving ||
                          retentionRunning
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-secondary">
                    <div>
                      <div className="text-xs text-text-tertiary mb-1">
                        {t("lastCleanupAt")}
                      </div>
                      <div className="text-text-primary">
                        {retention?.lastCleanupAt
                          ? new Date(retention.lastCleanupAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-tertiary mb-1">
                        {t("nextCleanupAt")}
                      </div>
                      <div className="text-text-primary">
                        {retention?.nextCleanupAt
                          ? new Date(retention.nextCleanupAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {retention?.deleted && (
                    <div className="text-sm text-text-secondary bg-bg-page/50 border border-border-subtle rounded-lg p-3">
                      <div className="text-xs text-text-tertiary mb-1">
                        {retention?.ranAt
                          ? new Date(retention.ranAt).toLocaleString()
                          : ""}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <span>Logs: {retention.deleted.logs}</span>
                        <span>Requests: {retention.deleted.requests}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleRetentionSave}
                      className={`action-btn action-btn--md ${retentionLoading || retentionSaving || retentionRunning
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--primary"
                        }`}
                      disabled={
                        retentionLoading || retentionSaving || retentionRunning
                      }
                    >
                      <span className="action-btn__content">
                        <Check size={16} />
                        {retentionSaving
                          ? `${t("saveChanges")}...`
                          : t("saveChanges")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRetentionRunNow}
                      className={`action-btn action-btn--md ${retentionLoading || retentionSaving || retentionRunning
                        ? "action-btn--disabled"
                        : "action-btn--fx action-btn--ghost"
                        }`}
                      disabled={
                        retentionLoading || retentionSaving || retentionRunning
                      }
                    >
                      <span className="action-btn__content">
                        <Trash2 size={16} />
                        <span>
                          {retentionRunning
                            ? `${t("runCleanupNow")}...`
                            : t("runCleanupNow")}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        containerRef={containerRef}
        type={toast.type}
      />
    </div>
  );
};

export default Settings;
