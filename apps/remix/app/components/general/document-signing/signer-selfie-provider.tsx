import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

export type SignerSelfieContextValue = {
  token: string;
  isSelfieRequired: boolean;
  hasSelfie: boolean;
  setHasSelfie: (hasSelfie: boolean) => void;
};

const SignerSelfieContext = createContext<SignerSelfieContextValue | null>(null);

export type SignerSelfieProviderProps = {
  token: string;
  isSelfieRequired: boolean;
  initialHasSelfie: boolean;
  children: ReactNode;
};

export const SignerSelfieProvider = ({
  token,
  isSelfieRequired,
  initialHasSelfie,
  children,
}: SignerSelfieProviderProps) => {
  const [hasSelfie, setHasSelfie] = useState(initialHasSelfie);

  return (
    <SignerSelfieContext.Provider value={{ token, isSelfieRequired, hasSelfie, setHasSelfie }}>
      {children}
    </SignerSelfieContext.Provider>
  );
};

/**
 * Only the token signing route mounts this provider. Embeds and direct templates
 * render the complete dialog without it, which leaves the selfie step disabled.
 */
export const useOptionalSignerSelfieContext = () => useContext(SignerSelfieContext);
