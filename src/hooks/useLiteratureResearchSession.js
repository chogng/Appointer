import { useContext } from "react";
import { LiteratureResearchSessionContext } from "../context/literature-research-session-context";

export const useLiteratureResearchSession = () =>
  useContext(LiteratureResearchSessionContext);

