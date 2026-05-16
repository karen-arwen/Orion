import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "./api.js";

/**
 * Liga o token do Clerk ao API client.
 * Renderiza nada — chame uma vez perto da raiz dentro de <ClerkProvider>.
 */
export function ClerkTokenBridge(): null {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
  }, [getToken, isSignedIn]);

  return null;
}
