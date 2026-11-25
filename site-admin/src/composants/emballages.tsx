/**
 * Éditeur d'emballages : une ligne par élément (nom, niveau, partie, bac, source), avec un commentaire.
 * Ce qui est enregistré ici devient la consigne « Vérifié par Proserpine » affichée dans l'app.
 */
import { BACS, COUCHES, MAX_EMBALLAGES, NIVEAUX, SOURCES, type Emballage } from '../services/base';
import { Icone } from './ui';

export const emballageVide = (premier: boolean): Emballage => ({
  niveau: 'unite',
  couche: premier ? 'contenant' : 'autre',
  nom: '',
  bac: null,
  source: 'doute',
  commentaire: null,
});

export function EditeurEmballages({ valeur, onChange }: { valeur: Emballage[]; onChange: (v: Emballage[]) => void }) {
  const modifier = (i: number, modif: Partial<Emballage>) => onChange(valeur.map((e, j) => (j === i ? { ...e, ...modif } : e)));

  return (
    <>
      {valeur.length > 0 ? (
        <table className="edit">
          <thead>
            <tr>
              <th style={{ width: '27%' }}>Élément</th>
              <th>Niveau</th>
              <th>Partie</th>
              <th>Bac</th>
              <th>Source</th>
              <th style={{ width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {valeur.map((e, i) => [
              <tr key={`l${i}`}>
                <td>
                  <input
                    className={`cel${e.nom.trim() ? '' : ' invalide'}`}
                    value={e.nom}
                    maxLength={100}
                    placeholder="Ex. : bouteille"
                    aria-label={`Élément ${i + 1}`}
                    onChange={(ev) => modifier(i, { nom: ev.target.value })}
                  />
                </td>
                <td>
                  <select className="cel" value={e.niveau} aria-label="Niveau" onChange={(ev) => modifier(i, { niveau: ev.target.value as Emballage['niveau'] })}>
                    {NIVEAUX.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.libelle}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="cel" value={e.couche} aria-label="Partie" onChange={(ev) => modifier(i, { couche: ev.target.value as Emballage['couche'] })}>
                    {COUCHES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.libelle}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="cel"
                    value={e.bac ?? ''}
                    aria-label="Bac"
                    onChange={(ev) => {
                      const b = (ev.target.value || null) as Emballage['bac'];
                      // Sans bac, la source devient « Doute » ; en choisissant un bac, un « Doute » devient « Moi ».
                      modifier(i, b ? { bac: b, source: e.source === 'doute' ? 'moi' : e.source } : { bac: null, source: 'doute' });
                    }}
                  >
                    {BACS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.court}
                      </option>
                    ))}
                    <option value="">Je ne sais pas</option>
                  </select>
                </td>
                <td>
                  <select className="cel" value={e.source} aria-label="Source" onChange={(ev) => modifier(i, { source: ev.target.value as Emballage['source'] })}>
                    {SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.libelle}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="btn-icone danger" title="Retirer cet élément" aria-label={`Retirer l'élément ${i + 1}`} onClick={() => onChange(valeur.filter((_, j) => j !== i))}>
                    <Icone nom="delete_outline" />
                  </button>
                </td>
              </tr>,
              <tr key={`c${i}`} className="ligne-com">
                <td colSpan={6}>
                  <input
                    className="cel com"
                    value={e.commentaire ?? ''}
                    maxLength={300}
                    placeholder="Commentaire (facultatif) : d'où vient l'information, doute…"
                    aria-label={`Commentaire de l'élément ${i + 1}`}
                    onChange={(ev) => modifier(i, { commentaire: ev.target.value || null })}
                  />
                </td>
              </tr>,
            ])}
          </tbody>
        </table>
      ) : (
        <div className="info">
          <Icone nom="info" taille={18} />
          Aucun emballage : la fiche du produit garde le calcul d'Open Food Facts.
        </div>
      )}
      {valeur.length < MAX_EMBALLAGES ? (
        <button className="btn" style={{ marginTop: 12 }} onClick={() => onChange([...valeur, emballageVide(valeur.length === 0)])}>
          <Icone nom="add" />
          Ajouter un élément
        </button>
      ) : (
        <p className="aide">{MAX_EMBALLAGES} éléments au plus.</p>
      )}
      <p className="aide">Seuls les éléments avec un bac s'affichent dans l'app. « Je ne sais pas » reste en attente.</p>
    </>
  );
}
