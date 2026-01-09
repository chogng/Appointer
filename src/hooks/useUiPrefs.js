import { useContext } from "react";
import { UiPrefsContext } from "../context/ui-prefs-context";

export const useUiPrefs = () => useContext(UiPrefsContext);

