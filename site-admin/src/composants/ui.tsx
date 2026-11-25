/** Petits éléments d'interface partagés : fenêtre de confirmation, messages, icône. */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export const Icone = ({ nom, taille }: { nom: string; taille?: number }) => (
  <span className="i" aria-hidden="true" style={taille ? { fontSize: taille } : undefined}>
    {nom}
  </span>
);

type Confirmation = { titre: string; message: string; confirmer: string; danger?: boolean; onConfirmer: () => void };
type Ui = { confirmer: (c: Confirmation) => void; toast: (message: string, erreur?: boolean) => void };

const Contexte = createContext<Ui | null>(null);

export function useUi(): Ui {
  const ui = useContext(Contexte);
  if (!ui) throw new Error('useUi hors de <FournisseurUi>');
  return ui;
}

export function FournisseurUi({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; erreur: boolean }[]>([]);

  const toast = useCallback((message: string, erreur = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, erreur }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Contexte.Provider value={{ confirmer: setConfirmation, toast }}>
      {children}
      {confirmation ? (
        <div className="voile" onClick={() => setConfirmation(null)}>
          <div className="fenetre" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmation.titre}</h3>
            <p>{confirmation.message}</p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirmation(null)} autoFocus>
                Annuler
              </button>
              <button
                className={`btn ${confirmation.danger ? 'dp' : 'p'}`}
                onClick={() => {
                  setConfirmation(null);
                  confirmation.onConfirmer();
                }}
              >
                {confirmation.confirmer}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.erreur ? ' erreur' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export const Chargement = ({ texte = 'Chargement…' }: { texte?: string }) => (
  <div className="chargement">
    <Icone nom="hourglass_top" />
    {texte}
  </div>
);
