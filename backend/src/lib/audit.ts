import prisma from './prismaClient';

interface AuditParams {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: object;
  newValues?: object;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await prisma.md_audit_logs.create({
    data: {
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : undefined,
      new_values: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : undefined,
    },
  });
}
