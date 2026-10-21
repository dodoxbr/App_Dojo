import { PLATFORM_PLACEHOLDER } from "./constants";
import { platformVars, TermsView } from "./terms-view";

// Public page (no sign-in needed): the person reads the terms before creating the account.
export default function TermosPage() {
  return <TermsView vars={{ ...PLATFORM_PLACEHOLDER, ...platformVars() }} />;
}
