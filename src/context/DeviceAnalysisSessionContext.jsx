import { useMemo, useState } from "react";
import { DeviceAnalysisSessionContext } from "./device-analysis-session-context";

export const DeviceAnalysisSessionProvider = ({ children }) => {
  const [rawData, setRawData] = useState([]);
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [extractionErrors, setExtractionErrors] = useState([]);

  // Device analysis SS (session state; defaults overridden by user settings if loaded).
  const [ssMethod, setSsMethod] = useState("auto"); // auto | manual | idWindow | legacy
  const [ssDiagnosticsEnabled, setSsDiagnosticsEnabled] = useState(true);
  const [ssShowFitLine, setSsShowFitLine] = useState(true);
  const [ssIdWindow, setSsIdWindow] = useState({
    low: "1e-11",
    high: "1e-9",
  });
  // { [fileId]: { [seriesId]: { x1, x2 } } }
  const [ssManualRanges, setSsManualRanges] = useState({});

  const value = useMemo(
    () => ({
      rawData,
      setRawData,
      selectedPreviewFileId,
      setSelectedPreviewFileId,
      processedData,
      setProcessedData,
      extractionErrors,
      setExtractionErrors,
      ssMethod,
      setSsMethod,
      ssDiagnosticsEnabled,
      setSsDiagnosticsEnabled,
      ssShowFitLine,
      setSsShowFitLine,
      ssIdWindow,
      setSsIdWindow,
      ssManualRanges,
      setSsManualRanges,
    }),
    [
      extractionErrors,
      processedData,
      rawData,
      selectedPreviewFileId,
      ssDiagnosticsEnabled,
      ssIdWindow,
      ssManualRanges,
      ssMethod,
      ssShowFitLine,
    ],
  );

  return (
    <DeviceAnalysisSessionContext.Provider value={value}>
      {children}
    </DeviceAnalysisSessionContext.Provider>
  );
};
