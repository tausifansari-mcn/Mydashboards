// Structured "what did we do about this" tracker, shared across every AI Quality detection
// feature that flags individual cases (Social Threat, Potential Scam, Fraud Call, TNI). One
// table keyed by (feature, lead_id, client_id) so each flagged case — or, for TNI, each agent —
// carries its own action independent of the others, instead of every feature growing its own
// bespoke comments table (see TNI's earlier tni_manager_comments, which this doesn't replace).
import { querySource } from './sourceDb';

export type CaseActionFeature = 'social_threat' | 'potential_scam' | 'fraud_call' | 'tni';

export interface CaseActionRow {
  feature:    CaseActionFeature;
  lead_id:    string;
  client_id:  string;
  action:     string;
  note:       string;
  updated_by: string;
  updated_at: string;
}

async function ensureCaseActionsTable(): Promise<void> {
  // No DEFAULT on the TEXT column — MySQL 8 rejects `TEXT DEFAULT ''` outright, and NULL is
  // already handled on read (COALESCE-equivalent via `?? ''` below).
  await querySource(`
    CREATE TABLE IF NOT EXISTS db_audit.case_actions (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      feature    VARCHAR(30)  NOT NULL,
      lead_id    VARCHAR(50)  NOT NULL,
      client_id  VARCHAR(50)  NOT NULL DEFAULT '',
      action     VARCHAR(50)  NOT NULL DEFAULT 'no_action',
      note       TEXT,
      updated_by VARCHAR(100) DEFAULT '',
      updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_feature_lead_client (feature, lead_id, client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function getCaseActions(feature: CaseActionFeature, clientId?: string): Promise<CaseActionRow[]> {
  await ensureCaseActionsTable();
  const extra = clientId ? ' AND client_id = ?' : '';
  const params: string[] = clientId ? [feature, clientId] : [feature];
  const rows = await querySource<{
    feature: string; lead_id: string; client_id: string; action: string; note: string | null; updated_by: string | null; updated_at: Date;
  }>(`
    SELECT feature, lead_id, client_id, action, note, updated_by, updated_at
    FROM db_audit.case_actions
    WHERE feature = ?${extra}
  `, params);
  return rows.map((r) => ({
    feature:    r.feature as CaseActionFeature,
    lead_id:    String(r.lead_id),
    client_id:  String(r.client_id),
    action:     String(r.action),
    note:       r.note ?? '',
    updated_by: r.updated_by ?? '',
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : '',
  }));
}

export async function upsertCaseAction(
  feature: CaseActionFeature, leadId: string, clientId: string, action: string, note: string, updatedBy: string,
): Promise<void> {
  await ensureCaseActionsTable();
  await querySource(`
    INSERT INTO db_audit.case_actions (feature, lead_id, client_id, action, note, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE action = VALUES(action), note = VALUES(note), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP
  `, [feature, leadId, clientId, action, note, updatedBy]);
}
